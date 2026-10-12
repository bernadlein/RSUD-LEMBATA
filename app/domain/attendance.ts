import { z } from 'zod'
import type { Workspace } from './types'
import { addDays } from './calendar'
import { isAvailable } from './analysis'
import { planShifts, shiftHours } from './shifts'

export const attendanceSchema = z.object({
  id: z.string().uuid(), workspace_id: z.string().uuid(), doctor_id: z.string(), doctor_name: z.string(), user_id: z.string().uuid().nullable(),
  duty_date: z.string(), shift_code: z.string(), scheduled_hours: z.coerce.number().positive(), scheduled_start: z.string(), scheduled_end: z.string(), check_in: z.string(), check_out: z.string().nullable(),
  check_in_distance_meters: z.coerce.number().finite().nonnegative().nullable().optional(),
  check_in_accuracy_meters: z.coerce.number().finite().nonnegative().nullable().optional(),
  check_out_distance_meters: z.coerce.number().finite().nonnegative().nullable().optional(),
  check_out_accuracy_meters: z.coerce.number().finite().nonnegative().nullable().optional(),
})
export const doctorAccountSchema = z.object({ workspace_id: z.string().uuid(), doctor_id: z.string(), user_id: z.string().uuid() })
export type Attendance = z.infer<typeof attendanceSchema>
export type DoctorAccount = z.infer<typeof doctorAccountSchema>
export interface DutyOption { date: string; code: string; hours: number; start: number; end: number }

export function attendanceQrContext(query: { w?: unknown; q?: unknown }, workspaceId: string) {
  if (!query.w && !query.q) return { scanned: false, token: null, error: '' }
  const id = z.string().uuid().safeParse(query.w), token = z.string().uuid().safeParse(query.q)
  if (!id.success || !token.success) return { scanned: true, token: null, error: 'Alamat QR absensi belum valid. Pindai kembali QR fasilitas.' }
  if (id.data !== workspaceId) return { scanned: true, token: null, error: 'QR ini berasal dari ruang kerja lain. Gunakan akun dan QR fasilitas yang sesuai.' }
  return { scanned: true, token: token.data, error: '' }
}

export function attendanceDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key)!.value).join('-')
}
export function attendanceClock(value: string | null, timezone: string): string {
  return value ? new Intl.DateTimeFormat('id-ID', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '—'
}
export function attendanceHours(row: Attendance): number | null {
  if (!row.check_out) return null
  return Math.round(Math.max(0, (Date.parse(row.check_out) - Date.parse(row.check_in)) / 3600000) * 100) / 100
}
export function availableDuties(w: Workspace, doctorId: string, now: Date): DutyOption[] {
  const d = w.doctors.find(d => d.id === doctorId), today = attendanceDate(now, w.settings.timezone)
  if (!d) return []
  const offset = { 'Asia/Jakarta': '+07:00', 'Asia/Makassar': '+08:00', 'Asia/Jayapura': '+09:00' }[w.settings.timezone]
  return [addDays(today, -1), today].flatMap(date => {
    const plan = w.plans[date.slice(0, 7)], code = plan?.assignments[doctorId]?.[date]
    const shift = plan && planShifts(w, plan).find(s => s.code === code), hours = shiftHours(shift)
    if (!isAvailable(d, date) || !code || !shift?.start || !shift.end || !hours || hours <= 0) return []
    const start = Date.parse(`${date}T${shift.start}:00${offset}`), end = start + hours * 3600000
    return now.getTime() >= start - 2 * 3600000 && now.getTime() < end ? [{ date, code, hours, start, end }] : []
  })
}
export function safeAttendanceReturn(value: unknown): string {
  if (typeof value !== 'string') return '/'
  try {
    const url = new URL(value, 'https://ruang-dinas.invalid')
    return url.origin === 'https://ruang-dinas.invalid' && url.pathname === '/absen' ? `${url.pathname}${url.search}` : '/'
  } catch { return '/' }
}
export function qrAttendanceLink(origin: string, workspaceId: string, token: string): string {
  z.string().uuid().parse(workspaceId); z.string().uuid().parse(token)
  const url = new URL('/absen', origin)
  url.searchParams.set('w', workspaceId); url.searchParams.set('q', token)
  return url.toString()
}
