'use client'

import { useEffect, useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { LoadingButton } from '@/components/ui/loading-button'
import { PasswordFields } from '@/components/password-fields'
import { validateLinkPassword, type PasswordType } from '@/lib/link-model'
import { defaultAccessPolicy, type AccessPolicy } from '@/lib/access-policy'
import { updateLinkPassword } from './actions'
import { toast } from 'sonner'
import { SessionExpiredDialog } from '@/components/session-expired-dialog'

export function ResetPasswordDialog({ open, onOpenChange, linkId, currentPasswordType, currentAccessPolicy, onSuccess }: {
    open: boolean; onOpenChange: (value: boolean) => void; linkId: number; currentPasswordType?: string | null; currentAccessPolicy?: AccessPolicy | null; onSuccess?: () => void
}) {
    const [type, setType] = useState<PasswordType>('none')
    const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>({ ...defaultAccessPolicy })
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [pending, setPending] = useState(false)
    const [session, setSession] = useState(false)
    const lock = useRef(false)
    useEffect(() => { if (open) { setType(currentPasswordType === 'custom' || currentPasswordType === 'six_digit' ? currentPasswordType as PasswordType : 'none'); setAccessPolicy(currentAccessPolicy || { ...defaultAccessPolicy }); setPassword(''); setError('') } }, [open, currentPasswordType, currentAccessPolicy])
    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (lock.current) return
        const invalid = validateLinkPassword(type, password)
        if (invalid) { setError(invalid); return }
        lock.current = true; setPending(true); setError('')
        try {
            const result = await updateLinkPassword(linkId, type, password, accessPolicy)
            if (result.needsLogin) setSession(true)
            else if (result.error) setError(result.error)
            else { toast.success('访问保护已更新'); onSuccess?.(); onOpenChange(false) }
        } catch { setError('网络异常，请重试。') }
        finally { lock.current = false; setPending(false) }
    }
    return <><Dialog open={open} onOpenChange={value => { if (!pending) onOpenChange(value) }}><DialogContent>
        <DialogHeader><DialogTitle>修改访问保护</DialogTitle><DialogDescription>链接访问设置</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4"><PasswordFields key={String(open)} accessPolicy={accessPolicy} onAccessPolicyChange={setAccessPolicy} type={type} value={password} onTypeChange={setType} onChange={value => { setPassword(value); setError('') }} error={error} disabled={pending} purpose="edit" />
            {type === 'none' && error && <p role="alert" className="text-destructive">{error}</p>}
            <DialogFooter><LoadingButton type="submit" loading={pending} icon={<Save />}>保存设置</LoadingButton></DialogFooter>
        </form>
    </DialogContent></Dialog><SessionExpiredDialog open={session} onOpenChange={setSession} /></>
}
