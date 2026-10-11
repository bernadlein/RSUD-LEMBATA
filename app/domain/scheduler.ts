import type { Doctor, MonthPlan, Role, ShiftCode, Workspace } from './types'
import { addDays, isSunday, monthDates } from './calendar'
import { fairness, inspectPlan, isAvailable, isOnLeave, summarize } from './analysis'
import { assertRole, cloneWorkspace } from './commands'
import { parseWorkspace } from './schema'
import { validateChange } from './permissions'
import { isNight, minutes, planShifts, shiftHours } from './shifts'

export interface GeneratorOptions {
  preferRegular: boolean
  restedBeforeFirstMonth: boolean
}
export interface GeneratedMonth {
  source: string
  options: GeneratorOptions
  plan: MonthPlan
  rows: Array<{ id: string; name: string; unit: Doctor['unit']; hours: number; availableDays: number; longDays: number; nightDays: number }>
  spread: number | null
  notes: string[]
}
interface Duty { shift: ShiftCode; hours: number; start: number; end: number }
interface State { hours: number; nights: number; work: number; long: number; rest: number; end: number }
interface Node { states: State[]; days: string[][]; longDays: number; extraHours: number; score: number }
interface Context {
  w: Workspace; dates: string[]; doctors: Doctor[]; off: string; leave: string; bm: string
  history: Array<Array<{ code: string; shift: ShiftCode }>>
  future: Array<Array<{ code: string; shift: ShiftCode }>> | null
  available: number[][]; options: GeneratorOptions
}

const DAY = 1440
const BEAM = 24
const MAX_PATTERNS = 12
const MAX_MATCH_NODES = 700
export const generatorHistoryDays = (w: Workspace) => Math.max(w.settings.maxConsecutiveWork, w.settings.offAfterLong + 1, Math.ceil(w.settings.minGapHours / 24) + 2)
const emptyState = (): State => ({ hours: 0, nights: 0, work: 0, long: 0, rest: 0, end: -Infinity })
const round = (v: number) => Math.round(v * 100) / 100
const duty = (shift: ShiftCode): Duty | null => {
  const hours = shiftHours(shift)
  if (!shift.active || hours === null || hours <= 0 || hours > 12 || !shift.start || !shift.end) return null
  const start = minutes(shift.start), end = start + hours * 60
  // An override must agree with the displayed clock before it can be generated.
  if (end % DAY !== minutes(shift.end)) return null
  return { shift, hours, start, end }
}

/** Only inputs that affect this month participate in the stale-preview guard. */
export function generatorSource(w: Workspace, month: string): string {
  const dates = monthDates(month)
  return JSON.stringify({ month, settings: w.settings, doctors: w.doctors, shifts: w.shifts,
    current: w.plans[month] ?? null, previous: w.plans[addDays(dates[0]!, -1).slice(0, 7)] ?? null,
    following: w.plans[addDays(dates.at(-1)!, 1).slice(0, 7)] ?? null })
}

function context(w: Workspace, month: string, options: GeneratorOptions): Context {
  const dates = monthDates(month)
  if (w.plans[month]) throw new Error('Jadwal bulan ini sudah tersedia. Pilih bulan baru.')
  const doctors = w.doctors.filter(d => d.active)
  if (!doctors.some(d => d.unit === 'rotasi')) throw new Error('Tambahkan dokter rotasi yang aktif terlebih dahulu.')
  function zero(kind: ShiftCode['kind']) {
    const s = w.shifts.find(s => s.active && s.kind === kind)
    if (!s) throw new Error('Aktifkan kode LIBUR, CUTI, dan BELUM MULAI pada master dinas.')
    return s.code
  }
  const off = zero('off'), leave = zero('leave'), bm = zero('not_started')
  const previous = w.plans[addDays(dates[0]!, -1).slice(0, 7)]
  const following = w.plans[addDays(dates.at(-1)!, 1).slice(0, 7)]
  function cell(d: Doctor, date: string, past: boolean) {
    const p = w.plans[date.slice(0, 7)]
    let code = p?.assignments[d.id]?.[date] ?? ''
    if (!code && d.joinedOn && date < d.joinedOn) code = bm
    if (!code && isOnLeave(d, date)) code = leave
    if (!code && past && !previous && options.restedBeforeFirstMonth) code = off
    if (!code) throw new Error(`Lengkapi riwayat ${d.name} pada ${date}${past && !previous ? ', atau konfirmasi kondisi istirahat sebelum bulan pertama' : ''}.`)
    const shift = (p ? planShifts(w, p) : w.shifts).find(s => s.code === code)
    const h = shiftHours(shift)
    if (!shift || h === null || (h > 0 && (!shift.start || !shift.end))) throw new Error(`Jam riwayat ${d.name}, kode ${code} pada ${date}, belum lengkap.`)
    return { code, shift }
  }
  const lookback = generatorHistoryDays(w)
  const history = doctors.map(d => Array.from({ length: lookback }, (_, i) => cell(d, addDays(dates[0]!, i - lookback), true)))
  const future = following ? doctors.map(d => Array.from({ length: lookback }, (_, i) => cell(d, addDays(dates.at(-1)!, i + 1), false))) : null
  for (let i = 0; i < doctors.length; i++) {
    const boundaryCodes = [...history[i]!.slice(-2), ...(future?.[i]?.slice(0, 2) ?? [])]
    if (boundaryCodes.some(c => !w.shifts.some(s => s.code === c.code))) throw new Error('Kode sambungan bulan belum ada pada master dinas. Tambahkan kembali kode tersebut sebelum menyusun bulan ini.')
  }
  const available = doctors.map(d => dates.map((_, day) => dates.slice(0, day + 1).filter(date => isAvailable(d, date)).length))
  return { w, dates, doctors, off, leave, bm, history, future, available, options }
}

