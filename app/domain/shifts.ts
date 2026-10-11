import type { MonthPlan, ShiftCode, Unit, Workspace } from './types'
export function planShifts(w: Workspace, p: MonthPlan): ShiftCode[] { return p.shiftSnapshot ?? w.shifts }
export const unitLabels: Record<Unit, string> = { igd: 'IGD', ruangan: 'Ruangan', anak: 'Ruang anak', lain: 'Lainnya', none: 'Tidak bertugas' }
export function minutes(time: string): number { const [h, m] = time.split(':').map(Number); return h! * 60 + m! }
export function shiftHours(shift: ShiftCode | undefined): number | null {
  if (!shift) return null
  if (['off', 'leave', 'not_started'].includes(shift.kind)) return 0
  if (shift.durationOverride !== null) return shift.durationOverride
  if (!shift.start || !shift.end || shift.start === shift.end) return null
  return ((minutes(shift.end) - minutes(shift.start) + 1440) % 1440) / 60
}
export function clockLabel(s: ShiftCode | undefined): string {
  if (!s) return 'Belum diisi'
  if (s.kind === 'off') return 'Libur'
  if (s.kind === 'leave') return 'Cuti'
  if (s.kind === 'not_started') return 'Belum mulai'
  if (!s.start || !s.end) return `${shiftHours(s) ?? '?'} jam · waktu belum diisi`
  const next = minutes(s.end) <= minutes(s.start) ? ' +1' : ''
  return `${s.start}–${s.end}${next}`
}
export function shiftStyle(s: ShiftCode | undefined): string {
  if (!s) return 'bg-slate-50 text-slate-400'
  if (s.kind === 'leave') return 'bg-amber-50 text-amber-700'
  if (s.kind === 'off' || s.kind === 'not_started') return 'bg-slate-100 text-slate-500'
  if (s.unit === 'igd') return (shiftHours(s) ?? 0) >= 12 ? 'bg-brand-100 text-brand-800' : 'bg-brand-50 text-brand-700'
  if (s.unit === 'ruangan') return (shiftHours(s) ?? 0) >= 12 ? 'bg-indigo-100 text-indigo-800' : 'bg-indigo-50 text-indigo-700'
  if (s.unit === 'anak') return 'bg-lime-100 text-lime-800'
  return 'bg-orange-50 text-orange-700'
}
export function isNight(s: ShiftCode | undefined): boolean { return !!s?.start && !!s.end && minutes(s.end) < minutes(s.start) }
export function shiftInterval(s: ShiftCode | undefined, dayIndex: number): [number, number] | null {
  if (!s?.start || (shiftHours(s) ?? 0) === 0) return null
  const start = dayIndex * 1440 + minutes(s.start)
  return [start, start + (shiftHours(s)! * 60)]
}
