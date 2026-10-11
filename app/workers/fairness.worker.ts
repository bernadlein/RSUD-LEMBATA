import { suggestFairSwap } from '../domain/commands'
import type { Workspace } from '../domain/types'
self.onmessage = (e: MessageEvent<{ data: Workspace; month: string }>) => {
  try { self.postMessage({ suggestion: suggestFairSwap(e.data.data, e.data.month) }) }
  catch (error) { self.postMessage({ error: (error as Error).message }) }
}
