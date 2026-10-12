import { createClient } from '@supabase/supabase-js'
import { isPublicRoute, safePrivateReturn } from '../domain/auth-routing'

export default defineNuxtPlugin(async nuxtApp => {
  const config = useRuntimeConfig().public
  let client = null, configError = ''
  try {
    client = config.storageMode === 'supabase' && config.supabaseUrl && config.supabaseAnonKey
      ? createClient(String(config.supabaseUrl), String(config.supabaseAnonKey)) : null
  } catch { configError = 'Login belum tersedia.' }
  nuxtApp.provide('db', client)
  const workspace = useWorkspace()
  const authSession = client ? (await client.auth.getSession()).data.session : null
  if (configError) { workspace.error.value = configError; workspace.loading.value = false }
  else try { await workspace.initialize(client, authSession) }
  catch (e) { workspace.error.value = (e as Error).message; workspace.loading.value = false }

  let authGeneration = 0
  client?.auth.onAuthStateChange((_event, nextSession) => {
    const oldId = workspace.session.value?.user.id
    workspace.session.value = nextSession
    if (oldId === nextSession?.user.id) return
    workspace.data.value = null
    workspace.id.value = ''
    workspace.role.value = 'viewer'
    workspace.needsWorkspace.value = false
    workspace.loading.value = true
    const generation = ++authGeneration
    queueMicrotask(async () => {
      if (generation !== authGeneration) return
      const route = nuxtApp.$router.currentRoute.value
      const requested = safePrivateReturn(route.path === '/masuk' || route.path === '/mulai' ? route.query.returnTo : route.fullPath)
      await workspace.initialize(client, nextSession)
      if (generation !== authGeneration) return
      if (isPublicRoute(route.path) && route.path !== '/masuk') return
      const target = !nextSession ? '/' : workspace.needsWorkspace.value
        ? { path: '/mulai', query: { returnTo: requested } } : requested
      await nuxtApp.runWithContext(() => navigateTo(target))
    })
  })
})
