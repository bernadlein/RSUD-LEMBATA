export function daysInMonth(month: string): number {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Bulan tidak valid.')
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate()
}
export function dateKey(month: string, day: number): string { return `${month}-${String(day).padStart(2, '0')}` }
export function monthDates(month: string): string[] { return Array.from({ length: daysInMonth(month) }, (_, i) => dateKey(month, i + 1)) }
export function weekday(date: string): string { return new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) }
export function isSunday(date: string): boolean { return new Date(`${date}T12:00:00Z`).getUTCDay() === 0 }
export function monthLabel(month: string): string { return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`)) }
export function prettyDate(date: string): string { return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) }
export function addDays(date: string, n: number): string { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
export function formatHours(value: number | null): string { return value === null ? 'Belum lengkap' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value) }
