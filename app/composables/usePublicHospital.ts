import { publicHospitalSchema } from '../domain/hospital-portal'

export function usePublicHospital() {
  const result = useAsyncData('hospital-publication', async () => {
    const response = await $fetch<{ hospital: unknown }>('/api/public/hospital')
    return { hospital: response.hospital ? publicHospitalSchema.parse(response.hospital) : null }
  })
  const hospital = computed(() => result.data.value?.hospital ?? null)
  return { hospital, pending: result.pending, error: result.error, refresh: result.refresh }
}
