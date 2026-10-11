import demo from '../data/demo-workspace.json'
import { parseWorkspace } from './schema'
import type { Workspace } from './types'
import { newRosterDoctors } from './doctor-roster'
export function createDemoWorkspace(): Workspace {
  const w = parseWorkspace(JSON.parse(JSON.stringify(demo)))
  const names = new Map(newRosterDoctors().map(d => [d.id, d.name]))
  w.doctors.forEach(d => { d.name = names.get(d.id) ?? d.name })
  return w
}
export function createEmptyWorkspace(): Workspace {
  const w = createDemoWorkspace()
  w.doctors = newRosterDoctors()
  w.plans = {}
  w.settings.hospital = 'Rumah Sakit Anda'
  w.settings.city = 'Kota Anda'
  w.settings.director = ''
  w.settings.sectionHead = ''
  w.audit = []
  return w
}
