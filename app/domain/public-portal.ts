import { attendanceDate } from './attendance'
import { addDays, monthDates, monthLabel, prettyDate } from './calendar'
import { HOSPITAL_CITY, HOSPITAL_NAME } from './branding'
import type { PublicHospital, PublicNews } from './hospital-portal'

/** Read models for the public website. No private workspace data is accepted. */
export type PublicScheduleRow = PublicHospital['schedule']['rows'][number]
export type PublicUnit = PublicScheduleRow['unit']
export type PublicUnitFilter = PublicUnit | 'all'
export type PublicTone = 'teal' | 'lime'
export interface PublicNavItem { to: string; label: string; active: boolean }
export interface PublicContactItem { id: string; label: string; text: string; href: string | null; external: boolean }
export interface PublicDay { value: string; label: string; weekday: string; number: string; today: boolean }
export interface PublicScheduleItem {
  id: string; doctorId: string; doctorName: string; initials: string; photoUrl: string | null; date: string;
  dateLabel: string; unit: PublicUnit; unitLabel: string; tone: PublicTone;
  code: string; label: string; timeLabel: string; hoursLabel: string; note: string;
}
export interface PublicDoctorItem {
  id: string; name: string; initials: string; photoUrl: string | null; unitLabel: string; tone: PublicTone;
  scheduleUrl: string; nextDuty: PublicScheduleItem | null;
}
export interface PublicNewsItem {
  id: string; title: string; summary: string; date: string; dateLabel: string; url: string;
}

const unitNames: Record<PublicUnit, string> = { igd: 'IGD', ruangan: 'Ruangan', anak: 'Ruang anak', lain: 'Layanan lainnya' }
export const publicUnitOptions: { value: PublicUnitFilter; label: string }[] = [
  { value: 'all', label: 'Semua unit' },
  ...Object.entries(unitNames).map(([value, label]) => ({ value: value as PublicUnit, label })),
]
const normalized = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('id-ID').trim()
const timeText = (value: string) => value.replace(':', '.')

