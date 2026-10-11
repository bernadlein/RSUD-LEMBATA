import type { GeneratedMonth, GeneratorOptions } from '../domain/scheduler'
import type { Workspace } from '../domain/types'

export function getGeneratedMonth(data: Workspace, month: string, options: GeneratorOptions, signal: AbortSignal): Promise<GeneratedMonth> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Perhitungan dibatalkan.', 'AbortError')); return }
    const worker = new Worker(new URL('../workers/scheduler.worker.ts', import.meta.url), { type: 'module' })
    const timer = setTimeout(() => finish(new Error('Perhitungan melebihi 30 detik. Periksa cakupan, jumlah dokter, dan aturan istirahat, lalu coba kembali.')), 30000)
    let settled = false
    function finish(error?: Error, proposal?: GeneratedMonth) {
      if (settled) return
      settled = true
      clearTimeout(timer); signal.removeEventListener('abort', abort); worker.terminate()
      if (error) reject(error)
      else if (proposal) resolve(proposal)
      else reject(new Error('Hasil generator belum tersedia.'))
    }
    function abort() { finish(new DOMException('Perhitungan dibatalkan.', 'AbortError')) }
    signal.addEventListener('abort', abort, { once: true })
    worker.onmessage = (event: MessageEvent<{ proposal?: GeneratedMonth; error?: string }>) => finish(event.data.error ? new Error(event.data.error) : undefined, event.data.proposal)
    worker.onerror = () => finish(new Error('Generator belum dapat dijalankan. Coba kembali setelah memuat ulang halaman.'))
    worker.onmessageerror = () => finish(new Error('Hasil generator tidak dapat dibaca. Hitung ulang jadwal.'))
    try { worker.postMessage({ data: JSON.parse(JSON.stringify(data)), month, options: { ...options } }) }
    catch (error) { finish(error instanceof Error ? error : new Error('Data jadwal tidak dapat dikirim ke generator.')) }
  })
}
