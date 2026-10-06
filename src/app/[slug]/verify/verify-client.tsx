'use client'

import { useRef, useState } from 'react'
import { Lock, ArrowLeft } from 'lucide-react'
import { PasswordFields } from '@/components/password-fields'
import { LoadingButton } from '@/components/ui/loading-button'
import { Button } from '@/components/ui/button'
import { validateLinkPassword } from '@/lib/link-model'
import Link from 'next/link'

export function VerifyPasswordClient({ slug, passwordType }: { slug: string; passwordType: 'six_digit' | 'custom' }) {
    const [password, setPassword] = useState('')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const [blocked, setBlocked] = useState(false)
    const lock = useRef(false)
    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (lock.current || blocked) return
        const invalid = validateLinkPassword(passwordType, password)
        if (invalid) { setError(invalid); return }
        lock.current = true; setPending(true); setError('')
        try {
            const response = await fetch('/api/verify-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, password }) })
            const data = await response.json()
            if (data.success && data.url) { window.location.assign(data.url); return }
            setError(data.error || '验证失败，请重试。')
            setBlocked(response.status === 429 || response.status === 404 || response.status === 410 || data.remaining === 0)
        } catch { setError('网络异常，请检查连接后重试。') }
        finally { lock.current = false; setPending(false) }
    }
    return <section className="mx-auto flex min-h-[80dvh] w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
        <header className="space-y-2"><Lock className="size-6 text-muted-foreground" /><h1 className="text-2xl font-semibold">访问受保护链接</h1><p className="break-all text-sm text-muted-foreground">{slug}</p></header>
        <form onSubmit={submit} className="space-y-4"><PasswordFields type={passwordType} value={password} onChange={setPassword} error={error} disabled={pending || blocked} purpose="verify" />
            <LoadingButton type="submit" loading={pending} disabled={blocked} icon={<Lock />} className="w-full">验证并访问</LoadingButton>
        </form>
        <Button asChild variant="ghost"><Link href="/"><ArrowLeft />返回首页</Link></Button>
    </section>
}
