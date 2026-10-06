import { NextRequest, NextResponse } from 'next/server'
import { hasAccessProtection } from '@/lib/access-policy'
import { createPublicSupabaseClient } from '@/lib/supabase'

// 强制动态渲染，防止 Next.js 静态缓存
export const dynamic = 'force-dynamic'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params
    const supabase = createPublicSupabaseClient()
    if (!supabase) return NextResponse.json({ error: '服务暂未配置' }, { status: 503 })

    // 1. 查询链接（包含密码字段）
    const { data, error } = await supabase
        .from('links')
        .select('id, original_url, expires_at, password_type, password_hash, access_policy')
        .eq('slug', slug)
        .single()

    if (error && error.code !== 'PGRST116') return NextResponse.json({ error: '服务暂时不可用' }, { status: 503 })

    if (data?.original_url) {
        // 检查是否过期
        if (data.expires_at) {
            const isExpired = new Date(data.expires_at) < new Date()
            if (isExpired) {
                return NextResponse.redirect(new URL('/link-expired', request.url))
            }
        }

        // 检查是否需要密码验证
        if ((data.password_type && data.password_type !== 'none') || hasAccessProtection(data.access_policy)) {
            // 需要密码，重定向到验证页面
            return NextResponse.redirect(new URL(`/${slug}/verify`, request.url))
        }

        // 2. 异步更新点击数（不阻塞重定向）
        supabase.rpc('increment_clicks', { slug_param: slug }).then(({ error }) => {
            if (error) console.error('Error incrementing clicks:', error)
        })

        // 3. 302 临时重定向 (避免浏览器缓存 301 导致无法统计点击和检测过期)
        const response = NextResponse.redirect(data.original_url, { status: 302 })
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        return response
    }

    return NextResponse.redirect(new URL('/link-not-found', request.url))
}