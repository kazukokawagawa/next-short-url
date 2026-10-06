'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, UserRound, Ban, CircleCheck } from 'lucide-react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { LoadingButton } from '@/components/ui/loading-button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { updateAdminUser, type AdminUser } from './actions'

export function UserMutationDialog({ user, field, onClose, onSuccess }: { user: AdminUser | null; field: 'role' | 'status'; onClose: () => void; onSuccess: () => void }) {
    const router = useRouter()
    const [role, setRole] = useState<'user' | 'admin'>(user?.role ?? 'user')
    const [reason, setReason] = useState('')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const lock = useRef(false)
    const disabling = user?.status === 'active'
    const title = field === 'role' ? '调整用户角色' : disabling ? '禁用账号' : '启用账号'
    const value = field === 'role' ? role : disabling ? 'disabled' : 'active'
    const save = async () => {
        if (!user || lock.current) return
        lock.current = true
        setPending(true)
        setError('')
        const notification = toast.loading(`正在${title}…`)
        try {
            const result = await updateAdminUser({ id: user.id, field, value, expectedUpdatedAt: user.updated_at, reason })
            if (result.error) {
                setError(result.error)
                toast.error('操作失败', { id: notification, description: result.error })
                if (result.needsLogin) router.push('/login')
            } else {
                toast.success(field === 'role' ? '角色已更新' : disabling ? '账号已禁用' : '账号已启用', { id: notification })
                onClose()
                onSuccess()
            }
        } catch {
            setError('网络异常，请重试。')
            toast.error('操作失败', { id: notification, description: '网络异常，请重试。' })
        } finally { lock.current = false; setPending(false) }
    }
    return <AlertDialog open={Boolean(user)} onOpenChange={open => { if (!open && !pending) onClose() }}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription className="break-all">{user?.email || user?.id}{field === 'status' && disabling ? '。禁用后无法登录或管理链接，已有公开短链保留。' : field === 'role' ? '。角色变更会立即影响后台访问权限。' : '。启用后可恢复登录和链接管理。'}</AlertDialogDescription></AlertDialogHeader>
            {field === 'role' && <div className="space-y-2"><Label htmlFor="user-role">角色</Label><Select value={role} onValueChange={value => setRole(value as 'user' | 'admin')} disabled={pending}><SelectTrigger id="user-role" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user"><UserRound />普通用户</SelectItem><SelectItem value="admin"><ShieldCheck />管理员</SelectItem></SelectContent></Select></div>}
            <div className="space-y-2"><Label htmlFor="user-change-reason">操作原因</Label><Textarea id="user-change-reason" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={pending} rows={3} /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <AlertDialogFooter><AlertDialogCancel disabled={pending}>取消</AlertDialogCancel><LoadingButton loading={pending} disabled={!reason.trim() || (field === 'role' && role === user?.role)} variant={field === 'status' && disabling ? 'destructive' : 'default'} icon={field === 'role' ? <ShieldCheck /> : disabling ? <Ban /> : <CircleCheck />} onClick={save}>确认{field === 'role' ? '调整' : disabling ? '禁用' : '启用'}</LoadingButton></AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
}
