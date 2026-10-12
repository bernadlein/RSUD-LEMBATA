import { authDestination } from '../domain/auth-routing'

export default defineNuxtRouteMiddleware((to) => {
  const w = useWorkspace()
  const target = authDestination(to.path, to.fullPath, to.query.returnTo, !!w.session.value, w.needsWorkspace.value, w.role.value)
  if (target) return navigateTo(target)
})
