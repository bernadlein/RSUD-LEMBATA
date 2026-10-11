import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { createDemoWorkspace } from '../app/domain/seed'
import { cloneWorkspace } from '../app/domain/commands'
import type { Workspace } from '../app/domain/types'

const admin = '10000000-0000-4000-8000-000000000001'
const planner = '10000000-0000-4000-8000-000000000002'
const viewer = '10000000-0000-4000-8000-000000000003'
const outsider = '10000000-0000-4000-8000-000000000004'
let db: PGlite, workspaceId: string
async function actor(id: string, role = 'authenticated') {
  await db.exec(`reset role; set role ${role};`)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
}
async function save(data: Workspace, revision: number, actorId = planner, administration = false) {
  await actor(actorId, 'service_role')
  return db.query<{ revision: number }>('select public.rd_save_workspace($1,$2::jsonb,$3,$4,$5,$6) as revision', [workspaceId, JSON.stringify(data), revision, 'Test perubahan', actorId, administration])
}
describe('Supabase migration on embedded PostgreSQL', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated,service_role;
      insert into auth.users values
      ('${admin}','admin@example.test',now()),('${planner}','planner@example.test',now()),
      ('${viewer}','viewer@example.test',now()),('${outsider}','outsider@example.test',now());
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql', import.meta.url), 'utf8'))
    await actor(admin)
    const result = await db.query<{ id: string }>('select public.rd_create_workspace($1,$2::jsonb) as id', ['Contoh', JSON.stringify(createDemoWorkspace())])
    workspaceId = result.rows[0]!.id
    await db.query('select public.rd_add_member($1,$2,$3)', [workspaceId, 'planner@example.test', 'planner'])
    await db.query('select public.rd_add_member($1,$2,$3)', [workspaceId, 'viewer@example.test', 'viewer'])
  }, 30000)
  afterAll(async () => { await db?.close() })
  it('exposes the workspace to members and isolates an unrelated account', async () => {
    await actor(viewer)
    expect((await db.query('select id from public.rd_workspaces')).rows).toHaveLength(1)
    await actor(outsider)
    expect((await db.query('select id from public.rd_workspaces')).rows).toHaveLength(0)
    expect((await db.query('select user_id from public.rd_members')).rows).toHaveLength(0)
  })
  it('prevents direct table updates and direct save RPC calls by browser users', async () => {
    await actor(planner)
    await expect(db.query('update public.rd_workspaces set revision=900 where id=$1', [workspaceId])).rejects.toThrow('permission denied')
    await expect(db.query('select public.rd_save_workspace($1,$2::jsonb,0,$3,$4,false)', [workspaceId, JSON.stringify(createDemoWorkspace()), 'Direct bypass', planner])).rejects.toThrow('permission denied')
  })
  it('rejects viewer writes and planner administrative writes even from the API role', async () => {
    await expect(save(createDemoWorkspace(), 0, viewer)).rejects.toThrow('tidak boleh')
    await expect(save(createDemoWorkspace(), 0, planner, true)).rejects.toThrow('admin')
  })
  it('independently protects master metadata and frozen dates', async () => {
    const metadata = createDemoWorkspace(); metadata.settings.minGapHours = 0
    await expect(save(metadata, 0)).rejects.toThrow('Master')
    const frozen = createDemoWorkspace(); frozen.plans['2026-10']!.assignments['doctor-02']!['2026-10-01'] = 'PI'
    await expect(save(frozen, 0)).rejects.toThrow('riwayat')
  })
  it('commits a change and refuses a second write with the stale revision', async () => {
    const data = createDemoWorkspace(); data.plans['2026-10']!.assignments['doctor-02']!['2026-10-30'] = 'L'
    expect((await save(data, 0)).rows[0]!.revision).toBe(1)
    await expect(save(createDemoWorkspace(), 0)).rejects.toThrow('Data berubah')
    const row = (await db.query<{ data: Workspace; revision: number }>('select data,revision from public.rd_workspaces where id=$1', [workspaceId])).rows[0]!
    expect(row.revision).toBe(1); expect(row.data.plans['2026-10']!.assignments['doctor-02']!['2026-10-30']).toBe('L')
    const log = (await db.query<{ actor_email: string }>('select actor_email from public.rd_audit where workspace_id=$1 order by created_at desc limit 1', [workspaceId])).rows[0]!
    expect(log.actor_email).toBe('planner@example.test')
  })
  it('blocks updates to a finalized month', async () => {
    const locked = createDemoWorkspace(); locked.plans['2026-10']!.locked = true
    expect((await save(locked, 1, admin, true)).rows[0]!.revision).toBe(2)
    const edit = cloneWorkspace(locked); edit.plans['2026-10']!.assignments['doctor-02']!['2026-10-30'] = 'L'
    await expect(save(edit, 2)).rejects.toThrow('dikunci')
  })
  it('keeps the final admin and prevents member administration by a planner', async () => {
    await actor(planner)
    await expect(db.query('select public.rd_add_member($1,$2,$3)', [workspaceId, 'outsider@example.test', 'admin'])).rejects.toThrow('Hanya admin')
    await actor(admin)
    await expect(db.query('select public.rd_remove_member($1,$2)', [workspaceId, admin])).rejects.toThrow('Admin terakhir')
    await expect(db.query('select public.rd_add_member($1,$2,$3)', [workspaceId, 'admin@example.test', 'viewer'])).rejects.toThrow('minimal satu admin')
  })
  it('rejects a malformed document before creating a workspace', async () => {
    await actor(outsider)
    await expect(db.query('select public.rd_create_workspace($1,$2::jsonb)', ['Rusak', '{}'])).rejects.toThrow('Format data')
  })
})
