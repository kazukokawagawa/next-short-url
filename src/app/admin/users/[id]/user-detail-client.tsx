'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ShieldCheck, Ban, CircleCheck, RefreshCw, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Container, PageHeader } from '@/components/page-header'
import { IconButton } from '@/components/ui/icon-button'
import { Button } from '@/components/ui/button'
import { LinkList } from '@/app/dashboard/link-list'
import { AsyncState } from '@/components/async-state'
import type { LinkSummary } from '@/lib/link-model'
import type { AdminUser } from '../actions'
import { UserMutationDialog } from '../user-mutation-dialog'
import { UserBadges, userDate } from '../users-client'

export type AuditEntry = { id: number; actor_email: string | null; action: string; before_value: { role?: string; status?: string; slug?: string }; after_value: { role?: string; status?: string }; reason: string; created_at: string }
const auditValue = (value?: string) => value === 'admin' ? '管理员' : value === 'user' ? '普通用户' : value === 'disabled' ? '已禁用' : value === 'active' ? '正常' : value ?? '—'

export function UserDetailClient({ user, viewerId, links, linksTotal, linksPage, linksError, audit, auditTotal, auditPage, auditError }: { user: AdminUser; viewerId: string; links: LinkSummary[]; linksTotal: number; linksPage: number; linksError: boolean; audit: AuditEntry[]; auditTotal: number; auditPage: number; auditError: boolean }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const reducedMotion = useReducedMotion()
    const [field, setField] = useState<'role' | 'status' | null>(null)
    const [tab, setTab] = useState<'links' | 'audit'>('links')
    const navigate = (name: 'linksPage' | 'auditPage', page: number) => {
        const query = new URLSearchParams(searchParams.toString())
        query.set(name, String(page))
        router.push(`?${query}`, { scroll: false })
    }
    const copyId = async () => {
        try { await navigator.clipboard.writeText(user.id); toast.success('用户 ID 已复制') }
        catch { toast.error('复制失败，请重试。') }
    }
    const pages = Math.max(1, Math.ceil((tab === 'links' ? linksTotal : auditTotal) / (tab === 'links' ? 12 : 20)))
    const page = tab === 'links' ? linksPage : auditPage
    return <Container>
        <PageHeader title={user.display_name || '用户详情'} description={user.email || user.id} back={<IconButton label="返回用户列表" onClick={() => router.push('/admin/users')}><ArrowLeft /></IconButton>} actions={<><IconButton label="刷新用户信息" onClick={() => router.refresh()}><RefreshCw /></IconButton><Button variant="outline" onClick={() => setField('role')}><ShieldCheck />调整角色</Button><Button variant={user.status === 'active' ? 'destructive' : 'outline'} disabled={user.id === viewerId && user.status === 'active'} onClick={() => setField('status')}>{user.status === 'active' ? <Ban /> : <CircleCheck />}{user.status === 'active' ? '禁用账号' : '启用账号'}</Button></>} />
        <section className="mb-6 border-b pb-6"><UserBadges user={user} /><dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="min-w-0"><dt className="text-xs text-muted-foreground">用户 ID</dt><dd className="mt-1 flex items-center gap-1"><span className="min-w-0 break-all font-mono text-xs">{user.id}</span><IconButton label="复制用户 ID" className="size-7 shrink-0" onClick={() => void copyId()}><Copy className="size-3" /></IconButton></dd></div><div><dt className="text-xs text-muted-foreground">注册时间</dt><dd className="mt-1">{userDate(user.created_at)}</dd></div><div><dt className="text-xs text-muted-foreground">最近活跃</dt><dd className="mt-1">{userDate(user.last_seen_at)}</dd></div><div><dt className="text-xs text-muted-foreground">短链接</dt><dd className="mt-1 tabular-nums">{linksTotal}</dd></div></dl></section>
        <div role="tablist" aria-label="用户资源" className="mb-5 flex gap-5 border-b"><button type="button" id="user-links-tab" role="tab" aria-selected={tab === 'links'} aria-controls="user-links-panel" onClick={() => setTab('links')} className={`border-b-2 py-3 transition-colors ${tab === 'links' ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}>短链接 ({linksTotal})</button><button type="button" id="user-audit-tab" role="tab" aria-selected={tab === 'audit'} aria-controls="user-audit-panel" onClick={() => setTab('audit')} className={`border-b-2 py-3 transition-colors ${tab === 'audit' ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}>操作记录 ({auditTotal})</button></div>
        <motion.section key={tab} role="tabpanel" id={tab === 'links' ? 'user-links-panel' : 'user-audit-panel'} aria-labelledby={tab === 'links' ? 'user-links-tab' : 'user-audit-tab'} initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }} className="min-h-48">
            {tab === 'links' ? linksError ? <AsyncState error="用户链接加载失败" onRetry={() => router.refresh()} /> : links.length ? <LinkList links={links} viewerId={viewerId} isAdmin onDeleteSuccess={() => router.refresh()} /> : <p className="py-16 text-center text-muted-foreground">暂无短链接</p> : auditError ? <AsyncState error="操作记录加载失败" onRetry={() => router.refresh()} /> : audit.length ? <ol className="divide-y">{audit.map(entry => <li key={entry.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{entry.action === 'user.role' ? '调整角色' : entry.action === 'user.status' ? '调整账号状态' : '删除链接'}</span><time className="text-xs text-muted-foreground">{userDate(entry.created_at)}</time></div><p className="mt-1 break-all text-xs text-muted-foreground">{entry.actor_email || '管理员'}{entry.action.startsWith('user.') ? ` · ${auditValue(entry.before_value[entry.action === 'user.role' ? 'role' : 'status'])} → ${auditValue(entry.after_value[entry.action === 'user.role' ? 'role' : 'status'])}` : ` · ${entry.before_value.slug || ''}`}</p>{entry.reason && <p className="mt-2 whitespace-pre-wrap break-words">{entry.reason}</p>}</li>)}</ol> : <p className="py-16 text-center text-muted-foreground">暂无操作记录</p>}
        </motion.section>
        <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground"><span>第 {page} / {pages} 页</span><div className="flex gap-1"><IconButton label="上一页" disabled={page <= 1} onClick={() => navigate(tab === 'links' ? 'linksPage' : 'auditPage', page - 1)}><ChevronLeft /></IconButton><IconButton label="下一页" disabled={page >= pages} onClick={() => navigate(tab === 'links' ? 'linksPage' : 'auditPage', page + 1)}><ChevronRight /></IconButton></div></div>
        {field && <UserMutationDialog key={`${field}-${user.updated_at}`} user={user} field={field} onClose={() => setField(null)} onSuccess={() => router.refresh()} />}
    </Container>
}
