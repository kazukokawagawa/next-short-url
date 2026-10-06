'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { MoreVertical, ExternalLink, Timer, Lock, QrCode, Trash2, MousePointerClick } from 'lucide-react'
import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { ResetPasswordDialog } from './reset-password-dialog'
import { QRCodeDialog } from '@/components/qrcode-dialog'
import { SessionExpiredDialog } from '@/components/session-expired-dialog'
import { deleteLink } from './actions'
import { adminDeleteLink } from '@/app/admin/actions'
import { buildShortUrl, canEditLinkPassword, type LinkSummary } from '@/lib/link-model'
import { toast } from 'sonner'

export function LinkCard({ link, index = 0, viewerId, isAdmin = false, onDeleteSuccess, showClickStats = true, showCreator = false, multiSelectEnabled = false, selected = false, onToggleSelected }: {
    link: LinkSummary; viewerId?: string; isAdmin?: boolean; onDeleteSuccess?: () => void; index?: number
    showClickStats?: boolean; showCreator?: boolean; multiSelectEnabled?: boolean; selected?: boolean; onToggleSelected?: (id: number) => void
}) {
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [passwordOpen, setPasswordOpen] = useState(false)
    const [qrOpen, setQrOpen] = useState(false)
    const [sessionOpen, setSessionOpen] = useState(false)
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined
    const url = buildShortUrl(link.slug, origin)
    const expired = Boolean(link.expires_at && new Date(link.expires_at) <= new Date())
    const protectedLink = Boolean(link.password_type && link.password_type !== 'none')
    const canEdit = canEditLinkPassword(link, viewerId)
    const canDelete = isAdmin || canEdit
    const remove = async () => {
        const result = isAdmin ? await adminDeleteLink(link.id) : await deleteLink(link.id)
        if (result.needsLogin) { setSessionOpen(true); return false }
        if (result.error) { toast.error('删除失败', { description: result.error }); return false }
        toast.success('链接已删除'); onDeleteSuccess?.(); return true
    }
    return <>
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: Math.min(index, 6) * 0.035 }}
            whileHover={{ y: -2 }}
            className={`min-w-0 rounded-[8px] border bg-card p-4 transition-shadow duration-200 hover:shadow-sm ${selected ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex min-w-0 items-center gap-2">
                {multiSelectEnabled && <input type="checkbox" aria-label={`选择 ${link.slug}`} checked={selected} onChange={() => onToggleSelected?.(link.id)} className="size-4 shrink-0 accent-primary" />}
                <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all font-medium text-primary" title={url}>{new URL(url).host}/{link.slug}</a>
                <CopyButton slug={link.slug} />
                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`更多操作：${link.slug}`}><MoreVertical /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><a href={link.original_url} target="_blank" rel="noopener noreferrer"><ExternalLink />打开原始链接</a></DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setQrOpen(true)}><QrCode />二维码</DropdownMenuItem>
                        {canEdit && <DropdownMenuItem onSelect={() => setPasswordOpen(true)}><Lock />访问保护</DropdownMenuItem>}
                        {canDelete && <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}><Trash2 />删除链接</DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <p className="mt-2 line-clamp-2 break-all text-xs text-muted-foreground" title={link.original_url}>{link.original_url}</p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <span className={`inline-flex items-center gap-1 ${expired ? 'text-warning' : ''}`}><Timer className="size-3" />{expired ? '已过期' : link.expires_at ? `${formatDistanceToNow(new Date(link.expires_at), { locale: zhCN })}后过期` : '永久'}</span>
                <span className="inline-flex items-center gap-1"><Lock className="size-3" />{protectedLink ? (link.password_type === 'six_digit' ? '数字密码' : '口令保护') : '无密码'}</span>
                {link.access_policy?.requireCaptcha && <span>人机验证</span>}
                {!!link.access_policy?.waitSeconds && <span>等待 {link.access_policy.waitSeconds} 秒</span>}
                {showClickStats && <span className="inline-flex items-center gap-1"><MousePointerClick className="size-3" />{link.clicks} 次</span>}
            </div>
            {showCreator && <p className="mt-2 break-all text-xs text-muted-foreground">{link.user_email || '匿名创建'}</p>}
        </motion.article>
        <ConfirmDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} count={1} object={link.slug} onConfirm={remove} />
        <SessionExpiredDialog open={sessionOpen} onOpenChange={setSessionOpen} />
        {canEdit && <ResetPasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} linkId={link.id} currentAccessPolicy={link.access_policy} currentPasswordType={link.password_type} onSuccess={onDeleteSuccess} />}
        <QRCodeDialog open={qrOpen} onOpenChange={setQrOpen} url={url} slug={link.slug} />
    </>
}