export function publicInitials(name: string): string {
  return name.replace(/^dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0] ?? '').join('').toUpperCase()
}
export function publicDateLabel(date: string): string {
  const day = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'))
  return `${day}, ${prettyDate(date)}`
}
export function publicTimezone(timezone: PublicHospital['timezone']): string {
  return { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' }[timezone]
}
export function publicUpdatedAt(hospital: PublicHospital | null): string {
  if (!hospital) return ''
  const date = new Date(hospital.publishedAt)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: hospital.timezone }).format(date)
}
export function publicIdentity(hospital: PublicHospital | null) {
  return { name: HOSPITAL_NAME, city: hospital?.city.trim() || HOSPITAL_CITY }
}
export function publicNavigation(hospital: PublicHospital | null, path: string, hash = ''): PublicNavItem[] {
  const links = [{ to: '/', label: 'Beranda' }, { to: '/jadwal-dokter', label: 'Jadwal dokter' }]
  if (hospital?.services.length) links.push({ to: '/#layanan', label: 'Layanan' })
  links.push({ to: '/berita', label: 'Berita RS' })
  if (hospital?.about.trim()) links.push({ to: '/#tentang', label: 'Tentang RS' })
  return links.map(link => ({ ...link, active: link.to.includes('#')
    ? path === '/' && hash === link.to.slice(1)
    : link.to === '/' ? path === '/' && !hash : path === link.to || path.startsWith(link.to + '/') }))
}
export function publicContacts(hospital: PublicHospital | null): PublicContactItem[] {
  if (!hospital) return []
  const items: PublicContactItem[] = []
  const address = hospital.address.trim(), phone = hospital.phone.trim(), email = hospital.email.trim()
  if (address) items.push({ id: 'address', label: 'Alamat', text: address, href: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address), external: true })
  if (phone) {
    const number = phone.replace(/[\s().-]/g, '')
    items.push({ id: 'phone', label: 'Telepon', text: phone, href: /^\+?\d{5,20}$/.test(number) ? 'tel:' + number : null, external: false })
  }
  if (email) items.push({ id: 'email', label: 'Email', text: email, href: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'mailto:' + email : null, external: false })
  return items
}
export function publicScheduleDays(hospital: PublicHospital | null, now = new Date()): PublicDay[] {
  if (!hospital?.schedule.month) return []
  const today = attendanceDate(now, hospital.timezone)
  return monthDates(hospital.schedule.month).map(value => ({
    value, label: publicDateLabel(value),
    weekday: new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z')),
    number: String(Number(value.slice(-2))), today: value === today,
  }))
}
export function publicDefaultDay(hospital: PublicHospital | null, requested = '', now = new Date()): string {
  const days = publicScheduleDays(hospital, now)
  if (days.some(day => day.value === requested)) return requested
  return days.find(day => day.today)?.value ?? days[0]?.value ?? ''
}
export function publicDayWindow(days: PublicDay[], selected: string): PublicDay[] {
  const index = Math.max(0, days.findIndex(day => day.value === selected))
  const start = Math.max(0, Math.min(index - 3, days.length - 7))
  return days.slice(start, start + 7)
}
export function publicScheduleItem(row: PublicScheduleRow, photoUrl: string | null = null): PublicScheduleItem {
  const hasTimes = !!row.start && !!row.end
  const overnight = hasTimes && row.end! <= row.start!
  return {
    id: [row.date, row.doctorId, row.unit, row.code].join(':'),
    doctorId: row.doctorId, doctorName: row.doctorName, initials: publicInitials(row.doctorName), photoUrl, date: row.date,
    dateLabel: publicDateLabel(row.date), unit: row.unit, unitLabel: unitNames[row.unit], tone: row.unit === 'anak' ? 'lime' : 'teal',
    code: row.code, label: row.label,
    timeLabel: hasTimes ? `${timeText(row.start!)} – ${timeText(row.end!)}` : row.hours ? `${row.hours} jam` : 'Waktu belum tersedia',
    hoursLabel: row.hours ? `${new Intl.NumberFormat('id-ID').format(row.hours)} jam` : '',
    note: overnight ? `Selesai ${prettyDate(addDays(row.date, 1))}` : hasTimes ? '' : 'Waktu mulai belum tercantum.',
  }
}
export function publicScheduleResults(hospital: PublicHospital | null, date: string, query = '', unit: PublicUnitFilter = 'all'): PublicScheduleItem[] {
  const search = normalized(query)
  const photos = new Map(hospital?.doctors.map(doctor => [doctor.id, doctor.photoUrl ?? null]))
  return (hospital?.schedule.rows ?? []).filter(row => row.date === date && (unit === 'all' || row.unit === unit) && normalized(row.doctorName).includes(search))
    .slice().sort((a, b) => (a.start ?? '99:99').localeCompare(b.start ?? '99:99') || a.doctorName.localeCompare(b.doctorName, 'id-ID'))
    .map(row => publicScheduleItem(row, photos.get(row.doctorId) ?? null))
}
export function publicDoctorItems(hospital: PublicHospital | null, now = new Date()): PublicDoctorItem[] {
  if (!hospital) return []
  const today = attendanceDate(now, hospital.timezone)
  return hospital.doctors.map(doctor => {
    const next = hospital.schedule.rows.filter(row => row.doctorId === doctor.id && row.date >= today)
      .slice().sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '99:99').localeCompare(b.start ?? '99:99'))[0]
    return {
      id: doctor.id, name: doctor.name, initials: publicInitials(doctor.name), photoUrl: doctor.photoUrl ?? null,
      unitLabel: doctor.unit === 'anak' ? 'Ruang anak' : 'IGD dan ruangan',
      tone: doctor.unit === 'anak' ? 'lime' : 'teal', scheduleUrl: '/jadwal-dokter?' + new URLSearchParams({ dokter: doctor.name }),
      nextDuty: next ? publicScheduleItem(next, doctor.photoUrl ?? null) : null,
    }
  })
}
function newsSummary(item: PublicNews): string {
  if (item.summary.trim()) return item.summary.trim()
  const text = item.content.replace(/\s+/g, ' ').trim()
  return text.length > 180 ? text.slice(0, 177).trimEnd() + '…' : text
}
export function publicNewsItems(hospital: PublicHospital | null, query = ''): PublicNewsItem[] {
  const search = normalized(query)
  return (hospital?.news ?? []).filter(item => normalized(item.title + ' ' + item.summary + ' ' + item.content).includes(search))
    .slice().sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .map(item => ({ id: item.id, title: item.title, summary: newsSummary(item), date: item.date, dateLabel: prettyDate(item.date), url: '/berita/' + encodeURIComponent(item.id) }))
}
export function publicArticle(hospital: PublicHospital | null, id: unknown) {
  if (typeof id !== 'string') return null
  const item = hospital?.news.find(news => news.id === id)
  return item ? { ...item, dateLabel: prettyDate(item.date), paragraphs: item.content.trim().split(/\n\s*\n/).filter(Boolean) } : null
}
export function publicScheduleMonth(hospital: PublicHospital | null): string {
  return hospital?.schedule.month ? monthLabel(hospital.schedule.month) : ''
}
