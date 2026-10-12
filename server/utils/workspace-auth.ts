import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { H3Event } from 'h3'

export async function requireWorkspaceAdmin(event: H3Event, workspaceId: string) {
  if (!z.string().uuid().safeParse(workspaceId).success) throw createError({ statusCode: 400, statusMessage: 'Ruang kerja belum valid.' })
  const config = useRuntimeConfig(event)
  if (config.public.storageMode !== 'supabase' || !config.public.supabaseUrl || !config.public.supabaseAnonKey || !config.supabaseServiceRoleKey) {
    throw createError({ statusCode: 503, statusMessage: 'Penyimpanan fasilitas belum dikonfigurasi.' })
  }
  const authorization = getHeader(event, 'authorization')
  if (!authorization?.startsWith('Bearer ')) throw createError({ statusCode: 401, statusMessage: 'Masuk terlebih dahulu.' })
  const client = createClient(String(config.public.supabaseUrl), String(config.public.supabaseAnonKey), {
    auth: { persistSession: false }, global: { headers: { Authorization: authorization } },
  })
  const { data: auth, error: authError } = await client.auth.getUser(authorization.slice(7))
  if (authError || !auth.user) throw createError({ statusCode: 401, statusMessage: 'Sesi berakhir. Masuk kembali.' })
  const { data: membership, error } = await client.from('rd_members').select('role').eq('workspace_id', workspaceId).eq('user_id', auth.user.id).maybeSingle()
  if (error || membership?.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Publikasi informasi hanya tersedia untuk admin fasilitas.' })
  const server = createClient(String(config.public.supabaseUrl), String(config.supabaseServiceRoleKey), { auth: { persistSession: false, autoRefreshToken: false } })
  return { client, server, user: auth.user }
}
