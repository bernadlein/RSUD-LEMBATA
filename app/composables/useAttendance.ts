import type { Attendance, DoctorAccount } from '../domain/attendance'
import type { Member } from '../domain/types'
import { attendanceDate, availableDuties } from '../domain/attendance'
import { SupabaseAttendanceRepository } from '../repositories/attendance-repository'
import { locationStatus, type AttendanceLocation, type LocationReading } from '../domain/geolocation'
import { requestGeolocation } from '../services/geolocation'

export function useAttendance() {
  const w = useWorkspace(), db = useNuxtApp().$db, { notify } = useNotifications()
  const records = shallowRef<Attendance[]>([]), open = shallowRef<Attendance[]>([]), accounts = shallowRef<DoctorAccount[]>([]), members = shallowRef<Member[]>([])
  const recent = shallowRef<Attendance[]>([])
  const location = ref<AttendanceLocation | null>(null), point = ref<LocationReading | null>(null), locating = ref(false), locationError = ref('')
  const token = ref<string | null>(null), loading = ref(false), busy = ref(false), error = ref(''), now = ref(new Date())
  const repository = db && w.mode === 'supabase' ? new SupabaseAttendanceRepository(db) : null
  const myAccount = computed(() => accounts.value.find(a => a.user_id === w.session.value?.user.id))
  const myDoctor = computed(() => w.data.value?.doctors.find(d => d.id === myAccount.value?.doctor_id))
  const myOpen = computed(() => open.value.find(r => r.user_id === w.session.value?.user.id))
  const duties = computed(() => w.data.value && myDoctor.value ? availableDuties(w.data.value, myDoctor.value.id, now.value).filter(d => !recent.value.some(r => r.doctor_id === myDoctor.value!.id && r.duty_date === d.date)) : [])
  const gps = computed(() => locationStatus(location.value, point.value, now.value.getTime()))
  let loadId = 0, writeId = 0, timer: ReturnType<typeof setInterval> | null = null
  const scope = () => `${w.id.value}:${w.session.value?.user.id ?? ''}:${w.role.value}`

  async function load() {
    const request = ++loadId, current = scope(), month = w.activeMonth.value
    if (!repository || !w.data.value || w.loading.value || !w.session.value) { records.value = []; recent.value = []; open.value = []; accounts.value = []; members.value = []; token.value = null; location.value = null; loading.value = false; error.value = ''; return }
    loading.value = true; error.value = ''
    try {
      const [data, users, qr] = await Promise.all([
        repository.load(w.id.value, month, attendanceDate(now.value, w.data.value.settings.timezone)),
        w.isAdmin.value ? w.getRepository()!.members(w.id.value) : Promise.resolve<Member[]>([]),
        w.isAdmin.value ? repository.qr(w.id.value) : Promise.resolve(null),
      ])
      if (request !== loadId || current !== scope() || month !== w.activeMonth.value) return
      records.value = data.records; recent.value = data.recent; open.value = data.open; accounts.value = data.accounts; members.value = users; token.value = qr; location.value = data.location
    } catch (e) { if (request === loadId && current === scope()) { records.value = []; recent.value = []; open.value = []; accounts.value = []; members.value = []; token.value = null; location.value = null; error.value = e instanceof Error ? e.message : 'Absensi belum dapat dimuat.' } }
    finally { if (request === loadId) loading.value = false }
  }
  async function write(operation: (repo: SupabaseAttendanceRepository, id: string, current: () => boolean) => Promise<unknown>, success: string): Promise<boolean> {
    if (!repository || busy.value || w.loading.value || !w.session.value) return false
    const current = scope(), request = ++writeId, id = w.id.value
    busy.value = true
    try {
      await operation(repository, id, () => current === scope() && request === writeId)
      if (current !== scope() || request !== writeId) return false
      await load()
      if (current === scope() && request === writeId) notify(success)
      return true
    } catch (e) { if (current === scope() && request === writeId) notify(e instanceof Error ? e.message : 'Absensi belum tersimpan.', true); return false }
    finally { if (request === writeId) busy.value = false }
  }
  async function checkLocation() {
    if (locating.value || busy.value) return
    const identity = scope(), request = writeId
    locating.value = true; locationError.value = ''
    try {
      const reading = await requestGeolocation()
      if (identity !== scope() || request !== writeId) return
      now.value = new Date(); point.value = reading
    } catch (error) { if (identity === scope() && request === writeId) locationError.value = (error as Error).message }
    finally { if (identity === scope() && request === writeId) locating.value = false }
  }
  function mark(qrToken: string, action: 'masuk' | 'pulang', date: string) {
    return write(async (repo, id, current) => {
      locationError.value = ''
      let reading: LocationReading
      try {
        reading = await requestGeolocation()
        if (!current()) throw new Error('Sesi absensi sudah berubah.')
        now.value = new Date(); point.value = reading
        const status = locationStatus(location.value, reading)
        if (!status.accepted) throw new Error(status.message)
      } catch (error) {
        if (current()) locationError.value = (error as Error).message
        throw error
      }
      return repo.mark(id, qrToken, action, date, reading)
    }, action === 'masuk' ? 'Absen masuk tercatat.' : 'Absen pulang tercatat.')
  }
  function bind(doctorId: string, userId: string) { return write((repo, id) => repo.bind(id, doctorId, userId), 'Akun dokter terhubung.') }
  function unbind(doctorId: string) { return write((repo, id) => repo.unbind(id, doctorId), 'Tautan akun dokter dilepas.') }
  function rotate() { return write(async (repo, id) => { await repo.qr(id, true) }, 'QR fasilitas diperbarui.') }
  watch([w.id, w.role, () => w.session.value?.user.id], () => { writeId++; busy.value = false; point.value = null; location.value = null; locationError.value = ''; locating.value = false; void load() }, { flush: 'sync' })
  watch([w.revision, w.activeMonth, w.loading], () => { void load() }, { immediate: true })
  onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 30000) })
  onBeforeUnmount(() => { loadId++; writeId++; if (timer) clearInterval(timer) })
  return { records, open, accounts, members, token, loading, busy, error, now, myAccount, myDoctor, myOpen, duties, location, point, gps, locating, locationError, load, mark, checkLocation, bind, unbind, rotate }
}
