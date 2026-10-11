import { createClient } from '@supabase/supabase-js'
import { safeAttendanceReturn } from '../domain/attendance'
export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig().public
  let client = null
  let configError = ''
  try { client = config.storageMode === 'supabase' && config.supabaseUrl && config.supabaseAnonKey ? createClient(String(config.supabaseUrl), String(config.supabaseAnonKey)) : null }
  catch { configError = 'URL atau kunci Supabase tidak valid. Periksa environment aplikasi.' }
  nuxtApp.provide('db', client)
  const workspace = useWorkspace()
  const authSession = client ? (await client.auth.getSession()).data.session : null
  if (configError) { workspace.error.value = configError; workspace.loading.value = false }
  else try { await workspace.initialize(client, authSession) } catch (e) { workspace.error.value = (e as Error).message; workspace.loading.value = false }
  let authGeneration = 0
  client?.auth.onAuthStateChange((_event, nextSession) => {
    const oldId = workspace.session.value?.user.id
    workspace.session.value = nextSession
    if (oldId !== nextSession?.user.id) {
      const generation = ++authGeneration
      queueMicrotask(async () => {
      if (generation !== authGeneration) return
      const route = nuxtApp.$router.currentRoute.value
      const requested = safeAttendanceReturn(route.path === '/absen' ? route.fullPath : route.query.returnTo)
      await workspace.initialize(client, nextSession)
      if (generation !== authGeneration) return
      const query = requested === '/' ? {} : { returnTo: requested }
      const target = !nextSession ? { path: '/masuk', query } : workspace.needsWorkspace.value ? { path: '/mulai', query } : requested
      await nuxtApp.runWithContext(() => navigateTo(target))
      })
    }
  })
})
