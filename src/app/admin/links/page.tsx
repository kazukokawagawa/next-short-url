import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import type { Link } from "@/app/dashboard/links-table"
import { AdminLinksClient } from "./admin-links-client"

export default async function AdminLinksPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect("/login")
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        redirect("/dashboard")
    }

    const { data: allLinks } = await supabase
        .from('links')
        .select('*')
        .order('created_at', { ascending: false })

    const normalized: Link[] = (allLinks || []).flatMap(row => {
        const r = row as Record<string, unknown>
        const idRaw = r.id
        const id = typeof idRaw === 'number' ? idRaw : Number(idRaw)
        if (!Number.isFinite(id)) return []

        const slug = typeof r.slug === 'string' ? r.slug : ''
        const original_url = typeof r.original_url === 'string' ? r.original_url : ''
        const created_at = typeof r.created_at === 'string' ? r.created_at : ''
        if (!slug || !original_url || !created_at) return []

        const clicksRaw = r.clicks
        const clicks = typeof clicksRaw === 'number' ? clicksRaw : Number(clicksRaw ?? 0)

        return [
            {
                id,
                slug,
                original_url,
                created_at,
                expires_at: typeof r.expires_at === 'string' ? r.expires_at : r.expires_at == null ? null : String(r.expires_at),
                clicks: Number.isFinite(clicks) ? clicks : 0,
                user_email: typeof r.user_email === 'string' ? r.user_email : undefined,
            }
        ]
    })

    return <AdminLinksClient links={normalized} />
}
