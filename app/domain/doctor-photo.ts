import type { Workspace } from './types'

export const DOCTOR_PHOTO_BUCKET = 'rd-doctor-photos'
export const DOCTOR_PHOTO_INPUT_LIMIT = 5 * 1024 * 1024
export const DOCTOR_PHOTO_OUTPUT_LIMIT = 300 * 1024
export const DOCTOR_PHOTO_WIDTH = 480
export const DOCTOR_PHOTO_HEIGHT = 600
export const DOCTOR_PHOTO_URL_SECONDS = 15 * 60
export const DOCTOR_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const pathPattern = new RegExp('^' + uuid + '/[A-Za-z0-9_-]{1,80}/' + uuid + '[.]jpg$')

export function isDoctorPhotoPath(value: string): boolean {
  return pathPattern.test(value)
}

export function assertDoctorPhotoScope(path: string, doctorId: string, workspaceId?: string): void {
  const parts = path.split('/')
  if (!isDoctorPhotoPath(path) || parts[1] !== doctorId || (workspaceId && parts[0] !== workspaceId)) {
    throw new Error('Foto dokter tidak sesuai dengan dokter atau ruang kerja ini.')
  }
}

export function assertWorkspacePhotoScope(workspace: Workspace, workspaceId: string): void {
  for (const doctor of workspace.doctors) {
    if (doctor.photoPath) assertDoctorPhotoScope(doctor.photoPath, doctor.id, workspaceId)
  }
}

/** A backup can restore schedules elsewhere; private photo links stay in their original workspace. */
export function prepareImportedDoctorPhotos(workspace: Workspace, workspaceId: string): { data: Workspace; removedPhotos: number } {
  let removedPhotos = 0
  const doctors = workspace.doctors.map(doctor => {
    if (!doctor.photoPath || doctor.photoPath.startsWith(workspaceId + '/')) return { ...doctor }
    removedPhotos++
    return { ...doctor, photoPath: null }
  })
  return { data: { ...workspace, doctors }, removedPhotos }
}

export function newDoctorPhotoPath(workspaceId: string, doctorId: string, imageId: string = crypto.randomUUID()): string {
  const path = workspaceId + '/' + doctorId + '/' + imageId + '.jpg'
  assertDoctorPhotoScope(path, doctorId, workspaceId)
  return path
}

export function validateDoctorPhotoFile(file: Pick<File, 'type' | 'size'>): void {
  if (!DOCTOR_PHOTO_TYPES.includes(file.type as typeof DOCTOR_PHOTO_TYPES[number])) {
    throw new Error('Pilih foto JPG, PNG, atau WebP.')
  }
  if (file.size <= 0 || file.size > DOCTOR_PHOTO_INPUT_LIMIT) {
    throw new Error('Ukuran foto harus antara 1 byte dan 5 MB.')
  }
}

/** Crop a portrait without stretching the original image. */
export function doctorPortraitCrop(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width * height > 40_000_000) {
    throw new Error('Resolusi foto tidak valid atau terlalu besar. Pilih foto yang lebih kecil.')
  }
  const ratio = DOCTOR_PHOTO_WIDTH / DOCTOR_PHOTO_HEIGHT
  const cropWidth = Math.min(width, height * ratio)
  const cropHeight = cropWidth / ratio
  return { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight }
}
