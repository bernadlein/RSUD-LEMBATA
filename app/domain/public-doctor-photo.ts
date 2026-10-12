import { assertDoctorPhotoScope } from './doctor-photo'

const versionPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const versionRegex = new RegExp('^' + versionPattern + '$')
const urlRegex = new RegExp('^/api/public/doctor-photo[?]doctor=[A-Za-z0-9_-]{1,80}&v=' + versionPattern + '$')

export function isPublicDoctorPhotoVersion(value: string): boolean { return versionRegex.test(value) }
export function isPublicDoctorPhotoUrl(value: string): boolean { return urlRegex.test(value) }

/** A publication stores the image revision, never a private storage path or signed URL. */
export function publicDoctorPhotoVersion(path: string | null | undefined, doctorId: string, workspaceId: string): string | null {
  if (!path) return null
  assertDoctorPhotoScope(path, doctorId, workspaceId)
  return path.split('/')[2]!.slice(0, -4)
}

export function publicDoctorPhotoUrl(version: string | null | undefined, doctorId: string): string | null {
  if (!version) return null
  if (!isPublicDoctorPhotoVersion(version) || !/^[A-Za-z0-9_-]{1,80}$/.test(doctorId)) {
    throw new Error('Referensi foto dokter belum valid.')
  }
  return '/api/public/doctor-photo?' + new URLSearchParams({ doctor: doctorId, v: version })
}
