import type { Doctor, Role, Workspace } from './types'
import { assertRole, cloneWorkspace } from './commands'

export const DOCTOR_ROSTER = [
  { name: 'Ela', aliases: ['ella'], unit: 'rotasi' },
  { name: 'Maria', aliases: [], unit: 'rotasi' },
  { name: 'Yunita', aliases: [], unit: 'rotasi' },
  { name: 'Trisya', aliases: [], unit: 'rotasi' },
  { name: 'Rury', aliases: [], unit: 'rotasi' },
  { name: 'Gredi', aliases: ['grendi'], unit: 'rotasi' },
  { name: 'Evira', aliases: ['elvira'], unit: 'rotasi' },
  { name: 'Putra', aliases: [], unit: 'rotasi' },
  { name: 'Dafrosa', aliases: ['dafro'], unit: 'anak' },
] as const

const normalized = (name: string) => name.toLowerCase().replace(/^dr\.?\s*/, '').trim()
export function doctorRank(d: Doctor): number {
  const name = normalized(d.name)
  const rank = DOCTOR_ROSTER.findIndex(r => r.name.toLowerCase() === name || (r.aliases as readonly string[]).includes(name))
  return rank < 0 ? DOCTOR_ROSTER.length : rank
}
export function orderedDoctors(doctors: Doctor[]): Doctor[] { return [...doctors].sort((a, b) => doctorRank(a) - doctorRank(b)) }
export function initialRosterChoices(doctors: Doctor[]): string[] {
  return DOCTOR_ROSTER.map((r, i) => doctors.find(d => doctorRank(d) === i)?.id
    ?? doctors.find(d => d.id === `doctor-${String(i + 1).padStart(2, '0')}` && /^dokter\s*\d+$/i.test(normalized(d.name)))?.id ?? '')
}
export function newRosterDoctors(): Doctor[] {
  return DOCTOR_ROSTER.map((r, i) => ({ id: `doctor-${String(i + 1).padStart(2, '0')}`, name: r.name, phone: '', unit: r.unit, active: true, joinedOn: null, leave: [] }))
}

/** Keep the selected identities so previous schedules and attendance remain linked. */
export function applyDoctorRoster(w: Workspace, choices: string[], role: Role): Workspace {
  assertRole(role, true)
  if (choices.length !== DOCTOR_ROSTER.length) throw new Error('Pilih pasangan untuk kesembilan dokter.')
  const selected = choices.filter(Boolean)
  if (new Set(selected).size !== selected.length || selected.some(id => !w.doctors.some(d => d.id === id))) throw new Error('Satu dokter lama hanya boleh dipilih sekali.')
  const next = cloneWorkspace(w)
  const roster = DOCTOR_ROSTER.map((r, i): Doctor => {
    const old = next.doctors.find(d => d.id === choices[i])
    return old ? { ...old, name: r.name, unit: r.unit, active: true }
      : { id: crypto.randomUUID(), name: r.name, phone: '', unit: r.unit, active: true, joinedOn: null, leave: [] }
  })
  const ids = new Set(roster.map(d => d.id))
  next.doctors = [...roster, ...next.doctors.filter(d => !ids.has(d.id)).map(d => ({ ...d, active: false }))]
  for (const p of Object.values(next.plans)) for (const d of roster) {
    p.assignments[d.id] ??= {}
    p.boundaries[d.id] ??= { prev2: '', prev1: '', next1: '', next2: '' }
  }
  return next
}
