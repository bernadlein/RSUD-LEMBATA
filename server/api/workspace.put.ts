import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { parseWorkspace } from '../../app/domain/schema'
import { validateChange } from '../../app/domain/permissions'
import type { Role } from '../../app/domain/types'

const requestSchema = z.object({ id: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), action: z.string().min(1).max(250), administration: z.boolean().default(false), data: z.unknown() })
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (config.public.storageMode !== 'supabase' || !config.public.supabaseUrl || !config.public.supabaseAnonKey || !config.supabaseServiceRoleKey) throw createError({ statusCode: 503, statusMessage: 'Penyimpanan bersama belum dikonfigurasi.' })
  const header = getHeader(event, 'authorization')
  if (!header?.startsWith('Bearer ')) throw createError({ statusCode: 401, statusMessage: 'Masuk terlebih dahulu.' })
  const publicClient = createClient(String(config.public.supabaseUrl), String(config.public.supabaseAnonKey), { auth: { persistSession: false }, global: { headers: { Authorization: header } } })
  const { data: auth, error: authError } = await publicClient.auth.getUser(header.slice(7))
  if (authError || !auth.user) throw createError({ statusCode: 401, statusMessage: 'Sesi berakhir. Masuk kembali.' })
  const raw = await readRawBody(event, 'utf8')
  if (!raw || Buffer.byteLength(raw) > 2 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Data maksimal 2 MB.' })
  let input: z.infer<typeof requestSchema>, next
  try { input = requestSchema.parse(JSON.parse(raw)); next = parseWorkspace(input.data) }
  catch { throw createError({ statusCode: 400, statusMessage: 'Format perubahan tidak valid.' }) }
  const { data: membership, error: memberError } = await publicClient.from('rd_members').select('role').eq('workspace_id', input.id).eq('user_id', auth.user.id).maybeSingle()
  if (memberError || !membership) throw createError({ statusCode: 403, statusMessage: 'Akun tidak memiliki akses ke ruang kerja ini.' })
  const { data: existing, error: loadError } = await publicClient.from('rd_workspaces').select('data,revision').eq('id', input.id).single()
  if (loadError || !existing) throw createError({ statusCode: 404, statusMessage: 'Ruang kerja tidak ditemukan.' })
  if (existing.revision !== input.expectedRevision) throw createError({ statusCode: 409, statusMessage: 'Data berubah oleh pengguna lain. Muat ulang sebelum menyimpan.' })
  try { validateChange(parseWorkspace(existing.data), next, membership.role as Role, input.administration) }
  catch (e) { throw createError({ statusCode: 422, statusMessage: (e as Error).message }) }
  const serverClient = createClient(String(config.public.supabaseUrl), String(config.supabaseServiceRoleKey), { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: revision, error } = await serverClient.rpc('rd_save_workspace', { p_workspace_id: input.id, p_data: next, p_expected_revision: input.expectedRevision, p_action: input.action, p_actor: auth.user.id, p_administration: input.administration })
  if (error) throw createError({ statusCode: error.message.includes('berubah') ? 409 : 422, statusMessage: error.message })
  setHeader(event, 'Cache-Control', 'no-store')
  return { revision }
})
