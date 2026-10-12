export const PRIVATE_HOME = '/dashboard'
const publicPaths = new Set(['/', '/masuk', '/jadwal-dokter', '/berita'])
const privatePaths = new Set(['/dashboard', '/jadwal', '/dokter', '/absen', '/rekap', '/kode-dinas', '/cetak', '/pengaturan', '/portal'])

export function isPublicRoute(path: string): boolean {
  return publicPaths.has(path) || /^\/berita\/[0-9a-f-]{36}$/.test(path)
}

export function safePrivateReturn(value: unknown): string {
  if (typeof value !== 'string') return PRIVATE_HOME
  try {
    const url = new URL(value, 'https://ruang-dinas.invalid')
    return url.origin === 'https://ruang-dinas.invalid' && privatePaths.has(url.pathname)
      ? url.pathname + url.search : PRIVATE_HOME
  } catch { return PRIVATE_HOME }
}

export function authDestination(path: string, fullPath: string, returnTo: unknown, signedIn: boolean, needsWorkspace: boolean) {
  if (isPublicRoute(path) && path !== '/masuk') return null
  const target = safePrivateReturn(returnTo)
  if (!signedIn) return path === '/masuk' ? null : { path: '/masuk', query: { returnTo: safePrivateReturn(fullPath) } }
  if (needsWorkspace) return path === '/mulai' ? null : { path: '/mulai', query: { returnTo: path === '/masuk' ? target : safePrivateReturn(fullPath) } }
  return path === '/masuk' || path === '/mulai' ? target : null
}
