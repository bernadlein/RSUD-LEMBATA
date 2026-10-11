import { describe, expect, it, vi } from 'vitest'
import { generateMonth, applyGeneratedMonth } from '../app/domain/scheduler'
import { createDemoWorkspace } from '../app/domain/seed'
import { applyTimeTemplate, cloneWorkspace, createMonth } from '../app/domain/commands'
import { coverage, inspectPlan, isAvailable } from '../app/domain/analysis'
import { addDays, monthDates } from '../app/domain/calendar'
import { shiftHours } from '../app/domain/shifts'
import { validateChange } from '../app/domain/permissions'
import type { Workspace } from '../app/domain/types'
import { getGeneratedMonth } from '../app/services/month-generator'

const normal = { preferRegular: true, restedBeforeFirstMonth: false }
const first = { ...normal, restedBeforeFirstMonth: true }
function fresh(): Workspace {
  const w = applyTimeTemplate(createDemoWorkspace(), '8', 'admin')
  w.plans = {}
  w.doctors = w.doctors.map(d => ({ ...d, leave: [], joinedOn: null }))
  return w
}
function valid(w: Workspace, month: string) {
  const p = w.plans[month]!
  expect(coverage(w, p).every(b => b.count >= w.settings.minimumCoverage)).toBe(true)
  expect(inspectPlan(w, p).filter(i => !i.historical && (i.severity === 'error' || ['missing', 'work_streak', 'coverage'].includes(i.rule)))).toEqual([])
  for (const d of w.doctors.filter(d => d.active)) for (const date of monthDates(month)) {
    const s = p.shiftSnapshot!.find(s => s.code === p.assignments[d.id]?.[date])!
    const h = shiftHours(s)!
    expect(s).toBeDefined(); expect(h).toBeLessThanOrEqual(12)
    if (h > 0) {
      expect(isAvailable(d, date)).toBe(true)
      if (Number(s.start!.slice(0, 2)) * 60 + Number(s.start!.slice(3)) + h * 60 > 1440) expect(isAvailable(d, addDays(date, 1))).toBe(true)
      expect(s.unit).toEqual(d.unit === 'anak' ? 'anak' : expect.stringMatching(/^(igd|ruangan)$/))
    }
  }
}

