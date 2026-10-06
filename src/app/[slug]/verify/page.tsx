import { createPublicSupabaseClient } from '@/lib/supabase'
import { notFound, redirect } from 'next/navigation'
import { VerifyPasswordClient } from '@/app/[slug]/verify/verify-client'

export const dynamic = 'force-dynamic'

interface Props {
    params: Promise<{ slug: string }>
}

export default async function VerifyPasswordPage({ params }: Props) {
    const supabase = createPublicSupabaseClient()
    if (!supabase) return <section className="mx-auto flex min-h-[70dvh] max-w-md items-center justify-center px-4 text-center"><p className="text-muted-foreground">服务暂未配置，请稍后再试。</p></section>
    const { slug } = await params

    // 查询链接信息
    const { data: link, error } = await supabase
        .from('links')
        .select('id, password_type, expires_at')
        .eq('slug', slug)
        .single()

    if (error && error.code !== 'PGRST116') {
        return <section className="mx-auto flex min-h-[70dvh] max-w-md items-center justify-center px-4 text-center"><p className="text-muted-foreground">链接服务暂时不可用，请稍后重试。</p></section>
    }
    if (!link) {
        notFound()
    }

    // 检查是否过期
    if (link.expires_at) {
        const isExpired = new Date(link.expires_at) < new Date()
        if (isExpired) {
            return <section className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center"><h1 className="text-2xl font-semibold">链接已过期</h1><p className="text-muted-foreground">此短链接已超过有效期。</p></section>
        }
    }

    // 如果不需要密码，直接跳转
    if (!link.password_type || link.password_type === 'none') redirect(`/${slug}`)

    return (
        <VerifyPasswordClient
            slug={slug}
            passwordType={link.password_type as 'six_digit' | 'custom'}
        />
    )
}
