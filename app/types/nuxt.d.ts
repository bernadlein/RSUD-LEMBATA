import type { SupabaseClient } from '@supabase/supabase-js'
declare module '#app' { interface NuxtApp { $db: SupabaseClient | null } }
declare module 'vue' { interface ComponentCustomProperties { $db: SupabaseClient | null } }
export {}
