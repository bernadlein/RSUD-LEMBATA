import { z } from 'zod'

export const locationReadingSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().positive(),
  capturedAt: z.string().datetime({ offset: true }),
})
export const attendanceLocationSchema = z.object({
  workspace_id: z.string().uuid(),
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  radius_meters: z.coerce.number().int().min(50).max(2000),
  max_accuracy_meters: z.coerce.number().int().min(10).max(500),
  revision: z.coerce.number().int().nonnegative(),
})
export type LocationReading = z.infer<typeof locationReadingSchema>
export type AttendanceLocation = z.infer<typeof attendanceLocationSchema>
export type AttendanceLocationInput = Pick<AttendanceLocation, 'latitude' | 'longitude' | 'radius_meters' | 'max_accuracy_meters'>

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (n: number) => n * Math.PI / 180
  const lat = rad(b.latitude - a.latitude), lng = rad(b.longitude - a.longitude)
  const h = Math.sin(lat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(lng / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}

export function locationStatus(config: AttendanceLocation | null, point: LocationReading | null, now = Date.now()) {
  if (!config) return { accepted: false, distance: null, message: 'Lokasi rumah sakit belum ditetapkan. Hubungi admin.' }
  if (!point) return { accepted: false, distance: null, message: 'Periksa lokasi perangkat sebelum mencatat absensi.' }
  const valid = locationReadingSchema.safeParse(point)
  if (!valid.success) return { accepted: false, distance: null, message: 'Lokasi perangkat belum valid. Periksa kembali GPS.' }
  const distance = distanceMeters(point, config), captured = Date.parse(point.capturedAt)
  if (captured < now - 60_000 || captured > now + 30_000) return { accepted: false, distance, message: 'Lokasi perlu diperbarui. Periksa lokasi kembali.' }
  if (point.accuracy > config.max_accuracy_meters) return { accepted: false, distance, message: 'Akurasi GPS belum cukup. Aktifkan lokasi akurat dan coba kembali.' }
  if (distance + point.accuracy > config.radius_meters) return { accepted: false, distance, message: 'Posisi dan akurasi GPS belum berada dalam radius rumah sakit. Bergerak mendekati titik acuan lalu coba kembali.' }
  return { accepted: true, distance, message: 'Lokasi berada dalam radius rumah sakit.' }
}
