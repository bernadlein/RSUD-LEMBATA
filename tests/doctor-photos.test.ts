import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createEmptyWorkspace } from '../app/domain/seed'
import { parseWorkspace } from '../app/domain/schema'
import { applyDoctorRoster, initialRosterChoices } from '../app/domain/doctor-roster'
import {
  assertWorkspacePhotoScope, DOCTOR_PHOTO_INPUT_LIMIT, DOCTOR_PHOTO_OUTPUT_LIMIT,
  doctorPortraitCrop, isDoctorPhotoPath, newDoctorPhotoPath, validateDoctorPhotoFile, prepareImportedDoctorPhotos,
} from '../app/domain/doctor-photo'
import { prepareDoctorPhoto } from '../app/services/doctor-photos'
import { SupabaseDoctorPhotoRepository } from '../app/repositories/doctor-photo-repository'

const workspaceId = '10000000-0000-4000-8000-000000000001'
const imageId = '20000000-0000-4000-8000-000000000001'
const path = workspaceId + '/doctor-01/' + imageId + '.jpg'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('doctor photos and existing workspaces', () => {
  it('restores a backup in another workspace without keeping inaccessible private photo references', () => {
    const original = createEmptyWorkspace(); original.doctors[0]!.photoPath = path
    const same = prepareImportedDoctorPhotos(original, workspaceId)
    expect(same.removedPhotos).toBe(0); expect(same.data.doctors[0]!.photoPath).toBe(path)
    const moved = prepareImportedDoctorPhotos(original, imageId)
    expect(moved.removedPhotos).toBe(1); expect(moved.data.doctors[0]!.photoPath).toBeNull()
    expect(moved.data.doctors.map(d => d.name)).toEqual(original.doctors.map(d => d.name))
    expect(moved.data.plans).toEqual(original.plans); expect(original.doctors[0]!.photoPath).toBe(path)
    expect(() => assertWorkspacePhotoScope(moved.data, imageId)).not.toThrow()
  })
  it('reads old data and preserves a photo through backup parsing and roster reconciliation', () => {
    const old = createEmptyWorkspace()
    expect(parseWorkspace(old)).toEqual(old)
    old.doctors[0]!.photoPath = path
    const restored = parseWorkspace(JSON.parse(JSON.stringify(old)))
    expect(restored.doctors[0]!.photoPath).toBe(path)
    const renamed = applyDoctorRoster(restored, initialRosterChoices(restored.doctors), 'admin')
    expect(renamed.doctors[0]!.photoPath).toBe(path)
    expect(renamed.doctors[0]!.id).toBe('doctor-01')
  })

  it('rejects external URLs, traversal, and references to another doctor or workspace', () => {
    expect(newDoctorPhotoPath(workspaceId, 'doctor-01', imageId)).toBe(path)
    for (const bad of ['https://example.test/ela.jpg', 'data:image/jpeg;base64,123', path.replace('doctor-01/', '../'), path.replace('.jpg', '.svg')]) {
      expect(isDoctorPhotoPath(bad)).toBe(false)
      const w = createEmptyWorkspace(); w.doctors[0]!.photoPath = bad
      expect(() => parseWorkspace(w)).toThrow()
    }
    const wrongDoctor = createEmptyWorkspace(); wrongDoctor.doctors[1]!.photoPath = path
    expect(() => parseWorkspace(wrongDoctor)).toThrow('Foto dokter')
    const wrongWorkspace = createEmptyWorkspace(); wrongWorkspace.doctors[0]!.photoPath = path
    expect(() => assertWorkspacePhotoScope(wrongWorkspace, imageId)).toThrow('ruang kerja')
    expect(() => assertWorkspacePhotoScope(wrongWorkspace, workspaceId)).not.toThrow()
  })

  it('limits source formats and file size before decoding', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(() => validateDoctorPhotoFile({ type, size: DOCTOR_PHOTO_INPUT_LIMIT })).not.toThrow()
    }
    for (const type of ['image/svg+xml', 'image/heic', 'text/html']) {
      expect(() => validateDoctorPhotoFile({ type, size: 10 })).toThrow('JPG')
    }
    expect(() => validateDoctorPhotoFile({ type: 'image/png', size: 0 })).toThrow('5 MB')
    expect(() => validateDoctorPhotoFile({ type: 'image/png', size: DOCTOR_PHOTO_INPUT_LIMIT + 1 })).toThrow('5 MB')
  })

  it('crops wide and tall images to 4:5 without changing their proportions', () => {
    expect(doctorPortraitCrop(800, 600)).toEqual({ x: 160, y: 0, width: 480, height: 600 })
    expect(doctorPortraitCrop(480, 1200)).toEqual({ x: 0, y: 300, width: 480, height: 600 })
    expect(doctorPortraitCrop(480, 600)).toEqual({ x: 0, y: 0, width: 480, height: 600 })
    expect(() => doctorPortraitCrop(0, 600)).toThrow('Resolusi')
    expect(() => doctorPortraitCrop(10_000, 10_000)).toThrow('Resolusi')
  })
})

