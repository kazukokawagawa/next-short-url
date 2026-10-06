'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LogIn, UserPlus } from 'lucide-react'
import { login, signup } from './actions'
import { getPublicSecuritySettings } from '@/app/admin/actions'
import { getSiteSettings } from '@/app/dashboard/settings-actions'
import { FormInput } from '@/components/ui/form-field'
import { LoadingButton } from '@/components/ui/loading-button'
import { Button } from '@/components/ui/button'
import { AsyncState } from '@/components/async-state'
import { TurnstileInline, type TurnstileInlineRef } from '@/components/turnstile-inline'
import { toast } from 'sonner'
import { Reveal } from '@/components/animations/reveal'
import { PasswordStrength } from '@/components/password-strength'

export default function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
    const params = use(searchParams)
    const router = useRouter()
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const [emailError, setEmailError] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [message, setMessage] = useState('')
    const [configError, setConfigError] = useState('')
    const [config, setConfig] = useState<{ open: boolean; captcha: boolean; key: string } | null>(null)
    const [token, setToken] = useState('')
    const [attempt, setAttempt] = useState(0)
    const captcha = useRef<TurnstileInlineRef>(null)
    const lock = useRef(false)
    useEffect(() => {
        let active = true
        Promise.all([getPublicSecuritySettings(), getSiteSettings()]).then(([security, site]) => {
            if (security.enabled && !security.siteKey) throw new Error('人机验证配置不完整')
            if (site.error) throw new Error(site.error)
            if (active) { setConfig({ open: site.openRegistration, captcha: security.enabled, key: security.siteKey }); setConfigError('') }
        }).catch(() => { if (active) setConfigError('认证配置加载失败，请重试。') })
        return () => { active = false }
    }, [attempt])
    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (lock.current) return
        const invalidEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '请输入有效的邮箱地址' : ''
        const invalidPassword = !password || (mode === 'signup' && password.length < 6) ? '请输入至少 6 位密码' : ''
        setEmailError(invalidEmail); setPasswordError(invalidPassword)
        if (invalidEmail || invalidPassword) { document.getElementById(invalidEmail ? 'auth-email' : 'auth-password')?.focus(); return }
        if (mode === 'signup' && config?.captcha && !token) { setError('请完成人机验证'); return }
        lock.current = true; setPending(true); setError(''); setMessage('')
        const form = new FormData(); form.set('email', email); form.set('password', password); form.set('turnstileToken', token)
        const notification = toast.loading(mode === 'login' ? '正在登录…' : '正在注册…')
        try {
            const result = mode === 'login' ? await login(form) : await signup(form)
            if (result.error) { setError(result.error); toast.error(mode === 'login' ? '登录失败' : '注册失败', { id: notification, description: result.error }); captcha.current?.reset(); setToken('') }
            else if (mode === 'login' || ('sessionReady' in result && result.sessionReady)) { toast.success('登录成功', { id: notification }); router.push('/dashboard') }
            else { toast.success('验证邮件已发送', { id: notification, description: '请查收邮箱并完成验证。' }); setMessage('验证邮件已发送，请查收邮箱。'); setMode('login'); setPassword('') }
        } catch { setError('网络异常，请重试。'); toast.error('网络异常，请重试。', { id: notification }) }
        finally { lock.current = false; setPending(false) }
    }
    return <section className="mx-auto w-full max-w-md px-4 py-8 md:py-16">
        <Button asChild variant="ghost" className="mb-6"><Link href="/"><ArrowLeft />返回首页</Link></Button>
        <h1 className="mb-6 text-2xl font-semibold">账户</h1>
        {configError ? <AsyncState error={configError} onRetry={() => setAttempt(value => value + 1)} /> : !config ? <AsyncState /> : <>
            <div role="group" aria-label="账户模式" className="mb-6 grid grid-cols-2 gap-1 border-b pb-2">
                <Button variant={mode === 'login' ? 'default' : 'ghost'} aria-pressed={mode === 'login'} disabled={pending} onClick={() => { setMode('login'); setError(''); setToken('') }}>登录</Button>
                <Button variant={mode === 'signup' ? 'default' : 'ghost'} aria-pressed={mode === 'signup'} disabled={pending || !config.open} onClick={() => { setMode('signup'); setError(''); setToken('') }}>注册</Button>
            </div>
            {!config.open && <p className="mb-4 text-sm text-muted-foreground">暂未开放注册</p>}
            <form onSubmit={submit} noValidate className="space-y-4">
                <FormInput id="auth-email" label="邮箱" type="email" autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setEmailError('') }} error={emailError} disabled={pending} />
                <FormInput id="auth-password" label="密码" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => { setPassword(event.target.value); setPasswordError('') }} error={passwordError} disabled={pending} />
                <Reveal show={mode === 'signup' && Boolean(password)}><PasswordStrength password={password} /></Reveal>
                {mode === 'signup' && config.captcha && <TurnstileInline ref={captcha} siteKey={config.key} onSuccess={setToken} onError={() => { setToken(''); setError('验证失败，请重试。') }} />}
                {(error || params.message) && <p role="alert" className="break-words text-sm text-destructive">{error || params.message}</p>}
                {message && <p role="status" className="text-sm text-success">{message}</p>}
                <LoadingButton type="submit" loading={pending} icon={mode === 'login' ? <LogIn /> : <UserPlus />} className="w-full disabled:opacity-100">{mode === 'login' ? '登录' : '注册'}</LoadingButton>
            </form>
        </>}
    </section>
}
