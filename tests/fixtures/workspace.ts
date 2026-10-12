import demo from '../../app/data/demo-workspace.json'
import { parseWorkspace } from '../../app/domain/schema'
import type { Workspace } from '../../app/domain/types'
import { newRosterDoctors } from '../../app/domain/doctor-roster'

/** Historical test fixture; not part of the browser application. */
export function createDemoWorkspace(): Workspace {
  const w = parseWorkspace(JSON.parse(JSON.stringify(demo)))
  const names = new Map(newRosterDoctors().map(d => [d.id, d.name]))
  w.doctors.forEach(d => { d.name = names.get(d.id) ?? d.name })
  return w
}
