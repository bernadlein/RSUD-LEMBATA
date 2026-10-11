import { rm } from 'node:fs/promises'

// Nitro's Vercel preset can leave route symlinks from an earlier build.
// Remove generated output only; keep project configuration and caches.
for (const path of ['../.vercel/output/', '../.output/']) {
  await rm(new URL(path, import.meta.url), { recursive: true, force: true })
}
