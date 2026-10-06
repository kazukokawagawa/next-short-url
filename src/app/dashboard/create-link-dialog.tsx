'use client'

import { useRef, useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LinkFormFields } from '@/components/link-form-fields'
import { useLinkFormConfig } from '@/components/use-link-form-config'
import { AsyncState } from '@/components/async-state'
import { SessionExpiredDialog } from '@/components/session-expired-dialog'
import { validateLinkPassword, type PasswordType } from '@/lib/link-model'
import { createLink } from './actions'
import { toast } from 'sonner'

export function CreateLinkDialog({ onSuccess }: { onSuccess?: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [url, setUrl] = useState('')
    const [slug, setSlug] = useState('')
    const [expiresAt, setExpiresAt] = useState<string | undefined>()
    const [advanced, setAdvanced] = useState(false)
    const [passwordType, setPasswordType] = useState<PasswordType>('none')
    const [password, setPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [urlError, setUrlError] = useState('')
    const [slugError, setSlugError] = useState('')
    const [error, setError] = useState('')
    const [session, setSession] = useState(false)
    const lock = useRef(false)
    const config = useLinkFormConfig()
    const changeOpen = (value: boolean) => {
        if (lock.current) return
        setOpen(value)
        if (!value) { setUrl(''); setSlug(''); setPassword(''); setPasswordType('none'); setAdvanced(false); setExpiresAt(undefined); setError(''); setPasswordError(''); setUrlError(''); setSlugError('') }
    }
    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (lock.current) return
        const form = new FormData(event.currentTarget)
        const urlValue = String(form.get('url') || '')
        const slugValue = String(form.get('slug') || '')
        const nextUrlError = /^https?:\/\/[^\s]+$/i.test(urlValue) ? '' : '请输入以 http:// 或 https:// 开头的有效网址'
        const nextSlugError = !slugValue || /^[a-zA-Z0-9_-]+$/.test(slugValue) ? '' : '后缀只能包含字母、数字、连字符和下划线'
        setUrlError(nextUrlError); setSlugError(nextSlugError)
        if (nextUrlError || nextSlugError) { if (nextSlugError) setAdvanced(true); return }
        const invalidPassword = validateLinkPassword(passwordType, password)
        if (invalidPassword) { setPasswordError(invalidPassword); setAdvanced(true); return }
        lock.current = true; setLoading(true); setError('')
        form.set('passwordType', passwordType); form.set('password', password)
        form.set('expiresAt', expiresAt ?? (config.defaultExpiration ? new Date(Date.now() + config.defaultExpiration * 60000).toISOString() : ''))
        const notification = toast.loading('正在创建链接…')
        try {
            const result = await createLink(form)
            if (result.needsLogin) { toast.dismiss(notification); setSession(true) }
            else if (result.error) { setError(result.error); toast.error('创建失败', { id: notification, description: result.error }) }
            else { toast.success('短链接已创建', { id: notification }); onSuccess?.(); lock.current = false; changeOpen(false) }
        } catch { setError('网络异常，请重试。'); toast.error('网络异常，请重试。', { id: notification }) }
        finally { lock.current = false; setLoading(false) }
    }
    return <><Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild><Button><Plus />创建链接</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>创建短链接</DialogTitle><DialogDescription>新链接</DialogDescription></DialogHeader>
            {config.error ? <AsyncState fullScreen={false} error={config.error} onRetry={config.retry} /> : <form onSubmit={submit} className="space-y-4">
                <LinkFormFields url={url} setUrl={value => { setUrl(value); setUrlError('') }} slug={slug} setSlug={value => { setSlug(value); setSlugError('') }} urlError={urlError} slugError={slugError} expiresAt={expiresAt} setExpiresAt={setExpiresAt} showCustomOption={advanced} setShowCustomOption={setAdvanced} placeholderSlug={config.placeholderSlug} defaultExpiration={config.defaultExpiration} passwordType={passwordType} setPasswordType={setPasswordType} password={password} setPassword={setPassword} passwordError={passwordError} setPasswordError={setPasswordError} disabled={loading} />
                {error && <p role="alert" className="break-all text-sm text-destructive">{error}</p>}
                <DialogFooter><LoadingButton type="submit" loading={loading} disabled={config.loading} icon={<Save />}>创建链接</LoadingButton></DialogFooter>
            </form>}
        </DialogContent>
    </Dialog><SessionExpiredDialog open={session} onOpenChange={setSession} /></>
}
