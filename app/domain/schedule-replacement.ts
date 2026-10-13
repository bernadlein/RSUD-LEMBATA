import { z } from 'zod'
import type { Doctor, Role, Workspace } from './types'
import { workspaceSchema, parseWorkspace } from './schema'
import { assertRole, cloneWorkspace } from './commands'
import { addDays, monthDates } from './calendar'
import { shiftHours } from './shifts'

const replacementSchema = z.object({
  format: z.literal('rsud-month-schedule'), version: z.literal(1),
  source: z.object({ file: z.string().min(1).max(180), sheet: z.string().min(1).max(80) }),
  doctors: z.array(workspaceSchema.shape.doctors.element.omit({ photoPath: true }).strict()).min(1).max(100),
  shifts: workspaceSchema.shape.shifts,
  plan: workspaceSchema.shape.plans.valueType,
  approval: workspaceSchema.shape.settings.pick({
    director: true, directorNip: true, sectionHead: true, sectionHeadNip: true,
    sectionHeadTitle: true, signatureOrder: true, signedDate: true,
  }),
  expectedHours: z.record(z.string(), z.number().min(0).max(744)),
}).strict()

export type ScheduleReplacement = z.infer<typeof replacementSchema>

export function isScheduleReplacement(input: unknown): boolean {
  return !!input && typeof input === 'object' && 'format' in input && input.format === 'rsud-month-schedule'
}

export function parseScheduleReplacement(input: unknown): ScheduleReplacement {
  const parsed = replacementSchema.safeParse(input)
  if (!parsed.success) throw new Error('Format berkas pengganti jadwal tidak valid.')
  const packet = parsed.data
  const dates = monthDates(packet.plan.month)
  const ids = new Set(packet.doctors.map(d => d.id))
  const shifts = new Map(packet.shifts.map(s => [s.code, s]))
  if (ids.size !== packet.doctors.length || shifts.size !== packet.shifts.length) throw new Error('ID dokter atau kode dinas ganda.')
  if (packet.plan.locked) throw new Error('Jadwal impor harus terbuka untuk pemeriksaan.')
  for (const key of Object.keys(packet.plan.assignments)) if (!ids.has(key)) throw new Error('Jadwal memuat dokter di luar daftar impor.')
  for (const key of Object.keys(packet.plan.boundaries)) if (!ids.has(key)) throw new Error('Sambungan bulan memuat dokter di luar daftar impor.')
  for (const key of Object.keys(packet.expectedHours)) if (!ids.has(key)) throw new Error('Total jam memuat dokter di luar daftar impor.')
  for (const doctor of packet.doctors) {
    const row = packet.plan.assignments[doctor.id]
    if (!row || Object.keys(row).length !== dates.length || dates.some(date => !row[date])) throw new Error(`Jadwal ${doctor.name} belum lengkap.`)
    let total = 0
    for (const date of dates) {
      const hours = shiftHours(shifts.get(row[date]!))
      if (hours === null) throw new Error(`Kode atau durasi ${doctor.name} pada ${date} belum valid.`)
      total += hours
    }
    if (packet.expectedHours[doctor.id] === undefined || Math.abs(total - packet.expectedHours[doctor.id]!) > 0.001) throw new Error(`Total jam ${doctor.name} tidak sesuai berkas sumber.`)
  }
  // Use the shared workspace validator for calendar, photo, code and snapshot rules.
  const checked = parseWorkspace({
    schemaVersion: 1,
    settings: {
      hospital: 'RSUD LEWOLEBA', city: 'Lewoleba', timezone: 'Asia/Makassar',
      minGapHours: 11, maxConsecutiveLong: 2, offAfterLong: 2, maxConsecutiveWork: 5, minimumCoverage: 1,
      ...packet.approval,
    },
    doctors: packet.doctors, shifts: packet.shifts,
    plans: { [packet.plan.month]: { ...packet.plan, shiftSnapshot: packet.shifts } }, audit: [],
  })
  packet.plan = checked.plans[packet.plan.month]!
  return packet
}

function replaceMonthLeave(current: Doctor['leave'], incoming: Doctor['leave'], first: string, last: string): Doctor['leave'] {
  const result: Doctor['leave'] = []
  for (const range of current) {
    if (range.to < first || range.from > last) result.push({ ...range })
    else {
      if (range.from < first) result.push({ from: range.from, to: addDays(first, -1) })
      if (range.to > last) result.push({ from: addDays(last, 1), to: range.to })
    }
  }
  for (const range of incoming) {
    if (range.from < first || range.to > last) throw new Error('Cuti impor harus berada dalam bulan jadwal.')
    result.push({ ...range })
  }
  return result.sort((a, b) => a.from.localeCompare(b.from))
}

export function replaceMonthSchedule(current: Workspace, input: unknown, role: Role): Workspace {
  assertRole(role, true)
  const packet = parseScheduleReplacement(input)
  // Fill legacy snapshots before editing master durations, keeping other months stable.
  const next = parseWorkspace(cloneWorkspace(current))
  const dates = monthDates(packet.plan.month), first = dates[0]!, last = dates.at(-1)!
  const existing = new Map(next.doctors.map(d => [d.id, d]))
  const ids = new Set(packet.doctors.map(d => d.id))
  if (next.doctors.some(d => d.active && !ids.has(d.id))) throw new Error('Ada dokter aktif di luar daftar impor. Periksa daftar dokter sebelum mengganti jadwal.')
  const imported = packet.doctors.map(source => {
    const doctor = existing.get(source.id)
    if (!doctor) throw new Error(`ID ${source.id} untuk ${source.name} belum terdaftar. Periksa identitas dokter.`)
    return {
      ...doctor, name: source.name, phone: source.phone, unit: source.unit, active: source.active,
      joinedOn: source.joinedOn ?? doctor.joinedOn,
      leave: replaceMonthLeave(doctor.leave, source.leave, first, last),
    }
  })
  next.doctors = [...imported, ...next.doctors.filter(d => !ids.has(d.id))]
  const shiftUpdates = new Map(packet.shifts.map(s => [s.code, s]))
  next.shifts = next.shifts.map(s => shiftUpdates.get(s.code) ?? s)
  for (const s of packet.shifts) if (!next.shifts.some(old => old.code === s.code)) next.shifts.push(s)
  next.plans[packet.plan.month] = JSON.parse(JSON.stringify(packet.plan))
  next.settings = { ...next.settings, ...packet.approval }
  return parseWorkspace(next)
}