/** Enumerate bounded, irredundant covers of a complete service day. */
function servicePatterns(w: Workspace): Duty[][] {
  const definitions = w.shifts.filter(s => ['igd', 'ruangan'].includes(s.unit) && s.start && s.end && (shiftHours(s) ?? 0) > 0)
  const starts = definitions.filter(s => !isNight(s)).map(s => minutes(s.start!))
  const anchor = starts.length ? Math.min(...starts) : 420
  const candidates = w.shifts.map(duty).filter((s): s is Duty => !!s && ['igd', 'ruangan'].includes(s.shift.unit))
  function covers(unit: 'igd' | 'ruangan'): Duty[][] {
    const unique = new Map<string, Duty>()
    for (const d of candidates.filter(d => d.shift.unit === unit)) {
      const start = d.start < anchor ? d.start + DAY : d.start
      const item = { ...d, start, end: start + d.hours * 60 }
      const key = `${item.start}:${item.end}`
      if (!unique.has(key)) unique.set(key, item)
    }
    const list = [...unique.values()].sort((a, b) => a.start - b.start || a.end - b.end || a.shift.code.localeCompare(b.shift.code))
    const found = new Map<string, Duty[]>()
    let visits = 0
    function search(point: number, selected: Duty[]) {
      if (++visits > 2500) return
      if (point >= anchor + DAY) {
        const sorted = [...selected].sort((a, b) => a.start - b.start)
        // Remove redundant covers rather than deliberately adding surplus duties.
        if (sorted.some((_, i) => {
          let end = anchor
          for (const d of sorted.filter((_, j) => j !== i)) { if (d.start > end) return false; end = Math.max(end, d.end) }
          return end >= anchor + DAY
        })) return
        found.set(sorted.map(d => d.shift.code).join('|'), sorted)
        return
      }
      if (selected.length >= 8) return
      for (const d of list) if (d.start <= point && d.end > point && !selected.includes(d)) search(d.end, [...selected, d])
    }
    search(anchor, [])
    const result = [...found.values()].sort((a, b) => a.reduce((n, d) => n + d.hours, 0) - b.reduce((n, d) => n + d.hours, 0) || a.length - b.length).slice(0, MAX_PATTERNS)
    if (!result.length) throw new Error(`Kode aktif ${unit === 'igd' ? 'IGD' : 'ruangan'} belum menutup 24 jam. Periksa jam mulai, selesai, dan durasinya pada master.`)
    return result
  }
  const result: Duty[][] = []
  for (const a of covers('igd')) for (const b of covers('ruangan')) {
    const slots = [...a, ...b].flatMap(d => Array.from({ length: w.settings.minimumCoverage }, () => ({ ...d, start: minutes(d.shift.start!), end: minutes(d.shift.start!) + d.hours * 60 })))
    result.push(slots)
  }
  return result.sort((a, b) => a.reduce((n, d) => n + d.hours, 0) - b.reduce((n, d) => n + d.hours, 0)).slice(0, MAX_PATTERNS)
}

