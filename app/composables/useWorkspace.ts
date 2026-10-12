import type { SupabaseClient, Session } from '@supabase/supabase-js'
import type { Role, Workspace } from '../domain/types'
import type { WorkspaceRepository } from '../repositories/workspace-repository'
import { LocalWorkspaceRepository } from '../repositories/local-workspace-repository'
import { SupabaseWorkspaceRepository } from '../repositories/supabase-workspace-repository'
import { assertRole, cloneWorkspace, record } from '../domain/commands'
import { parseWorkspace } from '../domain/schema'
import { coverage, fairness, inspectPlan, summarize } from '../domain/analysis'
import { createEmptyWorkspace } from '../domain/seed'
import { validateChange } from '../domain/permissions'

let repository: WorkspaceRepository | null = null
let loadGeneration = 0
export function useWorkspace() {
  const data = useState<Workspace | null>('workspace', () => null)
  const revision = useState('revision', () => 0)
  const id = useState('workspace-id', () => '')
  const role = useState<Role>('role', () => 'viewer')
  const activeMonth = useState('active-month', () => '2026-10')
  const loading = useState('workspace-loading', () => true)
  const saving = useState('workspace-saving', () => false)
  const error = useState('workspace-error', () => '')
  const needsWorkspace = useState('needs-workspace', () => false)
  const session = useState<Session | null>('auth-session', () => null)
  const mode = useRuntimeConfig().public.storageMode
  const { notify } = useNotifications()
  const plan = computed(() => data.value?.plans[activeMonth.value] ?? null)
  const months = computed(() => Object.keys(data.value?.plans ?? {}).sort().reverse())
  const summaries = computed(() => data.value && plan.value ? summarize(data.value, plan.value) : [])
  const issues = computed(() => data.value && plan.value ? inspectPlan(data.value, plan.value) : [])
  const balance = computed(() => data.value && plan.value ? fairness(data.value, plan.value) : { rows: [], min: 0, max: 0, spread: 0, average: 0 })
  const blocks = computed(() => data.value && plan.value ? coverage(data.value, plan.value) : [])
  const canEdit = computed(() => role.value !== 'viewer' && !saving.value)
  const isAdmin = computed(() => role.value === 'admin')

  async function reload() {
    if (!repository) return
    const generation = ++loadGeneration
    loading.value = true; error.value = ''
    try {
      const loaded = await repository.load()
      if (generation !== loadGeneration) return
      if (!loaded) { needsWorkspace.value = !!session.value; data.value = null; return }
      data.value = loaded.data; revision.value = loaded.revision; id.value = loaded.id; role.value = loaded.role; needsWorkspace.value = false
      if (!data.value.plans[activeMonth.value]) activeMonth.value = Object.keys(data.value.plans).sort().at(-1) ?? '2026-10'
    } catch (e) { if (generation === loadGeneration) error.value = (e as Error).message }
    finally { if (generation === loadGeneration) loading.value = false }
  }
  async function initialize(client: SupabaseClient | null, authSession: Session | null) {
    session.value = authSession
    if (mode === 'supabase') {
      if (!client) { error.value = 'Login belum tersedia.'; loading.value = false; return }
      repository = new SupabaseWorkspaceRepository(client)
      if (!authSession) { loadGeneration++; data.value = null; role.value = 'viewer'; needsWorkspace.value = false; loading.value = false; return }
    } else repository = new LocalWorkspaceRepository(window.localStorage)
    await reload()
  }
  async function mutate(transform: (w: Workspace) => Workspace, action: string, admin = false): Promise<boolean> {
    if (!data.value || !repository || saving.value) return false
    const request = { repository, id: id.value, userId: session.value?.user.id, generation: loadGeneration }
    const stillCurrent = () => request.id === id.value && request.userId === session.value?.user.id
    try {
      assertRole(role.value, admin)
      const next = parseWorkspace(transform(cloneWorkspace(data.value)))
      validateChange(data.value, next, role.value, admin)
      record(next, action, session.value?.user.email ?? 'Administrator')
      saving.value = true
      const nextRevision = await request.repository.save(request.id, next, revision.value, action, admin)
      if (!stillCurrent()) return false
      if (request.generation !== loadGeneration) await reload()
      else { data.value = next; revision.value = nextRevision }
      if (!stillCurrent()) return false
      notify('Perubahan tersimpan.')
      return true
    } catch (e) { if (stillCurrent()) notify((e as Error).message, true); return false }
    finally { saving.value = false }
  }
  async function createWorkspace(name: string) {
    const client = useNuxtApp().$db
    if (!client) throw new Error('Layanan akun belum tersedia.')
    const w = createEmptyWorkspace(); w.settings.hospital = name.trim()
    const { error: rpcError } = await client.rpc('rd_create_workspace', { p_name: name.trim(), p_data: parseWorkspace(w) })
    if (rpcError) throw new Error(rpcError.message)
    await reload()
  }
  return { data, revision, id, role, session, activeMonth, months, plan, loading, saving, error, needsWorkspace, summaries, issues, balance, blocks, canEdit, isAdmin, mode, reload, initialize, mutate, createWorkspace, getRepository: () => repository }
}
