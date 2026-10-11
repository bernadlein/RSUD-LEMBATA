import QRCode from 'qrcode'
import type { Attendance } from '../domain/attendance'
import { attendanceHours } from '../domain/attendance'
import { safeCsv } from './exports'

export async function attendanceQrSvg(url: string): Promise<string> {
  const target = new URL(url)

  if (
    !['http:', 'https:'].includes(target.protocol) ||
    target.pathname !== '/absen'
  ) {
    throw new Error('Alamat QR absensi tidak valid.')
  }

  return QRCode.toString(target.toString(), {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 512,
    color: {
      dark: '#101c21',
      light: '#ffffff',
    },
  })
}

export function attendanceCsv(
  rows: Attendance[],
  timezone: string,
): string {
  const datetime = (value: string | null): string => {
    if (!value) return ''

    return new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value))
  }

  const values = [
    [
      'Tanggal dinas',
      'Dokter',
      'Kode',
      'Jam terjadwal',
      'Masuk',
      'Pulang',
      'Jam kehadiran',
      'Status',
    ],
    ...rows.map(row => [
      row.duty_date,
      row.doctor_name,
      row.shift_code,
      String(row.scheduled_hours),
      datetime(row.check_in),
      datetime(row.check_out),
      attendanceHours(row)?.toString() ?? '',
      row.check_out ? 'Selesai' : 'Belum pulang',
    ]),
  ]

  return (
    '\uFEFF' +
    values
      .map(row => row.map(safeCsv).join(';'))
      .join('\r\n')
  )
}
