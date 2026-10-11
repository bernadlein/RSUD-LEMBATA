import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { createEmptyWorkspace } from '../app/domain/seed'

const admin = '10000000-0000-4000-8000-000000000001', planner = '10000000-0000-4000-8000-000000000002'
const viewer = '10000000-0000-4000-8000-000000000003', outsider = '10000000-0000-4000-8000-000000000004'
let db: PGlite, workspaceId: string, otherId: string, activePath: string, unusedPath: string
const migration = () => readFile(new URL('../supabase/migrations/003_doctor_photos.sql', import.meta.url), 'utf8')
async function actor(id: string, role = 'authenticated') {
  await db.exec('reset role; set role ' + role)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
}
async function insert(path: string) {
  return db.query("insert into storage.objects(bucket_id,name) values('rd-doctor-photos',$1) returning id", [path])
}

describe('private doctor photo storage policies', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;" +
      "create schema auth; create schema storage;" +
      "create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);" +
      "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;" +
      "create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);" +
      "create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));" +
      "alter table storage.objects enable row level security;" +
      "grant usage on schema auth,public,storage to anon,authenticated,service_role;" +
      "grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;" +
      "insert into auth.users values" +
      "('" + admin + "','admin@example.test',now()),('" + planner + "','planner@example.test',now())," +
      "('" + viewer + "','viewer@example.test',now()),('" + outsider + "','other@example.test',now());",
    )
    await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql', import.meta.url), 'utf8'))
    await db.exec(await migration())
    await actor(admin)
    workspaceId = (await db.query<{ id: string }>('select public.rd_create_workspace($1,$2::jsonb) as id', ['Hospital', JSON.stringify(createEmptyWorkspace())])).rows[0]!.id
    await db.query('select public.rd_add_member($1,$2,$3)', [workspaceId, 'planner@example.test', 'planner'])
    await db.query('select public.rd_add_member($1,$2,$3)', [workspaceId, 'viewer@example.test', 'viewer'])
    activePath = workspaceId + '/doctor-01/20000000-0000-4000-8000-000000000001.jpg'
    unusedPath = workspaceId + '/doctor-01/20000000-0000-4000-8000-000000000002.jpg'
    await insert(activePath); await insert(unusedPath)
    const w = createEmptyWorkspace(); w.doctors[0]!.photoPath = activePath
    await actor(admin, 'service_role')
    await db.query('select public.rd_save_workspace($1,$2::jsonb,0,$3,$4,true)', [workspaceId, JSON.stringify(w), 'Set photo', admin])
    await actor(outsider)
    otherId = (await db.query<{ id: string }>('select public.rd_create_workspace($1,$2::jsonb) as id', ['Other', JSON.stringify(createEmptyWorkspace())])).rows[0]!.id
    await insert(otherId + '/doctor-01/20000000-0000-4000-8000-000000000003.jpg')
    await db.exec('reset role')
    await db.query("insert into storage.objects(bucket_id,name) values('rd-doctor-photos','not-a-uuid/doctor-01/invalid.jpg')")
  }, 30000)
  afterAll(async () => { await db?.close() })

  it('keeps the bucket private with the size and MIME restrictions', async () => {
    await db.exec('reset role')
    const row = (await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>("select public,file_size_limit,allowed_mime_types from storage.buckets where id='rd-doctor-photos'")).rows[0]!
    expect(row.public).toBe(false)
    expect(Number(row.file_size_limit)).toBe(307200)
    expect(row.allowed_mime_types).toEqual(['image/jpeg'])
  })

  it('lets workspace members read their own team while excluding other facilities and anonymous users', async () => {
    for (const user of [admin, planner, viewer]) {
      await actor(user)
      const rows = (await db.query<{ name: string }>('select name from storage.objects')).rows
      expect(rows.map(r => r.name).sort()).toEqual([activePath, unusedPath].sort())
    }
    await actor(outsider)
    const others = (await db.query<{ name: string }>('select name from storage.objects')).rows
    expect(others).toHaveLength(1)
    expect(others[0]!.name.startsWith(otherId + '/')).toBe(true)
    await actor('', 'anon')
    expect((await db.query('select name from storage.objects')).rows).toHaveLength(0)
  })

  it('permits admin uploads only within their own workspace and with valid image paths', async () => {
    await actor(admin)
    const image = '/doctor-02/20000000-0000-4000-8000-000000000004.jpg'
    expect((await insert(workspaceId + image)).rows).toHaveLength(1)
    await expect(insert(otherId + image)).rejects.toThrow('row-level security')
    await expect(insert(workspaceId + image.replace('.jpg', '.svg'))).rejects.toThrow('row-level security')
    await expect(insert('invalid/doctor-01/file.jpg')).rejects.toThrow('row-level security')
    for (const user of [planner, viewer]) {
      await actor(user)
      await expect(insert(workspaceId + '/doctor-01/20000000-0000-4000-8000-000000000009.jpg')).rejects.toThrow('row-level security')
    }
  })

  it('forbids overwriting existing objects and prevents non-admin deletion', async () => {
    await actor(admin)
    expect((await db.query('update storage.objects set name=$1 where name=$2 returning id', [unusedPath, activePath])).rows).toHaveLength(0)
    await actor(planner)
    expect((await db.query('delete from storage.objects where name=$1 returning id', [activePath])).rows).toHaveLength(0)
  })

  it('discards an unused upload while protecting the image currently referenced by a doctor', async () => {
    await actor(admin)
    expect((await db.query('delete from storage.objects where name=$1 returning id', [activePath])).rows).toHaveLength(0)
    expect((await db.query('delete from storage.objects where name=$1 returning id', [unusedPath])).rows).toHaveLength(1)
    expect((await db.query('select id from storage.objects where name=$1', [activePath])).rows).toHaveLength(1)
  })

  it('can reapply the migration without deleting uploaded images or the current reference', async () => {
    await db.exec('reset role')
    const before = (await db.query('select id,name from storage.objects order by name')).rows
    await db.exec(await migration())
    expect((await db.query('select id,name from storage.objects order by name')).rows).toEqual(before)
    await actor(viewer)
    const row = (await db.query<{ data: { doctors: { photoPath: string }[] } }>('select data from public.rd_workspaces where id=$1', [workspaceId])).rows[0]!
    expect(row.data.doctors[0]!.photoPath).toBe(activePath)
  })

  it('explains the missing base migration before touching storage configuration', async () => {
    const empty = new PGlite()
    try {
      await expect(empty.exec(await migration())).rejects.toThrow('001_initial.sql')
    } finally { await empty.close() }
  })
})
