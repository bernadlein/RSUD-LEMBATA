import defaults from '../data/workspace-defaults.json'
import { parseWorkspace } from './schema'
import type { Workspace } from './types'
import { newRosterDoctors } from './doctor-roster'
import { HOSPITAL_NAME, HOSPITAL_CITY } from './branding'
export function createDemoWorkspace(): Workspace {
  return createEmptyWorkspace()
}
export function createEmptyWorkspace(): Workspace {
  return parseWorkspace({
    schemaVersion: 1, settings: { ...JSON.parse(JSON.stringify(defaults.settings)), hospital: HOSPITAL_NAME, city: HOSPITAL_CITY },
    doctors: newRosterDoctors(), shifts: JSON.parse(JSON.stringify(defaults.shifts)), plans: {}, audit: [],
  })
}