function advance(state: State, shift: ShiftCode | undefined, day: number, w: Workspace): State {
  const h = shiftHours(shift) ?? 0
  if (!h) return { ...state, work: 0, long: 0, rest: Math.max(0, state.rest - 1) }
  const long = h >= 12 ? state.long + 1 : 0
  return { hours: state.hours + h, nights: state.nights + Number(isNight(shift)), work: state.work + 1, long,
    rest: long >= 2 ? w.settings.offAfterLong : Math.max(0, state.rest - 1), end: day * DAY + minutes(shift!.start!) + h * 60 }
}

function allowed(c: Context, state: State, d: Doctor, shift: ShiftCode, day: number): boolean {
  const date = day < c.dates.length ? c.dates[day]! : addDays(c.dates.at(-1)!, day - c.dates.length + 1)
  const h = shiftHours(shift) ?? 0
  if (h <= 0) return true
  if (!isAvailable(d, date) || (d.unit === 'anak' && shift.unit !== 'anak') || state.rest > 0 || state.work >= c.w.settings.maxConsecutiveWork) return false
  const start = day * DAY + minutes(shift.start!)
  if ((start - state.end) / 60 < c.w.settings.minGapHours) return false
  if (h >= 12 && state.long >= c.w.settings.maxConsecutiveLong) return false
  if (minutes(shift.start!) + h * 60 > DAY && !isAvailable(d, addDays(date, 1))) return false
  // A pair at month end is only allowed when its entire rest window is known.
  if (h >= 12 && state.long >= 1 && day < c.dates.length) {
    const index = c.doctors.findIndex(x => x.id === d.id)
    for (let offset = 1; offset <= c.w.settings.offAfterLong; offset++) {
      const futureDay = day + offset - c.dates.length
      if (futureDay >= 0 && (!c.future || (shiftHours(c.future[index]![futureDay]?.shift) ?? Infinity) > 0)) return false
    }
  }
  return true
}

function nonDuty(c: Context, d: Doctor, date: string): string {
  if (d.joinedOn && date < d.joinedOn) return c.bm
  return isOnLeave(d, date) ? c.leave : c.off
}

function score(c: Context, node: Node, day: number): number {
  const indices = c.doctors.flatMap((d, i) => d.unit === 'rotasi' && c.available[i]![day]! > 0 ? [i] : [])
  const available = indices.reduce((n, i) => n + c.available[i]![day]!, 0)
  const hours = indices.reduce((n, i) => n + node.states[i]!.hours, 0)
  const nights = indices.reduce((n, i) => n + node.states[i]!.nights, 0)
  let imbalance = 0
  for (const i of indices) {
    const weight = c.available[i]![day]! / available
    imbalance += (node.states[i]!.hours - hours * weight) ** 2 + 12 * (node.states[i]!.nights - nights * weight) ** 2
  }
  return imbalance + node.extraHours * 100 + node.longDays * (c.options.preferRegular ? 10 : 0)
}

