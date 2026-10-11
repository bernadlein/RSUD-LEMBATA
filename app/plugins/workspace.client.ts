import { createClient } from '@supabase/supabase-js'
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
  client?.auth.onAuthStateChange((_event, nextSession) => {
    const oldId = workspace.session.value?.user.id
    workspace.session.value = nextSession
    if (oldId !== nextSession?.user.id) queueMicrotask(async () => {
      await workspace.initialize(client, nextSession)
      const target = !nextSession ? '/masuk' : workspace.needsWorkspace.value ? '/mulai' : '/'
      await nuxtApp.runWithContext(() => navigateTo(target))
    })
  })
})
