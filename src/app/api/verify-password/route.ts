import { NextRequest, NextResponse } from 'next/server'
import { createPublicSupabaseClient } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
    const supabase = createPublicSupabaseClient()
    if (!supabase) return NextResponse.json({ error: '服务暂未配置' }, { status: 503 })
    const { slug, password } = await request.json()

    // 获取请求者 IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'

    if (!slug || !password) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    // 查询链接信息
    const { data: link, error } = await supabase
        .from('links')
        .select('id, original_url, password_type, password_hash, expires_at')
        .eq('slug', slug)
        .single()

    if (error || !link) {
        return NextResponse.json({ error: '链接不存在' }, { status: 404 })
    }

    // 检查是否过期
    if (link.expires_at) {
        const isExpired = new Date(link.expires_at) < new Date()
        if (isExpired) {
            return NextResponse.json({ error: '链接已过期' }, { status: 410 })
        }
    }

    // 检查是否需要密码
    if (!link.password_type || link.password_type === 'none' || !link.password_hash) {
        // 不需要密码，直接返回 URL
        return NextResponse.json({ success: true, url: link.original_url })
    }

    // 检查 IP 失败次数（最近1小时内）
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: failCount, error: attemptsError } = await supabase
        .from('password_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .eq('slug', slug)
        .gte('attempted_at', oneHourAgo)

    if (attemptsError) return NextResponse.json({ error: '验证服务暂时不可用，请稍后重试' }, { status: 503 })
    if (failCount !== null && failCount >= 5) {
        return NextResponse.json({
            error: '尝试次数过多，请1小时后再试',
            tooManyAttempts: true
        }, { status: 429 })
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, link.password_hash)

    if (!isValid) {
        // 记录失败尝试
        const { error: recordError } = await supabase.from('password_attempts').insert({
            ip_address: ip,
            slug: slug
        })

        if (recordError) return NextResponse.json({ error: '验证服务暂时不可用，请稍后重试' }, { status: 503 })
        const remaining = 5 - ((failCount ?? 0) + 1)
        return NextResponse.json({
            error: remaining > 0 ? `密码错误，还剩 ${remaining} 次机会` : '密码错误，已无剩余机会',
            remaining
        }, { status: 401 })
    }

    // 密码正确，增加点击数
    supabase.rpc('increment_clicks', { slug_param: slug }).then(({ error }) => {
        if (error) console.error('Error incrementing clicks:', error)
    })

    return NextResponse.json({ success: true, url: link.original_url })
}
