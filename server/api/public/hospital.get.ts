import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { readPublicHospital } from '../../../app/domain/hospital-portal'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  setHeader(event, 'Cache-Control', 'no-store')
  if (!z.string().uuid().safeParse(config.public.hospitalId).success || !config.public.supabaseUrl || !config.public.supabaseAnonKey) return { hospital: null }
  const client = createClient(String(config.public.supabaseUrl), String(config.public.supabaseAnonKey), { auth: { persistSession: false } })
  const { data, error } = await client.rpc('rd_read_public_hospital', { p_workspace_id: String(config.public.hospitalId) })
  if (error) throw createError({ statusCode: 502, statusMessage: 'Informasi rumah sakit belum dapat dimuat.' })
  if (!data) return { hospital: null }
  try { return { hospital: readPublicHospital(data) } }
  catch { throw createError({ statusCode: 502, statusMessage: 'Informasi rumah sakit sedang diperbarui.' }) }
})
