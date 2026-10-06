'use client'

import { MotionConfig } from 'framer-motion'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { GridBackground } from '@/components/grid-background'
import { Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function AppSurface({ children, maintenance, message, bypass }: { children: ReactNode; maintenance: boolean; message: string; bypass: boolean }) {
    const path = usePathname()
    const blocked = maintenance && !bypass && path !== '/login' && !path.startsWith('/auth/')
    const content = blocked ? <section className="mx-auto flex min-h-[80dvh] w-full max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
        <Wrench className="size-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">系统维护中</h1>
        <p className="w-full whitespace-pre-wrap break-words text-muted-foreground">{message || '系统正在维护，请稍后再试。'}</p>
        <Button asChild variant="outline"><Link href="/login">管理员登录</Link></Button>
    </section> : children
    return <MotionConfig reducedMotion="user" transition={{ duration: 0.18 }}>
        {path === '/' && !blocked ? <GridBackground className="flex flex-col">{content}</GridBackground> : <div className="flex min-h-screen flex-col bg-background">{content}</div>}
    </MotionConfig>
}
