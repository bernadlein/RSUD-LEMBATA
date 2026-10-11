import type { Doctor, DoctorSummary, Issue, MonthPlan, ShiftCode, Workspace } from './types'
import { addDays, dateKey, daysInMonth, monthDates } from './calendar'
import { isNight, minutes, planShifts, shiftHours, shiftInterval } from './shifts'

export function isOnLeave(d: Doctor, date: string): boolean { return d.leave.some(l => l.from <= date && l.to >= date) }
export function isAvailable(d: Doctor, date: string): boolean { return d.active && (!d.joinedOn || d.joinedOn <= date) && !isOnLeave(d, date) }
export function summarize(w: Workspace, p: MonthPlan): DoctorSummary[] {
  const dates = monthDates(p.month)
  const codes = new Map(planShifts(w, p).map(s => [s.code, s]))
  return w.doctors.filter(d => d.active || Object.values(p.assignments[d.id] ?? {}).some(Boolean)).map(doctor => {
    let knownHours = 0, workDays = 0, offDays = 0, leaveDays = 0, notStartedDays = 0, emptyDays = 0, longDays = 0, nightDays = 0, invalid = false
    for (const date of dates) {
      const c = p.assignments[doctor.id]?.[date]
      if (!c) { emptyDays++; continue }
      const shift = codes.get(c), h = shiftHours(shift)
      if (h === null) { invalid = true; continue }
      knownHours += h
      if (h > 0) workDays++
      if (h === 12) longDays++
      if (shift?.kind === 'off') offDays++
      if (shift?.kind === 'leave') leaveDays++
      if (shift?.kind === 'not_started') notStartedDays++
      if (isNight(shift)) nightDays++
    }
    const availableDays = dates.filter(date => isAvailable(doctor, date)).length
    return { doctor, totalHours: invalid ? null : Math.round(knownHours * 100) / 100, knownHours, workDays, offDays, leaveDays, notStartedDays, emptyDays, longDays, nightDays, availableDays, comparable: doctor.unit === 'rotasi' && availableDays === dates.length }
  })
}
export function fairness(w: Workspace, p: MonthPlan) {
  const rows = summarize(w, p).filter(r => r.comparable && r.totalHours !== null)
  const values = rows.map(r => r.totalHours!)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0
  return { rows, min, max, spread: Math.round((max - min) * 100) / 100, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 }
}
export interface CoverageBlock { date: string; unit: 'igd' | 'ruangan'; start: string; end: string; count: number }
const timeLabel = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${m >= 1440 ? ' +1' : ''}`
export function coverage(w: Workspace, p: MonthPlan): CoverageBlock[] {
  const shifts = planShifts(w, p).filter(s => ['igd', 'ruangan'].includes(s.unit) && s.start && s.end && (shiftHours(s) ?? 0) > 0)
  const dayStarts = shifts.filter(s => !isNight(s)).map(s => minutes(s.start!))
  const anchor = dayStarts.length ? Math.min(...dayStarts) : 420
  const intervals = new Map(shifts.map(s => {
    let start = minutes(s.start!)
    if (start < anchor) start += 1440
    return [s.code, [start, start + shiftHours(s)! * 60] as [number, number]]
  }))
  const points = [...new Set([anchor, anchor + 1440, ...[...intervals.values()].flat().filter(v => v > anchor && v < anchor + 1440)])].sort((a, b) => a - b)
  const result: CoverageBlock[] = []
  for (const date of monthDates(p.month)) for (const unit of ['igd', 'ruangan'] as const) {
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i]!, end = points[i + 1]!
      const count = w.doctors.filter(d => {
        const c = p.assignments[d.id]?.[date]
        const s = shifts.find(s => s.code === c && s.unit === unit)
        const interval = s && intervals.get(s.code)
        return !!interval && interval[0] <= start && interval[1] >= end
      }).length
      result.push({ date, unit, start: timeLabel(start), end: timeLabel(end), count })
    }
  }
  return result
}
export function inspectPlan(w: Workspace, p: MonthPlan): Issue[] {
  const issues: Issue[] = [], dates = monthDates(p.month), n = dates.length
  const startValidation = dateKey(p.month, Math.min(p.validationFrom, n))
  const codes = new Map(planShifts(w, p).map(s => [s.code, s]))
  function push(d: Doctor | null, date: string, rule: Issue['rule'], message: string, severity: Issue['severity'] = 'error', starts = date) {
    issues.push({ id: `${d?.id ?? 'unit'}:${date}:${rule}:${d ? '' : message}`, doctorId: d?.id ?? null, date, rule, message, severity, historical: starts < startValidation })
  }
  for (const d of w.doctors.filter(d => d.active || Object.values(p.assignments[d.id] ?? {}).some(Boolean))) {
    const b = p.boundaries[d.id]
    const row = [b?.prev2 ?? '', b?.prev1 ?? '', ...dates.map(date => p.assignments[d.id]?.[date] ?? ''), b?.next1 ?? '', b?.next2 ?? '']
    const prevMonth = addDays(dates[0]!, -1).slice(0, 7), nextMonth = addDays(dates.at(-1)!, 1).slice(0, 7)
    const previousCodes = w.plans[prevMonth] ? new Map(planShifts(w, w.plans[prevMonth]!).map(s => [s.code, s])) : codes
    const nextCodes = w.plans[nextMonth] ? new Map(planShifts(w, w.plans[nextMonth]!).map(s => [s.code, s])) : codes
    const rowShifts = row.map((c, i) => (i < 2 ? previousCodes : i >= n + 2 ? nextCodes : codes).get(c))
    const hours = rowShifts.map(s => shiftHours(s))
    if (!row[0] || !row[1]) push(d, dates[0]!, 'boundary', 'Dua hari terakhir bulan sebelumnya belum lengkap.', 'warning')
    for (let day = 0; day < n; day++) {
      const date = dates[day]!, i = day + 2, c = row[i]!, s = codes.get(c), h = hours[i]
      if (!c) { push(d, date, 'missing', 'Kode dinas belum diisi.', 'warning'); continue }
      if (h === null) { push(d, date, 'invalid', `Kode ${c} tidak dikenal atau durasinya belum valid.`); continue }
      if ((h ?? 0) > 0 && !isAvailable(d, date)) push(d, date, 'availability', 'Dinas jatuh pada masa cuti, sebelum bergabung, atau saat dokter nonaktif.')
      if ((h ?? 0) > 0 && d.unit === 'anak' && s?.unit !== 'anak') push(d, date, 'specialty', 'Dokter ini hanya bertugas di ruang anak.')
      const longLength = w.settings.maxConsecutiveLong + 1
      if (i >= longLength - 1 && hours.slice(i - longLength + 1, i + 1).every(v => v !== null && v !== undefined && v >= 12)) {
        push(d, date, 'long_streak', `${longLength} dinas 12 jam atau lebih berturut-turut.`, 'error', addDays(date, 1 - longLength))
      }
      const prev = shiftInterval(rowShifts[i - 1], day - 1), current = shiftInterval(s, day)
      if (prev && current) {
        const gap = (current[0] - prev[1]) / 60
        if (gap < w.settings.minGapHours) push(d, date, 'gap', `Jeda ${Math.round(gap * 100) / 100} jam; aturan penyusunan ${w.settings.minGapHours} jam.`)
      }
      const streak = w.settings.maxConsecutiveWork + 1
      if (i >= streak - 1 && hours.slice(i - streak + 1, i + 1).every(v => v !== null && v !== undefined && v > 0)) push(d, date, 'work_streak', `Lebih dari ${w.settings.maxConsecutiveWork} tanggal dinas berturut-turut.`, 'warning', addDays(date, 1 - streak))
    }
    for (let i = 1; i < n + 2; i++) {
      if ((hours[i - 1] ?? 0) < 12 || (hours[i] ?? 0) < 12) continue
      const completed = i < 2 ? dates[0]! : dates[i - 2]!
      const next = hours.slice(i + 1, i + 1 + w.settings.offAfterLong)
      const unknown = next.length < w.settings.offAfterLong || next.some(v => v === null)
      if (next.some(v => v !== null && v > 0)) push(d, completed, 'rest', `Dua dinas panjang belum diikuti ${w.settings.offAfterLong} hari tanpa dinas.`, 'error', addDays(completed, -1))
      else if (unknown) push(d, completed, 'rest', `Lengkapi ${w.settings.offAfterLong} hari sesudah dinas panjang untuk memeriksa libur.`, 'warning', addDays(completed, -1))
    }
  }
  for (const b of coverage(w, p)) if (b.count < w.settings.minimumCoverage) {
    push(null, b.date, 'coverage', `${b.unit === 'igd' ? 'IGD' : 'Ruangan'} ${b.start}–${b.end}: ${b.count}/${w.settings.minimumCoverage} dokter.`, 'warning')
  }
  return issues.sort((a, b) => a.date.localeCompare(b.date) || a.rule.localeCompare(b.rule))
}
export function newBlockingIssues(before: Workspace, after: Workspace, month: string, doctorIds: string[]): Issue[] {
  const blocking = ['long_streak', 'rest', 'gap', 'availability', 'specialty', 'invalid']
  const old = new Set(inspectPlan(before, before.plans[month]!).filter(i => i.severity === 'error').map(i => i.id))
  return inspectPlan(after, after.plans[month]!).filter(i => doctorIds.includes(i.doctorId ?? '') && i.severity === 'error' && blocking.includes(i.rule) && !old.has(i.id))
}
