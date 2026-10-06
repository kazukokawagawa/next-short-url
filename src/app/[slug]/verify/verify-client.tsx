'use client'

import { useEffect, useRef, useState } from 'react'
import { Lock, ArrowLeft, ShieldCheck, Timer } from 'lucide-react'
import { PasswordFields } from '@/components/password-fields'
import { LoadingButton } from '@/components/ui/loading-button'
import { Button } from '@/components/ui/button'
import { validateLinkPassword } from '@/lib/link-model'
import { TurnstileDialog } from '@/components/turnstile-dialog'
import Link from 'next/link'

interface Props { slug: string; passwordType: 'none' | 'six_digit' | 'custom'; requireCaptcha: boolean; siteKey: string }
export function VerifyPasswordClient({ slug, passwordType, requireCaptcha, siteKey }: Props) {
    const [password, setPassword] = useState('')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const [blocked, setBlocked] = useState(false)
    const [captchaOpen, setCaptchaOpen] = useState(false)
    const [remaining, setRemaining] = useState<number | null>(null)
    const [revealAttempt, setRevealAttempt] = useState(0)
    const [revealText, setRevealText] = useState('')
    const [revealed, setRevealed] = useState(false)
    const lock = useRef(false)
    const submit = async (event?: React.FormEvent, token?: string) => {
        event?.preventDefault()
        if (lock.current || blocked) return
        const invalid = validateLinkPassword(passwordType, password)
        if (invalid) { setError(invalid); return }
        if (requireCaptcha && !token) { setCaptchaOpen(true); return }
        lock.current = true; setPending(true); setError('')
        try {
            const response = await fetch('/api/verify-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, password, turnstileToken: token }) })
            const data = await response.json()
            if (data.success && data.url) { window.location.assign(data.url); return }
            if (data.success && data.waiting) { setRevealText(data.revealText || ''); setRemaining(data.remaining); return }
            setError(data.error || '验证失败，请重试。'); setBlocked(response.status === 429 || response.status === 404 || response.status === 410 || data.remaining === 0)
        } catch { setError('网络异常，请检查连接后重试。') }
        finally { lock.current = false; setPending(false) }
    }
    useEffect(() => {
        if (remaining === null || remaining <= 0) return
        const timer = window.setInterval(() => setRemaining(value => value === null ? null : Math.max(0, value - 1)), 1000)
        return () => window.clearInterval(timer)
    }, [remaining])
    useEffect(() => {
        if (remaining !== 0 || revealed) return
        let active = true
        fetch('/api/verify-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, stage: 'reveal' }) }).then(response => response.json()).then(data => { if (active && data.ready) { setRevealText(data.revealText); setRevealed(true) } else if (active && data.remaining) setRemaining(data.remaining); else if (active) setError(data.error || '无法确认访问状态，请刷新页面重试。') }).catch(() => { if (active) setError('等待状态获取失败，请刷新页面重试。') })
        return () => { active = false }
    }, [remaining, slug, revealed, revealAttempt])
    const continueAccess = async () => {
        if (lock.current) return
        lock.current = true; setPending(true); setError('')
        try { const response = await fetch('/api/verify-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, stage: 'continue' }) }); const data = await response.json(); if (data.url) window.location.assign(data.url); else setError(data.error || '访问失败，请重试。') } catch { setError('网络异常，请重试。') } finally { lock.current = false; setPending(false) }
    }
    return <><section className="mx-auto flex min-h-[80dvh] w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
        <header className="space-y-2"><Lock className="size-6 text-muted-foreground" /><h1 className="text-2xl font-semibold">访问受保护链接</h1><p className="break-all text-sm text-muted-foreground">{slug}</p></header>
        {remaining !== null ? <div className="space-y-4 rounded-lg border p-5 text-center">
            {revealed ? <ShieldCheck className="mx-auto size-8 text-success" /> : <Timer className="mx-auto size-8 text-muted-foreground" />}
            <p className="text-lg font-medium">{revealed ? '等待结束，可以继续访问' : remaining > 0 ? `请等待 ${remaining} 秒` : '正在确认访问状态…'}</p>
            {revealText && <p className="whitespace-pre-wrap break-words text-sm">{revealText}</p>}
            {revealed && <LoadingButton loading={pending} onClick={continueAccess} icon={<Lock />} className="w-full">继续访问</LoadingButton>}
        </div> : <form onSubmit={submit} className="space-y-4">{passwordType !== 'none' && <PasswordFields type={passwordType} value={password} onChange={setPassword} disabled={pending || blocked} purpose="verify" />}<LoadingButton type="submit" loading={pending} disabled={blocked} icon={<Lock />} className="w-full">验证并访问</LoadingButton></form>}
        {error && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p>{remaining === 0 && !revealed && <Button variant="outline" onClick={() => { setError(''); setRevealAttempt(value => value + 1) }}>重新确认</Button>}</div>}<Button asChild variant="ghost"><Link href="/"><ArrowLeft />返回首页</Link></Button>
    </section><TurnstileDialog open={captchaOpen} onOpenChange={setCaptchaOpen} siteKey={siteKey} onSuccess={token => { setCaptchaOpen(false); submit(undefined, token) }} onError={() => setError('人机验证失败，请重试。')} /></>
}
