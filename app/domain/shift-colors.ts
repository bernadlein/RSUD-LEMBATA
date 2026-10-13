/** Shared presentation mapping; shift durations and scheduling rules stay in shifts.ts. */
const colorKeys: Readonly<Record<string, string>> = Object.freeze({
  PSI: 'psi', PI: 'pi', SI: 'si', MI: 'mi', NI: 'mi',
  PSR: 'psr', PRR: 'prr', SR: 'sr', MR: 'mr', NR: 'mr',
  PR: 'pr', C: 'leave', L: 'off', BM: 'not-started',
  PSM: 'full-day', '24 JAM': 'full-day', '24JAM': 'full-day',
})

export function shiftColorClass(code: string | undefined): string {
  const key = code?.trim().toUpperCase() ?? ''
  const color = !key ? 'empty' : Object.hasOwn(colorKeys, key) ? colorKeys[key]! : 'other'
  return `shift-tone shift-${color}`
}
