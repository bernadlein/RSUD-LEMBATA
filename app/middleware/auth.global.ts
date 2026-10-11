import { safeAttendanceReturn } from '../domain/attendance'

export default defineNuxtRouteMiddleware((to) => {
  const w = useWorkspace()
  if (w.mode !== 'supabase') return
  const target = safeAttendanceReturn(to.path === '/absen' ? to.fullPath : to.query.returnTo)
  const query = target === '/' ? {} : { returnTo: target }
  if (!w.session.value && to.path !== '/masuk') return navigateTo({ path: '/masuk', query })
  if (w.session.value && w.needsWorkspace.value && to.path !== '/mulai' && to.path !== '/masuk') return navigateTo({ path: '/mulai', query })
  if (w.session.value && to.path === '/masuk') return navigateTo(w.needsWorkspace.value ? { path: '/mulai', query } : target)
})
