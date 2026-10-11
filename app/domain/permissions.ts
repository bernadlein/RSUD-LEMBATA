import type { Role, Workspace } from './types'
import { newBlockingIssues } from './analysis'
import { assertRole } from './commands'

/** The same policy is used by the authenticated API and by tests. Database RPC
 * independently enforces immutable metadata, frozen dates and revision checks. */
export function validateChange(before: Workspace, after: Workspace, role: Role, administration: boolean) {
  assertRole(role, administration)
  if (administration) return
  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings) || JSON.stringify(before.doctors) !== JSON.stringify(after.doctors) || JSON.stringify(before.shifts) !== JSON.stringify(after.shifts)) throw new Error('Perubahan master hanya tersedia untuk admin.')
  for (const [month, previous] of Object.entries(before.plans)) {
    const next = after.plans[month]
    if (!next) throw new Error('Jadwal lama tidak dapat dihapus oleh penyusun.')
    if (JSON.stringify(previous) === JSON.stringify(next)) continue
    if (previous.locked) throw new Error('Bulan ini sudah dikunci.')
    const { assignments: oldCells, ...oldMetadata } = previous
    const { assignments: newCells, ...newMetadata } = next
    if (JSON.stringify(oldMetadata) !== JSON.stringify(newMetadata)) throw new Error('Pengaturan bulan hanya dapat diubah oleh admin.')
    const changedDoctors: string[] = []
    for (const id of new Set([...Object.keys(oldCells), ...Object.keys(newCells)])) {
      if (JSON.stringify(oldCells[id]) === JSON.stringify(newCells[id])) continue
      changedDoctors.push(id)
      for (const date of new Set([...Object.keys(oldCells[id] ?? {}), ...Object.keys(newCells[id] ?? {})])) {
        if (Number(date.slice(-2)) <= previous.frozenThrough && (oldCells[id]?.[date] ?? '') !== (newCells[id]?.[date] ?? '')) throw new Error('Tanggal riwayat sudah dikunci.')
      }
    }
    const issues = newBlockingIssues(before, after, month, changedDoctors)
    if (issues.length) throw new Error(`${issues[0]!.message} (${issues[0]!.date})`)
  }
  for (const [month, p] of Object.entries(after.plans)) if (!before.plans[month]) {
    if (p.locked || p.frozenThrough !== 0 || p.validationFrom !== 1 || JSON.stringify(p.shiftSnapshot) !== JSON.stringify(after.shifts)) throw new Error('Bulan baru harus memakai master yang tersedia dan dimulai sebagai draf.')
    const empty = { ...before, plans: { ...before.plans, [month]: { ...p, assignments: {} } } }
    const issues = newBlockingIssues(empty, after, month, after.doctors.map(d => d.id))
    if (issues.length) throw new Error(`Salinan jadwal menambah benturan: ${issues[0]!.message} Pilih jadwal kosong atau perbaiki sumber salinan.`)
  }
}
