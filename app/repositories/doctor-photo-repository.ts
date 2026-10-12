import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DOCTOR_PHOTO_BUCKET, DOCTOR_PHOTO_OUTPUT_LIMIT, DOCTOR_PHOTO_URL_SECONDS,
  assertDoctorPhotoScope, isDoctorPhotoPath, newDoctorPhotoPath,
} from '../domain/doctor-photo'

export interface DoctorPhotoRepository {
  urls(paths: string[]): Promise<Record<string, string>>
  upload(workspaceId: string, doctorId: string, photo: Blob): Promise<string>
  discard(path: string): Promise<void>
}

function fail(error: { message: string } | null): void {
  if (!error) return
  if (/bucket.*not found|does not exist/i.test(error.message)) {
    throw new Error('Penyimpanan foto belum tersedia.')
  }
  if (/row.level|permission|unauthorized|not authorized/i.test(error.message)) {
    throw new Error('Akun belum diizinkan mengakses foto. Periksa hak akses dan penerapan SQL foto.')
  }
  throw new Error('Foto belum dapat diproses: ' + error.message)
}

export class SupabaseDoctorPhotoRepository implements DoctorPhotoRepository {
  constructor(private client: SupabaseClient) {}

  async urls(paths: string[]): Promise<Record<string, string>> {
    const unique = [...new Set(paths)].filter(isDoctorPhotoPath)
    if (!unique.length) return {}
    const { data, error } = await this.client.storage.from(DOCTOR_PHOTO_BUCKET).createSignedUrls(unique, DOCTOR_PHOTO_URL_SECONDS)
    fail(error)
    const result: Record<string, string> = {}
    for (const row of data ?? []) if (!row.error && row.path && row.signedUrl) result[row.path] = row.signedUrl
    return result
  }

  async upload(workspaceId: string, doctorId: string, photo: Blob): Promise<string> {
    if (photo.type !== 'image/jpeg' || photo.size <= 0 || photo.size > DOCTOR_PHOTO_OUTPUT_LIMIT) {
      throw new Error('Foto belum dalam format unggahan yang valid.')
    }
    const path = newDoctorPhotoPath(workspaceId, doctorId)
    assertDoctorPhotoScope(path, doctorId, workspaceId)
    const { error } = await this.client.storage.from(DOCTOR_PHOTO_BUCKET).upload(path, photo, {
      contentType: 'image/jpeg', cacheControl: '3600', upsert: false,
    })
    fail(error)
    return path
  }

  async discard(path: string): Promise<void> {
    if (!isDoctorPhotoPath(path)) return
    // Database policy permits removal only while no doctor references this path.
    const { error } = await this.client.storage.from(DOCTOR_PHOTO_BUCKET).remove([path])
    fail(error)
  }
}
