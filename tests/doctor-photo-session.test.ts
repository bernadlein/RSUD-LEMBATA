import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, watch, effectScope } from 'vue'
import { useDoctorPhotos } from '../app/composables/useDoctorPhotos'
import { prepareDoctorPhoto } from '../app/services/doctor-photos'
import { createEmptyWorkspace } from '../app/domain/seed'
import type { Role, Workspace } from '../app/domain/types'

vi.mock('../app/services/doctor-photos', () => ({ prepareDoctorPhoto: vi.fn() }))
const workspaceId = '10000000-0000-4000-8000-000000000001', userId = '20000000-0000-4000-8000-000000000001'
const existingPath = workspaceId + '/doctor-01/30000000-0000-4000-8000-000000000001.jpg'
const jpeg = () => new Blob(['prepared jpeg'], { type: 'image/jpeg' })
const selectedFile = () => new File(['source jpeg'], 'photo.jpg', { type: 'image/jpeg' })

function workspace() {
  const role = ref<Role>('admin'), data = ref<Workspace>(createEmptyWorkspace())
  return {
    role, data, mode: 'supabase', id: ref(workspaceId), session: ref({ user: { id: userId } }),
    isAdmin: computed(() => role.value === 'admin'), saving: ref(false),
    mutate: vi.fn(async (transform: (w: Workspace) => Workspace) => { data.value = transform(data.value); return true }),
  }
}
let w: ReturnType<typeof workspace>
let storage: {
  createSignedUrls: ReturnType<typeof vi.fn>; upload: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>
}
let photos: ReturnType<typeof useDoctorPhotos>, scope: ReturnType<typeof effectScope>, dispose: () => void

beforeEach(() => {
  w = workspace()
  storage = {
    createSignedUrls: vi.fn(async (paths: string[]) => ({ data: paths.map(path => ({ path, error: null, signedUrl: 'https://storage.test/' + path })), error: null })),
    upload: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })),
  }
  vi.mocked(prepareDoctorPhoto).mockResolvedValue(jpeg())
  vi.stubGlobal('useWorkspace', () => w)
  vi.stubGlobal('useNuxtApp', () => ({ $db: { storage: { from: () => storage } } }))
  vi.stubGlobal('ref', ref); vi.stubGlobal('computed', computed); vi.stubGlobal('watch', watch)
  vi.stubGlobal('onMounted', vi.fn())
  vi.stubGlobal('onUnmounted', (callback: () => void) => { dispose = callback })
  vi.stubGlobal('window', { removeEventListener: vi.fn() })
  vi.stubGlobal('document', { removeEventListener: vi.fn() })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:doctor-preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  scope = effectScope()
  scope.run(() => { photos = useDoctorPhotos() })
  photos.begin(w.data.value.doctors[0]!)
})
afterEach(() => { dispose(); scope.stop(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.mocked(prepareDoctorPhoto).mockReset() })

describe('photo editing and account changes', () => {
  it('drops a prepared preview when the signed-in account changes', async () => {
    let finish!: (blob: Blob) => void
    vi.mocked(prepareDoctorPhoto).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = photos.select(selectedFile())
    w.session.value = { user: { id: 'new-user' } }
    finish(jpeg()); await pending
    expect(photos.previewUrl.value).toBeNull()
    expect(photos.hasPhoto.value).toBe(false)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(photos.busy.value).toBe(false)
  })

  it('does not save an upload into a different workspace after an account switch', async () => {
    await photos.select(selectedFile())
    const doctor = { ...w.data.value.doctors[0]! }
    let finish!: (result: { error: null }) => void
    storage.upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = photos.save(doctor)
    w.id.value = '10000000-0000-4000-8000-000000000099'
    w.session.value = { user: { id: 'different-user' } }
    finish({ error: null })
    expect(await pending).toBe(false)
    expect(w.mutate).not.toHaveBeenCalled()
    expect(storage.remove).toHaveBeenCalledOnce()
    expect(storage.remove.mock.calls[0]![0][0]).toMatch(new RegExp('^' + workspaceId + '/doctor-01/'))
    expect(photos.error.value).toBe('')
  })

  it('discards a newly uploaded image if the workspace write fails', async () => {
    await photos.select(selectedFile())
    w.mutate.mockResolvedValue(false)
    expect(await photos.save({ ...w.data.value.doctors[0]! })).toBe(false)
    expect(storage.remove).toHaveBeenCalledOnce()
    expect(w.data.value.doctors[0]!.photoPath).toBeUndefined()
    expect(photos.previewUrl.value).toBe('blob:doctor-preview')
    expect(photos.hasPhoto.value).toBe(true)
  })

  it('links a successful upload and retains earlier objects for existing backups', async () => {
    await photos.select(selectedFile())
    expect(await photos.save({ ...w.data.value.doctors[0]! })).toBe(true)
    const path = w.data.value.doctors[0]!.photoPath!
    expect(path).toContain(workspaceId + '/doctor-01/')
    expect(storage.remove).not.toHaveBeenCalled()
    photos.begin(w.data.value.doctors[0]!)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:doctor-preview')
    photos.remove()
    expect(await photos.save({ ...w.data.value.doctors[0]! })).toBe(true)
    expect(w.data.value.doctors[0]!.photoPath).toBeNull()
    expect(storage.remove).not.toHaveBeenCalled()
  })

  it('does not restore signed photo URLs from the previous account', async () => {
    w.data.value.doctors[0]!.photoPath = existingPath
    let finish!: (result: unknown) => void
    storage.createSignedUrls.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = photos.refresh()
    w.session.value = { user: { id: 'new-user' } }
    w.id.value = '10000000-0000-4000-8000-000000000099'
    finish({ data: [{ path: existingPath, error: null, signedUrl: 'https://storage.test/old-account' }], error: null })
    await pending
    expect(photos.urls.value).toEqual({})
  })

  it('blocks uploads by non-admins and rejects an editor with a changed photo', async () => {
    w.role.value = 'viewer'
    photos.begin(w.data.value.doctors[0]!)
    await photos.select(selectedFile())
    expect(photos.error.value).toContain('admin')
    expect(prepareDoctorPhoto).not.toHaveBeenCalled()
    w.role.value = 'admin'
    photos.begin(w.data.value.doctors[0]!)
    w.data.value.doctors[0]!.photoPath = existingPath
    expect(await photos.save({ ...w.data.value.doctors[0]! })).toBe(false)
    expect(photos.error.value).toContain('sudah berubah')
    expect(storage.upload).not.toHaveBeenCalled()
  })
})
