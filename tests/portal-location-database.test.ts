import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { createEmptyWorkspace } from '../app/domain/seed'
import { createMonth } from '../app/domain/commands'
import { monthDates } from '../app/domain/calendar'
import { buildPublicHospital, emptyPortalDraft, type PublicHospital } from '../app/domain/hospital-portal'
import type { Workspace } from '../app/domain/types'

const admin = '70000000-0000-4000-8000-000000000001', planner = '70000000-0000-4000-8000-000000000002'
const viewer = '70000000-0000-4000-8000-000000000003', outsider = '70000000-0000-4000-8000-000000000004'
const newsId = '70000000-0000-4000-8000-000000000005'
let db: PGlite, workspaceId: string, otherId: string, today: string, token: string, original: Workspace
async function actor(id: string, role = 'authenticated') {
  await db.exec('reset role; set role ' + role)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
}
const migration = () => readFile(new URL('../supabase/migrations/004_portal_location.sql', import.meta.url), 'utf8')
async function mark(options: { action?: string; latitude?: number; longitude?: number; accuracy?: number; captured?: string; user?: string; qr?: string } = {}) {
  await actor(options.user ?? viewer)
  return (await db.query<{ entry: Record<string, unknown> }>('select public.rd_mark_attendance($1,$2,$3,$4::date,$5::float8,$6::float8,$7::float8,$8::timestamptz) as entry',
    [workspaceId, options.qr ?? token, options.action ?? 'masuk', today, options.latitude ?? 0, options.longitude ?? 0, options.accuracy ?? 20, options.captured ?? new Date().toISOString()])).rows[0]!.entry
}
async function saveDraft() {
  const draft = emptyPortalDraft()
  draft.scheduleMonth = today.slice(0, 7)
  draft.news = [
    { id: newsId, title: 'Public news', summary: '', content: 'Public article', date: today, published: true },
    { id: admin, title: 'PRIVATE_DRAFT', summary: '', content: 'PRIVATE_DRAFT_CONTENT', date: today, published: false },
  ]
  await actor(admin)
  await db.query('select public.rd_save_portal_draft($1,$2::jsonb,0)', [workspaceId, JSON.stringify(draft)])
  return draft
}
async function publish(data: unknown, expected = 1, actorId = admin) {
  await actor('', 'service_role')
  return db.query('select public.rd_publish_hospital_portal($1,$2,$3::jsonb,0,$4)', [workspaceId, actorId, JSON.stringify(data), expected])
}

