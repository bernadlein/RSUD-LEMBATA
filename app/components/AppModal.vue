<script setup lang="ts">
import { X } from '@lucide/vue'
const props = withDefaults(defineProps<{ title: string; wide?: boolean }>(), { wide: false })
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
let previous: HTMLElement | null = null
function keydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  if (e.key !== 'Tab' || !panel.value) return
  const els = [...panel.value.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')]
  const first = els[0], last = els.at(-1)
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
}
onMounted(() => { previous = document.activeElement as HTMLElement; document.addEventListener('keydown', keydown); document.body.style.overflow = 'hidden'; nextTick(() => panel.value?.querySelector<HTMLElement>('input,button')?.focus()) })
onUnmounted(() => { document.removeEventListener('keydown', keydown); document.body.style.overflow = ''; previous?.focus() })
</script>
<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-80 flex items-center justify-center bg-brand-200/50 p-4 backdrop-blur-sm" @mousedown.self="emit('close')">
      <section ref="panel" role="dialog" aria-modal="true" aria-labelledby="dialog-title" class="max-h-[90dvh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl" :class="props.wide ? 'max-w-2xl' : 'max-w-lg'">
        <div class="flex items-center justify-between border-b border-slate-100 px-6 py-5"><h2 id="dialog-title" class="text-lg font-semibold">{{ title }}</h2><button class="btn btn-quiet p-1.5" aria-label="Tutup dialog" @click="emit('close')"><X :size="20" /></button></div>
        <div class="p-6"><slot /></div>
      </section>
    </div>
  </Teleport>
</template>
