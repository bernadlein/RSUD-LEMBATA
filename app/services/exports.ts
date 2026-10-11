import type { MonthPlan, Workspace } from '../domain/types'
import { monthDates } from '../domain/calendar'
import { summarize } from '../domain/analysis'
export function downloadText(text: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function safeCsv(value: unknown): string {
  let s = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
export function rosterCsv(w: Workspace, p: MonthPlan): string {
  const dates = monthDates(p.month)
  const header = ['No', 'Dokter', ...dates, 'Total jam', 'Hari belum diisi']
  const rows = summarize(w, p).map((r, i) => [i + 1, r.doctor.name, ...dates.map(date => p.assignments[r.doctor.id]?.[date] ?? ''), r.totalHours, r.emptyDays])
  return '\uFEFF' + [header, ...rows].map(r => r.map(safeCsv).join(';')).join('\r\n')
}
