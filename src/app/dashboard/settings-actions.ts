'use server'

import { createClient } from "@/utils/supabase/server"
import { hasSupabaseConfig, SUPABASE_CONFIG_ERROR } from '@/lib/supabase-config'

/**
 * 获取链接设置（可公开调用，用于客户端获取 slugLength）
 */
export async function getLinksSettings() {
    if (!hasSupabaseConfig()) {
        return { slugLength: 6, enableClickStats: true, defaultExpiration: 0, error: SUPABASE_CONFIG_ERROR }
    }
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'links')
        .single()

    if (error && error.code !== 'PGRST116') {
        return {
            slugLength: 6,
            enableClickStats: true,
            defaultExpiration: 0,
            error: '无法读取 Supabase 链接配置，请检查环境变量、网络和 settings 表权限。'
        }
    }

    if (!data) {
        return {
            slugLength: 6,
            enableClickStats: true,
            defaultExpiration: 0
        }
    }

    return {
        slugLength: data.value?.slugLength ?? 6,
        enableClickStats: data.value?.enableClickStats ?? true,
        defaultExpiration: data.value?.defaultExpiration ?? 0
    }
}

/**
 * 获取站点设置（包含 allowPublicShorten）
 */
export async function getSiteSettings() {
    if (!hasSupabaseConfig()) {
        return { allowPublicShorten: true, openRegistration: true, error: SUPABASE_CONFIG_ERROR }
    }
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'site')
        .single()

    if (error && error.code !== 'PGRST116') {
        return { allowPublicShorten: true, openRegistration: true, error: '无法读取 Supabase 站点配置，请检查环境变量、网络和 settings 表权限。' }
    }
    if (!data) {
        return { allowPublicShorten: true, openRegistration: true }
    }
    return {
        allowPublicShorten: data.value?.allowPublicShorten ?? true,
        openRegistration: data.value?.openRegistration ?? true
    }
}

/**
 * 获取外观设置（用于动态主题色）
 */
export async function getAppearanceSettings() {
    if (!hasSupabaseConfig()) {
        return { primaryColor: '#1a1a1f', themeMode: 'system' as const }
    }
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'appearance')
        .single()

    if (error || !data) {
        return {
            primaryColor: "#1a1a1f",
            themeMode: "system" as const
        }
    }

    return {
        primaryColor: data.value?.primaryColor ?? "#1a1a1f",
        themeMode: (data.value?.themeMode ?? "system") as "light" | "dark" | "system"
    }
}
