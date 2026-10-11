import { generateMonth } from '../domain/scheduler'
import type { GeneratorOptions } from '../domain/scheduler'
import type { Workspace } from '../domain/types'

self.onmessage = (event: MessageEvent<{ data: Workspace; month: string; options: GeneratorOptions }>) => {
  try { self.postMessage({ proposal: generateMonth(event.data.data, event.data.month, event.data.options) }) }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Jadwal belum dapat dihitung.' }) }
}
