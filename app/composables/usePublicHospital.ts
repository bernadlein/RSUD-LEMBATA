import { publicHospitalSchema } from '../domain/hospital-portal'
import { HOSPITAL_NAME } from '../domain/branding'

export function usePublicHospital() {
  const result = useAsyncData('hospital-publication', async () => {
    const response = await $fetch<{ hospital: unknown }>('/api/public/hospital')
    return { hospital: response.hospital ? publicHospitalSchema.parse(response.hospital) : null }
  })
  const hospital = computed(() => {
    const published = result.data.value?.hospital
    return published ? { ...published, name: HOSPITAL_NAME } : null
  })
  return { hospital, pending: result.pending, error: result.error, refresh: result.refresh }
}
