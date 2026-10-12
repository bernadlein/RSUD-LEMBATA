import type { SupabaseClient } from '@supabase/supabase-js'
import { DOCTOR_PHOTO_BUCKET, DOCTOR_PHOTO_OUTPUT_LIMIT, assertDoctorPhotoScope } from '../../app/domain/doctor-photo'

export class PublicDoctorPhotoError extends Error {
  constructor(public statusCode: number, public statusMessage: string) { super(statusMessage) }
}

/** Read only the exact image in the current publication, never an arbitrary storage path. */
export async function readPublishedDoctorPhoto(server: SupabaseClient, workspaceId: string, doctorId: string, version: string): Promise<Buffer> {
  const { data: path, error: lookupError } = await server.rpc('rd_public_doctor_photo_path', {
    p_workspace_id: workspaceId, p_doctor_id: doctorId,
  })
  if (lookupError) throw new PublicDoctorPhotoError(503, 'Foto dokter belum dapat dimuat.')
  if (typeof path !== 'string') throw new PublicDoctorPhotoError(404, 'Foto dokter tidak tersedia.')
  try { assertDoctorPhotoScope(path, doctorId, workspaceId) }
  catch { throw new PublicDoctorPhotoError(404, 'Foto dokter tidak tersedia.') }
  if (path.split('/')[2] !== version + '.jpg') throw new PublicDoctorPhotoError(404, 'Foto dokter tidak tersedia.')
  const { data: photo, error } = await server.storage.from(DOCTOR_PHOTO_BUCKET).download(path)
  if (error || !photo) throw new PublicDoctorPhotoError(404, 'Foto dokter tidak tersedia.')
  if (photo.type !== 'image/jpeg' || photo.size <= 0 || photo.size > DOCTOR_PHOTO_OUTPUT_LIMIT) {
    throw new PublicDoctorPhotoError(404, 'Foto dokter tidak tersedia.')
  }
  const bytes = Buffer.from(await photo.arrayBuffer())
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new PublicDoctorPhotoError(404, 'Foto dokter tidak tersedia.')
  }
  return bytes
}
