import type { Doctor } from '../domain/types'
import { saveDoctor } from '../domain/commands'
import { prepareDoctorPhoto } from '../services/doctor-photos'
import { SupabaseDoctorPhotoRepository } from '../repositories/doctor-photo-repository'

export function useDoctorPhotos() {
  const w = useWorkspace()
  const client = useNuxtApp().$db
  const repository = client ? new SupabaseDoctorPhotoRepository(client) : null
  const urls = ref<Record<string, string>>({})
  const loading = ref(false), loadError = ref('')
  const busy = ref(false), error = ref('')
  const draftId = ref(''), draftPath = ref<string | null>(null)
  const staged = ref<Blob | null>(null), preview = ref<string | null>(null), removed = ref(false)
  let urlGeneration = 0, draftGeneration = 0, alive = true
  let loadedPaths: Record<string, string> = {}
  let timer: ReturnType<typeof setInterval> | undefined

  const scope = computed(() => [w.mode, w.id.value, w.session.value?.user.id ?? '', w.role.value].join('|'))
  const canUpload = computed(() => w.mode === 'supabase' && !!repository && !!w.session.value && w.isAdmin.value)
  const previewUrl = computed(() => removed.value ? null : preview.value ?? urls.value[draftId.value] ?? null)
  const hasPhoto = computed(() => !removed.value && !!(staged.value || draftPath.value))
  const photoKey = computed(() => scope.value + '|' + JSON.stringify(
    w.data.value?.doctors.map(d => [d.id, d.photoPath ?? null]) ?? [],
  ))

  function revokePreview() {
    if (preview.value) URL.revokeObjectURL(preview.value)
    preview.value = null
  }

  function clear() {
    draftGeneration++
    revokePreview()
    staged.value = null
    removed.value = false
    draftId.value = ''
    draftPath.value = null
    busy.value = false
    error.value = ''
  }

  function begin(doctor: Doctor) {
    clear()
    draftId.value = doctor.id
    draftPath.value = doctor.photoPath ?? null
  }

  async function refresh() {
    const generation = ++urlGeneration, requestScope = scope.value
    const doctors = w.data.value?.doctors ?? []
    urls.value = Object.fromEntries(doctors.filter(d => d.photoPath && d.photoPath === loadedPaths[d.id] && urls.value[d.id])
      .map(d => [d.id, urls.value[d.id]!]))
    if (w.mode !== 'supabase' || !repository || !w.session.value || !w.id.value) {
      urls.value = {}; loading.value = false; loadError.value = ''; return
    }
    const paths = doctors.map(d => d.photoPath).filter((path): path is string => !!path && path.startsWith(w.id.value + '/'))
    if (!paths.length) { urls.value = {}; loadedPaths = {}; loading.value = false; loadError.value = ''; return }
    loading.value = true
    loadError.value = ''
    try {
      const signed = await repository.urls(paths)
      if (!alive || generation !== urlGeneration || requestScope !== scope.value) return
      urls.value = Object.fromEntries(doctors.filter(d => d.photoPath && signed[d.photoPath]).map(d => [d.id, signed[d.photoPath!]!]))
      loadedPaths = Object.fromEntries(doctors.filter(d => d.photoPath).map(d => [d.id, d.photoPath!]))
    } catch (e) {
      if (alive && generation === urlGeneration && requestScope === scope.value) loadError.value = (e as Error).message
    } finally {
      if (alive && generation === urlGeneration && requestScope === scope.value) loading.value = false
    }
  }

  async function select(file: File) {
    if (busy.value || !draftId.value) return
    const generation = ++draftGeneration, requestScope = scope.value
    busy.value = true
    error.value = ''
    try {
      if (!canUpload.value) throw new Error('Unggah foto tersedia untuk admin pada akun fasilitas.')
      const photo = await prepareDoctorPhoto(file)
      if (!alive || generation !== draftGeneration || requestScope !== scope.value) return
      revokePreview()
      staged.value = photo
      preview.value = URL.createObjectURL(photo)
      removed.value = false
    } catch (e) {
      if (alive && generation === draftGeneration && requestScope === scope.value) error.value = (e as Error).message
    } finally {
      if (alive && generation === draftGeneration && requestScope === scope.value) busy.value = false
    }
  }

  function remove() {
    if (busy.value) return
    draftGeneration++
    revokePreview()
    staged.value = null
    removed.value = true
    error.value = ''
  }

  async function save(doctor: Doctor): Promise<boolean> {
    if (busy.value || w.saving.value || !w.isAdmin.value || doctor.id !== draftId.value) return false
    const generation = draftGeneration, requestScope = scope.value, workspaceId = w.id.value
    const current = () => alive && generation === draftGeneration && requestScope === scope.value
    let uploaded: string | null = null, committed = false
    busy.value = true
    error.value = ''
    try {
      const latestPath = w.data.value?.doctors.find(d => d.id === doctor.id)?.photoPath ?? null
      if (latestPath !== draftPath.value) throw new Error('Foto dokter sudah berubah. Tutup formulir dan buka kembali data dokter.')
      const next = { ...doctor }
      if (removed.value) next.photoPath = null
      if (staged.value) {
        if (!canUpload.value || !repository) throw new Error('Unggah foto tersedia untuk admin pada akun fasilitas.')
        uploaded = await repository.upload(workspaceId, doctor.id, staged.value)
        if (!current()) return false
        next.photoPath = uploaded
      }
      if (!current()) return false
      committed = await w.mutate(data => saveDoctor(data, next, w.role.value), 'Menyimpan dokter ' + next.name, true)
      if (!committed || !current()) return false
      await refresh()
      return current()
    } catch (e) {
      if (current()) error.value = (e as Error).message
      return false
    } finally {
      if (uploaded && !committed && repository) {
        try { await repository.discard(uploaded) } catch { /* Unlinked images can be cleaned up by the facility admin. */ }
      }
      if (current()) busy.value = false
    }
  }

  function resume() { if (document.visibilityState === 'visible') void refresh() }
  watch(scope, () => { clear(); urls.value = {}; loadedPaths = {}; loadError.value = '' }, { flush: 'sync' })
  watch(photoKey, () => { void refresh() }, { immediate: true })
  onMounted(() => {
    timer = setInterval(() => { void refresh() }, 10 * 60 * 1000)
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', resume)
  })
  onUnmounted(() => {
    alive = false
    urlGeneration++
    clear()
    if (timer) clearInterval(timer)
    window.removeEventListener('focus', resume)
    document.removeEventListener('visibilitychange', resume)
  })
  return { urls, loading, loadError, canUpload, previewUrl, hasPhoto, busy, error, begin, clear, select, remove, save, refresh }
}
