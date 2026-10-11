import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { createEmptyWorkspace } from '../app/domain/seed'
import { createMonth } from '../app/domain/commands'
import { monthDates } from '../app/domain/calendar'
import type { Attendance } from '../app/domain/attendance'

const admin = '30000000-0000-4000-8000-000000000001', planner = '30000000-0000-4000-8000-000000000002'
const viewer = '30000000-0000-4000-8000-000000000003', outsider = '30000000-0000-4000-8000-000000000004'
let db: PGlite, workspaceId: string, otherWorkspace: string, token: string, today: string
async function actor(id: string, role = 'authenticated') {
  await db.exec(`reset role; set role ${role};`)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
}
async function mark(id: string, action: string, qr = token, date = today) {
  await actor(id)
  const result = await db.query<{ entry: Attendance }>('select public.rd_mark_attendance($1,$2,$3,$4::date) as entry', [workspaceId, qr, action, date])
  return result.rows[0]!.entry
}

describe('attendance SQL authorization and clock handling', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated,service_role;
      insert into auth.users values ('${admin}','admin@example.test',now()),('${planner}','planner@example.test',now()),('${viewer}','doctor@example.test',now()),('${outsider}','outside@example.test',now());
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/002_attendance.sql', import.meta.url), 'utf8'))
    const clock = (await db.query<{ date: string; hour: number }>("select to_char(clock_timestamp() at time zone 'Asia/Makassar','YYYY-MM-DD') as date, extract(hour from clock_timestamp() at time zone 'Asia/Makassar')::integer as hour")).rows[0]!
    today = clock.date
    const hh = (n: number) => `${String(n % 24).padStart(2, '0')}:00`
    let w = createEmptyWorkspace()
    w.shifts.push({ code: 'TEST', label: 'Dinas uji', unit: 'igd', kind: 'custom', start: hh(clock.hour), end: hh(clock.hour + 8), durationOverride: null, active: true })
    w = createMonth(w, today.slice(0, 7), 'admin')
    for (const d of w.doctors) for (const date of monthDates(today.slice(0, 7))) w.plans[today.slice(0, 7)]!.assignments[d.id]![date] = 'L'
    w.plans[today.slice(0, 7)]!.assignments['doctor-01']![today] = 'TEST'
    w.plans[today.slice(0, 7)]!.assignments['doctor-02']![today] = 'TEST'
    // Deliberately change master clocks after snapshot creation.
    w.shifts.find(s => s.code === 'TEST')!.end = hh(clock.hour + 2)
    await actor(admin)
    workspaceId = (await db.query<{ id: string }>('select public.rd_create_workspace($1,$2::jsonb) as id', ['Test attendance', JSON.stringify(w)])).rows[0]!.id
    await db.query('select public.rd_add_member($1,$2,$3)', [workspaceId, 'planner@example.test', 'planner'])
    await db.query('select public.rd_add_member($1,$2,$3)', [workspaceId, 'doctor@example.test', 'viewer'])
    await actor(outsider)
    otherWorkspace = (await db.query<{ id: string }>('select public.rd_create_workspace($1,$2::jsonb) as id', ['Other facility', JSON.stringify(createEmptyWorkspace())])).rows[0]!.id
  }, 30000)
  beforeEach(async () => {
    await db.exec('reset role; truncate public.rd_attendance, public.rd_doctor_accounts;')
    await actor(admin)
    await db.query('select public.rd_bind_doctor_account($1,$2,$3)', [workspaceId, 'doctor-01', viewer])
    await db.query('select public.rd_bind_doctor_account($1,$2,$3)', [workspaceId, 'doctor-02', planner])
    token = (await db.query<{ token: string }>('select public.rd_get_attendance_qr($1,true) as token', [workspaceId])).rows[0]!.token
  })
  afterAll(async () => { await db?.close() })

  it('uses server time and the monthly snapshot; repeated requests keep one record', async () => {
    const before = Date.now(), row = await mark(viewer, 'masuk'), duplicate = await mark(viewer, 'masuk')
    expect(row.user_id).toBe(viewer); expect(row.doctor_id).toBe('doctor-01'); expect(row.doctor_name).toBe('Ela')
    expect(row.scheduled_hours).toBe(8)
    expect(Date.parse(row.scheduled_end) - Date.parse(row.scheduled_start)).toBe(8 * 3600000)
    expect(Math.abs(Date.parse(row.check_in) - before)).toBeLessThan(10000)
    expect(duplicate.id).toBe(row.id); expect(duplicate.check_in).toBe(row.check_in)
    const out = await mark(viewer, 'pulang'), repeatedOut = await mark(viewer, 'pulang')
    expect(out.check_out).not.toBeNull(); expect(repeatedOut.check_out).toBe(out.check_out)
    expect((await db.query('select id from public.rd_attendance')).rows).toHaveLength(1)
  })
  it('isolates a doctor from other records while supervisors see the team', async () => {
    await mark(viewer, 'masuk'); await mark(planner, 'masuk')
    await actor(viewer)
    expect((await db.query('select doctor_id from public.rd_attendance')).rows).toEqual([{ doctor_id: 'doctor-01' }])
    expect((await db.query('select doctor_id from public.rd_doctor_accounts')).rows).toEqual([{ doctor_id: 'doctor-01' }])
    await actor(planner); expect((await db.query('select id from public.rd_attendance')).rows).toHaveLength(2)
    await actor(admin); expect((await db.query('select id from public.rd_attendance')).rows).toHaveLength(2)
    await actor(outsider); expect((await db.query('select id from public.rd_attendance')).rows).toHaveLength(0)
    expect((await db.query('select doctor_id from public.rd_doctor_accounts')).rows).toHaveLength(0)
  })
  it('rejects wrong QR codes, anonymous access and a different facility', async () => {
    await expect(mark(viewer, 'masuk', outsider)).rejects.toThrow('QR absensi tidak valid')
    await expect(mark(outsider, 'masuk')).rejects.toThrow('tidak memiliki akses')
    await actor(outsider)
    const otherToken = (await db.query<{ token: string }>('select public.rd_get_attendance_qr($1,false) as token', [otherWorkspace])).rows[0]!.token
    await expect(mark(viewer, 'masuk', otherToken)).rejects.toThrow('QR absensi tidak valid')
    await actor(viewer, 'anon')
    await expect(db.query('select public.rd_mark_attendance($1,$2,$3,$4::date)', [workspaceId, token, 'masuk', today])).rejects.toThrow('permission denied')
  })
  it('prevents direct timestamp edits and QR table reads from authenticated browsers', async () => {
    await mark(viewer, 'masuk')
    await actor(viewer)
    await expect(db.query('update public.rd_attendance set check_in=now()-interval \'3 hours\'')).rejects.toThrow('permission denied')
    await expect(db.query('delete from public.rd_attendance')).rejects.toThrow('permission denied')
    await expect(db.query('select token from public.rd_attendance_qr')).rejects.toThrow('permission denied')
    await expect(db.query('update public.rd_doctor_accounts set doctor_id=$1', ['doctor-09'])).rejects.toThrow('permission denied')
  })
  it('requires admin for account links and QR rotation and disallows duplicate identities', async () => {
    await actor(planner)
    await expect(db.query('select public.rd_get_attendance_qr($1,true)', [workspaceId])).rejects.toThrow('Hanya admin')
    await expect(db.query('select public.rd_bind_doctor_account($1,$2,$3)', [workspaceId, 'doctor-03', admin])).rejects.toThrow('Hanya admin')
    await actor(admin)
    await expect(db.query('select public.rd_bind_doctor_account($1,$2,$3)', [workspaceId, 'doctor-03', viewer])).rejects.toThrow('sudah terhubung')
    await expect(db.query('select public.rd_bind_doctor_account($1,$2,$3)', [workspaceId, 'doctor-03', outsider])).rejects.toThrow('ruang kerja')
    await expect(db.query('select public.rd_bind_doctor_account($1,$2,$3)', [workspaceId, 'missing-doctor', admin])).rejects.toThrow('Dokter tidak ditemukan')
  })
  it('does not detach an open attendance record and rejects an invalid duty day', async () => {
    await mark(viewer, 'masuk'); await actor(admin)
    await expect(db.query('select public.rd_unbind_doctor_account($1,$2)', [workspaceId, 'doctor-01'])).rejects.toThrow('pulang')
    await mark(viewer, 'pulang'); await actor(admin)
    await db.query('select public.rd_unbind_doctor_account($1,$2)', [workspaceId, 'doctor-01'])
    await expect(mark(viewer, 'masuk')).rejects.toThrow('belum dihubungkan')
    await expect(mark(planner, 'masuk', token, '1900-01-01')).rejects.toThrow('Tidak ada dinas')
  })
  it('keeps the QR stable across reads and invalidates it only when rotated', async () => {
    await actor(admin)
    expect((await db.query<{ token: string }>('select public.rd_get_attendance_qr($1,false) as token', [workspaceId])).rows[0]!.token).toBe(token)
    const rotated = (await db.query<{ token: string }>('select public.rd_get_attendance_qr($1,true) as token', [workspaceId])).rows[0]!.token
    expect(rotated).not.toBe(token)
    await expect(mark(viewer, 'masuk', token)).rejects.toThrow('QR absensi tidak valid')
    expect((await mark(viewer, 'masuk', rotated)).doctor_id).toBe('doctor-01')
  })
  it('prevents account removal from orphaning an open session', async () => {
    await mark(viewer, 'masuk'); await actor(admin)
    await expect(db.query('select public.rd_remove_member($1,$2)', [workspaceId, viewer])).rejects.toThrow('absen pulang')
    await mark(viewer, 'pulang'); await actor(admin)
    await db.query('select public.rd_remove_member($1,$2)', [workspaceId, viewer])
    expect((await db.query('select doctor_id from public.rd_doctor_accounts where workspace_id=$1 and user_id=$2', [workspaceId, viewer])).rows).toEqual([])
    await db.query('select public.rd_add_member($1,$2,$3)', [workspaceId, 'doctor@example.test', 'viewer'])
  })
})
