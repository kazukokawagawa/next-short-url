'use client'

import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from '@/components/ui/card'
import { ShortenForm } from "./shorten-form"
import { FadeIn } from "@/components/animations/fade-in"
import { useEffect, useState } from "react"
import { User } from "@supabase/supabase-js"
import { useLoading } from "@/components/providers/loading-provider"
import { toast } from "sonner"
import { AsyncState } from '@/components/async-state'
import { AnnouncementConfig } from "@/lib/site-config"
import { hasSupabaseConfig } from '@/lib/supabase-config'


interface HomeClientProps {
    announcementConfig: AnnouncementConfig
    allowPublicShorten: boolean
    configError?: string
    children: React.ReactNode
}

export function HomeClient({ announcementConfig, allowPublicShorten, configError, children }: HomeClientProps) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const { setIsLoading: setGlobalLoading } = useLoading()

    useEffect(() => {
        async function getUser() {
            if (!hasSupabaseConfig()) {
                setLoading(false)
                setGlobalLoading(false)
                return
            }
            try {
                const supabase = createClient()
                const { data: { user }, error: userError } = await supabase.auth.getUser()
                setUser(user)
                if (userError) toast.warning('账户服务暂时不可用，当前按未登录状态继续。')
            } catch {
                setUser(null)
                toast.warning('无法连接账户服务，当前按未登录状态继续。')
            } finally {
                setLoading(false)
                setGlobalLoading(false)
            }
        }
        getUser()
    }, [setGlobalLoading])

    // 处理公告 Toast
    useEffect(() => {
        if (announcementConfig.enabled && announcementConfig.content) {
            // 延迟一点显示，以免和页面加载冲突
            const timer = setTimeout(() => {
                const toastOptions = {
                    description: announcementConfig.content,
                    duration: announcementConfig.duration || 5000,
                }

                switch (announcementConfig.type) {
                    case "destructive":
                        toast.error("公告", toastOptions)
                        break
                    case "secondary":
                        toast.success("公告", toastOptions)
                        break
                    case "outline":
                        toast.info("公告", toastOptions)
                        break
                    default:
                        toast("公告", toastOptions)
                        break
                }
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [announcementConfig])

    // 如果正在加载用户状态，不显示全屏 loading，仅隐藏用户相关UI
    // 主要内容（Card）仍然渲染，提升LCP

    return (
        <>
            <main className="flex min-h-[85dvh] flex-col items-center justify-center relative px-4 pt-24 pb-8">

                {/* 顶部导航区 */}
                {!loading && (
                    <FadeIn delay={0} className="absolute top-6 right-6 md:top-8 md:right-8 z-20">
                        <div className="flex items-center gap-4">
                            {user ? (
                                <>
                                    <span className="text-sm text-muted-foreground hidden md:inline-block max-w-64 truncate" title={user.email}>
                                        {user.email}
                                    </span>
                                    <Button
                                        size="sm"
                                        className="md:h-10 md:px-4 md:py-2 gap-2"
                                        onClick={() => {
                                            setGlobalLoading(true)
                                            router.push("/dashboard")
                                        }}
                                    >
                                        控制台
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => {
                                        setGlobalLoading(true)
                                        router.push("/login")
                                    }}
                                >
                                    登录
                                </Button>
                            )}
                        </div>
                    </FadeIn>
                )}

                {/* 核心卡片区域 */}
                <div className="w-full max-w-md z-10">
                    <Card className="w-full border-0 shadow-none bg-transparent">
                        {children}
                        <CardContent>
                            <FadeIn delay={0.3}>
                                {configError ? <AsyncState fullScreen={false} error={configError} onRetry={() => window.location.reload()} /> : <ShortenForm user={user} allowPublicShorten={allowPublicShorten} />}
                            </FadeIn>
                        </CardContent>
                    </Card>
                </div>

            </main>
        </>
    )
}
