import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { nanoid } from 'nanoid'

import { getSiteConfig, getLinksConfig, getSecurityConfig } from '@/lib/site-config'
import { validateUrl, validateSlug } from '@/lib/url-validation'
import { processLinkPassword } from '@/lib/password'
import { checkPublicAccess } from '@/utils/auth'
import { verifyTurnstileToken } from '@/lib/turnstile'

export async function POST(request: Request) {
    const { url, slug, expiresAt, passwordType, password, turnstileToken } = await request.json()
    const supabase = await createClient()

    // 使用统一的认证检查
    const siteConfig = await getSiteConfig()
    const authResult = await checkPublicAccess(supabase, siteConfig.allowPublicShorten)
    if (authResult.error) {
        return NextResponse.json({ error: '未登录' }, { status: 401 })
    }
    const user = authResult.user

    if (!url) return NextResponse.json({ error: 'URL 不能为空' }, { status: 400 })

    if (!user) {
        const securityConfig = await getSecurityConfig()
        const requiresTurnstile = securityConfig.turnstileEnabled && securityConfig.turnstileAnonymousShortenEnabled

        if (requiresTurnstile) {
            if (!securityConfig.turnstileSecretKey?.trim()) {
                return NextResponse.json({ error: 'Turnstile 配置不完整' }, { status: 500 })
            }

            if (!turnstileToken) {
                return NextResponse.json({ error: '请先完成人机验证' }, { status: 400 })
            }

            const forwardedFor = request.headers.get('x-forwarded-for')
            const remoteIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() : null
            const result = await verifyTurnstileToken({
                token: String(turnstileToken),
                secretKey: securityConfig.turnstileSecretKey,
                remoteIp
            })

            if (!result.success) {
                return NextResponse.json({ error: '人机验证失败，请重试' }, { status: 400 })
            }
        }
    }

    // --- URL 格式验证 ---
    try {
        const urlObject = new URL(url)
        if (!['http:', 'https:'].includes(urlObject.protocol)) {
            return NextResponse.json({
                error: 'URL 协议无效，仅支持 HTTP 和 HTTPS'
            }, { status: 400 })
        }
    } catch {
        return NextResponse.json({
            error: 'URL 格式无效，请输入以 http:// 或 https:// 开头的有效地址'
        }, { status: 400 })
    }

    // --- Slug 验证（格式 + 黑名单）---
    if (slug) {
        const slugValidation = await validateSlug(slug)
        if (!slugValidation.valid) {
            return NextResponse.json({
                error: slugValidation.errorCode || slugValidation.error
            }, { status: 400 })
        }
    }

    // --- Safe Browsing + 可访问性检查 ---
    const validationResult = await validateUrl(url, { logPrefix: '[API/shorten]' })

    if (!validationResult.valid) {
        return NextResponse.json({
            error: validationResult.errorCode || validationResult.error,
            threats: validationResult.threats,
            statusCode: validationResult.statusCode
        }, { status: 400 })
    }

    // 使用统一的设置获取函数
    const linksConfig = await getLinksConfig()
    const finalSlug = slug || nanoid(linksConfig.slugLength)

    // 计算过期时间
    let finalExpiresAt = null

    if (expiresAt) {
        finalExpiresAt = expiresAt
    } else if (linksConfig.defaultExpiration > 0) {
        const date = new Date()
        date.setMinutes(date.getMinutes() + linksConfig.defaultExpiration)
        finalExpiresAt = date.toISOString()
    }

    // 使用统一的密码处理
    const passwordResult = await processLinkPassword(passwordType || 'none', password || '')
    if (passwordResult.error) {
        return NextResponse.json({ error: passwordResult.error }, { status: 400 })
    }

    // 插入数据
    const { data, error } = await supabase
        .from('links')
        .insert([{
            original_url: url,
            slug: finalSlug,
            user_id: user?.id ?? null,
            user_email: user?.email ?? null,
            expires_at: finalExpiresAt,
            password_type: passwordType || 'none',
            password_hash: passwordResult.hash
        }])
        .select()
        .single()

    if (error) {
        // 如果由于 slug 重复导致唯一性约束错误
        if (error.code === '23505') {
            return NextResponse.json({ error: '该自定义后缀已被使用' }, { status: 409 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ slug: data.slug, original_url: data.original_url })
}
