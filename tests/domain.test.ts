import { describe, expect, it } from 'vitest'
import { createDemoWorkspace } from '../app/domain/seed'
import { coverage, fairness, inspectPlan, summarize } from '../app/domain/analysis'
import { applySwap, applyTimeTemplate, cloneWorkspace, createMonth, setAssignment, suggestFairSwap } from '../app/domain/commands'
import { clockLabel, shiftHours } from '../app/domain/shifts'
import { addDays, daysInMonth, monthDates } from '../app/domain/calendar'
import { parseWorkspace } from '../app/domain/schema'
import { validateChange } from '../app/domain/permissions'
import { rosterCsv, safeCsv } from '../app/services/exports'
import { LocalWorkspaceRepository } from '../app/repositories/local-workspace-repository'
import type { Workspace } from '../app/domain/types'

function blank(): Workspace {
  const w = createDemoWorkspace()
  w.plans = {}; w.doctors = w.doctors.slice(0, 2).map(d => ({ ...d, leave: [], joinedOn: null }))
  return createMonth(w, '2026-11', 'admin')
}
describe('calendar and duration', () => {
  it('handles leap months and month boundaries without device timezone', () => {
    expect(daysInMonth('2028-02')).toBe(29); expect(daysInMonth('2026-02')).toBe(28)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(() => daysInMonth('2026-13')).toThrow()
  })
  it('calculates midnight crossings and preserves the historical 24-hour override', () => {
    const w = createDemoWorkspace(), find = (c: string) => w.shifts.find(s => s.code === c)
    expect(shiftHours(find('NI'))).toBe(10); expect(shiftHours(find('MI'))).toBe(12)
    expect(shiftHours(find('24 JAM'))).toBe(24); expect(clockLabel(find('24 JAM'))).toContain('waktu belum diisi')
    expect(shiftHours(find('L'))).toBe(0); expect(shiftHours(undefined)).toBeNull()
    expect(clockLabel(find('MI'))).toBe('19:00–07:00 +1')
  })
})
describe('October reconciliation', () => {
  it('reconciles all nine doctor totals and the grand total with the workbook', () => {
    const w = createDemoWorkspace(), rows = summarize(w, w.plans['2026-10']!)
    expect(rows.map(r => r.totalHours)).toEqual([115, 195, 195, 195, 195, 195, 195, 187, 189])
    expect(rows.reduce((n, r) => n + r.knownHours, 0)).toBe(1661)
    expect(rows.reduce((n, r) => n + r.longDays, 0)).toBe(86)
    expect(rows.every(r => r.emptyDays === 0)).toBe(true)
  })
  it('compares only the six full-month rotating doctors', () => {
    const w = createDemoWorkspace(), f = fairness(w, w.plans['2026-10']!)
    expect(f.rows).toHaveLength(6); expect(f.spread).toBe(0); expect(f.min).toBe(195)
    const rows = summarize(w, w.plans['2026-10']!)
    expect(rows[0]!.leaveDays).toBe(15); expect(rows[7]!.notStartedDays).toBe(9)
  })
  it('keeps the two inherited 12×3 patterns and six insufficient-rest pairs visible', () => {
    const w = createDemoWorkspace(), issues = inspectPlan(w, w.plans['2026-10']!)
    expect(issues.filter(i => i.rule === 'long_streak')).toHaveLength(2)
    expect(issues.filter(i => i.rule === 'rest' && i.severity === 'error')).toHaveLength(6)
    expect(issues.some(i => i.rule === 'gap' && i.doctorId === 'doctor-04' && i.date === '2026-10-10' && i.message.includes('0 jam'))).toBe(true)
    expect(issues.filter(i => i.severity === 'error' && i.date >= '2026-10-11')).toHaveLength(0)
  })
  it('maintains both services in every time block from October 10', () => {
    const w = createDemoWorkspace(), blocks = coverage(w, w.plans['2026-10']!).filter(b => b.date >= '2026-10-10')
    expect(blocks).toHaveLength(22 * 4 * 2)
    expect(blocks.every(b => b.count >= 1)).toBe(true)
    expect(blocks.find(b => b.date === '2026-10-10' && b.unit === 'ruangan' && b.start === '07:00')?.count).toBe(2)
  })
  it('never turns an unknown code into a zero-hour monthly total', () => {
    const w = createDemoWorkspace(); w.plans['2026-10']!.assignments['doctor-02']!['2026-10-20'] = 'UNKNOWN'
    expect(summarize(w, w.plans['2026-10']!)[1]!.totalHours).toBeNull()
    expect(() => parseWorkspace(w)).toThrow('tidak ditemukan')
  })
})
describe('editing and permissions', () => {
  it('blocks a third long duty and the loss of required rest', () => {
    let w = blank()
    w = setAssignment(w, '2026-11', 'doctor-01', '2026-11-10', 'PSI', 'planner')
    w = setAssignment(w, '2026-11', 'doctor-01', '2026-11-11', 'MI', 'planner')
    expect(() => setAssignment(w, '2026-11', 'doctor-01', '2026-11-12', 'PSI', 'planner')).toThrow(/dinas|diikuti/)
    w = setAssignment(w, '2026-11', 'doctor-01', '2026-11-12', 'L', 'planner')
    w = setAssignment(w, '2026-11', 'doctor-01', '2026-11-13', 'L', 'planner')
    expect(inspectPlan(w, w.plans['2026-11']!).filter(i => i.rule === 'rest' && i.severity === 'error')).toHaveLength(0)
  })
  it('rejects doctor availability violations and room restrictions', () => {
    const w = createDemoWorkspace()
    expect(() => setAssignment(w, '2026-10', 'doctor-01', '2026-10-18', 'PI', 'admin')).toThrow(/cuti|bergabung/)
    expect(() => setAssignment(w, '2026-10', 'doctor-09', '2026-10-18', 'PI', 'admin')).toThrow(/ruang anak/)
  })
  it('protects frozen dates, finalized months and viewer access', () => {
    const w = createDemoWorkspace()
    expect(() => setAssignment(w, '2026-10', 'doctor-01', '2026-10-09', 'L', 'admin')).toThrow('riwayat')
    expect(() => setAssignment(w, '2026-10', 'doctor-01', '2026-10-10', 'L', 'viewer')).toThrow('pembaca')
    w.plans['2026-10']!.locked = true
    expect(() => setAssignment(w, '2026-10', 'doctor-01', '2026-10-10', 'L', 'planner')).toThrow('dikunci')
  })
  it('runs the same pattern checks on the authenticated server path', () => {
    const before = blank(), after = cloneWorkspace(before)
    Object.assign(after.plans['2026-11']!.assignments['doctor-01']!, { '2026-11-10': 'PSI', '2026-11-11': 'MI', '2026-11-12': 'PSI' })
    expect(() => validateChange(before, after, 'planner', false)).toThrow(/dinas|diikuti/)
    expect(() => validateChange(before, after, 'viewer', false)).toThrow('pembaca')
    expect(() => validateChange(before, after, 'planner', true)).toThrow('admin')
  })
  it('prevents forged configuration and snapshot changes on the planner API path', () => {
    const before = createDemoWorkspace(), after = cloneWorkspace(before)
    after.settings.minGapHours = 0
    expect(() => validateChange(before, after, 'planner', false)).toThrow(/master/i)
    after.settings.minGapHours = before.settings.minGapHours
    after.plans['2026-10']!.shiftSnapshot![0]!.end = '15:00'
    expect(() => validateChange(before, after, 'planner', false)).toThrow('Pengaturan bulan')
  })
})
describe('time snapshots and fairness proposals', () => {
  it('offers true 8-hour shifts while keeping 12-hour codes and historical totals', () => {
    const w = applyTimeTemplate(createDemoWorkspace(), '8', 'admin')
    expect(['PI', 'SI', 'NI'].map(c => shiftHours(w.shifts.find(s => s.code === c)))).toEqual([8, 8, 8])
    expect(['PSI', 'MI', 'PSR', 'MR'].map(c => shiftHours(w.shifts.find(s => s.code === c)))).toEqual([12, 12, 12, 12])
    expect(summarize(w, w.plans['2026-10']!)[1]!.totalHours).toBe(195)
    const next = createMonth(w, '2026-11', 'admin')
    expect(shiftHours(next.plans['2026-11']!.shiftSnapshot!.find(s => s.code === 'PI'))).toBe(8)
  })
  it('uses the previous month clock snapshot for cross-month rest gaps', () => {
    const w = blank()
    w.plans['2026-10'] = { ...cloneWorkspace(createDemoWorkspace()).plans['2026-10']!, assignments: {} }
    const night = w.plans['2026-10']!.shiftSnapshot!.find(s => s.code === 'NI')!
    night.start = '20:00'; night.end = '08:00'
    w.plans['2026-11']!.boundaries['doctor-01'] = { prev2: 'L', prev1: 'NI', next1: '', next2: '' }
    w.plans['2026-11']!.assignments['doctor-01']!['2026-11-01'] = 'MI'
    expect(inspectPlan(w, w.plans['2026-11']!).some(i => i.rule === 'gap' && i.doctorId === 'doctor-01' && i.date === '2026-11-01')).toBe(false) // 08:00 → 19:00 = 11 h
  })
  it('proposes and atomically applies a swap that reduces the hour spread', () => {
    let w = blank()
    w.shifts.push({ code: 'D4', label: 'Dinas khusus 4 jam', unit: 'lain', kind: 'custom', start: '07:00', end: '11:00', durationOverride: null, active: true })
    w.plans['2026-11']!.shiftSnapshot = JSON.parse(JSON.stringify(w.shifts))
    for (const d of w.doctors) for (const date of monthDates('2026-11')) w.plans['2026-11']!.assignments[d.id]![date] = 'L'
    Object.assign(w.plans['2026-11']!.assignments['doctor-01']!, { '2026-11-10': 'D8', '2026-11-11': 'MI' })
    w.plans['2026-11']!.assignments['doctor-02']!['2026-11-15'] = 'D4'
    const s = suggestFairSwap(w, '2026-11')
    expect(s?.spreadBefore).toBe(16); expect(s?.spreadAfter).toBe(0)
    w = applySwap(w, '2026-11', s!, 'planner')
    expect(fairness(w, w.plans['2026-11']!).spread).toBe(0)
    expect(() => applySwap(w, '2026-11', s!, 'planner')).toThrow('berubah')
  })
})
describe('backup and persistence', () => {
  it('rejects duplicate codes and impossible dates', () => {
    const w = createDemoWorkspace(); w.shifts.push({ ...w.shifts[0]! })
    expect(() => parseWorkspace(w)).toThrow('ganda')
    const b = blank(); b.plans['2026-11']!.assignments['doctor-01']!['2026-11-31'] = 'L'
    expect(() => parseWorkspace(b)).toThrow()
  })
  it('detects concurrent edits between browser tabs', async () => {
    const map = new Map<string, string>(), storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v) } }
    const a = new LocalWorkspaceRepository(storage), b = new LocalWorkspaceRepository(storage)
    const oldA = await a.load(), oldB = await b.load()
    expect(await a.save('local', oldA.data, oldA.revision)).toBe(1)
    await expect(b.save('local', oldB.data, oldB.revision)).rejects.toThrow('tab lain')
    expect((await b.load()).revision).toBe(1)
  })
  it('does not overwrite corrupt local data with a demo fallback', async () => {
    const repo = new LocalWorkspaceRepository({ getItem: () => '{broken', setItem: () => { throw new Error('Must not write') } })
    await expect(repo.load()).rejects.toThrow('Data lama tetap disimpan')
  })
  it('exports Excel-compatible UTF-8 CSV and neutralizes formula injection', () => {
    const w = createDemoWorkspace(), csv = rosterCsv(w, w.plans['2026-10']!)
    expect(csv.startsWith('\uFEFF')).toBe(true); expect(csv).toContain('"195"')
    expect(safeCsv('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
  })
})
