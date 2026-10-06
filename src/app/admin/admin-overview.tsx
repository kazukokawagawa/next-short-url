'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, Link2, Settings2, UserRoundCog, ShieldCheck, RefreshCw } from 'lucide-react'
import { Container, PageHeader } from '@/components/page-header'
import { IconButton } from '@/components/ui/icon-button'

const modules = [
    { href: '/admin/links', title: '全局链接管理', icon: Link2, color: 'text-info', background: 'bg-info/10', fields: ['全部短链接', '创建者与访问数据', '批量清理'] },
    { href: '/admin/users', title: '用户与权限', icon: UserRoundCog, color: 'text-success', background: 'bg-success/10', fields: ['用户账号', '角色与账号状态', '操作记录'] },
    { href: '/admin/settings', title: '系统设置', icon: Settings2, color: 'text-warning', background: 'bg-warning/10', fields: ['站点与外观', '安全与注册', '维护与公告'] }
]

export function AdminOverview({ email, stats }: { email?: string; stats: { links: number | null; users: number | null; admins: number | null } }) {
    const router = useRouter()
    const reducedMotion = useReducedMotion()
    return <Container>
        <PageHeader title="管理控制台" description={email} back={<IconButton label="返回用户控制台" onClick={() => router.push('/dashboard')}><ArrowLeft /></IconButton>} actions={<><span className="mr-2 inline-flex items-center gap-1.5 text-xs text-success"><ShieldCheck className="size-4" />管理员</span><IconButton label="刷新管理统计" onClick={() => router.refresh()}><RefreshCw /></IconButton></>} />
        <section aria-label="站点统计" className="mb-8 grid grid-cols-3 divide-x border-b pb-6">
            {[{ label: '短链接', value: stats.links, icon: Link2 }, { label: '用户', value: stats.users, icon: UserRoundCog }, { label: '管理员', value: stats.admins, icon: ShieldCheck }].map(({ label, value, icon: Icon }, index) => <div key={label} className={index === 0 ? 'pr-3' : 'px-3 sm:px-6'}><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4 shrink-0" />{label}</div><p className={value === null ? 'text-xs text-muted-foreground' : 'text-2xl font-semibold tabular-nums'}>{value === null ? '暂不可用' : value.toLocaleString('zh-CN')}</p></div>)}
        </section>
        <section aria-label="管理模块"><h2 className="mb-4 text-sm font-semibold">管理入口</h2><div className="grid gap-4 md:grid-cols-3">{modules.map(({ href, title, icon: Icon, color, background, fields }, index) => <motion.div key={href} initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : index * 0.04 }} className="min-w-0"><Link href={href} className="group flex h-full min-h-48 flex-col rounded-[8px] border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><div className="mb-5 flex items-center justify-between"><span className={`flex size-10 items-center justify-center rounded-[6px] ${background} ${color}`}><Icon className="size-5" /></span><ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" /></div><h3 className="mb-3 text-base font-semibold">{title}</h3><ul className="space-y-1 text-xs text-muted-foreground">{fields.map(field => <li key={field}>{field}</li>)}</ul></Link></motion.div>)}</div></section>
    </Container>
}