function match(c: Context, node: Node, slots: Duty[], day: number, variant: number): Node | null {
  const eligible = slots.map(slot => c.doctors.flatMap((d, i) => d.unit === 'rotasi' && allowed(c, node.states[i]!, d, slot.shift, day) ? [i] : []))
  const order = slots.map((_, i) => i).sort((a, b) => eligible[a]!.length - eligible[b]!.length || slots[b]!.hours - slots[a]!.hours)
  const used = new Set<number>(), assigned = new Map<number, ShiftCode>()
  let visits = 0
  function search(depth: number): boolean {
    if (++visits > MAX_MATCH_NODES) return false
    if (depth === order.length) return true
    const slotIndex = order[depth]!, slot = slots[slotIndex]!
    const candidates = eligible[slotIndex]!.filter(i => !used.has(i)).sort((a, b) => {
      const cost = (i: number) => {
        const s = node.states[i]!, av = c.available[i]![day]!
        const burden = (s.hours + slot.hours) / Math.max(1, av)
        const tie = ((i * 17 + day * 13 + variant * 19 + slotIndex * 7) % 31) / 31
        return burden * 10 + (isNight(slot.shift) ? s.nights * 0.8 : 0) + tie * (variant + 1)
      }
      return cost(a) - cost(b) || a - b
    })
    for (const i of candidates) {
      used.add(i); assigned.set(i, slot.shift)
      if (search(depth + 1)) return true
      used.delete(i); assigned.delete(i)
    }
    return false
  }
  if (!search(0)) return null
  const child = c.w.shifts.map(duty).filter((s): s is Duty => !!s && s.shift.unit === 'anak').sort((a, b) => a.hours - b.hours)
  const codes = c.doctors.map((d, i) => {
    if (d.unit === 'anak' && !isSunday(c.dates[day]!)) {
      const s = child.find(s => allowed(c, node.states[i]!, d, s.shift, day))
      if (s) assigned.set(i, s.shift)
    }
    return assigned.get(i)?.code ?? nonDuty(c, d, c.dates[day]!)
  })
  const states = node.states.map((s, i) => advance(s, assigned.get(i), day, c.w))
  const result: Node = { states, days: [...node.days, codes], longDays: node.longDays + slots.filter(s => s.hours >= 12).length,
    extraHours: node.extraHours + slots.reduce((n, s) => n + s.hours, 0) - 48 * c.w.settings.minimumCoverage, score: 0 }
  result.score = score(c, result, day)
  // Check the actual following-month snapshot as soon as the month is complete.
  if (day === c.dates.length - 1 && c.future) for (let i = 0; i < c.doctors.length; i++) {
    let s = states[i]!
    for (let j = 0; j < c.future[i]!.length; j++) {
      const shift = c.future[i]![j]!.shift
      if (!allowed(c, s, c.doctors[i]!, shift, c.dates.length + j)) return null
      s = advance(s, shift, c.dates.length + j, c.w)
    }
  }
  return result
}

function buildPlan(c: Context, node: Node, month: string): MonthPlan {
  const p: MonthPlan = { month, assignments: {}, boundaries: {}, locked: false, frozenThrough: 0, validationFrom: 1, shiftSnapshot: JSON.parse(JSON.stringify(c.w.shifts)) }
  for (let i = 0; i < c.doctors.length; i++) {
    const id = c.doctors[i]!.id, previous = c.history[i]!.slice(-2), next = c.future?.[i]
    p.assignments[id] = Object.fromEntries(c.dates.map((date, day) => [date, node.days[day]![i]!]))
    p.boundaries[id] = { prev2: previous[0]!.code, prev1: previous[1]!.code, next1: next?.[0]?.code ?? '', next2: next?.[1]?.code ?? '' }
  }
  return p
}

function initialStates(c: Context): State[] {
  return c.doctors.map((_, i) => {
    let state = emptyState()
    for (let j = 0; j < c.history[i]!.length; j++) state = advance(state, c.history[i]![j]!.shift, j - c.history[i]!.length, c.w)
    return { ...state, hours: 0, nights: 0 }
  })
}

function verify(w: Workspace, p: MonthPlan, options: GeneratorOptions): Workspace {
  if (JSON.stringify(p.shiftSnapshot) !== JSON.stringify(w.shifts)) throw new Error('Master dinas berubah. Susun ulang jadwal.')
  const c = context(w, p.month, options), states = initialStates(c)
  // Replay independently, including gaps across off days and overnight leave.
  for (let i = 0; i < c.doctors.length; i++) {
    const d = c.doctors[i]!
    const previous = c.history[i]!.slice(-2), future = c.future?.[i]
    const boundary = { prev2: previous[0]!.code, prev1: previous[1]!.code, next1: future?.[0]?.code ?? '', next2: future?.[1]?.code ?? '' }
    if (JSON.stringify(p.boundaries[d.id]) !== JSON.stringify(boundary)) throw new Error('Sambungan bulan berubah. Susun ulang jadwal.')
    let state = states[i]!
    for (let day = 0; day < c.dates.length; day++) {
      const code = p.assignments[d.id]?.[c.dates[day]!], shift = w.shifts.find(s => s.code === code)
      if (!shift) throw new Error(`Jadwal ${d.name} belum lengkap.`)
      const h = shiftHours(shift)!
      if ((h > 0 && (!duty(shift) || (d.unit === 'rotasi' && !['igd', 'ruangan'].includes(shift.unit)))) || !allowed(c, state, d, shift, day)) throw new Error(`Jadwal ${d.name} belum memenuhi ketersediaan atau istirahat pada ${c.dates[day]}.`)
      state = advance(state, shift, day, w)
    }
    for (let day = 0; day < (c.future?.[i]?.length ?? 0); day++) {
      const shift = c.future![i]![day]!.shift
      if (!allowed(c, state, d, shift, c.dates.length + day)) throw new Error(`Sambungan ${d.name} ke bulan berikutnya berbenturan dengan istirahat. Periksa jadwal sumber.`)
      state = advance(state, shift, c.dates.length + day, w)
    }
  }
  const next = parseWorkspace({ ...cloneWorkspace(w), plans: { ...w.plans, [p.month]: p } })
  const problem = inspectPlan(next, p).find(i => !i.historical && (i.severity === 'error' || ['missing', 'coverage', 'work_streak'].includes(i.rule)))
  if (problem) throw new Error(`Hasil belum memenuhi aturan: ${problem.message} (${problem.date}).`)
  return next
}

