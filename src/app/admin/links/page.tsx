import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import type { LinkSummary as Link } from '@/lib/link-model'
import { getLinksConfig } from '@/lib/site-config'
import { AdminLinksClient } from "./admin-links-client"
import { requireAdmin } from '@/utils/auth'
import { hasSupabaseConfig, SUPABASE_CONFIG_ERROR } from '@/lib/supabase-config'

export default async function AdminLinksPage() {
    if (!hasSupabaseConfig()) {
        return <section className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center gap-3 px-4 text-center"><h1 className="text-xl font-semibold">管理员功能不可用</h1><p className="text-sm text-muted-foreground">{SUPABASE_CONFIG_ERROR}</p></section>
    }
    const supabase = await createClient()

    const auth = await requireAdmin(supabase)
    if (auth.needsLogin) redirect('/login')
    if (!auth.user) redirect('/dashboard')
    const user = auth.user

    const { data: allLinks, error: queryError } = await supabase
        .from('links')
        .select('*')
        .order('created_at', { ascending: false })

    if (queryError) throw new Error('链接列表加载失败')
    const settings = await getLinksConfig()
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
                password_type: typeof r.password_type === 'string' ? r.password_type : 'none',
                user_id: typeof r.user_id === 'string' ? r.user_id : null,
                user_email: typeof r.user_email === 'string' ? r.user_email : undefined,
            }
        ]
    })

    return <AdminLinksClient links={normalized} viewerId={user.id} showClickStats={settings.enableClickStats} />
}
