'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

export function VerificationToast() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const lastNotification = useRef('')

    useEffect(() => {
        // 检测 URL 中是否有 verified=true
        const isVerified = searchParams.get('verified') === 'true'
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (!isVerified && !error) {
            lastNotification.current = ''
            return
        }
        const notification = JSON.stringify([pathname, isVerified, error, errorDescription])
        if (lastNotification.current === notification) return
        lastNotification.current = notification

        if (isVerified) {
            toast.success('邮箱验证成功！', {
                id: 'email-verification',
                description: '您的账户已激活，欢迎使用。',
                duration: 5000,
            })
        } else if (error) {
            toast.error('邮箱验证失败', {
                id: 'email-verification',
                description: errorDescription || '链接可能已过期或无效。',
            })
        }

        const params = new URLSearchParams(searchParams.toString())
        for (const key of ['verified', 'error', 'error_description', 'error_code']) params.delete(key)
        const query = params.toString()
        router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })
    }, [searchParams, router, pathname])

    // 这个组件不需要渲染任何 UI，它只负责逻辑
    return null
}
