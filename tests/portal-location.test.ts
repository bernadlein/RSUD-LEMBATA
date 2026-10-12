import { afterEach, describe, expect, it, vi } from 'vitest'
import { authDestination, isPublicRoute, safePrivateReturn } from '../app/domain/auth-routing'
import { attendanceLocationSchema, distanceMeters, locationStatus } from '../app/domain/geolocation'
import { requestGeolocation } from '../app/services/geolocation'
import { buildPublicHospital, emptyPortalDraft, portalDraftSchema } from '../app/domain/hospital-portal'
import { createDemoWorkspace as historicalWorkspace } from './fixtures/workspace'
import { createDemoWorkspace as browserDemo, createEmptyWorkspace } from '../app/domain/seed'

const workspaceId = '60000000-0000-4000-8000-000000000001'
const newsId = '60000000-0000-4000-8000-000000000002'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('public and private navigation', () => {
  it('keeps public information accessible and gates every staff feature before login', () => {
    for (const path of ['/', '/jadwal-dokter', '/berita', '/berita/' + newsId]) {
      expect(isPublicRoute(path)).toBe(true)
      expect(authDestination(path, path, null, false, false)).toBeNull()
    }
    for (const path of ['/dashboard', '/jadwal', '/dokter', '/absen', '/rekap', '/kode-dinas', '/cetak', '/pengaturan', '/portal']) {
      expect(authDestination(path, path, null, false, false)).toEqual({ path: '/masuk', query: { returnTo: path } })
      expect(authDestination(path, path, null, true, false)).toBeNull()
    }
  })

  it('preserves a scanned QR through login and onboarding without loops or open redirects', () => {
    const scanned = '/absen?w=' + workspaceId + '&q=' + newsId
    expect(authDestination('/absen', scanned, null, false, false)).toEqual({ path: '/masuk', query: { returnTo: scanned } })
    expect(authDestination('/masuk', '/masuk', scanned, true, true)).toEqual({ path: '/mulai', query: { returnTo: scanned } })
    expect(authDestination('/mulai', '/mulai', scanned, true, true)).toBeNull()
    expect(authDestination('/masuk', '/masuk', scanned, true, false)).toBe(scanned)
    for (const value of ['https://evil.test/absen', '//evil.test/absen', 'javascript:alert(1)', '/mulai', '/masuk', ['/absen']]) {
      expect(safePrivateReturn(value)).toBe('/dashboard')
    }
    expect(authDestination('/mulai', '/mulai', '/mulai', true, false)).toBe('/dashboard')
  })
})

