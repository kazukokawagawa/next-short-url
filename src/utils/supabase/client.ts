import { createBrowserClient } from '@supabase/ssr'
import { hasSupabaseConfig, SUPABASE_CONFIG_ERROR } from '@/lib/supabase-config'

export function createClient() {
    if (!hasSupabaseConfig()) throw new Error(SUPABASE_CONFIG_ERROR)
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
