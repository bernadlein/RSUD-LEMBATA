import type { Doctor, MonthPlan, Role, ShiftCode, Workspace } from './types'
import { dateKey, daysInMonth, isSunday, monthDates } from './calendar'
import { isAvailable, isOnLeave, newBlockingIssues, summarize } from './analysis'
import { parseWorkspace } from './schema'
import { planShifts, shiftHours } from './shifts'

export const cloneWorkspace = (w: Workspace): Workspace => JSON.parse(JSON.stringify(w))
export function assertRole(role: Role, admin = false) { if (role === 'viewer' || (admin && role !== 'admin')) throw new Error(admin ? 'Hanya admin yang dapat mengubah bagian ini.' : 'Akun pembaca tidak dapat mengubah jadwal.') }
export function assertEditable(p: MonthPlan, day: number, role: Role) {
  assertRole(role)
  if (p.locked) throw new Error('Bulan ini sudah dikunci. Minta admin membuka kunci terlebih dahulu.')
  if (day <= p.frozenThrough) throw new Error(`Tanggal 1–${p.frozenThrough} dikunci sebagai riwayat.`)
}
export function record(w: Workspace, action: string, actor: string): void {
  w.audit.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), action: action.slice(0, 250), actor })
  w.audit = w.audit.slice(0, 200)
}
export function setAssignment(w: Workspace, month: string, doctorId: string, date: string, code: string, role: Role): Workspace {
  const p = w.plans[month]
  if (!p || !monthDates(month).includes(date)) throw new Error('Tanggal atau bulan tidak ditemukan.')
  assertEditable(p, Number(date.slice(-2)), role)
  const d = w.doctors.find(d => d.id === doctorId), s = planShifts(w, p).find(s => s.code === code)
  if (!d || (code && (!s || !s.active))) throw new Error('Dokter atau kode dinas tidak tersedia.')
  if ((shiftHours(s) ?? 0) > 0 && !isAvailable(d, date)) throw new Error('Dinas jatuh pada masa cuti, sebelum bergabung, atau saat dokter nonaktif.')
  if ((shiftHours(s) ?? 0) > 0 && d.unit === 'anak' && s?.unit !== 'anak') throw new Error('Dokter ini hanya bertugas di ruang anak.')
  const next = cloneWorkspace(w)
  next.plans[month]!.assignments[doctorId] ??= {}
  next.plans[month]!.assignments[doctorId]![date] = code
  const issues = newBlockingIssues(w, next, month, [doctorId])
  if (issues.length) throw new Error(`${issues[0]!.message} (${issues[0]!.date})`)
  return next
}
export function createMonth(w: Workspace, month: string, role: Role, copyFrom?: string): Workspace {
  assertRole(role)
  daysInMonth(month)
  if (w.plans[month]) throw new Error('Jadwal bulan ini sudah tersedia.')
  const next = cloneWorkspace(w)
  const p: MonthPlan = { month, assignments: {}, boundaries: {}, locked: false, frozenThrough: 0, validationFrom: 1, shiftSnapshot: JSON.parse(JSON.stringify(w.shifts)) }
  const old = copyFrom ? w.plans[copyFrom] : undefined
  const off = w.shifts.find(s => s.kind === 'off')!.code, leave = w.shifts.find(s => s.kind === 'leave')!.code, bm = w.shifts.find(s => s.kind === 'not_started')!.code
  const child = w.shifts.find(s => s.unit === 'anak' && s.active)
  for (const d of w.doctors.filter(d => d.active)) {
    p.assignments[d.id] = {}
    p.boundaries[d.id] = { prev2: '', prev1: '', next1: '', next2: '' }
    for (const date of monthDates(month)) {
      let code = old?.assignments[d.id]?.[dateKey(old.month, Number(date.slice(-2)))] ?? ''
      if (d.joinedOn && date < d.joinedOn) code = bm
      else if (isOnLeave(d, date)) code = leave
      else if (d.unit === 'anak' && child) code = isSunday(date) ? off : child.code
      p.assignments[d.id]![date] = code
    }
    const previousMonthDate = new Date(`${month}-01T12:00:00Z`); previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1)
    const prevMonth = previousMonthDate.toISOString().slice(0, 7), prev = w.plans[prevMonth]
    if (prev) {
      const n = daysInMonth(prevMonth)
      p.boundaries[d.id]!.prev2 = prev.assignments[d.id]?.[dateKey(prevMonth, n - 1)] ?? ''
      p.boundaries[d.id]!.prev1 = prev.assignments[d.id]?.[dateKey(prevMonth, n)] ?? ''
    }
  }
  next.plans[month] = p
  return next
}
export function saveDoctor(w: Workspace, doctor: Doctor, role: Role): Workspace {
  assertRole(role, true)
  const next = cloneWorkspace(w), index = next.doctors.findIndex(d => d.id === doctor.id)
  if (index >= 0) next.doctors[index] = doctor
  else { next.doctors.push(doctor); for (const p of Object.values(next.plans)) { p.assignments[doctor.id] = {}; p.boundaries[doctor.id] = { prev2: '', prev1: '', next1: '', next2: '' } } }
  return parseWorkspace(next)
}
export function saveShift(w: Workspace, shift: ShiftCode, role: Role): Workspace {
  assertRole(role, true)
  const next = cloneWorkspace(w), index = next.shifts.findIndex(s => s.code === shift.code)
  if (index >= 0) next.shifts[index] = shift
  else next.shifts.push(shift)
  return parseWorkspace(next)
}
export function applyTimeTemplate(w: Workspace, template: 'A' | 'B' | '8', role: Role): Workspace {
  assertRole(role, true)
  const next = cloneWorkspace(w)
  const t = template === 'A' ? ['08:00', '14:00', '20:00', '08:00'] : template === '8' ? ['07:00', '15:00', '23:00', '07:00'] : ['07:00', '14:00', '21:00', '07:00']
  for (const s of next.shifts) {
    if (['PI', 'PRR'].includes(s.code)) { s.start = t[0]!; s.end = t[1]! }
    if (['SI', 'SR'].includes(s.code)) { s.start = t[1]!; s.end = t[2]! }
    if (['NI', 'NR'].includes(s.code)) { s.start = t[2]!; s.end = t[3]! }
    if (['PSI', 'PSR'].includes(s.code)) { s.start = t[0]!; s.end = template === 'A' ? '20:00' : '19:00' }
    if (['MI', 'MR'].includes(s.code)) { s.start = template === 'A' ? '20:00' : '19:00'; s.end = t[0]! }
  }
  return parseWorkspace(next)
}
export interface SwapSuggestion { doctorA: string; doctorB: string; date: string; codeA: string; codeB: string; spreadBefore: number; spreadAfter: number }
export function suggestFairSwap(w: Workspace, month: string): SwapSuggestion | null {
  const p = w.plans[month]
  if (!p || p.locked) return null
  const rows = summarize(w, p).filter(r => r.comparable && r.totalHours !== null && !r.emptyDays)
  if (rows.length < 2) return null
  const sorted = [...rows].sort((a, b) => b.totalHours! - a.totalHours!)
  const original = sorted[0]!.totalHours! - sorted.at(-1)!.totalHours!
  if (original === 0) return null
  let best: SwapSuggestion | null = null
  for (const high of sorted) for (const low of [...sorted].reverse()) {
    if (high.totalHours! <= low.totalHours!) continue
    for (const date of monthDates(month)) {
      if (Number(date.slice(-2)) <= p.frozenThrough || !isAvailable(high.doctor, date) || !isAvailable(low.doctor, date)) continue
      const codeA = p.assignments[high.doctor.id]?.[date] ?? '', codeB = p.assignments[low.doctor.id]?.[date] ?? ''
      const a = planShifts(w, p).find(s => s.code === codeA), b = planShifts(w, p).find(s => s.code === codeB)
      if (!a || !b || codeA === codeB) continue
      const diff = (shiftHours(a) ?? 0) - (shiftHours(b) ?? 0)
      if (diff <= 0 || diff >= high.totalHours! - low.totalHours!) continue
      const totals = rows.map(r => r.totalHours! + (r.doctor.id === high.doctor.id ? -diff : r.doctor.id === low.doctor.id ? diff : 0))
      const spread = Math.max(...totals) - Math.min(...totals)
      if (spread >= (best?.spreadAfter ?? original)) continue
      const next = cloneWorkspace(w)
      next.plans[month]!.assignments[high.doctor.id]![date] = codeB
      next.plans[month]!.assignments[low.doctor.id]![date] = codeA
      if (newBlockingIssues(w, next, month, [high.doctor.id, low.doctor.id]).length) continue
      best = { doctorA: high.doctor.id, doctorB: low.doctor.id, date, codeA, codeB, spreadBefore: original, spreadAfter: spread }
    }
  }
  return best
}
export function applySwap(w: Workspace, month: string, s: SwapSuggestion, role: Role): Workspace {
  const p = w.plans[month]!
  assertEditable(p, Number(s.date.slice(-2)), role)
  if (p.assignments[s.doctorA]?.[s.date] !== s.codeA || p.assignments[s.doctorB]?.[s.date] !== s.codeB) throw new Error('Jadwal berubah sejak saran dibuat. Hitung ulang saran.')
  const next = cloneWorkspace(w)
  next.plans[month]!.assignments[s.doctorA]![s.date] = s.codeB
  next.plans[month]!.assignments[s.doctorB]![s.date] = s.codeA
  const issues = newBlockingIssues(w, next, month, [s.doctorA, s.doctorB])
  if (issues.length) throw new Error(issues[0]!.message)
  return next
}
