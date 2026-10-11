import type { WorkspaceRepository } from './workspace-repository'
import type { LoadedWorkspace, Workspace } from '../domain/types'
import { parseWorkspace } from '../domain/schema'
import { createDemoWorkspace } from '../domain/seed'
export const LOCAL_KEY = 'ruang-dinas:workspace:v1'
export class LocalWorkspaceRepository implements WorkspaceRepository {
  mode = 'demo' as const
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'>) {}
  async load(): Promise<LoadedWorkspace> {
    const raw = this.storage.getItem(LOCAL_KEY)
    if (!raw) return { data: createDemoWorkspace(), revision: 0, role: 'admin', id: 'local' }
    try {
      const saved = JSON.parse(raw)
      if (!Number.isInteger(saved.revision) || saved.revision < 1) throw new Error('revision')
      return { data: parseWorkspace(saved.data), revision: saved.revision, role: 'admin', id: 'local' }
    } catch { throw new Error('Data browser tidak dapat dibaca. Data lama tetap disimpan; pulihkan menggunakan cadangan JSON.') }
  }
  async save(_id: string, data: Workspace, expectedRevision: number): Promise<number> {
    const previous = this.storage.getItem(LOCAL_KEY)
    const current = previous ? JSON.parse(previous).revision : 0
    if (current !== expectedRevision) throw new Error('Data berubah di tab lain. Muat ulang sebelum mengedit kembali.')
    const revision = expectedRevision + 1
    try { this.storage.setItem(LOCAL_KEY, JSON.stringify({ data: parseWorkspace(data), revision })) }
    catch { throw new Error('Penyimpanan browser penuh atau tidak tersedia. Unduh cadangan sebelum melanjutkan.') }
    return revision
  }
  async members() { return [] }
  async addMember() { throw new Error('Pengguna bersama tersedia pada mode Supabase.') }
  async removeMember() { throw new Error('Pengguna bersama tersedia pada mode Supabase.') }
}
