'use client'

import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Link2, Check } from 'lucide-react'
import { LinkFormFields } from '@/components/link-form-fields'
import { useLinkFormConfig } from '@/components/use-link-form-config'
import { LoadingButton } from '@/components/ui/loading-button'
import { AsyncState } from '@/components/async-state'
import { CopyButton } from '@/components/copy-button'
import { TurnstileDialog } from '@/components/turnstile-dialog'
import { getPublicSecuritySettings } from '@/app/admin/actions'
import { buildShortUrl, validateLinkPassword, type PasswordType } from '@/lib/link-model'
import { defaultAccessPolicy, type AccessPolicy } from '@/lib/access-policy'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'

export function ShortenForm({ user, allowPublicShorten }: { user: User | null; allowPublicShorten: boolean }) {
    const router = useRouter()
    const config = useLinkFormConfig()
    const [url, setUrl] = useState('')
    const [slug, setSlug] = useState('')
    const [advanced, setAdvanced] = useState(false)
    const [expiresAt, setExpiresAt] = useState<string | undefined>()
    const [passwordType, setPasswordType] = useState<PasswordType>('none')
    const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>({ ...defaultAccessPolicy })
    const [password, setPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [urlError, setUrlError] = useState('')
    const [slugError, setSlugError] = useState('')
    const [error, setError] = useState('')
    const [result, setResult] = useState('')
    const [formVersion, setFormVersion] = useState(0)
    const [pending, setPending] = useState(false)
    const [security, setSecurity] = useState<{ siteKey: string; anonymousShortenEnabled: boolean } | null>(null)
    const [securityError, setSecurityError] = useState('')
    const [attempt, setAttempt] = useState(0)
    const [captchaOpen, setCaptchaOpen] = useState(false)
    const lock = useRef(false)
    useEffect(() => {
        let active = true
        getPublicSecuritySettings().then(value => { if (active) { setSecurity(value); setSecurityError('') } }).catch(() => { if (active) setSecurityError('安全配置加载失败，请重试。') })
        return () => { active = false }
    }, [attempt])
    const submit = async (token?: string) => {
        if (lock.current) return
        const invalid = validateLinkPassword(passwordType, password)
        if (invalid) { setPasswordError(invalid); setAdvanced(true); return }
        if (!user && security?.anonymousShortenEnabled && !security.siteKey) { setError('人机验证配置不完整，请联系管理员。'); return }
        if (!user && security?.anonymousShortenEnabled && security.siteKey && !token) { setCaptchaOpen(true); return }
        lock.current = true; setPending(true); setError(''); setResult('')
        const notification = toast.loading('正在生成短链接…')
        try {
            const response = await fetch('/api/shorten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, slug, expiresAt: expiresAt === undefined ? undefined : expiresAt || null, passwordType, password, accessPolicy, turnstileToken: token }) })
            const data = await response.json()
            if (!response.ok) { const message = data.error || '创建失败，请重试。'; setError(message); toast.error('创建失败', { id: notification, description: message }); return }
            setFormVersion(value => value + 1)
            setResult(data.slug); toast.success('短链接已创建', { id: notification, description: '链接已经准备好，可以复制或打开。' }); setUrl(''); setSlug(''); setUrlError(''); setSlugError(''); setPassword(''); setPasswordType('none'); setAccessPolicy({ ...defaultAccessPolicy }); setAdvanced(false); setExpiresAt(undefined)
        } catch { setError('网络异常，请重试。'); toast.error('创建失败', { id: notification, description: '网络异常，请稍后重试。' }) }
        finally { lock.current = false; setPending(false) }
    }
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const nextUrlError = /^https?:\/\/[^\s]+$/i.test(url) ? '' : '请输入以 http:// 或 https:// 开头的有效网址'
        const nextSlugError = !slug || /^[a-zA-Z0-9_-]+$/.test(slug) ? '' : '后缀只能包含字母、数字、连字符和下划线'
        setUrlError(nextUrlError); setSlugError(nextSlugError)
        if (nextUrlError || nextSlugError) { if (nextSlugError) setAdvanced(true); return }
        await submit()
    }
    if (config.error || securityError) return <AsyncState fullScreen={false} error={config.error || securityError} onRetry={() => { config.retry(); setAttempt(value => value + 1) }} />
    const fullUrl = result ? buildShortUrl(result, typeof window !== 'undefined' ? window.location.origin : undefined) : ''
    return <>
        <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
            <LinkFormFields accessPolicy={accessPolicy} setAccessPolicy={setAccessPolicy} key={formVersion} url={url} setUrl={value => { setUrl(value); setUrlError('') }} slug={slug} setSlug={value => { setSlug(value); setSlugError('') }} urlError={urlError} slugError={slugError} showCustomOption={advanced} setShowCustomOption={setAdvanced} placeholderSlug={config.placeholderSlug} defaultExpiration={config.defaultExpiration} expiresAt={expiresAt} setExpiresAt={setExpiresAt} passwordType={passwordType} setPasswordType={setPasswordType} password={password} setPassword={setPassword} passwordError={passwordError} setPasswordError={setPasswordError} disabled={pending} />
            {error && <p role="alert" className="break-all text-sm text-destructive">{error}</p>}
            {!user && !allowPublicShorten ? <Button type="button" onClick={() => router.push('/login')} className="w-full">登录后创建</Button> : <LoadingButton loading={pending} disabled={config.loading || !security} type="submit" icon={<Link2 />} className="w-full">生成短链接</LoadingButton>}
        </form>
        {security?.siteKey && <TurnstileDialog open={captchaOpen} onOpenChange={setCaptchaOpen} siteKey={security.siteKey} onSuccess={token => { setCaptchaOpen(false); submit(token) }} onError={() => setError('人机验证失败，请重试。')} />}
        <AnimatePresence initial={false}>
            {result && <motion.div key={result} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div role="status" className="mt-6 flex min-w-0 items-center gap-3 border-t pt-4"><Check className="size-4 shrink-0 text-success" /><a className="min-w-0 flex-1 break-all text-primary" href={fullUrl} target="_blank" rel="noopener noreferrer">{fullUrl}</a><CopyButton slug={result} /></div>
            </motion.div>}
        </AnimatePresence>
    </>
}
