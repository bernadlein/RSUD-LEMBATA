import { z } from 'zod'
import type { Workspace } from './types'
import { orderedDoctors } from './doctor-roster'
import { monthDates } from './calendar'
import { planShifts, shiftHours } from './shifts'
import { isPublicDoctorPhotoUrl, isPublicDoctorPhotoVersion, publicDoctorPhotoUrl, publicDoctorPhotoVersion } from './public-doctor-photo'

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + 'T12:00:00Z')
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
})
const news = z.object({
  id: z.string().uuid(), title: z.string().trim().min(1).max(160),
  summary: z.string().max(400), content: z.string().min(1).max(12000), date,
})
export const portalDraftSchema = z.object({
  about: z.string().max(4000), address: z.string().max(500), phone: z.string().max(40),
  email: z.union([z.literal(''), z.email().max(180)]),
  services: z.array(z.string().trim().min(1).max(120)).max(20),
  scheduleMonth: month.nullable(),
  news: z.array(news.extend({ published: z.boolean() })).max(30),
})
export type PortalDraft = z.infer<typeof portalDraftSchema>
export const publicHospitalSchema = z.object({
  schemaVersion: z.literal(1), workspaceId: z.string().uuid(),
  name: z.string().min(1).max(180), city: z.string().max(80),
  timezone: z.enum(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']),
  about: z.string().max(4000), address: z.string().max(500), phone: z.string().max(40),
  email: z.string().max(180), services: z.array(z.string().max(120)).max(20),
  doctors: z.array(z.object({
    id: z.string().max(80), name: z.string().max(100), unit: z.enum(['rotasi', 'anak']),
    photoUrl: z.string().max(220).refine(isPublicDoctorPhotoUrl).nullable().optional(),
  })).max(100),
  schedule: z.object({
    month: month.nullable(),
    rows: z.array(z.object({
      date, doctorId: z.string().max(80), doctorName: z.string().max(100),
      unit: z.enum(['igd', 'ruangan', 'anak', 'lain']), code: z.string().max(16), label: z.string().max(140),
      start: z.string().nullable(), end: z.string().nullable(), hours: z.number().positive().max(24).nullable(),
    })).max(3100),
  }),
  news: z.array(news).max(30), publishedAt: z.string(),
})
export type PublicHospital = z.infer<typeof publicHospitalSchema>
export const publishedHospitalSchema = publicHospitalSchema.extend({
  doctors: z.array(z.object({
    id: z.string().max(80), name: z.string().max(100), unit: z.enum(['rotasi', 'anak']),
    photoVersion: z.string().refine(isPublicDoctorPhotoVersion).nullable().optional(),
  })).max(100),
})
export type PublishedHospital = z.infer<typeof publishedHospitalSchema>
export type PublicNews = z.infer<typeof news>
export interface PortalState { data: PortalDraft; revision: number; publishedAt: string | null }

export function emptyPortalDraft(): PortalDraft {
  return { about: '', address: '', phone: '', email: '', services: [], scheduleMonth: null, news: [] }
}

/** Build a deliberate public projection; private workspace fields never enter it. */
export function buildPublicHospital(w: Workspace, input: PortalDraft, workspaceId: string, publishedAt: string): PublishedHospital {
  const draft = portalDraftSchema.parse(input)
  const doctors = orderedDoctors(w.doctors.filter(d => d.active))
  const rows: PublicHospital['schedule']['rows'] = []
  if (draft.scheduleMonth) {
    const plan = w.plans[draft.scheduleMonth]
    if (!plan || !plan.locked) throw new Error('Kunci jadwal bulan yang dipilih sebelum menerbitkannya ke publik.')
    const shifts = planShifts(w, plan)
    for (const date of monthDates(draft.scheduleMonth)) for (const doctor of doctors) {
      const code = plan.assignments[doctor.id]?.[date]
      const shift = shifts.find(s => s.code === code), hours = shiftHours(shift)
      if (!shift || !hours || hours <= 0 || ['off', 'leave', 'not_started'].includes(shift.kind) || shift.unit === 'none') continue
      rows.push({
        date, doctorId: doctor.id, doctorName: doctor.name, unit: shift.unit,
        code: shift.code, label: shift.label, start: shift.start, end: shift.end, hours,
      })
    }
  }
  return publishedHospitalSchema.parse({
    schemaVersion: 1, workspaceId, name: w.settings.hospital, city: w.settings.city, timezone: w.settings.timezone,
    about: draft.about, address: draft.address, phone: draft.phone, email: draft.email, services: draft.services,
    doctors: doctors.map(d => {
      const photoVersion = publicDoctorPhotoVersion(d.photoPath, d.id, workspaceId)
      return { id: d.id, name: d.name, unit: d.unit, ...(photoVersion ? { photoVersion } : {}) }
    }),
    schedule: { month: draft.scheduleMonth, rows },
    news: draft.news.filter(n => n.published).map(n => ({ id: n.id, title: n.title, summary: n.summary, content: n.content, date: n.date })),
    publishedAt,
  })
}

/** Resolve public image URLs from an approved snapshot without exposing storage paths. */
export function readPublicHospital(input: unknown): PublicHospital {
  const published = publishedHospitalSchema.parse(input)
  return publicHospitalSchema.parse({
    ...published,
    doctors: published.doctors.map(doctor => ({
      id: doctor.id, name: doctor.name, unit: doctor.unit,
      photoUrl: publicDoctorPhotoUrl(doctor.photoVersion, doctor.id),
    })),
  })
}
