import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useWorkspace } from '../app/composables/useWorkspace'
import type { Session } from '@supabase/supabase-js'
import { createEmptyWorkspace } from '../app/domain/seed'

const notify = vi.fn()
beforeEach(() => {
  const states = new Map(), stored = new Map<string, string>()
  vi.stubGlobal('useState', (key: string, factory: () => unknown) => { if (!states.has(key)) states.set(key, ref(factory())); return states.get(key) })
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { storageMode: 'demo' } }))
  vi.stubGlobal('useNotifications', () => ({ notify }))
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) } })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); notify.mockClear() })

describe('workspace save session boundaries', () => {
  it('does not publish an old save into a newly signed-in account', async () => {
    const w = useWorkspace(); await w.initialize(null, null)
    const repo = w.getRepository()!
    let complete!: (revision: number) => void
    vi.spyOn(repo, 'save').mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const request = w.mutate(data => { data.settings.city = 'Old session city'; return data }, 'Test save', true)
    const fresh = createEmptyWorkspace(); fresh.settings.city = 'New session city'
    w.session.value = { user: { id: 'new-user' } } as Session
    w.id.value = 'new-workspace'; w.data.value = fresh; w.revision.value = 12
    complete(1)
    expect(await request).toBe(false)
    expect(w.data.value!.settings.city).toBe('New session city'); expect(w.revision.value).toBe(12)
    expect(notify).not.toHaveBeenCalled(); expect(w.saving.value).toBe(false)
  })
  it('reloads the committed result when a refresh overlapped a save', async () => {
    const w = useWorkspace(); await w.initialize(null, null)
    const repo = w.getRepository()!, save = repo.save.bind(repo)
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    vi.spyOn(repo, 'save').mockImplementation(async (...args) => { await pending; return save(...args) })
    const request = w.mutate(data => { data.settings.city = 'Committed city'; return data }, 'Test save', true)
    await w.reload()
    release()
    expect(await request).toBe(true)
    expect(w.data.value!.settings.city).toBe('Committed city'); expect(w.revision.value).toBe(1)
    expect(notify).toHaveBeenCalledWith('Perubahan tersimpan.')
  })
})
