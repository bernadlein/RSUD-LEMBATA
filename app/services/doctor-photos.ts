import {
  DOCTOR_PHOTO_WIDTH, DOCTOR_PHOTO_HEIGHT, DOCTOR_PHOTO_OUTPUT_LIMIT,
  doctorPortraitCrop, validateDoctorPhotoFile,
} from '../domain/doctor-photo'

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) }
  } catch (error) { URL.revokeObjectURL(url); throw error }
}

/** Re-encode the selected image as a small JPEG before uploading it. */
export async function prepareDoctorPhoto(file: File): Promise<Blob> {
  validateDoctorPhotoFile(file)
  let image
  try { image = await decode(file) }
  catch { throw new Error('Foto tidak dapat dibaca. Pilih berkas JPG, PNG, atau WebP yang valid.') }
  try {
    const crop = doctorPortraitCrop(image.width, image.height)
    const canvas = document.createElement('canvas')
    canvas.width = DOCTOR_PHOTO_WIDTH
    canvas.height = DOCTOR_PHOTO_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser belum dapat memproses foto. Coba browser lain.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image.source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.86, 0.74, 0.62, 0.5]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.type === 'image/jpeg' && blob.size > 0 && blob.size <= DOCTOR_PHOTO_OUTPUT_LIMIT) return blob
    }
    throw new Error('Foto masih terlalu besar setelah diproses. Pilih foto yang lebih kecil.')
  } finally { image.close() }
}