describe('image preparation', () => {
  function canvasHarness(output: Blob | null) {
    const bitmap = { width: 800, height: 600, close: vi.fn() }
    const drawImage = vi.fn(), fillRect = vi.fn()
    const toBlob = vi.fn((callback: (value: Blob | null) => void) => callback(output))
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage, fillRect, fillStyle: '' }), toBlob }
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap))
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
    return { bitmap, drawImage, fillRect, canvas, toBlob }
  }

  it('draws the crop onto a JPEG portrait and releases the decoded image', async () => {
    const jpeg = new Blob(['encoded portrait'], { type: 'image/jpeg' }), h = canvasHarness(jpeg)
    expect(await prepareDoctorPhoto(new File(['source PNG'], 'portrait.png', { type: 'image/png' }))).toBe(jpeg)
    expect(h.canvas.width).toBe(480); expect(h.canvas.height).toBe(600)
    expect(h.drawImage).toHaveBeenCalledWith(h.bitmap, 160, 0, 480, 600, 0, 0, 480, 600)
    expect(h.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.86)
    expect(h.bitmap.close).toHaveBeenCalledOnce()
  })

  it('refuses a failed or oversized encoding and always releases image resources', async () => {
    const h = canvasHarness(new Blob([new Uint8Array(DOCTOR_PHOTO_OUTPUT_LIMIT + 1)], { type: 'image/jpeg' }))
    await expect(prepareDoctorPhoto(new File(['source'], 'portrait.jpg', { type: 'image/jpeg' }))).rejects.toThrow('terlalu besar')
    expect(h.toBlob).toHaveBeenCalledTimes(4)
    expect(h.bitmap.close).toHaveBeenCalledOnce()
    const decode = vi.fn().mockRejectedValue(new Error('Not an image'))
    vi.stubGlobal('createImageBitmap', decode)
    await expect(prepareDoctorPhoto(new File(['fake'], 'fake.jpg', { type: 'image/jpeg' }))).rejects.toThrow('tidak dapat dibaca')
  })
})

describe('photo storage adapter', () => {
  function storageHarness() {
    const bucket = {
      createSignedUrls: vi.fn(async (paths: string[]) => ({ data: paths.map(p => ({ path: p, error: null, signedUrl: 'https://storage.test/' + p })), error: null })),
      upload: vi.fn(async () => ({ error: null })),
      remove: vi.fn(async () => ({ error: null })),
    }
    const from = vi.fn(() => bucket)
    return { bucket, from, repo: new SupabaseDoctorPhotoRepository({ storage: { from } } as unknown as SupabaseClient) }
  }

  it('batches unique paths with temporary URLs and creates a new immutable JPEG path', async () => {
    const h = storageHarness()
    expect((await h.repo.urls([path, path, 'https://bad.test/file']))[path]).toContain(path)
    expect(h.bucket.createSignedUrls).toHaveBeenCalledWith([path], 900)
    const blob = new Blob(['jpeg'], { type: 'image/jpeg' })
    const uploaded = await h.repo.upload(workspaceId, 'doctor-01', blob)
    expect(isDoctorPhotoPath(uploaded)).toBe(true)
    expect(h.bucket.upload).toHaveBeenCalledWith(uploaded, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
    expect(h.from).toHaveBeenCalledWith('rd-doctor-photos')
  })

  it('rejects raw uploads and reports an unavailable photo service', async () => {
    const h = storageHarness()
    await expect(h.repo.upload(workspaceId, 'doctor-01', new Blob(['png'], { type: 'image/png' }))).rejects.toThrow('format')
    expect(h.bucket.upload).not.toHaveBeenCalled()
    h.bucket.upload.mockResolvedValue({ error: { message: 'Bucket not found' } } as never)
    await expect(h.repo.upload(workspaceId, 'doctor-01', new Blob(['jpeg'], { type: 'image/jpeg' }))).rejects.toThrow('Penyimpanan foto belum tersedia.')
  })
})
