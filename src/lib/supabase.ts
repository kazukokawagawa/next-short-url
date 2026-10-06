import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Create the public Supabase client only when a request actually uses it. */
export function createPublicSupabaseClient(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return url && key ? createClient(url, key) : null
}
