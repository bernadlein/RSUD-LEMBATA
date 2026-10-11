export default defineNuxtRouteMiddleware((to) => {
  const w = useWorkspace()
  if (w.mode !== 'supabase') return
  if (!w.session.value && to.path !== '/masuk') return navigateTo('/masuk')
  if (w.session.value && w.needsWorkspace.value && to.path !== '/mulai' && to.path !== '/masuk') return navigateTo('/mulai')
  if (w.session.value && to.path === '/masuk') return navigateTo(w.needsWorkspace.value ? '/mulai' : '/')
})
