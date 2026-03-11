'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { nanoid } from "nanoid"
import { getFriendlyErrorMessage } from "@/utils/error-mapping"
import { headers } from "next/headers"

import { requireAuth, checkPublicAccess } from "@/utils/auth"
import { processLinkPassword } from "@/lib/password"
import { getSiteConfig, getLinksConfig, getSecurityConfig } from "@/lib/site-config"
import { validateUrl, validateSlug } from "@/lib/url-validation"
import { verifyTurnstileToken } from "@/lib/turnstile"

// 简单的 URL 格式校验
function isValidUrlFormat(url: string): boolean {
    try {
        const parsed = new URL(url)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
    } catch {
        return false
    }
}

// 1. 创建短链接的 Action
export async function createLink(formData: FormData) {
    const supabase = await createClient()

    // 使用统一的认证检查
    const siteConfig = await getSiteConfig()
    const authResult = await checkPublicAccess(supabase, siteConfig.allowPublicShorten)
    if (authResult.error) {
        return { error: authResult.error, needsLogin: authResult.needsLogin }
    }
    const user = authResult.user

    const url = formData.get('url') as string
    const customSlug = formData.get('slug') as string
    const isNoIndex = formData.get('isNoIndex') === 'true'

    // 使用统一的设置获取函数
    const linksConfig = await getLinksConfig()
    const slug = customSlug || nanoid(linksConfig.slugLength)

    // --- 格式检查 ---
    if (!url || !isValidUrlFormat(url)) {
        return { error: "请输入以 http:// 或 https:// 开头的有效网址" }
    }

    // --- 防递归检查 (禁止缩短本站链接) ---
    const headersList = await headers()
    const host = headersList.get("host") // 获取当前域名 (如 localhost:3000)
    if (host && url.includes(host)) {
        return { error: "不能缩短本站的链接" }
    }

    if (!user) {
        const securityConfig = await getSecurityConfig()
        const requiresTurnstile = securityConfig.turnstileEnabled && securityConfig.turnstileAnonymousShortenEnabled

        if (requiresTurnstile) {
            if (!securityConfig.turnstileSecretKey?.trim()) {
                return { error: "Turnstile 配置不完整" }
            }

            const token = formData.get('turnstileToken')
            if (!token) {
                return { error: "请先完成人机验证" }
            }

            const forwardedFor = headersList.get('x-forwarded-for')
            const remoteIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() : null
            const result = await verifyTurnstileToken({
                token: String(token),
                secretKey: securityConfig.turnstileSecretKey,
                remoteIp
            })

            if (!result.success) {
                return { error: "人机验证失败，请重试" }
            }
        }
    }

    // --- Slug 验证（格式 + 黑名单）---
    if (customSlug) {
        const slugValidation = await validateSlug(customSlug)
        if (!slugValidation.valid) {
            return { error: slugValidation.errorCode || slugValidation.error }
        }
    }

    // --- 黑名单/安全检查 (简易版) ---
    const blackList = ['malware.com', 'phishing.site']
    if (blackList.some(domain => url.includes(domain))) {
        return { error: "该链接因安全原因被禁止" }
    }


    // --- Safe Browsing + 可用性检查 ---
    const validationResult = await validateUrl(url, { logPrefix: '[createLink]' })

    if (!validationResult.valid) {
        return {
            error: validationResult.errorCode || validationResult.error || "验证失败",
            threats: validationResult.threats,
            statusCode: validationResult.statusCode
        }
    }

    const { error } = await supabase
        .from('links')
        .insert({
            original_url: url,
            slug: slug,
            user_id: user?.id ?? null,
            user_email: user?.email ?? null,
            is_no_index: isNoIndex,
            expires_at: formData.get('expiresAt') as string || null,
            password_type: formData.get('passwordType') as string || 'none',
            password_hash: await (async () => {
                const passwordType = formData.get('passwordType') as string
                const password = formData.get('password') as string
                const result = await processLinkPassword(passwordType, password)
                return result.hash
            })()
        })

    if (error) {
        console.error(error)
        return { error: getFriendlyErrorMessage(error) }
    }

    revalidatePath('/dashboard')
    return { success: true }
}

// 4. 获取链接设置 Action
export async function getLinkSettings() {
    const supabase = await createClient()

    // 使用统一的认证检查
    const authResult = await requireAuth(supabase)
    if (authResult.error) {
        return { error: authResult.error }
    }

    // 使用统一的设置获取
    const linksConfig = await getLinksConfig()

    return {
        enableClickStats: linksConfig.enableClickStats
    }
}

// 2. 登出的 Action
export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    return redirect('/login')
}

// 3. 删除链接 Action
export async function deleteLink(id: number) {
    const supabase = await createClient()

    // 使用统一的认证检查
    const authResult = await requireAuth(supabase)
    if (authResult.error) {
        return { error: authResult.error, needsLogin: authResult.needsLogin }
    }

    const { error } = await supabase
        .from('links')
        .delete()
        .eq('id', id)
        .eq('user_id', authResult.user!.id)

    if (error) {
        return { error: getFriendlyErrorMessage(error) }
    }

    revalidatePath('/dashboard')
    return { success: true }
}

// 5. 更新链接密码 Action
export async function updateLinkPassword(
    linkId: number,
    passwordType: 'none' | 'six_digit' | 'custom',
    password: string
) {
    const supabase = await createClient()

    // 使用统一的认证检查
    const authResult = await requireAuth(supabase)
    if (authResult.error) {
        return { error: authResult.error, needsLogin: authResult.needsLogin }
    }

    // 使用统一的密码处理
    const passwordResult = await processLinkPassword(passwordType, password)
    if (passwordResult.error) {
        return { error: passwordResult.error }
    }

    const { error } = await supabase
        .from('links')
        .update({
            password_type: passwordType,
            password_hash: passwordResult.hash
        })
        .eq('id', linkId)
        .eq('user_id', authResult.user!.id)

    if (error) {
        return { error: getFriendlyErrorMessage(error) }
    }

    revalidatePath('/dashboard')
    return { success: true }
}
