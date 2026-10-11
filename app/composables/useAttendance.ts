import type { Attendance, DoctorAccount } from '../domain/attendance'
import type { Member } from '../domain/types'
import { attendanceDate, availableDuties } from '../domain/attendance'
import { SupabaseAttendanceRepository } from '../repositories/attendance-repository'

export function useAttendance() {
  const w = useWorkspace(), db = useNuxtApp().$db, { notify } = useNotifications()
  const records = shallowRef<Attendance[]>([]), open = shallowRef<Attendance[]>([]), accounts = shallowRef<DoctorAccount[]>([]), members = shallowRef<Member[]>([])
  const recent = shallowRef<Attendance[]>([])
  const token = ref<string | null>(null), loading = ref(false), busy = ref(false), error = ref(''), now = ref(new Date())
  const repository = db && w.mode === 'supabase' ? new SupabaseAttendanceRepository(db) : null
  const myAccount = computed(() => accounts.value.find(a => a.user_id === w.session.value?.user.id))
  const myDoctor = computed(() => w.data.value?.doctors.find(d => d.id === myAccount.value?.doctor_id))
  const myOpen = computed(() => open.value.find(r => r.user_id === w.session.value?.user.id))
  const duties = computed(() => w.data.value && myDoctor.value ? availableDuties(w.data.value, myDoctor.value.id, now.value).filter(d => !recent.value.some(r => r.doctor_id === myDoctor.value!.id && r.duty_date === d.date)) : [])
  let loadId = 0, writeId = 0, timer: ReturnType<typeof setInterval> | null = null
  const scope = () => `${w.id.value}:${w.session.value?.user.id ?? ''}:${w.role.value}`

  async function load() {
    const request = ++loadId, current = scope(), month = w.activeMonth.value
    if (!repository || !w.data.value || w.loading.value || !w.session.value) { records.value = []; recent.value = []; open.value = []; accounts.value = []; members.value = []; token.value = null; loading.value = false; error.value = ''; return }
    loading.value = true; error.value = ''
    try {
      const [data, users, qr] = await Promise.all([
        repository.load(w.id.value, month, attendanceDate(now.value, w.data.value.settings.timezone)),
        w.isAdmin.value ? w.getRepository()!.members(w.id.value) : Promise.resolve<Member[]>([]),
        w.isAdmin.value ? repository.qr(w.id.value) : Promise.resolve(null),
      ])
      if (request !== loadId || current !== scope() || month !== w.activeMonth.value) return
      records.value = data.records; recent.value = data.recent; open.value = data.open; accounts.value = data.accounts; members.value = users; token.value = qr
    } catch (e) { if (request === loadId && current === scope()) { records.value = []; recent.value = []; open.value = []; accounts.value = []; members.value = []; token.value = null; error.value = e instanceof Error ? e.message : 'Absensi belum dapat dimuat.' } }
    finally { if (request === loadId) loading.value = false }
  }
  async function write(operation: (repo: SupabaseAttendanceRepository, id: string) => Promise<unknown>, success: string): Promise<boolean> {
    if (!repository || busy.value || w.loading.value || !w.session.value) return false
    const current = scope(), request = ++writeId, id = w.id.value
    busy.value = true
    try {
      await operation(repository, id)
      if (current !== scope() || request !== writeId) return false
      await load()
      if (current === scope() && request === writeId) notify(success)
      return true
    } catch (e) { if (current === scope() && request === writeId) notify(e instanceof Error ? e.message : 'Absensi belum tersimpan.', true); return false }
    finally { if (request === writeId) busy.value = false }
  }
  function mark(qrToken: string, action: 'masuk' | 'pulang', date: string) {
    return write((repo, id) => repo.mark(id, qrToken, action, date), action === 'masuk' ? 'Absen masuk tercatat.' : 'Absen pulang tercatat.')
  }
  function bind(doctorId: string, userId: string) { return write((repo, id) => repo.bind(id, doctorId, userId), 'Akun dokter terhubung.') }
  function unbind(doctorId: string) { return write((repo, id) => repo.unbind(id, doctorId), 'Tautan akun dokter dilepas.') }
  function rotate() { return write(async (repo, id) => { await repo.qr(id, true) }, 'QR baru tersedia. Unduh ulang untuk mengganti QR yang ditempel.') }
  watch([w.id, w.role, () => w.session.value?.user.id], () => { writeId++; busy.value = false; void load() })
  watch([w.revision, w.activeMonth, w.loading], () => { void load() }, { immediate: true })
  onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 30000) })
  onBeforeUnmount(() => { loadId++; writeId++; if (timer) clearInterval(timer) })
  return { records, open, accounts, members, token, loading, busy, error, now, myAccount, myDoctor, myOpen, duties, load, mark, bind, unbind, rotate }
}
