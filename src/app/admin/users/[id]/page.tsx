import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/utils/auth'
import type { AdminUser } from '../actions'
import type { LinkSummary } from '@/lib/link-model'
import { UserDetailClient, type AuditEntry } from './user-detail-client'

export default async function UserDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ linksPage?: string; auditPage?: string }> }) {
    const { id } = await params
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.needsLogin) redirect('/login')
    if (!auth.user) redirect('/dashboard')
    const query = await searchParams
    const pageNumber = (value?: string) => /^\d{1,5}$/.test(value ?? '') ? Math.max(1, Number(value)) : 1
    const linksPage = pageNumber(query.linksPage)
    const auditPage = pageNumber(query.auditPage)
    const [profileResult, linksResult, auditResult] = await Promise.all([
        supabase.from('profiles').select('id, email, display_name, role, status, created_at, updated_at, last_seen_at').eq('id', id).maybeSingle(),
        supabase.from('links').select('id, slug, original_url, created_at, expires_at, clicks, user_id, user_email, password_type', { count: 'exact' }).eq('user_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).range((linksPage - 1) * 12, linksPage * 12 - 1),
        supabase.from('admin_audit_logs').select('id, actor_email, action, before_value, after_value, reason, created_at', { count: 'exact' }).eq('target_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).range((auditPage - 1) * 20, auditPage * 20 - 1)
    ])
    if (profileResult.error) throw new Error('用户信息读取失败，请确认用户权限迁移已执行')
    if (!profileResult.data) notFound()
    const profile = { ...profileResult.data, link_count: linksResult.count ?? 0 } as AdminUser
    return <UserDetailClient user={profile} viewerId={auth.user.id} links={(linksResult.data ?? []) as LinkSummary[]} linksTotal={linksResult.count ?? 0} linksPage={linksPage} linksError={Boolean(linksResult.error)} audit={(auditResult.data ?? []) as AuditEntry[]} auditTotal={auditResult.count ?? 0} auditPage={auditPage} auditError={Boolean(auditResult.error)} />
}
