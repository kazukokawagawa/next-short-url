import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/utils/auth'
import { hasSupabaseConfig, SUPABASE_CONFIG_ERROR } from '@/lib/supabase-config'
import { listAdminUsers } from './actions'
import { UsersClient } from './users-client'

export default async function UsersPage() {
    if (!hasSupabaseConfig()) return <section className="p-8 text-center">{SUPABASE_CONFIG_ERROR}</section>
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.needsLogin) redirect('/login')
    if (!auth.user) redirect('/dashboard')
    return <UsersClient initial={await listAdminUsers()} viewerId={auth.user.id} />
}
