import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkspaceRepository } from './workspace-repository'
import type { LoadedWorkspace, Member, Role, Workspace } from '../domain/types'
import { parseWorkspace } from '../domain/schema'
function fail(error: { message: string } | null) { if (error) throw new Error(error.message) }
export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  mode = 'supabase' as const
  constructor(private client: SupabaseClient) {}
  async load(): Promise<LoadedWorkspace | null> {
    const { data: auth, error: authError } = await this.client.auth.getUser(); fail(authError)
    if (!auth.user) return null
    const { data: hospitalId, error: joinError } = await this.client.rpc('rd_join_hospital')
    if (joinError) throw new Error(joinError.code === 'PGRST202' || joinError.code === '42883' ? 'Akses fasilitas belum diaktifkan.' : joinError.message)
    if (!hospitalId) throw new Error('Fasilitas belum tersedia.')
    const { data: membership, error: memberError } = await this.client.from('rd_members').select('workspace_id,role').eq('user_id', auth.user.id).eq('workspace_id', hospitalId).maybeSingle(); fail(memberError)
    if (!membership) return null
    const { data: row, error } = await this.client.from('rd_workspaces').select('id,data,revision').eq('id', membership.workspace_id).single(); fail(error)
    const { data: logs, error: logError } = await this.client.from('rd_audit').select('id,created_at,actor_email,action').eq('workspace_id', row!.id).order('created_at', { ascending: false }).limit(200); fail(logError)
    const data = parseWorkspace(row!.data)
    data.audit = (logs ?? []).map(l => ({ id: l.id, at: l.created_at, actor: l.actor_email, action: l.action }))
    return { data, revision: row!.revision, role: membership.role === 'admin' ? 'admin' : 'viewer', id: row!.id }
  }
  async save(id: string, data: Workspace, expectedRevision: number, action: string, administration = false): Promise<number> {
    const { data: auth } = await this.client.auth.getSession()
    if (!auth.session) throw new Error('Sesi berakhir. Masuk kembali untuk menyimpan.')
    const response = await fetch('/api/workspace', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session.access_token}` },
      body: JSON.stringify({ id, data: parseWorkspace(data), expectedRevision, action, administration }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.statusMessage ?? result.message ?? 'Perubahan belum tersimpan.')
    return result.revision as number
  }
  async members(id: string): Promise<Member[]> {
    const { data, error } = await this.client.rpc('rd_list_members', { p_workspace_id: id }); fail(error)
    const rows = (data ?? []) as { user_id: string; email: string; role: Role }[]
    return rows.map(m => ({ userId: m.user_id, email: m.email, role: m.role === 'admin' ? 'admin' : 'viewer' }))
  }
  async addMember(id: string, email: string, role: Role) {
    if (role !== 'viewer') throw new Error('Akun pengguna hanya dapat diberi akses pembaca.')
    const { error } = await this.client.rpc('rd_add_member', { p_workspace_id: id, p_email: email.trim().toLowerCase(), p_role: role }); fail(error)
  }
  async removeMember(id: string, userId: string) {
    const { error } = await this.client.rpc('rd_remove_member', { p_workspace_id: id, p_user_id: userId }); fail(error)
  }
}
