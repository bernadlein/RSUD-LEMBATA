import { describe, expect, it } from 'vitest'
import { createDemoWorkspace, createEmptyWorkspace } from '../app/domain/seed'
import { cloneWorkspace, createMonth, applyTimeTemplate } from '../app/domain/commands'
import { parseWorkspace } from '../app/domain/schema'
import { DOCTOR_ROSTER, applyDoctorRoster, initialRosterChoices, orderedDoctors } from '../app/domain/doctor-roster'
import { attendanceClock, attendanceDate, attendanceHours, availableDuties, safeAttendanceReturn, attendanceQrContext, qrAttendanceLink } from '../app/domain/attendance'
import type { Attendance } from '../app/domain/attendance'
import { attendanceCsv, attendanceQrSvg } from '../app/services/attendance-exports'

const workspaceId = '10000000-0000-4000-8000-000000000001', token = '20000000-0000-4000-8000-000000000001'
const record: Attendance = {
  id: token, workspace_id: workspaceId, doctor_id: 'doctor-01', doctor_name: 'Ela', user_id: workspaceId,
  duty_date: '2026-10-31', shift_code: 'NI', scheduled_hours: 10,
  scheduled_start: '2026-10-31T13:00:00Z', scheduled_end: '2026-10-31T23:00:00Z',
  check_in: '2026-10-31T15:00:00Z', check_out: '2026-10-31T23:00:00Z',
}

describe('doctor roster and attendance domain', () => {
  it('uses the requested order in new workspaces and the child-only specialty', () => {
    expect(createEmptyWorkspace().doctors.map(d => d.name)).toEqual(['Ela', 'Maria', 'Yunita', 'Trisya', 'Rury', 'Gredi', 'Evira', 'Putra', 'Dafrosa'])
    expect(createDemoWorkspace().doctors.map(d => d.name)).toEqual(DOCTOR_ROSTER.map(d => d.name))
    expect(createEmptyWorkspace().doctors.at(-1)!.unit).toBe('anak')
  })
  it('renames and reorders selected identities without losing leave or schedule history', () => {
    const w = createDemoWorkspace()
    w.doctors[0]!.name = 'Ella'; w.doctors[5]!.name = 'Grendi'; w.doctors.reverse()
    const before = JSON.stringify(w)
    const choices = initialRosterChoices(w.doctors), next = applyDoctorRoster(w, choices, 'admin')
    expect(next.doctors.map(d => d.name)).toEqual(DOCTOR_ROSTER.map(d => d.name))
    expect(next.plans).toEqual(w.plans)
    expect(next.doctors[0]!.leave).toEqual(w.doctors.find(d => d.id === 'doctor-01')!.leave)
    expect(next.doctors[7]!.joinedOn).toBe('2026-10-10')
    expect(parseWorkspace(next)).toEqual(next)
    expect(JSON.stringify(w)).toBe(before)
  })
  it('rejects duplicated identity mappings and keeps unselected doctors as inactive history', () => {
    const w = createDemoWorkspace(), choices = initialRosterChoices(w.doctors)
    expect(() => applyDoctorRoster(w, choices, 'planner')).toThrow('admin')
    expect(() => applyDoctorRoster(w, Array(9).fill('doctor-01'), 'admin')).toThrow('sekali')
    w.doctors.push({ ...w.doctors[0]!, id: 'former', name: 'Galih' })
    const next = applyDoctorRoster(w, choices, 'admin')
    expect(next.doctors.at(-1)!.active).toBe(false)
    expect(next.doctors.at(-1)!.id).toBe('former')
    expect(orderedDoctors([...next.doctors].reverse()).slice(0, 9).map(d => d.name)).toEqual(DOCTOR_ROSTER.map(d => d.name))
  })
  it('finds an overnight duty from the previous month using its original clock snapshot', () => {
    let w = applyTimeTemplate(createDemoWorkspace(), '8', 'admin')
    w.doctors[1]!.leave = []
    w.plans['2026-10']!.assignments['doctor-02']!['2026-10-31'] = 'NI'
    w = createMonth(w, '2026-11', 'admin')
    w.plans['2026-11']!.assignments['doctor-02']!['2026-11-01'] = 'L'
    const duties = availableDuties(w, 'doctor-02', new Date('2026-10-31T22:00:00Z'))
    expect(duties).toHaveLength(1); expect(duties[0]!.date).toBe('2026-10-31'); expect(duties[0]!.hours).toBe(10)
    expect(availableDuties(w, 'doctor-02', new Date('2026-10-31T23:00:00Z'))).toEqual([])
    w.doctors[1]!.active = false
    expect(availableDuties(w, 'doctor-02', new Date('2026-10-31T22:00:00Z'))).toEqual([])
  })
  it('keeps attendance hours distinct from scheduled duration and handles timezone day changes', () => {
    expect(attendanceHours(record)).toBe(8); expect(record.scheduled_hours).toBe(10)
    expect(attendanceHours({ ...record, check_out: null })).toBeNull()
    expect(attendanceDate(new Date('2026-10-31T17:00:00Z'), 'Asia/Makassar')).toBe('2026-11-01')
    expect(attendanceClock(record.check_in, 'Asia/Makassar')).toBe('23.00')
  })
  it('preserves the scanned link through login while rejecting external redirects and wrong workspaces', () => {
    const link = qrAttendanceLink('https://example.test', workspaceId, token), url = new URL(link)
    expect(safeAttendanceReturn(url.pathname + url.search)).toBe(url.pathname + url.search)
    for (const value of ['https://evil.test/absen', '//evil.test/absen', '\\evil.test/absen', 'javascript:alert(1)', ['/absen']]) expect(safeAttendanceReturn(value)).toBe('/')
    expect(attendanceQrContext({ w: workspaceId, q: token }, workspaceId).token).toBe(token)
    expect(attendanceQrContext({ w: workspaceId, q: token }, token).error).toContain('lain')
    expect(attendanceQrContext({ w: [workspaceId], q: token }, workspaceId).token).toBeNull()
  })
  it('exports complete overnight timestamps, unfinished records and neutralized spreadsheet formulas', () => {
    const csv = attendanceCsv([{ ...record, doctor_name: '=HYPERLINK("bad")' }, { ...record, check_out: null }], 'Asia/Makassar')
    expect(csv.startsWith('\uFEFF')).toBe(true); expect(csv).toContain('01/11/2026'); expect(csv).toContain('Belum pulang')
    expect(csv).toContain("'="); expect(csv).toContain('"8"'); expect(csv).toContain(';')
  })
  it('generates a real vector QR with a quiet border for the correct attendance address', async () => {
    const svg = await attendanceQrSvg(qrAttendanceLink('https://example.test', workspaceId, token))
    expect(svg).toContain('<svg'); expect(svg).toContain('width="512"'); expect(svg).toContain('<path')
    await expect(attendanceQrSvg('javascript:alert(1)')).rejects.toThrow('tidak valid')
  })
})
