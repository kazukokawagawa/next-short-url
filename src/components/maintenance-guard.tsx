'use client'

import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface MaintenanceGuardProps {
    enabled: boolean
    message?: string
    bypass?: boolean
}

export function MaintenanceGuard({ enabled, message, bypass }: MaintenanceGuardProps) {
    const pathname = usePathname()

    // 允许访问的路径
    const isAllowedPath =
        pathname?.startsWith('/login') ||
        pathname?.startsWith('/admin') ||
        pathname?.startsWith('/api/auth')

    // 如果未启用，或已绕过，或在允许的路径上，则不显示遮罩
    if (!enabled || bypass || isAllowedPath) {
        return null
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative mx-4 w-full max-w-md overflow-hidden rounded-[8px] border bg-card p-6"
            >
                {/* 背景装饰 */}
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
                <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

                <div className="relative flex flex-col items-center text-center">
                    <motion.div
                        initial={{ rotate: -20, scale: 0.8 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                            delay: 0.2
                        }}
                        className="mb-6 flex h-20 w-20 items-center justify-center rounded-[8px] bg-primary/10 text-primary"
                    >
                        <Wrench className="h-10 w-10" />
                    </motion.div>

                    <h1 className="mb-3 text-2xl font-semibold text-foreground">
                        系统维护中
                    </h1>

                    <p className="mb-8 text-muted-foreground">
                        {message || "为了给您提供更好的服务，系统正在进行临时维护。请稍后再回来看看。"}
                    </p>

                    <div className="flex gap-4">
                        <Button asChild variant="outline">
                            <Link href="/login">管理员登录</Link>
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