describe('automatic monthly scheduling', () => {
  it('covers both services, preserves October, balances hours and applies through planner policy', () => {
    const w = createDemoWorkspace(), before = JSON.stringify(w)
    const result = generateMonth(w, '2026-11', normal)
    const next = applyGeneratedMonth(w, result, 'planner')
    valid(next, '2026-11')
    expect(JSON.stringify(w)).toBe(before)
    expect(next.plans['2026-10']).toEqual(w.plans['2026-10'])
    expect(result.rows).toHaveLength(9)
    expect(result.spread).toBeLessThanOrEqual(12)
    expect(() => validateChange(w, next, 'planner', false)).not.toThrow()
  }, 30000)

  it('supports 8-hour regular duties, preserves 12-hour options and has deterministic output', () => {
    const w = fresh(), a = generateMonth(w, '2026-11', first), b = generateMonth(w, '2026-11', first)
    expect(a).toEqual(b)
    valid(applyGeneratedMonth(w, a, 'admin'), '2026-11')
    const codes = Object.values(a.plan.assignments).flatMap(row => Object.values(row))
    expect(codes).toContain('PI'); expect(codes).not.toContain('24 JAM')
    expect(a.rows.filter(r => r.unit === 'rotasi').reduce((n, r) => n + r.longDays, 0)).toBeLessThan(60)
    expect(a.spread).toBeLessThanOrEqual(12)
  }, 30000)

  it('respects leave including overnight spill, joining dates and the child-only doctor', () => {
    const w = fresh()
    w.doctors[0]!.leave = [{ from: '2026-11-17', to: '2026-11-30' }]
    w.doctors[7]!.joinedOn = '2026-11-10'
    const result = generateMonth(w, '2026-11', first), next = applyGeneratedMonth(w, result, 'planner')
    valid(next, '2026-11')
    expect(result.plan.assignments[w.doctors[0]!.id]!['2026-11-17']).toBe('C')
    expect(result.plan.assignments[w.doctors[7]!.id]!['2026-11-09']).toBe('BM')
    expect(result.rows[0]!.hours).toBeLessThan(result.rows[1]!.hours)
  }, 30000)

  it('carries two required rest days and the previous clock snapshot into the new month', () => {
    let w = fresh()
    w = createMonth(w, '2026-10', 'admin')
    for (const d of w.doctors) for (const date of monthDates('2026-10')) w.plans['2026-10']!.assignments[d.id]![date] = 'L'
    const row = w.plans['2026-10']!.assignments[w.doctors[0]!.id]!
    row['2026-10-30'] = 'PSI'; row['2026-10-31'] = 'MI'
    const night = w.plans['2026-10']!.shiftSnapshot!.find(s => s.code === 'NI')!
    night.start = '20:00'; night.end = '08:00'
    w.plans['2026-10']!.assignments[w.doctors[1]!.id]!['2026-10-31'] = 'NI'
    const result = generateMonth(w, '2026-11', normal)
    expect(result.plan.assignments[w.doctors[0]!.id]!['2026-11-01']).toBe('L')
    expect(result.plan.assignments[w.doctors[0]!.id]!['2026-11-02']).toBe('L')
    const firstCode = result.plan.assignments[w.doctors[1]!.id]!['2026-11-01']!
    expect(['L', 'MI', 'MR', 'NI', 'NR']).toContain(firstCode)
    valid(applyGeneratedMonth(w, result, 'planner'), '2026-11')
  }, 30000)

  it('never silently invents history, ignores a real unknown clock or accepts missing coverage', () => {
    const w = fresh()
    expect(() => generateMonth(w, '2026-11', normal)).toThrow('riwayat')
    w.plans = createMonth(w, '2026-10', 'admin').plans
    expect(() => generateMonth(w, '2026-11', first)).toThrow('riwayat')
    for (const d of w.doctors) for (const date of monthDates('2026-10')) w.plans['2026-10']!.assignments[d.id]![date] = 'L'
    w.plans['2026-10']!.assignments[w.doctors[0]!.id]!['2026-10-31'] = '24 JAM'
    expect(() => generateMonth(w, '2026-11', normal)).toThrow('Jam riwayat')
    const missing = fresh(); missing.shifts.forEach(s => { if (s.unit === 'ruangan') s.active = false })
    expect(() => generateMonth(missing, '2026-11', first)).toThrow('belum menutup 24 jam')
  })

  it('fails without mutation for too few doctors and rejects stale or unauthorized application', () => {
    const insufficient = fresh(); insufficient.doctors = insufficient.doctors.slice(0, 3)
    const before = JSON.stringify(insufficient)
    expect(() => generateMonth(insufficient, '2026-11', first)).toThrow('hanya 3')
    expect(JSON.stringify(insufficient)).toBe(before)
    const w = fresh(), proposal = generateMonth(w, '2026-11', first)
    expect(() => applyGeneratedMonth(w, proposal, 'viewer')).toThrow('pembaca')
    const changed = cloneWorkspace(w); changed.settings.minGapHours++
    expect(() => applyGeneratedMonth(changed, proposal, 'planner')).toThrow('Data berubah')
    const next = applyGeneratedMonth(w, proposal, 'planner')
    expect(() => applyGeneratedMonth(next, proposal, 'planner')).toThrow('sudah tersedia')
  }, 30000)

  it('uses the following month clock snapshot and keeps that month unchanged', () => {
    let w = createMonth(fresh(), '2026-12', 'admin')
    for (const d of w.doctors) for (const date of monthDates('2026-12')) w.plans['2026-12']!.assignments[d.id]![date] = 'L'
    const nextPlan = w.plans['2026-12']!, early = nextPlan.shiftSnapshot!.find(s => s.code === 'PI')!
    early.start = '05:00'; early.end = '13:00'
    nextPlan.assignments[w.doctors[0]!.id]!['2026-12-01'] = 'PI'
    const result = generateMonth(w, '2026-11', first), applied = applyGeneratedMonth(w, result, 'planner')
    valid(applied, '2026-11')
    expect(['L', 'PI', 'PRR']).toContain(result.plan.assignments[w.doctors[0]!.id]!['2026-11-30'])
    expect(result.plan.boundaries[w.doctors[0]!.id]!.next1).toBe('PI')
    expect(applied.plans['2026-12']).toEqual(nextPlan)
  }, 30000)

  it('checks full prior work streaks even when more than two days cross the boundary', () => {
    const w = createMonth(fresh(), '2026-10', 'admin')
    for (const d of w.doctors) for (const date of monthDates('2026-10')) w.plans['2026-10']!.assignments[d.id]![date] = 'L'
    for (const date of ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']) w.plans['2026-10']!.assignments[w.doctors[0]!.id]![date] = 'PI'
    const result = generateMonth(w, '2026-11', normal)
    expect(result.plan.assignments[w.doctors[0]!.id]!['2026-11-01']).toBe('L')
    valid(applyGeneratedMonth(w, result, 'planner'), '2026-11')
  }, 30000)

  it('supports leap months and verifies the whole rest window after every long pair', () => {
    const w = fresh()
    const result = generateMonth(w, '2028-02', first)
    valid(applyGeneratedMonth(w, result, 'planner'), '2028-02')
    const dates = monthDates('2028-02')
    expect(dates).toHaveLength(29)
    for (const row of Object.values(result.plan.assignments)) {
      const hours = dates.map(date => shiftHours(w.shifts.find(s => s.code === row[date]))!)
      for (let i = 1; i < hours.length; i++) if (hours[i - 1]! >= 12 && hours[i]! >= 12) {
        expect(hours.slice(i + 1, i + 1 + w.settings.offAfterLong)).toEqual([0, 0])
      }
    }
  }, 30000)

  it('revalidates overnight leave when a proposal is altered before applying', () => {
    const w = fresh(); w.doctors[0]!.leave = [{ from: '2026-11-17', to: '2026-11-30' }]
    const result = generateMonth(w, '2026-11', first)
    result.plan.assignments[w.doctors[0]!.id]!['2026-11-16'] = 'NI'
    expect(() => applyGeneratedMonth(w, result, 'planner')).toThrow('ketersediaan atau istirahat')
  }, 30000)

  it('terminates workers on cancellation and timeout, and ignores late messages', async () => {
    class WorkerStub {
      static instances: WorkerStub[] = []
      terminate = vi.fn()
      postMessage = vi.fn()
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: (() => void) | null = null
      onmessageerror: (() => void) | null = null
      constructor() { WorkerStub.instances.push(this) }
    }
    vi.useFakeTimers(); vi.stubGlobal('Worker', WorkerStub)
    try {
      const abort = new AbortController(), request = getGeneratedMonth(fresh(), '2026-11', first, abort.signal)
      abort.abort()
      await expect(request).rejects.toMatchObject({ name: 'AbortError' })
      const worker = WorkerStub.instances[0]!
      worker.onmessage?.({ data: { error: 'late response' } } as MessageEvent)
      expect(worker.terminate).toHaveBeenCalledTimes(1)
      const timeout = getGeneratedMonth(fresh(), '2026-11', first, new AbortController().signal)
      const assertion = expect(timeout).rejects.toThrow('30 detik')
      await vi.advanceTimersByTimeAsync(30000); await assertion
      expect(WorkerStub.instances[1]!.terminate).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
    } finally { vi.unstubAllGlobals(); vi.useRealTimers() }
  })
})
