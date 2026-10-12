import { computed, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { isPublicDoctorPhotoUrl } from '../domain/public-doctor-photo'

/** Keep image failure state separate from the portrait component. */
export function usePublicDoctorPortrait(source: MaybeRefOrGetter<string | null | undefined>) {
  const failed = ref(false)
  watch(() => toValue(source), () => { failed.value = false }, { flush: 'sync' })
  const src = computed(() => {
    const value = toValue(source)
    return value && !failed.value && isPublicDoctorPhotoUrl(value) ? value : null
  })
  function onError() { failed.value = true }
  return { src, onError }
}
