import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef, watch, effectScope } from 'vue'
import { useAttendance } from '../app/composables/useAttendance'
import { requestGeolocation } from '../app/services/geolocation'
import { createEmptyWorkspace } from '../app/domain/seed'

const methods = vi.hoisted(() => ({ load: vi.fn(), mark: vi.fn(), qr: vi.fn(), bind: vi.fn(), unbind: vi.fn() }))
vi.mock('../app/services/geolocation', () => ({ requestGeolocation: vi.fn() }))
vi.mock('../app/repositories/attendance-repository', () => ({
  SupabaseAttendanceRepository: class {
    load = methods.load; mark = methods.mark; qr = methods.qr; bind = methods.bind; unbind = methods.unbind
  },
}))
const workspaceId = '80000000-0000-4000-8000-000000000001', userId = '80000000-0000-4000-8000-000000000002'
const point = () => ({ latitude: 0, longitude: 0, accuracy: 20, capturedAt: new Date().toISOString() })
const notify = vi.fn()
let scope: ReturnType<typeof effectScope>, attendance: ReturnType<typeof useAttendance>, cleanup: () => void
let w: ReturnType<typeof workspace>
function workspace() {
  return {
    mode: 'supabase', id: ref(workspaceId), session: ref({ user: { id: userId } }), role: ref('viewer'),
    isAdmin: computed(() => false), data: ref(createEmptyWorkspace()), loading: ref(false), activeMonth: ref('2026-10'),
    revision: ref(0), getRepository: () => ({ members: async () => [] }),
  }
}
beforeEach(async () => {
  w = workspace()
  methods.load.mockResolvedValue({
    records: [], recent: [], open: [], accounts: [{ workspace_id: workspaceId, doctor_id: 'doctor-01', user_id: userId }],
    location: { workspace_id: workspaceId, latitude: 0, longitude: 0, radius_meters: 300, max_accuracy_meters: 150, revision: 1 },
  })
  methods.mark.mockResolvedValue({})
  vi.mocked(requestGeolocation).mockResolvedValue(point())
  vi.stubGlobal('useWorkspace', () => w); vi.stubGlobal('useNuxtApp', () => ({ $db: {} }))
  vi.stubGlobal('useNotifications', () => ({ notify }))
  vi.stubGlobal('computed', computed); vi.stubGlobal('ref', ref); vi.stubGlobal('shallowRef', shallowRef); vi.stubGlobal('watch', watch)
  vi.stubGlobal('onMounted', vi.fn()); vi.stubGlobal('onBeforeUnmount', (fn: () => void) => { cleanup = fn })
  scope = effectScope(); scope.run(() => { attendance = useAttendance() })
  await attendance.load()
})
afterEach(() => {
  cleanup(); scope.stop()
  vi.restoreAllMocks(); vi.unstubAllGlobals(); notify.mockClear()
  vi.mocked(requestGeolocation).mockReset()
  Object.values(methods).forEach(fn => fn.mockReset())
})

describe('GPS attendance request lifecycle', () => {
  it('passes a fresh reading to the server before declaring success', async () => {
    const reading = point(); vi.mocked(requestGeolocation).mockResolvedValue(reading)
    expect(await attendance.mark(userId, 'masuk', '2026-10-12')).toBe(true)
    expect(methods.mark).toHaveBeenCalledWith(workspaceId, userId, 'masuk', '2026-10-12', reading)
    expect(notify).toHaveBeenCalledWith('Absen masuk tercatat.')
    expect(attendance.gps.value.accepted).toBe(true)
  })
  it('never sends the previous doctor request after an account switch during GPS acquisition', async () => {
    let finish!: (reading: ReturnType<typeof point>) => void
    vi.mocked(requestGeolocation).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = attendance.mark(userId, 'masuk', '2026-10-12')
    w.session.value = { user: { id: 'new-account' } }
    finish(point())
    expect(await pending).toBe(false)
    expect(methods.mark).not.toHaveBeenCalled()
    expect(attendance.point.value).toBeNull()
    expect(notify).not.toHaveBeenCalled()
  })
  it('blocks the RPC and shows an error for a location outside the campus radius', async () => {
    vi.mocked(requestGeolocation).mockResolvedValue({ ...point(), latitude: 0.01 })
    expect(await attendance.mark(userId, 'pulang', '2026-10-12')).toBe(false)
    expect(methods.mark).not.toHaveBeenCalled()
    expect(attendance.gps.value.accepted).toBe(false)
    expect(attendance.locationError.value).toContain('radius')
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('radius'), true)
  })
  it('retains a useful permission error and blocks the server call', async () => {
    vi.mocked(requestGeolocation).mockRejectedValue(new Error('Izinkan lokasi pada browser.'))
    expect(await attendance.mark(userId, 'masuk', '2026-10-12')).toBe(false)
    expect(methods.mark).not.toHaveBeenCalled()
    expect(attendance.locationError.value).toContain('Izinkan lokasi')
  })
})
