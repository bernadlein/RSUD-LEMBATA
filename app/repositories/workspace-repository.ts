import type { LoadedWorkspace, Member, Role, Workspace } from '../domain/types'
export interface WorkspaceRepository {
  mode: 'demo' | 'supabase'
  load(): Promise<LoadedWorkspace | null>
  save(id: string, data: Workspace, expectedRevision: number, action: string, administration?: boolean): Promise<number>
  members(id: string): Promise<Member[]>
  addMember(id: string, email: string, role: Role): Promise<void>
  removeMember(id: string, userId: string): Promise<void>
}