describe('public projection and safe browser defaults', () => {
  it('does not include historical staffing, cuti or audit data in the browser demo', () => {
    const w = browserDemo()
    expect(w.plans).toEqual({}); expect(w.audit).toEqual([])
    expect(w.doctors.every(d => d.phone === '' && d.leave.length === 0 && d.joinedOn === null)).toBe(true)
    expect(createEmptyWorkspace().doctors.map(d => d.name)).toEqual(['Ela', 'Maria', 'Yunita', 'Trisya', 'Rury', 'Gredi', 'Evira', 'Putra', 'Dafrosa'])
  })

  it('publishes only selected news and working duties without private doctor fields', () => {
    const w = historicalWorkspace(); w.plans['2026-10']!.locked = true
    w.doctors[0]!.phone = 'PRIVATE_DOCTOR_PHONE'
    w.settings.directorNip = 'PRIVATE_DIRECTOR_NIP'
    const draft = emptyPortalDraft(); draft.scheduleMonth = '2026-10'; draft.phone = 'PUBLIC_HOSPITAL_PHONE'
    draft.news = [
      { id: newsId, title: 'Published', summary: 'Summary', content: 'Public content', date: '2026-10-01', published: true },
      { id: workspaceId, title: 'PRIVATE_DRAFT', summary: '', content: 'PRIVATE_DRAFT_BODY', date: '2026-10-02', published: false },
    ]
    const publicData = buildPublicHospital(w, draft, workspaceId, '2026-10-12T00:00:00Z')
    expect(publicData.news).toHaveLength(1)
    expect(publicData.phone).toBe('PUBLIC_HOSPITAL_PHONE')
    expect(publicData.schedule.rows.every(r => !['L', 'CUTI', 'BELUM'].includes(r.code) && !!r.hours)).toBe(true)
    expect(publicData.schedule.rows.some(r => r.doctorId === 'doctor-01' && r.date >= '2026-10-17')).toBe(false)
    const text = JSON.stringify(publicData)
    for (const secret of ['PRIVATE_DOCTOR_PHONE', 'PRIVATE_DIRECTOR_NIP', 'PRIVATE_DRAFT', '"leave"', '"joinedOn"', '"audit"', '"photoPath"']) expect(text).not.toContain(secret)
    const plan = w.plans['2026-10']!
    const before = publicData.schedule.rows.find(r => r.code === 'MI')!
    w.shifts.find(s => s.code === 'MI')!.start = '20:00'
    expect(buildPublicHospital(w, draft, workspaceId, '2026-10-12T00:00:00Z').schedule.rows.find(r => r.code === 'MI')!.start).toBe(before.start)
    expect(plan.shiftSnapshot!.find(s => s.code === 'MI')!.start).toBe(before.start)
  })

  it('refuses a draft month while allowing profile and news publication without a schedule', () => {
    const w = historicalWorkspace(), draft = emptyPortalDraft(); draft.scheduleMonth = '2026-10'
    expect(() => buildPublicHospital(w, draft, workspaceId, '2026-10-12')).toThrow('Kunci jadwal')
    draft.scheduleMonth = null
    expect(buildPublicHospital(w, draft, workspaceId, '2026-10-12').schedule.rows).toEqual([])
    expect(() => portalDraftSchema.parse({ ...draft, email: 'not-an-email' })).toThrow()
  })
})

describe('location checks', () => {
  const config = attendanceLocationSchema.parse({ workspace_id: workspaceId, latitude: 0, longitude: 0, radius_meters: 300, max_accuracy_meters: 150, revision: 1 })
  const now = Date.now()
  const point = (latitude = 0, accuracy = 20) => ({ latitude, longitude: 0, accuracy, capturedAt: new Date(now).toISOString() })

  it('calculates distances and includes GPS uncertainty in the radius check', () => {
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0 })).toBeCloseTo(111.195, 2)
    expect(locationStatus(config, point(0.0005), now).accepted).toBe(true)
    expect(locationStatus(config, point(0.01), now).message).toContain('radius')
    expect(locationStatus(config, point(0.0026, 30), now).accepted).toBe(false)
  })

  it('fails closed without a location, with poor accuracy, or with stale and invalid readings', () => {
    expect(locationStatus(null, point(), now).accepted).toBe(false)
    expect(locationStatus(config, null, now).accepted).toBe(false)
    expect(locationStatus(config, point(0, 200), now).message).toContain('Akurasi')
    expect(locationStatus(config, { ...point(), capturedAt: new Date(now - 120000).toISOString() }, now).accepted).toBe(false)
    expect(locationStatus(config, { ...point(), latitude: Number.NaN }, now).accepted).toBe(false)
  })

  it('requests a fresh high-accuracy reading only over a secure connection', async () => {
    const getCurrentPosition = vi.fn((success: (reading: unknown) => void) => success({ coords: { latitude: 0, longitude: 0, accuracy: 20 }, timestamp: now }))
    vi.stubGlobal('window', { isSecureContext: true }); vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    expect((await requestGeolocation()).accuracy).toBe(20)
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 })
    vi.stubGlobal('window', { isSecureContext: false })
    await expect(requestGeolocation()).rejects.toThrow('HTTPS')
  })

  it('provides an actionable error when a doctor denies location permission', async () => {
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_success: unknown, failure: (error: unknown) => void) => failure({ code: 1 }) } })
    await expect(requestGeolocation()).rejects.toThrow('Izinkan lokasi')
  })
})
