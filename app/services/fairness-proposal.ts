import type { Workspace } from '../domain/types'
import type { SwapSuggestion } from '../domain/commands'
export function getFairnessProposal(data: Workspace, month: string): Promise<SwapSuggestion | null> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/fairness.worker.ts', import.meta.url), { type: 'module' })
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Perhitungan melebihi 30 detik. Periksa pemerataan secara manual atau coba setelah mempersempit jadwal.')) }, 30000)
    worker.onmessage = event => {
      clearTimeout(timer); worker.terminate()
      if (event.data.error) reject(new Error(event.data.error))
      else resolve(event.data.suggestion)
    }
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error('Saran belum dapat dihitung. Jadwal tetap tersimpan.')) }
    worker.postMessage({ data: JSON.parse(JSON.stringify(data)), month })
  })
}
