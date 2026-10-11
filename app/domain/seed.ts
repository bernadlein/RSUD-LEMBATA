import demo from '../data/demo-workspace.json'
import { parseWorkspace } from './schema'
import type { Workspace } from './types'
export function createDemoWorkspace(): Workspace { return parseWorkspace(JSON.parse(JSON.stringify(demo))) }
export function createEmptyWorkspace(): Workspace {
  const w = createDemoWorkspace()
  w.doctors = [{ id: 'doctor-01', name: 'Dokter pertama', phone: '', unit: 'rotasi', active: true, joinedOn: null, leave: [] }]
  w.plans = {}
  w.settings.hospital = 'Rumah Sakit Anda'
  w.settings.city = 'Kota Anda'
  w.settings.director = ''
  w.settings.sectionHead = ''
  w.audit = []
  return w
}
