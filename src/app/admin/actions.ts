'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { getFriendlyErrorMessage } from "@/utils/error-mapping"
import { requireAuth } from "@/utils/auth"

// 从统一类型文件导入
import {
    SiteSettings,
    LinksSettings,
    AppearanceSettings,
    DataSettings,
    MaintenanceSettings,
    SecuritySettings,
    AnnouncementConfig,
    AllSettings,
    defaultSiteSettings,
    defaultLinksSettings,
    defaultAppearanceSettings,
    defaultDataSettings,
    defaultMaintenanceSettings,
    defaultSecuritySettings,
    defaultAnnouncementConfig
} from "@/types/settings"

// 重新导出类型供其他模块使用
export type {
    SiteSettings,
    LinksSettings,
    AppearanceSettings,
    DataSettings,
    MaintenanceSettings,
    SecuritySettings,
    AnnouncementConfig,
    AllSettings
}

// 管理员删除链接 Action (不限制 user_id)
export async function adminDeleteLink(id: number) {
    const supabase = await createClient()

    // 使用统一的认证检查
    const authResult = await requireAuth(supabase)
    if (authResult.error) {
        return { error: authResult.error, needsLogin: authResult.needsLogin }
    }

    // 验证管理员权限
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authResult.user!.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: "无权限：需要管理员身份" }
    }

    // 执行删除 (不检查 user_id，管理员可以删除任何链接)
    const { error } = await supabase
        .from('links')
        .delete()
        .eq('id', id)

    if (error) {
        return { error: getFriendlyErrorMessage(error) }
    }

    revalidatePath('/admin/links')
    return { success: true }
}

// 获取所有设置
export async function getSettings(): Promise<{ data?: AllSettings, error?: string, needsLogin?: boolean }> {
    const supabase = await createClient()

    // 使用统一的认证检查
    const authResult = await requireAuth(supabase)
    if (authResult.error) {
        return { error: authResult.error, needsLogin: authResult.needsLogin }
    }

    // 验证管理员权限
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authResult.user!.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: "无权限：需要管理员身份" }
    }

    // 读取所有设置
    const { data: settings, error } = await supabase
        .from('settings')
        .select('key, value')

    if (error) {
        return { error: getFriendlyErrorMessage(error) }
    }

    // 转换为对象格式
    const settingsMap: Record<string, unknown> = {}
    settings?.forEach(item => {
        settingsMap[item.key] = item.value
    })

    // 返回设置，使用统一的默认值
    return {
        data: {
            site: (settingsMap.site as SiteSettings) || defaultSiteSettings,
            links: (settingsMap.links as LinksSettings) || defaultLinksSettings,
            appearance: (settingsMap.appearance as AppearanceSettings) || defaultAppearanceSettings,
            data: (settingsMap.data as DataSettings) || defaultDataSettings,
            maintenance: (settingsMap.maintenance as MaintenanceSettings) || defaultMaintenanceSettings,
            security: (settingsMap.security as SecuritySettings) || defaultSecuritySettings,
            announcement: (settingsMap.announcement as AnnouncementConfig) || defaultAnnouncementConfig
        }
    }
}

// 保存所有设置
export async function saveSettings(settings: AllSettings): Promise<{ success?: boolean, error?: string, needsLogin?: boolean }> {
    const supabase = await createClient()

    // 使用统一的认证检查
    const authResult = await requireAuth(supabase)
    if (authResult.error) {
        return { error: authResult.error, needsLogin: authResult.needsLogin }
    }

    // 验证管理员权限
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authResult.user!.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: "无权限：需要管理员身份" }
    }

    // 逐个更新设置
    const updates = [
        { key: 'site', value: settings.site },
        { key: 'links', value: settings.links },
        { key: 'appearance', value: settings.appearance },
        { key: 'data', value: settings.data },
        { key: 'maintenance', value: settings.maintenance },
        { key: 'security', value: settings.security },
        { key: 'announcement', value: settings.announcement }
    ]

    for (const update of updates) {
        const { error } = await supabase
            .from('settings')
            .upsert(
                { key: update.key, value: update.value, updated_at: new Date().toISOString() },
                { onConflict: 'key' }
            )

        if (error) {
            return { error: getFriendlyErrorMessage(error) }
        }
    }

    revalidatePath('/admin/settings')
    return { success: true }
}

// 公开获取安全设置（不需要登录，不暴露 Secret Key）
export async function getPublicSecuritySettings(): Promise<{ enabled: boolean, siteKey: string, anonymousShortenEnabled: boolean }> {
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')

    // 使用 service role key 读取设置（因为登录页面没有用户）
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return { enabled: false, siteKey: '', anonymousShortenEnabled: false }
    }

    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    const { data: securitySetting, error } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'security')
        .single()

    if (error) {
        console.log('[getPublicSecuritySettings] Error:', error.message)
    }

    if (!securitySetting?.value) {
        return { enabled: false, siteKey: '', anonymousShortenEnabled: false }
    }

    const security = securitySetting.value as SecuritySettings
    const result = {
        enabled: security.turnstileEnabled,
        siteKey: security.turnstileSiteKey,
        anonymousShortenEnabled: security.turnstileEnabled && (security.turnstileAnonymousShortenEnabled ?? false)
    }
    return result
}

// 清理已过期链接
export async function cleanExpiredLinks() {
    const supabase = await createClient()

    // 使用统一的认证检查
    const authResult = await requireAuth(supabase)
    if (authResult.error) {
        return { error: authResult.error, needsLogin: authResult.needsLogin }
    }

    // 验证管理员权限
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authResult.user!.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: "无权限：需要管理员身份" }
    }

    // 执行清理
    const now = new Date().toISOString()
    const { error, count } = await supabase
        .from('links')
        .delete({ count: 'exact' })
        .not('expires_at', 'is', null) // expires_at is not null
        .lt('expires_at', now)         // expires_at < now

    if (error) {
        console.error('Error cleaning expired links:', error)
        return { error: getFriendlyErrorMessage(error) }
    }

    revalidatePath('/admin/settings')
    return { success: true, count }
}
