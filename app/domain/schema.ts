import { z } from 'zod'
import type { Workspace } from './types'
import { isDoctorPhotoPath, assertDoctorPhotoScope } from './doctor-photo'

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const date = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/).refine(value => {
  const d = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
})
const code = z.string().min(1).max(16).regex(/^[A-Z0-9 _-]+$/)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const doctor = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), name: z.string().min(1).max(100), phone: z.string().max(30),
  photoPath: z.string().max(180).refine(isDoctorPhotoPath).nullable().optional(),
  unit: z.enum(['rotasi', 'anak']), active: z.boolean(), joinedOn: date.nullable(),
  leave: z.array(z.object({ from: date, to: date })).max(120),
})
const shift = z.object({
  code, label: z.string().min(1).max(140), unit: z.enum(['igd', 'ruangan', 'anak', 'lain', 'none']),
  kind: z.enum(['regular', 'long', 'off', 'leave', 'not_started', 'custom']),
  start: time.nullable(), end: time.nullable(), durationOverride: z.number().min(0).max(24).nullable(), active: z.boolean(),
})
const boundary = z.object({ prev2: z.string().max(16), prev1: z.string().max(16), next1: z.string().max(16), next2: z.string().max(16) })
const plan = z.object({
  month, assignments: z.record(z.string(), z.record(date, z.string().max(16))),
  boundaries: z.record(z.string(), boundary), locked: z.boolean(),
  frozenThrough: z.number().int().min(0).max(31), validationFrom: z.number().int().min(1).max(31),
  shiftSnapshot: z.array(shift).min(1).max(100).optional(),
})
export const workspaceSchema = z.object({
  schemaVersion: z.literal(1),
  settings: z.object({
    hospital: z.string().min(1).max(180), city: z.string().min(1).max(80), timezone: z.enum(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']),
    director: z.string().max(120), directorNip: z.string().max(30), sectionHead: z.string().max(120), sectionHeadNip: z.string().max(30),
    signedDate: z.union([date, z.literal('')]), minGapHours: z.number().min(0).max(48),
    maxConsecutiveLong: z.number().int().min(1).max(2), offAfterLong: z.number().int().min(1).max(7),
    maxConsecutiveWork: z.number().int().min(1).max(14), minimumCoverage: z.number().int().min(1).max(10),
  }),
  doctors: z.array(doctor).min(1).max(100), shifts: z.array(shift).min(1).max(100),
  plans: z.record(month, plan),
  audit: z.array(z.object({ id: z.string().max(80), at: z.string().max(40), actor: z.string().max(120), action: z.string().max(250) })).max(200),
})

export function parseWorkspace(input: unknown): Workspace {
  const parsed = workspaceSchema.safeParse(input)
  if (!parsed.success) throw new Error('Format data jadwal tidak valid.')
  const data = parsed.data
  const doctorIds = new Set(data.doctors.map(d => d.id))
  const codes = new Set(data.shifts.map(s => s.code))
  if (doctorIds.size !== data.doctors.length || codes.size !== data.shifts.length) throw new Error('ID dokter atau kode dinas ganda.')
  const validateShift = (s: z.infer<typeof shift>) => {
    const zero = ['off', 'leave', 'not_started'].includes(s.kind)
    if (!zero && s.durationOverride === null && (!s.start || !s.end || s.start === s.end)) throw new Error(`Jam kode ${s.code} belum valid.`)
    if (!zero && s.durationOverride === 0) throw new Error(`Dinas ${s.code} harus memiliki durasi positif.`)
  }
  data.shifts.forEach(validateShift)
  for (const d of data.doctors) if (d.photoPath) assertDoctorPhotoScope(d.photoPath, d.id)
  for (const d of data.doctors) for (const l of d.leave) if (l.from > l.to) throw new Error(`Rentang cuti ${d.name} terbalik.`)
  for (const [key, p] of Object.entries(data.plans)) {
    if (key !== p.month) throw new Error('Kunci bulan tidak sesuai dengan isi jadwal.')
    p.shiftSnapshot ??= JSON.parse(JSON.stringify(data.shifts))
    const planCodes = new Set(p.shiftSnapshot!.map(s => s.code))
    if (planCodes.size !== p.shiftSnapshot!.length) throw new Error('Kode dinas pada snapshot bulan ganda.')
    p.shiftSnapshot!.forEach(validateShift)
    const lastDay = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate()
    if (p.frozenThrough > lastDay || p.validationFrom > lastDay) throw new Error('Batas periode melewati jumlah hari bulan ini.')
    for (const [id, cells] of Object.entries(p.assignments)) {
      if (!doctorIds.has(id)) throw new Error('Jadwal merujuk dokter yang tidak terdaftar.')
      for (const [day, c] of Object.entries(cells)) {
        if (day.slice(0, 7) !== key || new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error('Tanggal jadwal di luar bulan.')
        if (c && !planCodes.has(c)) throw new Error(`Kode ${c} tidak ditemukan pada kode dinas bulan ${key}.`)
      }
    }
    for (const [id, b] of Object.entries(p.boundaries)) {
      if (!doctorIds.has(id)) throw new Error('Sambungan bulan merujuk dokter yang tidak terdaftar.')
      for (const c of Object.values(b)) if (c && !planCodes.has(c)) throw new Error(`Kode sambungan ${c} tidak ditemukan.`)
    }
  }
  if (!data.shifts.some(s => s.kind === 'off') || !data.shifts.some(s => s.kind === 'leave') || !data.shifts.some(s => s.kind === 'not_started')) throw new Error('Kode libur, cuti, dan belum mulai harus tersedia.')
  return data
}
