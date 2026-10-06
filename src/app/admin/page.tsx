import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/utils/auth'
import { hasSupabaseConfig, SUPABASE_CONFIG_ERROR } from '@/lib/supabase-config'
import { AdminOverview } from './admin-overview'

export default async function AdminPage() {
    if (!hasSupabaseConfig()) return <section className="p-8 text-center">{SUPABASE_CONFIG_ERROR}</section>
    const client = await createClient()
    const auth = await requireAdmin(client)
    if (auth.needsLogin) redirect('/login')
    if (!auth.user) redirect('/dashboard')
    const [links, users, admins] = await Promise.all([
        client.from('links').select('id', { head: true, count: 'exact' }),
        client.from('profiles').select('id', { head: true, count: 'exact' }),
        client.from('profiles').select('id', { head: true, count: 'exact' }).eq('role', 'admin')
    ])
    return <AdminOverview email={auth.user.email} stats={{ links: links.error ? null : links.count, users: users.error ? null : users.count, admins: admins.error ? null : admins.count }} />
}
