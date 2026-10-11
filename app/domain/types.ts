export type Role = 'admin' | 'planner' | 'viewer'
export type Unit = 'igd' | 'ruangan' | 'anak' | 'lain' | 'none'
export type ShiftKind = 'regular' | 'long' | 'off' | 'leave' | 'not_started' | 'custom'

export interface ShiftCode {
  code: string
  label: string
  unit: Unit
  kind: ShiftKind
  start: string | null
  end: string | null
  durationOverride: number | null
  active: boolean
}
export interface Doctor {
  id: string
  name: string
  phone: string
  photoPath?: string | null
  unit: 'rotasi' | 'anak'
  active: boolean
  joinedOn: string | null
  leave: Array<{ from: string; to: string }>
}
export interface Boundary { prev2: string; prev1: string; next1: string; next2: string }
export interface MonthPlan {
  month: string
  assignments: Record<string, Record<string, string>>
  boundaries: Record<string, Boundary>
  locked: boolean
  frozenThrough: number
  validationFrom: number
  shiftSnapshot?: ShiftCode[]
}
export interface Settings {
  hospital: string
  city: string
  timezone: string
  director: string
  directorNip: string
  sectionHead: string
  sectionHeadNip: string
  signedDate: string
  minGapHours: number
  maxConsecutiveLong: number
  offAfterLong: number
  maxConsecutiveWork: number
  minimumCoverage: number
}
export interface AuditEvent { id: string; at: string; actor: string; action: string }
export interface Workspace {
  schemaVersion: 1
  settings: Settings
  doctors: Doctor[]
  shifts: ShiftCode[]
  plans: Record<string, MonthPlan>
  audit: AuditEvent[]
}
export interface Issue {
  id: string
  doctorId: string | null
  date: string
  rule: 'missing' | 'invalid' | 'long_streak' | 'rest' | 'gap' | 'availability' | 'specialty' | 'coverage' | 'boundary' | 'work_streak'
  message: string
  severity: 'error' | 'warning'
  historical: boolean
}
export interface DoctorSummary {
  doctor: Doctor
  totalHours: number | null
  knownHours: number
  workDays: number
  offDays: number
  leaveDays: number
  notStartedDays: number
  emptyDays: number
  longDays: number
  nightDays: number
  availableDays: number
  comparable: boolean
}
export interface LoadedWorkspace { data: Workspace; revision: number; role: Role; id: string }
export interface Member { userId: string; email: string; role: Role }