describe('published information and mandatory attendance location', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth;" +
      "create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);" +
      "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;" +
      "grant usage on schema auth,public to anon,authenticated,service_role;" +
      "insert into auth.users values('" + admin + "','admin@example.test',now()),('" + planner + "','planner@example.test',now())," +
      "('" + viewer + "','doctor@example.test',now()),('" + outsider + "','other@example.test',now());")
    for (const name of ['001_initial.sql', '002_attendance.sql', '004_portal_location.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'))
    }
    const clock = (await db.query<{ date: string; hour: number }>("select to_char(clock_timestamp() at time zone 'Asia/Makassar','YYYY-MM-DD') as date, extract(hour from clock_timestamp() at time zone 'Asia/Makassar')::integer as hour")).rows[0]!
    today = clock.date
    const hh = (n: number) => String(n % 24).padStart(2, '0') + ':00'
    let w = createEmptyWorkspace()
    w.doctors[0]!.phone = 'PRIVATE_DOCTOR_PHONE'; w.settings.directorNip = 'PRIVATE_DIRECTOR_NIP'
    w.shifts.push({ code: 'T8', label: 'Dinas uji', unit: 'igd', kind: 'custom', start: hh(clock.hour), end: hh(clock.hour + 8), durationOverride: null, active: true })
    w = createMonth(w, today.slice(0, 7), 'admin')
    for (const d of w.doctors) for (const date of monthDates(today.slice(0, 7))) w.plans[today.slice(0, 7)]!.assignments[d.id]![date] = 'L'
    w.plans[today.slice(0, 7)]!.assignments['doctor-01']![today] = 'T8'
    w.plans[today.slice(0, 7)]!.assignments['doctor-02']![today] = 'T8'
    w.plans[today.slice(0, 7)]!.locked = true
    original = w
    await actor(admin)
    workspaceId = (await db.query<{ id: string }>('select public.rd_create_workspace($1,$2::jsonb) as id', ['Hospital', JSON.stringify(w)])).rows[0]!.id
    await db.query('select public.rd_add_member($1,$2,$3)', [workspaceId, 'planner@example.test', 'planner'])
    await db.query('select public.rd_add_member($1,$2,$3)', [workspaceId, 'doctor@example.test', 'viewer'])
    await actor(outsider)
    otherId = (await db.query<{ id: string }>('select public.rd_create_workspace($1,$2::jsonb) as id', ['Other', JSON.stringify(createEmptyWorkspace())])).rows[0]!.id
  }, 30000)
  beforeEach(async () => {
    await db.exec('reset role; truncate public.rd_attendance, public.rd_doctor_accounts, public.rd_portal_drafts, public.rd_portal_publications, public.rd_attendance_locations')
    await actor(admin)
    await db.query('select public.rd_bind_doctor_account($1,$2,$3)', [workspaceId, 'doctor-01', viewer])
    token = (await db.query<{ token: string }>('select public.rd_get_attendance_qr($1,false) as token', [workspaceId])).rows[0]!.token
    await db.query('select public.rd_save_attendance_location($1,0::float8,0::float8,300,150,0)', [workspaceId])
  })
  afterAll(async () => { await db?.close() })

  it('exposes only an explicitly published snapshot to guests and strips extra nested fields', async () => {
    await actor('', 'anon')
    expect((await db.query<{ data: unknown }>('select public.rd_read_public_hospital($1) as data', [workspaceId])).rows[0]!.data).toBeNull()
    const draft = await saveDraft()
    const publicData = buildPublicHospital(original, draft, workspaceId, new Date().toISOString())
    const payload = { ...publicData, audit: 'PRIVATE_AUDIT', doctors: publicData.doctors.map(d => ({ ...d, phone: 'PRIVATE_NESTED_PHONE', leave: 'PRIVATE_LEAVE' })) }
    await publish(payload)
    await actor('', 'anon')
    const published = (await db.query<{ data: PublicHospital }>('select public.rd_read_public_hospital($1) as data', [workspaceId])).rows[0]!.data
    expect(published.news).toHaveLength(1)
    expect(published.schedule.rows).toHaveLength(2)
    for (const secret of ['PRIVATE_DOCTOR_PHONE', 'PRIVATE_DIRECTOR_NIP', 'PRIVATE_DRAFT', 'PRIVATE_AUDIT', 'PRIVATE_NESTED_PHONE', 'PRIVATE_LEAVE']) expect(JSON.stringify(published)).not.toContain(secret)
    await expect(db.query('select data from public.rd_workspaces')).rejects.toThrow('permission denied')
    await expect(db.query('select data from public.rd_portal_drafts')).rejects.toThrow('permission denied')
    await expect(db.query('select latitude from public.rd_attendance_locations')).rejects.toThrow('permission denied')
  })

  it('restricts draft administration and blocks browser callers from the publication writer', async () => {
    await saveDraft()
    const payload = buildPublicHospital(original, emptyPortalDraft(), workspaceId, new Date().toISOString())
    for (const user of [planner, viewer, outsider]) {
      await actor(user)
      expect((await db.query('select data from public.rd_portal_drafts')).rows).toHaveLength(0)
      await expect(db.query('select public.rd_save_portal_draft($1,$2::jsonb,0)', [workspaceId, JSON.stringify(emptyPortalDraft())])).rejects.toThrow('Hanya admin')
    }
    await actor(admin)
    await expect(db.query('select public.rd_publish_hospital_portal($1,$2,$3::jsonb,0,1)', [workspaceId, admin, JSON.stringify(payload)])).rejects.toThrow('permission denied')
    await expect(publish(payload, 1, outsider)).rejects.toThrow('admin fasilitas')
  })

  it('checks draft revisions and withdraws the public snapshot without deleting the draft', async () => {
    const draft = await saveDraft(), payload = buildPublicHospital(original, draft, workspaceId, new Date().toISOString())
    await expect(publish(payload, 0)).rejects.toThrow('berubah')
    await publish(payload)
    await actor(admin)
    await expect(db.query('select public.rd_save_portal_draft($1,$2::jsonb,0)', [workspaceId, JSON.stringify(draft)])).rejects.toThrow('berubah')
    await db.query('select public.rd_unpublish_hospital_portal($1)', [workspaceId])
    expect((await db.query('select data from public.rd_portal_drafts')).rows).toHaveLength(1)
    await actor('', 'anon')
    expect((await db.query<{ data: unknown }>('select public.rd_read_public_hospital($1) as data', [workspaceId])).rows[0]!.data).toBeNull()
  })

  it('allows nearby check-in and check-out and preserves first timestamps and distance evidence', async () => {
    const first = await mark(), duplicate = await mark({ latitude: 0.0002, accuracy: 30 })
    expect(first.check_in_distance_meters).toBe(0)
    expect(duplicate.check_in_distance_meters).toBe(0)
    expect(duplicate.check_in).toBe(first.check_in)
    const out = await mark({ action: 'pulang', latitude: 0.0001 })
    expect(Number(out.check_out_distance_meters)).toBeCloseTo(11.1, 1)
    const repeated = await mark({ action: 'pulang', latitude: 0 })
    expect(repeated.check_out).toBe(out.check_out)
    expect(repeated.check_out_distance_meters).toBe(out.check_out_distance_meters)
  })

  it('rejects out-of-radius, imprecise, stale and future GPS readings', async () => {
    await expect(mark({ latitude: 0.01 })).rejects.toThrow('radius')
    await expect(mark({ latitude: 0.0026, accuracy: 30 })).rejects.toThrow('radius')
    await expect(mark({ accuracy: 300 })).rejects.toThrow('akurasi')
    await expect(mark({ captured: new Date(Date.now() - 120000).toISOString() })).rejects.toThrow('diperbarui')
    await expect(mark({ captured: new Date(Date.now() + 300000).toISOString() })).rejects.toThrow('diperbarui')
    await expect(mark({ latitude: 100 })).rejects.toThrow('GPS')
    expect((await db.query('select id from public.rd_attendance')).rows).toHaveLength(0)
  })

  it('fails closed without site settings and prevents use of the old four-argument RPC', async () => {
    await actor(viewer)
    await expect(db.query('select public.rd_mark_attendance($1,$2,$3,$4::date)', [workspaceId, token, 'masuk', today])).rejects.toThrow('permission denied')
    await db.exec('reset role; delete from public.rd_attendance_locations')
    await expect(mark()).rejects.toThrow('belum ditetapkan')
    await expect(mark({ user: outsider })).rejects.toThrow('tidak memiliki akses')
  })

  it('protects location settings by role and revision while members can read their own facility', async () => {
    await actor(viewer)
    expect((await db.query('select workspace_id from public.rd_attendance_locations')).rows).toEqual([{ workspace_id: workspaceId }])
    await expect(db.query('update public.rd_attendance_locations set radius_meters=2000')).rejects.toThrow('permission denied')
    await expect(db.query('select public.rd_save_attendance_location($1,0::float8,0::float8,300,150,1)', [workspaceId])).rejects.toThrow('Hanya admin')
    await actor(admin)
    await expect(db.query('select public.rd_save_attendance_location($1,0::float8,0::float8,300,150,0)', [workspaceId])).rejects.toThrow('berubah')
    await expect(db.query('select public.rd_save_attendance_location($1,100::float8,0::float8,300,150,1)', [workspaceId])).rejects.toThrow('belum valid')
    await actor(outsider)
    expect((await db.query('select workspace_id from public.rd_attendance_locations')).rows).toHaveLength(0)
    await expect(db.query('select public.rd_save_attendance_location($1,0::float8,0::float8,300,150,0)', [workspaceId])).rejects.toThrow('Hanya admin')
    expect(otherId).not.toBe(workspaceId)
  })

  it('can reapply the migration without losing attendance and still denies the old RPC', async () => {
    const first = await mark()
    await db.exec('reset role'); await db.exec(await migration())
    await actor(viewer)
    expect((await db.query<{ id: string }>('select id from public.rd_attendance')).rows[0]!.id).toBe(first.id)
    await expect(db.query('select public.rd_mark_attendance($1,$2,$3,$4::date)', [workspaceId, token, 'masuk', today])).rejects.toThrow('permission denied')
  })

  it('rejects unverified legacy timestamps even if the older migration restores its browser grant', async () => {
    await db.exec('reset role')
    await db.exec(await readFile(new URL('../supabase/migrations/002_attendance.sql', import.meta.url), 'utf8'))
    await actor(viewer)
    await expect(db.query('select public.rd_mark_attendance($1,$2,$3,$4::date)', [workspaceId, token, 'masuk', today])).rejects.toThrow('validasi lokasi')
    expect((await db.query('select id from public.rd_attendance')).rows).toHaveLength(0)
    expect((await mark()).check_in_distance_meters).toBe(0)
    await actor(viewer)
    await expect(db.query('select public.rd_mark_attendance($1,$2,$3,$4::date)', [workspaceId, token, 'pulang', today])).rejects.toThrow('validasi lokasi')
    expect((await mark({ action: 'pulang' })).check_out).not.toBeNull()
    await db.exec('reset role'); await db.exec(await migration())
  })
})
