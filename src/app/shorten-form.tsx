'use client'

import { toastMessages, validateUrl, validateSlug } from '@/lib/validation'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/copy-button'
import { toast } from "sonner"
import { LoaderCircle, KeyRound } from 'lucide-react'
import { motion, AnimatePresence } from "framer-motion"
import { User } from '@supabase/supabase-js'
import { LinkFormFields, PasswordType } from '@/components/link-form-fields'
import { LinkArrowIcon } from '@/components/link-arrow-icon'
import { getPublicSecuritySettings } from '@/app/admin/actions'
import { TurnstileDialog } from '@/components/turnstile-dialog'


export function ShortenForm({ user, allowPublicShorten }: { user: User | null; allowPublicShorten: boolean }) {
    const router = useRouter()

    // 状态管理
    const [url, setUrl] = useState('')
    const [slug, setSlug] = useState('')
    const [showCustomOption, setShowCustomOption] = useState(false)
    const [placeholderSlug, setPlaceholderSlug] = useState('')
    // 结果与加载状态
    const [shortUrlSlug, setShortUrlSlug] = useState('')
    const [loading, setLoading] = useState(false)
    const [isButtonHovered, setIsButtonHovered] = useState(false)

    // 密码状态
    const [passwordType, setPasswordType] = useState<PasswordType>('none')
    const [password, setPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')

    const [turnstileSiteKey, setTurnstileSiteKey] = useState('')
    const [anonymousShortenTurnstileEnabled, setAnonymousShortenTurnstileEnabled] = useState(false)
    const [turnstileToken, setTurnstileToken] = useState('')
    const [turnstileDialogOpen, setTurnstileDialogOpen] = useState(false)
    const [pendingSubmit, setPendingSubmit] = useState(false)

    const requiresTurnstile = !user && allowPublicShorten && anonymousShortenTurnstileEnabled && Boolean(turnstileSiteKey)

    useEffect(() => {
        getPublicSecuritySettings()
            .then(settings => {
                setTurnstileSiteKey(settings.siteKey)
                setAnonymousShortenTurnstileEnabled(settings.anonymousShortenEnabled)
            })
            .catch(err => {
                console.error('Failed to load security settings:', err)
            })
    }, [])

    const submitLink = async (tokenOverride?: string) => {
        setLoading(true)
        setShortUrlSlug('')

        const toastId = toastMessages.linkCreating()
        const finalSlug = slug || placeholderSlug

        try {
            const res = await fetch('/api/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    slug: finalSlug,
                    passwordType: passwordType !== 'none' ? passwordType : undefined,
                    password: passwordType !== 'none' ? password : undefined,
                    turnstileToken: requiresTurnstile ? (tokenOverride || turnstileToken) : undefined
                }),
            })
            const data = await res.json()

            if (data.slug) {
                setShortUrlSlug(data.slug)
                setUrl('')
                setSlug('')
                setShowCustomOption(false)
                setPasswordType('none')
                setPassword('')
                setPasswordError('')
                setTurnstileToken('')
                toastMessages.linkCreateSuccess(toastId)
            } else {
                if (data.error === 'URL_NOT_ACCESSIBLE') {
                    toastMessages.urlNotAccessible(data.statusCode)
                    toast.dismiss(toastId)
                } else if (data.error === 'URL_TIMEOUT') {
                    toastMessages.urlTimeout()
                    toast.dismiss(toastId)
                } else if (data.error === 'URL_VERIFICATION_FAILED') {
                    toastMessages.urlVerificationFailed()
                    toast.dismiss(toastId)
                } else if (data.error === 'URL_MALICIOUS') {
                    toastMessages.urlMalicious(data.threats)
                    toast.dismiss(toastId)
                } else if (data.error === 'URL_SUFFIX_BLOCKED') {
                    toastMessages.urlSuffixBlocked()
                    toast.dismiss(toastId)
                } else if (data.error === 'URL_DOMAIN_BLOCKED') {
                    toastMessages.urlDomainBlocked()
                    toast.dismiss(toastId)
                } else if (data.error === 'SLUG_BLOCKED') {
                    toastMessages.slugBlocked()
                    toast.dismiss(toastId)
                } else if (data.error === '请先完成人机验证' || data.error === '人机验证失败，请重试') {
                    setTurnstileToken('')
                    setTurnstileDialogOpen(true)
                    toastMessages.linkCreateError(data.error, toastId)
                } else {
                    toastMessages.linkCreateError(data.error || "生成失败", toastId)
                }
            }
        } catch (error) {
            console.error(error)
            toastMessages.networkError(toastId)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        console.log('handleSubmit - allowPublicShorten:', allowPublicShorten, 'user:', user)

        // 如果不允许公开缩短且用户未登录，提示登录
        if (!user && !allowPublicShorten) {
            // 创建自定义登录按钮内容组件（用 div 代替 button 避免嵌套）
            const LoginButtonContent = () => {
                const [isHovered, setIsHovered] = useState(false)

                return (
                    <div
                        className="relative inline-flex items-center justify-center w-12 h-full"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        onTouchStart={() => setIsHovered(true)}
                        onTouchEnd={() => setIsHovered(false)}
                    >
                        <motion.span
                            initial={false}
                            animate={{
                                opacity: isHovered ? 0 : 1,
                                x: isHovered ? -10 : 0
                            }}
                            transition={{ duration: 0.2 }}
                            className="absolute"
                        >
                            登录
                        </motion.span>
                        <motion.span
                            initial={false}
                            animate={{
                                opacity: isHovered ? 1 : 0,
                                x: isHovered ? 0 : 10
                            }}
                            transition={{ duration: 0.2 }}
                            className="absolute"
                        >
                            →
                        </motion.span>
                    </div>
                )
            }

            toastMessages.loginRequired(
                <KeyRound className="h-5 w-5" />,
                {
                    label: <LoginButtonContent />,
                    onClick: () => router.push('/login')
                }
            )
            return
        }

        // 验证 URL 和 Slug
        if (!validateUrl(url) || !validateSlug(slug)) {
            return
        }

        // 密码验证
        if (passwordType === 'six_digit' && password.length !== 6) {
            toastMessages.passwordSixDigitRequired()
            return
        }
        if (passwordType === 'custom' && password.length === 0) {
            toastMessages.passwordCustomRequired()
            return
        }

        if (requiresTurnstile && !turnstileToken) {
            setPendingSubmit(true)
            setTurnstileDialogOpen(true)
            return
        }

        await submitLink()
    }

    return (
        <>
            {requiresTurnstile && (
                <TurnstileDialog
                    open={turnstileDialogOpen}
                    onOpenChange={(open) => {
                        setTurnstileDialogOpen(open)
                        if (!open) {
                            setPendingSubmit(false)
                        }
                    }}
                    siteKey={turnstileSiteKey}
                    title="人机验证"
                    description="请完成验证以继续创建短链接"
                    onSuccess={(token) => {
                        setTurnstileToken(token)
                        if (pendingSubmit) {
                            setPendingSubmit(false)
                            submitLink(token)
                        }
                    }}
                    onError={() => setTurnstileToken('')}
                />
            )}
            <form onSubmit={handleSubmit} className="grid w-full items-center gap-4" noValidate>

                <LinkFormFields
                    url={url}
                    setUrl={setUrl}
                    slug={slug}
                    setSlug={setSlug}
                    showCustomOption={showCustomOption}
                    setShowCustomOption={setShowCustomOption}
                    placeholderSlug={placeholderSlug}
                    setPlaceholderSlug={setPlaceholderSlug}
                    passwordType={passwordType}
                    setPasswordType={setPasswordType}
                    password={password}
                    setPassword={setPassword}
                    passwordError={passwordError}
                    setPasswordError={setPasswordError}
                />

                <Button
                    disabled={loading}
                    type="submit"
                    className="w-full gap-2"
                    onMouseEnter={() => setIsButtonHovered(true)}
                    onMouseLeave={() => setIsButtonHovered(false)}
                    onTouchStart={() => setIsButtonHovered(true)}
                    onTouchEnd={() => setIsButtonHovered(false)}
                >
                    {loading ? (
                        <>
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            生成中...
                        </>
                    ) : (
                        <>
                            <LinkArrowIcon isHovered={isButtonHovered} />
                            生成短链接
                        </>
                    )}
                </Button>
            </form>

            {/* --- 结果显示 --- */}
            <AnimatePresence>
                {shortUrlSlug && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="mt-6"
                    >
                        <div className="rounded-lg border bg-card p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <motion.svg
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
                                            className="h-4 w-4 text-primary"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2.5}
                                        >
                                            <motion.path
                                                initial={{ pathLength: 0 }}
                                                animate={{ pathLength: 1 }}
                                                transition={{ delay: 0.2, duration: 0.3 }}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M5 13l4 4L19 7"
                                            />
                                        </motion.svg>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            短链接已生成
                                        </span>
                                    </div>
                                    <span className="font-medium text-foreground">
                                        {typeof window !== 'undefined' ? window.location.host : ''}/{shortUrlSlug}
                                    </span>
                                </div>
                                <CopyButton slug={shortUrlSlug} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