/** A bounded search, not a claim of global optimality. Never writes its input. */
export function generateMonth(w: Workspace, month: string, options: GeneratorOptions): GeneratedMonth {
  const c = context(w, month, options), patterns = servicePatterns(w)
  if (c.doctors.some(d => d.unit === 'anak') && !w.shifts.some(s => s.unit === 'anak' && duty(s))) throw new Error('Tambahkan kode dinas ruang anak yang aktif dengan jam lengkap, maksimal 12 jam.')
  const states = initialStates(c)
  let beam: Node[] = [{ states, days: [], longDays: 0, extraHours: 0, score: 0 }]
  for (let day = 0; day < c.dates.length; day++) {
    const available = c.doctors.filter(d => d.unit === 'rotasi' && isAvailable(d, c.dates[day]!)).length
    if (available * 12 < 48 * w.settings.minimumCoverage) throw new Error(`Dokter rotasi yang tersedia pada ${c.dates[day]} hanya ${available}; kebutuhan dua layanan 24 jam tidak dapat ditutup dengan dinas maksimal 12 jam.`)
    const next = new Map<string, Node>()
    for (const node of beam) for (const slots of patterns) for (let variant = 0; variant < 3; variant++) {
      const candidate = match(c, node, slots, day, variant)
      if (!candidate) continue
      const key = JSON.stringify(candidate.states)
      const existing = next.get(key)
      if (!existing || existing.score > candidate.score) next.set(key, candidate)
    }
    beam = [...next.values()].sort((a, b) => a.score - b.score).slice(0, BEAM)
    if (!beam.length) throw new Error(`Belum menemukan jadwal yang memenuhi cakupan dan istirahat pada ${c.dates[day]}. Periksa jumlah dokter, cuti, riwayat, dan aturan jeda. Tidak ada jadwal yang disimpan.`)
  }
  const plan = buildPlan(c, beam[0]!, month), next = verify(w, plan, options)
  const rows = summarize(next, plan), f = fairness(next, plan)
  const notes = ['Pemerataan memperhitungkan hari tersedia. Dokter khusus ruang anak dihitung terpisah.', 'Selisih jam ditampilkan dari hasil pencarian; kesamaan persis tidak selalu dapat dicapai.']
  if (!c.future) notes.push('Bulan berikutnya belum tersedia. Saat menyusunnya, gunakan jadwal ini sebagai riwayat sambungan.')
  if (!w.plans[addDays(c.dates[0]!, -1).slice(0, 7)] && options.restedBeforeFirstMonth) notes.push(`Riwayat LIBUR sebelum bulan pertama memakai konfirmasi istirahat penuh selama ${generatorHistoryDays(w)} hari.`)
  if (!patterns.some(p => p.every(s => s.hours < 12))) notes.push('Master belum menyediakan kombinasi reguler yang menutup kedua layanan. Dinas 12 jam digunakan sesuai aturan.')
  return { source: generatorSource(w, month), options: { ...options }, plan, rows: rows.map(r => ({ id: r.doctor.id, name: r.doctor.name, unit: r.doctor.unit, hours: r.knownHours, availableDays: r.availableDays, longDays: r.longDays, nightDays: r.nightDays })), spread: f.rows.length >= 2 ? f.spread : null, notes }
}

export function applyGeneratedMonth(w: Workspace, proposal: GeneratedMonth, role: Role): Workspace {
  assertRole(role)
  if (w.plans[proposal.plan.month]) throw new Error('Jadwal bulan ini sudah tersedia.')
  if (generatorSource(w, proposal.plan.month) !== proposal.source) throw new Error('Data berubah sejak perhitungan. Susun ulang jadwal sebelum menyimpan.')
  const next = verify(w, proposal.plan, proposal.options)
  validateChange(w, next, role, false)
  return next
}
