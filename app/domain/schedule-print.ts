import type { MonthPlan, Workspace } from './types'
import { monthDates, prettyDate } from './calendar'
import { planShifts, shiftHours, clockLabel } from './shifts'
import { HOSPITAL_CITY, HOSPITAL_NAME } from './branding'

export function schedulePrintData(workspace: Workspace, plan: MonthPlan) {
  const codes = new Set(Object.values(plan.assignments).flatMap(row => Object.values(row)))
  const shifts = planShifts(workspace, plan).filter(s => codes.has(s.code) && s.code !== plan.printDetails?.blankCode)
  const legend = plan.printDetails?.legend ?? shifts.map(s => ({ code: s.code, label: s.label }))
  const settings = workspace.settings
  const city = !settings.city || settings.city === 'Kota Anda' ? HOSPITAL_CITY : settings.city
  const signedAt = settings.signedDate ? `${city}, ${prettyDate(settings.signedDate)}` : ''
  const director = { id: 'director', preamble: signedAt, title: 'Direktur', name: settings.director, nip: settings.directorNip }
  const head = { id: 'head', preamble: 'Mengetahui,', title: settings.sectionHeadTitle ?? 'Kepala Seksi Pelayanan Medik', name: settings.sectionHead, nip: settings.sectionHeadNip }
  if (settings.signatureOrder !== 'head-first') { director.preamble = 'Mengetahui,'; head.preamble = signedAt }
  return {
    hospital: HOSPITAL_NAME, dates: monthDates(plan.month),
    legendTitle: plan.printDetails?.legendTitle ?? 'Keterangan kode dinas', legend,
    clocks: shifts.map(s => ({ code: s.code, label: clockLabel(s), hours: shiftHours(s) })),
    notes: plan.printDetails?.notes ?? [], showPhone: plan.printDetails?.showPhone ?? false,
    blankCode: plan.printDetails?.blankCode,
    signatories: settings.signatureOrder === 'head-first' ? [head, director] : [director, head],
  }
}
