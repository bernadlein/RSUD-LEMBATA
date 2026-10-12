import {
  publicArticle, publicContacts, publicDayWindow, publicDefaultDay, publicDoctorItems, publicIdentity,
  publicNavigation, publicNewsItems, publicScheduleDays, publicScheduleMonth, publicScheduleResults,
  publicTimezone, publicUnitOptions, publicUpdatedAt,
} from '../domain/public-portal'
import type { PublicUnitFilter } from '../domain/public-portal'
import type { Session } from '@supabase/supabase-js'

/** Loading and read models live here; components only receive display data. */
export function usePublicPortal() {
  const site = usePublicHospital(), route = useRoute()
  const session = useState<Session | null>('auth-session', () => null)
  const account = computed(() => session.value ? { url: '/dashboard', label: 'Ruang kerja' } : { url: '/masuk', label: 'Masuk' })
  const currentPath = computed(() => route.fullPath)
  const clock = useState('public-portal-clock', () => new Date().toISOString())
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    clock.value = new Date().toISOString()
    timer = setInterval(() => { clock.value = new Date().toISOString() }, 60_000)
  })
  onUnmounted(() => { if (timer) clearInterval(timer) })
  const now = computed(() => new Date(clock.value))
  const identity = computed(() => publicIdentity(site.hospital.value))
  const contacts = computed(() => publicContacts(site.hospital.value))
  const phone = computed(() => contacts.value.find(contact => contact.id === 'phone'))
  const navigation = computed(() => publicNavigation(site.hospital.value, route.path, route.hash))
  const doctors = computed(() => publicDoctorItems(site.hospital.value, now.value))
  const news = computed(() => publicNewsItems(site.hospital.value))
  const days = computed(() => publicScheduleDays(site.hospital.value, now.value))
  const highlightDay = computed(() => publicDefaultDay(site.hospital.value, '', now.value))
  const highlight = computed(() => days.value.find(day => day.value === highlightDay.value))
  const highlightRows = computed(() => publicScheduleResults(site.hospital.value, highlightDay.value))
  const highlightPreview = computed(() => highlightRows.value.slice(0, 3))
  const latestNews = computed(() => news.value.slice(0, 3))
  const highlightUrl = computed(() => highlightDay.value ? '/jadwal-dokter?' + new URLSearchParams({ tanggal: highlightDay.value }) : '/jadwal-dokter')
  const month = computed(() => publicScheduleMonth(site.hospital.value))
  const timezone = computed(() => publicTimezone(site.hospital.value?.timezone ?? 'Asia/Makassar'))
  const updatedAt = computed(() => publicUpdatedAt(site.hospital.value))
  const year = computed(() => now.value.getFullYear())
  return { ...site, now, identity, contacts, phone, navigation, account, currentPath, doctors, news, latestNews, days, highlight, highlightRows, highlightPreview, highlightUrl, month, timezone, updatedAt, year }
}

export function usePublicSchedule() {
  const portal = usePublicPortal(), route = useRoute()
  const selected = ref(''), query = ref(''), unit = ref<PublicUnitFilter>('all')
  const availableUnits = computed(() => publicUnitOptions.filter(option => option.value === 'all' || portal.hospital.value?.schedule.rows.some(row => row.unit === option.value)))
  const requestedDate = computed(() => typeof route.query.tanggal === 'string' ? route.query.tanggal : '')
  watch([() => portal.hospital.value?.schedule.month, requestedDate], () => {
    selected.value = publicDefaultDay(portal.hospital.value, requestedDate.value, portal.now.value)
  }, { immediate: true })
  watch(() => route.query.dokter, value => { query.value = typeof value === 'string' ? value : '' }, { immediate: true })
  watch([() => route.query.unit, availableUnits], ([value, options]) => {
    unit.value = options.some(option => option.value === value) ? value as PublicUnitFilter : 'all'
  }, { immediate: true })
  const results = computed(() => publicScheduleResults(portal.hospital.value, selected.value, query.value, unit.value))
  const date = computed(() => portal.days.value.find(day => day.value === selected.value))
  const windowDays = computed(() => publicDayWindow(portal.days.value, selected.value))
  const doctorCount = computed(() => new Set(results.value.map(row => row.doctorId)).size)
  function clearFilters() { query.value = ''; unit.value = 'all' }
  return { ...portal, selected, query, unit, results, date, windowDays, doctorCount, availableUnits, clearFilters }
}

export function usePublicNews() {
  const portal = usePublicPortal(), query = ref('')
  const results = computed(() => publicNewsItems(portal.hospital.value, query.value))
  const featured = computed(() => query.value.trim() ? null : results.value[0] ?? null)
  const remaining = computed(() => results.value.filter(item => item.id !== featured.value?.id))
  return { ...portal, query, results, featured, remaining }
}

export function usePublicArticle() {
  const portal = usePublicPortal(), route = useRoute()
  const article = computed(() => publicArticle(portal.hospital.value, route.params.id))
  const related = computed(() => portal.news.value.filter(item => item.id !== article.value?.id).slice(0, 2))
  return { ...portal, article, related }
}
