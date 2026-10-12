import { locationReadingSchema, type LocationReading } from '../domain/geolocation'

export async function requestGeolocation(): Promise<LocationReading> {
  if (!window.isSecureContext) throw new Error('Lokasi memerlukan koneksi HTTPS. Buka domain resmi rumah sakit.')
  if (!navigator.geolocation) throw new Error('Perangkat ini belum mendukung lokasi. Gunakan browser ponsel dengan GPS.')
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(position => {
      try {
        resolve(locationReadingSchema.parse({
          latitude: position.coords.latitude, longitude: position.coords.longitude,
          accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString(),
        }))
      } catch { reject(new Error('Lokasi perangkat belum valid. Periksa kembali GPS.')) }
    }, error => {
      const message = error.code === 1 ? 'Izin lokasi belum diberikan. Izinkan lokasi pada browser untuk mencatat absen.'
        : error.code === 2 ? 'GPS belum dapat menentukan lokasi. Aktifkan lokasi perangkat dan coba lagi.'
          : 'Pemeriksaan lokasi terlalu lama. Coba lagi di area dengan sinyal GPS yang lebih baik.'
      reject(new Error(message))
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 })
  })
}
