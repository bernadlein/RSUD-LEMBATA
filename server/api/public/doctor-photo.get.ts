import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { isPublicDoctorPhotoVersion } from '../../../app/domain/public-doctor-photo'
import { PublicDoctorPhotoError, readPublishedDoctorPhoto } from '../../utils/public-doctor-photo'

const querySchema = z.object({
  doctor: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  v: z.string().refine(isPublicDoctorPhotoVersion),
})

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  const query = querySchema.safeParse(getQuery(event))
  if (!query.success) throw createError({ statusCode: 400, statusMessage: 'Permintaan foto belum valid.' })
  const config = useRuntimeConfig(event)
  if (!z.string().uuid().safeParse(config.public.hospitalId).success || !config.public.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw createError({ statusCode: 503, statusMessage: 'Foto dokter belum dapat dimuat.' })
  }
  const server = createClient(String(config.public.supabaseUrl), String(config.supabaseServiceRoleKey), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  let bytes: Buffer
  try { bytes = await readPublishedDoctorPhoto(server, String(config.public.hospitalId), query.data.doctor, query.data.v) }
  catch (error) {
    if (error instanceof PublicDoctorPhotoError) throw createError({ statusCode: error.statusCode, statusMessage: error.statusMessage })
    throw createError({ statusCode: 502, statusMessage: 'Foto dokter belum dapat dimuat.' })
  }
  setHeader(event, 'Content-Type', 'image/jpeg')
  setHeader(event, 'Content-Length', bytes.length)
  return bytes
})
