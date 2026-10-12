import { emptyPortalDraft, type PortalDraft } from '../domain/hospital-portal'
import type { AttendanceLocation, AttendanceLocationInput } from '../domain/geolocation'
import { HospitalPortalRepository } from '../repositories/hospital-portal-repository'

export function useHospitalPortal() {
  const w = useWorkspace(), client = useNuxtApp().$db, { notify } = useNotifications()
  const repository = client ? new HospitalPortalRepository(client) : null
  const draft = ref<PortalDraft>(emptyPortalDraft()), revision = ref(0), publishedAt = ref<string | null>(null)
  const location = ref<AttendanceLocation | null>(null)
  const loading = ref(false), busy = ref(false), error = ref('')
  let generation = 0, alive = true
  const scope = () => [w.id.value, w.session.value?.user.id ?? '', w.role.value].join('|')
  async function load() {
    const request = ++generation, identity = scope()
    if (!repository || !w.isAdmin.value || !w.id.value || w.loading.value) {
      draft.value = emptyPortalDraft(); revision.value = 0; location.value = null; publishedAt.value = null; loading.value = false; return
    }
    loading.value = true; error.value = ''
    try {
      const [portal, geo] = await Promise.all([repository.load(w.id.value), repository.location(w.id.value)])
      if (!alive || request !== generation || identity !== scope()) return
      draft.value = portal.data; revision.value = portal.revision; publishedAt.value = portal.publishedAt; location.value = geo
    } catch (e) { if (alive && request === generation && identity === scope()) error.value = (e as Error).message }
    finally { if (alive && request === generation && identity === scope()) loading.value = false }
  }
  async function write(operation: (repo: HospitalPortalRepository, id: string) => Promise<unknown>, message: string, reload = true) {
    if (!repository || !w.isAdmin.value || busy.value || loading.value || !w.session.value) return false
    const identity = scope()
    busy.value = true
    try {
      await operation(repository, w.id.value)
      if (!alive || identity !== scope()) return false
      if (reload) await load()
      if (!alive || identity !== scope()) return false
      notify(message); return true
    } catch (e) { if (alive && identity === scope()) notify((e as Error).message, true); return false }
    finally { if (alive && identity === scope()) busy.value = false }
  }
  function save(data: PortalDraft) { const copy = JSON.parse(JSON.stringify(data)); return write((repo, id) => repo.save(id, copy, revision.value), 'Draf portal tersimpan. Terbitkan untuk memperbarui informasi publik.') }
  async function publish() {
    const expected = revision.value
    const ok = await write((repo, id) => repo.publish(id, expected), 'Informasi rumah sakit diterbitkan.')
    if (ok) await refreshNuxtData('hospital-publication')
    return ok
  }
  async function unpublish() {
    const identity = scope()
    const ok = await write(async (repo, id) => { await repo.unpublish(id); if (alive && identity === scope()) publishedAt.value = null }, 'Informasi publik ditarik dari portal.', false)
    if (ok) await refreshNuxtData('hospital-publication')
    return ok
  }
  function saveLocation(data: AttendanceLocationInput) {
    const copy = { ...data }, expected = location.value?.revision ?? 0, identity = scope()
    return write(async (repo, id) => {
      const saved = await repo.saveLocation(id, copy, expected)
      if (alive && identity === scope()) location.value = saved
    }, 'Titik dan radius absensi tersimpan.', false)
  }
  watch([w.id, w.role, () => w.session.value?.user.id], () => {
    busy.value = false; draft.value = emptyPortalDraft(); revision.value = 0; publishedAt.value = null; location.value = null; error.value = ''
    void load()
  }, { flush: 'sync' })
  watch(w.loading, () => { void load() }, { immediate: true })
  onBeforeUnmount(() => { alive = false; generation++ })
  return { draft, revision, publishedAt, location, loading, busy, error, load, save, publish, unpublish, saveLocation }
}
