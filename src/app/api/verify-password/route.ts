import { NextRequest, NextResponse } from 'next/server'
import { createPublicSupabaseClient } from '@/lib/supabase'
import { parseAccessPolicy } from '@/lib/access-policy'
import { accessCookieName, accessFingerprint, readAccessTicket, signAccessTicket } from '@/lib/access-ticket'
import { getSecurityConfig } from '@/lib/site-config'
import { verifyTurnstileToken } from '@/lib/turnstile'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
    const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
    let input
    try { input = await request.json() }
    catch { return json({ error: '请求格式无效' }, 400) }
    if (!input || typeof input.slug !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(input.slug)) return json({ error: '缺少有效链接参数' }, 400)
    const { slug, password, turnstileToken, stage } = input
    const supabase = createPublicSupabaseClient()
    if (!supabase) return json({ error: '服务暂未配置' }, 503)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
    // 缺少 access_policy 的旧数据库仍可验证密码；其他查询错误继续拒绝放行。
    const { data: link, error } = await supabase.from('links').select('*').eq('slug', slug).single()
    if (error) return json({ error: error.code === 'PGRST116' ? '链接不存在' : '验证服务暂时不可用' }, error.code === 'PGRST116' ? 404 : 503)
    if (!link) return json({ error: '链接不存在' }, 404)
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return json({ error: '链接已过期' }, 410)
    let policy
    try { policy = parseAccessPolicy(link.access_policy) }
    catch { return json({ error: '链接保护配置无效，请联系所有者' }, 503) }

    const secret = process.env.LINK_ACCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
    const cookieName = accessCookieName(slug)
    const fingerprint = accessFingerprint({ ...link, slug }, ip)
    const ticket = secret ? readAccessTicket(request.cookies.get(cookieName)?.value, fingerprint, secret) : null
    const finish = async () => {
        const { error: clickError } = await supabase.rpc('increment_clicks', { slug_param: slug })
        if (clickError) console.error('Error incrementing clicks:', clickError)
        const response = json({ success: true, url: link.original_url })
        response.cookies.set(cookieName, '', { path: '/api/verify-password', maxAge: 0 })
        return response
    }
    if (stage === 'reveal' || stage === 'continue') {
        if (!ticket) return json({ error: '验证已失效，请刷新页面重新验证' }, 401)
        const remaining = Math.max(0, Math.ceil((ticket.readyAt - Date.now()) / 1000))
        if (remaining) return json({ success: true, waiting: true, remaining })
        if (stage === 'continue') return finish()
        return json({ success: true, ready: true, revealText: policy.revealText })
    }
    if (stage !== undefined) return json({ error: '验证步骤无效' }, 400)
    if ((policy.waitSeconds || policy.revealText) && !secret) return json({ error: '访问保护服务尚未配置，请联系管理员' }, 503)

    if (policy.requireCaptcha) {
        const security = await getSecurityConfig()
        if (!security.turnstileEnabled || !security.turnstileSiteKey?.trim() || !security.turnstileSecretKey?.trim()) return json({ error: '人机验证配置不完整，请联系管理员' }, 503)
        if (typeof turnstileToken !== 'string' || !turnstileToken) return json({ error: '请先完成人机验证' }, 400)
        const verified = await verifyTurnstileToken({ token: turnstileToken, secretKey: security.turnstileSecretKey, remoteIp: ip === 'unknown' ? null : ip })
        if (!verified.success) return json({ error: '人机验证失败或已过期，请重试' }, 400)
    }
    if (link.password_type && link.password_type !== 'none') {
        if (!link.password_hash) return json({ error: '密码保护配置无效' }, 503)
        if (typeof password !== 'string' || !password || password.length > 128) return json({ error: '请输入有效密码' }, 400)
        const { count: failCount, error: attemptsError } = await supabase.from('password_attempts').select('*', { count: 'exact', head: true }).eq('ip_address', ip).eq('slug', slug).gte('attempted_at', new Date(Date.now() - 3600000).toISOString())
        if (attemptsError) return json({ error: '验证服务暂时不可用，请稍后重试' }, 503)
        if ((failCount ?? 0) >= 5) return json({ error: '尝试次数过多，请1小时后再试', tooManyAttempts: true }, 429)
        if (!await bcrypt.compare(password, link.password_hash)) {
            const { error: recordError } = await supabase.from('password_attempts').insert({ ip_address: ip, slug })
            if (recordError) return json({ error: '验证服务暂时不可用，请稍后重试' }, 503)
            const remaining = 5 - ((failCount ?? 0) + 1)
            return json({ error: remaining > 0 ? `密码错误，还剩 ${remaining} 次机会` : '密码错误，已无剩余机会', remaining }, 401)
        }
    }
    if (!policy.waitSeconds && !policy.revealText) return finish()
    const response = json({ success: true, waiting: true, remaining: policy.waitSeconds, revealText: policy.revealText })
    response.cookies.set(cookieName, signAccessTicket(fingerprint, Date.now() + policy.waitSeconds * 1000, secret!), {
        httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'strict', path: '/api/verify-password', maxAge: 900
    })
    return response
}
