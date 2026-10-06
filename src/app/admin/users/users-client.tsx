'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, RefreshCw, Search, Users, ChevronLeft, ChevronRight, MoreVertical, Eye, ShieldCheck, Ban, CircleCheck, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Container, PageHeader } from '@/components/page-header'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AsyncState } from '@/components/async-state'
import { listAdminUsers, type AdminUser, type UserFilters } from './actions'
import { UserMutationDialog } from './user-mutation-dialog'

export function userDate(value: string | null) {
    if (!value) return '暂无记录'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '暂无记录' : date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function UserBadges({ user }: { user: Pick<AdminUser, 'role' | 'status'> }) {
    return <div className="flex flex-wrap gap-2 text-xs"><span className={`inline-flex items-center gap-1 ${user.role === 'admin' ? 'text-info' : 'text-muted-foreground'}`}>{user.role === 'admin' && <ShieldCheck className="size-3" />}{user.role === 'admin' ? '管理员' : '普通用户'}</span><span className={`inline-flex items-center gap-1 ${user.status === 'active' ? 'text-success' : 'text-destructive'}`}>{user.status === 'active' ? <CircleCheck className="size-3" /> : <Ban className="size-3" />}{user.status === 'active' ? '正常' : '已禁用'}</span></div>
}

export function UsersClient({ initial, viewerId }: { initial: Awaited<ReturnType<typeof listAdminUsers>>; viewerId: string }) {
    const router = useRouter()
    const reducedMotion = useReducedMotion()
    const [result, setResult] = useState(initial)
    const [search, setSearch] = useState('')
    const [filters, setFilters] = useState<UserFilters>({ role: 'all', status: 'all', page: 1 })
    const [loading, setLoading] = useState(false)
    const [mutation, setMutation] = useState<{ user: AdminUser; field: 'role' | 'status' } | null>(null)
    const requestId = useRef(0)
    const load = async (next: UserFilters = filters) => {
        const id = ++requestId.current
        setFilters(next)
        setLoading(true)
        try {
            const data = await listAdminUsers(next)
            if (id !== requestId.current) return
            setResult(data)
            if (data.error) toast.error('用户列表加载失败', { description: data.error })
            if (data.needsLogin) router.push('/login')
        } catch {
            if (id === requestId.current) {
                setResult(current => ({ ...current, error: '用户列表加载失败，请重试。' }))
                toast.error('用户列表加载失败，请重试。')
            }
        } finally { if (id === requestId.current) setLoading(false) }
    }
    const pages = Math.max(1, Math.ceil(result.total / result.pageSize))
    const copy = async (email: string) => {
        try { await navigator.clipboard.writeText(email); toast.success('邮箱已复制') }
        catch { toast.error('复制失败，请重试。') }
    }
    return <Container>
        <PageHeader title="用户与权限" description={`共 ${result.total} 位用户`} back={<IconButton label="返回管理控制台" onClick={() => router.push('/admin')}><ArrowLeft /></IconButton>} actions={<IconButton label="刷新用户列表" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? 'animate-spin' : ''} /></IconButton>} />
        <form className="mb-5 flex flex-wrap items-center gap-3" onSubmit={event => { event.preventDefault(); void load({ ...filters, search, page: 1 }) }}>
            <div className="relative min-w-0 flex-1 basis-60"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="搜索邮箱、名称或用户 ID" placeholder="搜索用户" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} className="pl-9" /></div>
            <Select value={filters.role} onValueChange={role => void load({ ...filters, role: role as UserFilters['role'], search, page: 1 })}><SelectTrigger aria-label="按角色筛选" className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部角色</SelectItem><SelectItem value="user">普通用户</SelectItem><SelectItem value="admin">管理员</SelectItem></SelectContent></Select>
            <Select value={filters.status} onValueChange={status => void load({ ...filters, status: status as UserFilters['status'], search, page: 1 })}><SelectTrigger aria-label="按账号状态筛选" className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="active">正常</SelectItem><SelectItem value="disabled">已禁用</SelectItem></SelectContent></Select>
            <IconButton type="submit" label="搜索用户" variant="outline" disabled={loading}><Search /></IconButton>
        </form>
        <div aria-busy={loading} className="min-h-64">
            {result.error ? <AsyncState error={result.error} onRetry={() => void load()} /> : loading ? <AsyncState /> : <AnimatePresence mode="wait" initial={false}><motion.div key={`${result.page}-${filters.role}-${filters.status}-${filters.search}`} initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
                {!result.users.length ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground"><Users className="size-6" /><p>没有符合条件的用户</p></div> : <div className="relative max-w-full overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="border-b text-xs text-muted-foreground"><tr><th className="p-3 font-medium">用户</th><th className="p-3 font-medium">角色与状态</th><th className="p-3 font-medium">注册时间</th><th className="p-3 font-medium">最近活跃</th><th className="p-3 font-medium">链接</th><th className="w-12 p-3"><span className="sr-only">操作</span></th></tr></thead><tbody>{result.users.map(user => <tr key={user.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="max-w-72 p-3"><div className="flex items-center gap-1"><Link href={`/admin/users/${user.id}`} title={user.email || user.id} className="block min-w-0 truncate font-medium hover:underline">{user.email || user.id}</Link>{user.email && <IconButton label={`复制 ${user.email}`} className="size-7 shrink-0" onClick={() => void copy(user.email!)}><Copy className="size-3" /></IconButton>}</div>{user.display_name && <p className="truncate text-xs text-muted-foreground">{user.display_name}</p>}{user.id === viewerId && <span className="text-xs text-muted-foreground">当前账号</span>}</td>
                    <td className="p-3"><UserBadges user={user} /></td><td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{userDate(user.created_at)}</td><td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{userDate(user.last_seen_at)}</td><td className="p-3 tabular-nums">{user.link_count}</td>
                    <td className="p-3"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`用户操作：${user.email || user.id}`}><MoreVertical /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/admin/users/${user.id}`}><Eye />查看详情</Link></DropdownMenuItem><DropdownMenuItem onSelect={() => setMutation({ user, field: 'role' })}><ShieldCheck />调整角色</DropdownMenuItem><DropdownMenuItem disabled={user.id === viewerId && user.status === 'active'} variant={user.status === 'active' ? 'destructive' : 'default'} onSelect={() => setMutation({ user, field: 'status' })}>{user.status === 'active' ? <Ban /> : <CircleCheck />}{user.status === 'active' ? '禁用账号' : '启用账号'}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></td>
                </tr>)}</tbody></table></div>}
            </motion.div></AnimatePresence>}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground"><span>第 {result.page} / {pages} 页 · 每页 {result.pageSize} 位</span><div className="flex gap-1"><IconButton label="上一页" disabled={loading || result.page <= 1} onClick={() => void load({ ...filters, page: result.page - 1 })}><ChevronLeft /></IconButton><IconButton label="下一页" disabled={loading || result.page >= pages} onClick={() => void load({ ...filters, page: result.page + 1 })}><ChevronRight /></IconButton></div></div>
        {mutation && <UserMutationDialog key={`${mutation.user.id}-${mutation.field}`} user={mutation.user} field={mutation.field} onClose={() => setMutation(null)} onSuccess={() => void load()} />}
    </Container>
}
