import { z } from 'zod'
import { parseWorkspace } from '../../app/domain/schema'
import { buildPublicHospital, portalDraftSchema } from '../../app/domain/hospital-portal'
import { requireWorkspaceAdmin } from '../utils/workspace-auth'

const inputSchema = z.object({ workspaceId: z.string().uuid(), draftRevision: z.number().int().nonnegative() })
export default defineEventHandler(async event => {
  const raw = await readRawBody(event, 'utf8')
  if (!raw || Buffer.byteLength(raw) > 2048) throw createError({ statusCode: 400, statusMessage: 'Permintaan publikasi belum valid.' })
  let input: z.infer<typeof inputSchema>
  try { input = inputSchema.parse(JSON.parse(raw)) }
  catch { throw createError({ statusCode: 400, statusMessage: 'Permintaan publikasi belum valid.' }) }
  const { client, server, user } = await requireWorkspaceAdmin(event, input.workspaceId)
  const [workspace, draft] = await Promise.all([
    client.from('rd_workspaces').select('data,revision').eq('id', input.workspaceId).single(),
    client.from('rd_portal_drafts').select('data,revision').eq('workspace_id', input.workspaceId).single(),
  ])
  if (workspace.error || !workspace.data || draft.error || !draft.data) {
    throw createError({ statusCode: 422, statusMessage: 'Simpan pengaturan portal terlebih dahulu dan pastikan migrasi portal sudah diterapkan.' })
  }
  if (draft.data.revision !== input.draftRevision) throw createError({ statusCode: 409, statusMessage: 'Draf portal berubah. Muat ulang sebelum menerbitkan.' })
  let publication
  try {
    publication = buildPublicHospital(parseWorkspace(workspace.data.data), portalDraftSchema.parse(draft.data.data), input.workspaceId, new Date().toISOString())
  } catch (error) {
    throw createError({ statusCode: 422, statusMessage: error instanceof Error ? error.message : 'Informasi portal belum valid.' })
  }
  const { data, error } = await server.rpc('rd_publish_hospital_portal', {
    p_workspace_id: input.workspaceId, p_actor: user.id, p_data: publication,
    p_workspace_revision: workspace.data.revision, p_draft_revision: input.draftRevision,
  })
  if (error) throw createError({ statusCode: error.message.includes('berubah') ? 409 : 422, statusMessage: error.message })
  setHeader(event, 'Cache-Control', 'no-store')
  return { publishedAt: data as string }
})
