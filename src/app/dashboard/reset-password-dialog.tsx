'use client'

import { useEffect, useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { LoadingButton } from '@/components/ui/loading-button'
import { PasswordFields } from '@/components/password-fields'
import { validateLinkPassword, type PasswordType } from '@/lib/link-model'
import { updateLinkPassword } from './actions'
import { toast } from 'sonner'
import { SessionExpiredDialog } from '@/components/session-expired-dialog'

export function ResetPasswordDialog({ open, onOpenChange, linkId, currentPasswordType, onSuccess }: {
    open: boolean; onOpenChange: (value: boolean) => void; linkId: number; currentPasswordType?: string | null; onSuccess?: () => void
}) {
    const [type, setType] = useState<PasswordType>('none')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [pending, setPending] = useState(false)
    const [session, setSession] = useState(false)
    const lock = useRef(false)
    useEffect(() => { if (open) { setType(currentPasswordType === 'custom' || currentPasswordType === 'six_digit' ? currentPasswordType as PasswordType : 'none'); setPassword(''); setError('') } }, [open, currentPasswordType])
    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (lock.current) return
        const invalid = validateLinkPassword(type, password)
        if (invalid) { setError(invalid); return }
        lock.current = true; setPending(true); setError('')
        try {
            const result = await updateLinkPassword(linkId, type, password)
            if (result.needsLogin) setSession(true)
            else if (result.error) setError(result.error)
            else { toast.success('密码设置已更新'); onSuccess?.(); onOpenChange(false) }
        } catch { setError('网络异常，请重试。') }
        finally { lock.current = false; setPending(false) }
    }
    return <><Dialog open={open} onOpenChange={value => { if (!pending) onOpenChange(value) }}><DialogContent>
        <DialogHeader><DialogTitle>修改链接密码</DialogTitle><DialogDescription>密码设置</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4"><PasswordFields type={type} value={password} onTypeChange={setType} onChange={value => { setPassword(value); setError('') }} error={error} disabled={pending} purpose="edit" />
            {type === 'none' && error && <p role="alert" className="text-destructive">{error}</p>}
            <DialogFooter><LoadingButton type="submit" loading={pending} icon={<Save />}>保存密码</LoadingButton></DialogFooter>
        </form>
    </DialogContent></Dialog><SessionExpiredDialog open={session} onOpenChange={setSession} /></>
}
