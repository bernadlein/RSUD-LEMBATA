import type { SupabaseClient } from '@supabase/supabase-js'
import { attendanceSchema, doctorAccountSchema } from '../domain/attendance'
import type { Attendance, DoctorAccount } from '../domain/attendance'
import { addDays, monthDates } from '../domain/calendar'

function fail(error: { message: string; code?: string } | null) {
  if (!error) return
  if (['42P01', 'PGRST202', 'PGRST205'].includes(error.code ?? '')) throw new Error('Absensi belum diaktifkan. Admin perlu menjalankan migrasi 002_attendance.sql di Supabase.')
  throw new Error(error.message)
}
export interface AttendanceRepository {
  load(workspaceId: string, month: string, today: string): Promise<{ records: Attendance[]; recent: Attendance[]; open: Attendance[]; accounts: DoctorAccount[] }>
  qr(workspaceId: string, rotate?: boolean): Promise<string>
  bind(workspaceId: string, doctorId: string, userId: string): Promise<void>
  unbind(workspaceId: string, doctorId: string): Promise<void>
  mark(workspaceId: string, token: string, action: 'masuk' | 'pulang', date: string): Promise<Attendance>
}
export class SupabaseAttendanceRepository implements AttendanceRepository {
  constructor(private client: SupabaseClient) {}
  async load(workspaceId: string, month: string, today: string) {
    const dates = monthDates(month), records: Attendance[] = []
    for (let page = 0; page < 8; page++) {
      const { data, error } = await this.client.from('rd_attendance').select('*').eq('workspace_id', workspaceId)
        .gte('duty_date', dates[0]!).lt('duty_date', addDays(dates.at(-1)!, 1)).order('duty_date', { ascending: false }).order('id').range(page * 500, page * 500 + 499)
      fail(error)
      const rows = attendanceSchema.array().parse(data ?? [])
      records.push(...rows)
      if (rows.length < 500) break
      if (page === 7) throw new Error('Rekap melebihi 4.000 catatan. Hubungi admin untuk mengekspor rentang tanggal yang lebih pendek.')
    }
    const results = await Promise.all([
      this.client.from('rd_attendance').select('*').eq('workspace_id', workspaceId).is('check_out', null).order('check_in', { ascending: false }).limit(100),
      this.client.from('rd_doctor_accounts').select('workspace_id,doctor_id,user_id').eq('workspace_id', workspaceId).limit(100),
      this.client.from('rd_attendance').select('*').eq('workspace_id', workspaceId).gte('duty_date', addDays(today, -1)).lte('duty_date', today).limit(200),
    ])
    results.forEach(r => fail(r.error))
    return { records, open: attendanceSchema.array().parse(results[0].data ?? []), accounts: doctorAccountSchema.array().parse(results[1].data ?? []), recent: attendanceSchema.array().parse(results[2].data ?? []) }
  }
  async qr(workspaceId: string, rotate = false): Promise<string> {
    const { data, error } = await this.client.rpc('rd_get_attendance_qr', { p_workspace_id: workspaceId, p_rotate: rotate }); fail(error)
    if (typeof data !== 'string') throw new Error('QR belum tersedia.')
    return data
  }
  async bind(workspaceId: string, doctorId: string, userId: string) {
    const { error } = await this.client.rpc('rd_bind_doctor_account', { p_workspace_id: workspaceId, p_doctor_id: doctorId, p_user_id: userId }); fail(error)
  }
  async unbind(workspaceId: string, doctorId: string) {
    const { error } = await this.client.rpc('rd_unbind_doctor_account', { p_workspace_id: workspaceId, p_doctor_id: doctorId }); fail(error)
  }
  async mark(workspaceId: string, token: string, action: 'masuk' | 'pulang', date: string): Promise<Attendance> {
    const { data, error } = await this.client.rpc('rd_mark_attendance', { p_workspace_id: workspaceId, p_qr_token: token, p_action: action, p_duty_date: date }); fail(error)
    return attendanceSchema.parse(data)
  }
}
