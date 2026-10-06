'use client'

import { Turnstile } from '@marsidev/react-turnstile'
import { useState, forwardRef, useImperativeHandle } from 'react'
import { LoaderCircle, ShieldCheck, ShieldX } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from "@/components/ui/button"

interface TurnstileInlineProps {
    siteKey: string
    onSuccess: (token: string) => void
    onError?: () => void
}

export interface TurnstileInlineRef {
    reset: () => void
}

export const TurnstileInline = forwardRef<TurnstileInlineRef, TurnstileInlineProps>(({
    siteKey,
    onSuccess,
    onError
}, ref) => {
    const [status, setStatus] = useState<'loading' | 'ready' | 'verifying' | 'success' | 'error'>('loading')
    const [widgetKey, setWidgetKey] = useState(0)

    useImperativeHandle(ref, () => ({
        reset: () => {
            setStatus('loading')
            setWidgetKey(prev => prev + 1)
        }
    }))

    const handleSuccess = (token: string) => {
        setStatus('success')
        setTimeout(() => {
            onSuccess(token)
        }, 600)
    }

    const handleError = () => {
        setStatus('error')
        onError?.()
    }

    const handleExpire = () => {
        setStatus('ready')
    }

    const handleRetry = () => {
        setStatus('loading')
        setWidgetKey(prev => prev + 1)
    }

    return (
        <div className="flex flex-col items-center justify-center h-[80px]">
            {status === 'success' ? (
                <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-2 text-success"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                        <ShieldCheck className="h-10 w-10" />
                    </motion.div>
                    <span className="text-sm font-medium">验证成功</span>
                </motion.div>
            ) : status === 'error' ? (
                <div className="flex flex-col items-center gap-3">
                    <div className="flex flex-col items-center gap-2 text-destructive">
                        <ShieldX className="h-10 w-10" />
                        <span className="text-sm font-medium">验证失败</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRetry}>
                        重新验证
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col items-center">
                    {status === 'loading' && (
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            <span className="text-sm">加载中...</span>
                        </div>
                    )}
                    <Turnstile
                        key={widgetKey}
                        siteKey={siteKey}
                        onSuccess={handleSuccess}
                        onError={handleError}
                        onExpire={handleExpire}
                        onWidgetLoad={() => setStatus('ready')}
                        options={{
                            theme: 'auto',
                            language: 'zh-CN'
                        }}
                    />
                </div>
            )}
        </div>
    )
})

TurnstileInline.displayName = 'TurnstileInline'
