'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { LoadingButton } from '@/components/ui/loading-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { deleteAdminUser, type AdminUser } from './actions'

export function DeleteUserDialog({ user, onClose, onSuccess }: { user: AdminUser | null; onClose: () => void; onSuccess: () => void }) {
    const router = useRouter()
    const [confirmation, setConfirmation] = useState('')
    const [reason, setReason] = useState('')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const lock = useRef(false)
    const expected = user?.email || user?.id || ''
    const remove = async () => {
        if (!user || lock.current) return
        lock.current = true
        setPending(true)
        setError('')
        const notification = toast.loading('正在删除账号…')
        try {
            const result = await deleteAdminUser({ id: user.id, expectedUpdatedAt: user.updated_at, confirmation, reason })
            if (result.error) {
                setError(result.error)
                toast.error('删除失败', { id: notification, description: result.error })
                if (result.needsLogin) router.push('/login')
            } else {
                toast.success('账号已删除，关联短链接已清理', { id: notification })
                onClose()
                onSuccess()
            }
        } catch {
            setError('网络异常，请重试。')
            toast.error('删除失败', { id: notification, description: '网络异常，请重试。' })
        } finally { lock.current = false; setPending(false) }
    }
    return <AlertDialog open={Boolean(user)} onOpenChange={open => { if (!open && !pending) onClose() }}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle className="text-destructive">永久删除账号</AlertDialogTitle><AlertDialogDescription className="break-words">此操作会永久删除该账号、其短链接和登录身份，无法撤销。请输入账号邮箱或用户 ID 确认。</AlertDialogDescription></AlertDialogHeader>
            <div className="space-y-2"><Label htmlFor="delete-user-confirmation">确认账号</Label><Input id="delete-user-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder={expected} disabled={pending} autoComplete="off" /></div>
            <div className="space-y-2"><Label htmlFor="delete-user-reason">操作原因</Label><Textarea id="delete-user-reason" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={pending} rows={3} /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <AlertDialogFooter><AlertDialogCancel disabled={pending}>取消</AlertDialogCancel><LoadingButton loading={pending} variant="destructive" disabled={confirmation !== expected || !reason.trim()} icon={<Trash2 />} onClick={remove}>永久删除</LoadingButton></AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
}
