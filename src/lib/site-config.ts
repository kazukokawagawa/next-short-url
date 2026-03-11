'use server'

import { createClient } from "@/utils/supabase/server"

// 站点设置类型
export interface SiteConfig {
    name: string
    subtitle: string
    description: string
    keywords: string
    authorName: string
    authorUrl: string
    allowPublicShorten: boolean
    openRegistration: boolean
}

// 默认设置（用于数据库未配置时）
const defaultSiteConfig: SiteConfig = {
    name: "LinkFlow",
    subtitle: "下一代短链接生成器",
    description: "让链接更短，让分享更简单",
    keywords: "短链接,URL Shortener,Link Management,Next.js",
    authorName: "池鱼",
    authorUrl: "https://chiyu.it",
    allowPublicShorten: true,
    openRegistration: true
}

// 获取站点配置（用于服务端组件和 Server Actions）
export async function getSiteConfig(): Promise<SiteConfig> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'site')
            .single()

        if (error || !data) {
            return defaultSiteConfig
        }

        return {
            ...defaultSiteConfig,
            ...data.value
        }
    } catch {
        return defaultSiteConfig
    }
}

// 别名，保持兼容性
export const getCachedSiteConfig = getSiteConfig

// 外观设置类型
export interface AppearanceConfig {
    primaryColor: string
    themeMode: 'light' | 'dark' | 'system'
    toastPosition: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'
}

// 默认外观设置
const defaultAppearanceConfig: AppearanceConfig = {
    primaryColor: "#1a1a1f",
    themeMode: "system",
    toastPosition: "bottom-right"
}

// 获取外观配置（用于服务端组件）
export async function getAppearanceConfig(): Promise<AppearanceConfig> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'appearance')
            .single()

        if (error || !data) {
            return defaultAppearanceConfig
        }

        return {
            ...defaultAppearanceConfig,
            ...data.value
        }
    } catch {
        return defaultAppearanceConfig
    }
}

// 链接设置类型
export interface LinksConfig {
    slugLength: number
    enableClickStats: boolean
    defaultExpiration: number
}

// 默认链接设置
const defaultLinksConfig: LinksConfig = {
    slugLength: 6,
    enableClickStats: true,
    defaultExpiration: 0
}

// 获取链接配置
export async function getLinksConfig(): Promise<LinksConfig> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'links')
            .single()

        if (error || !data) {
            return defaultLinksConfig
        }

        return {
            ...defaultLinksConfig,
            slugLength: Number(data.value?.slugLength) || defaultLinksConfig.slugLength,
            enableClickStats: data.value?.enableClickStats ?? defaultLinksConfig.enableClickStats,
            defaultExpiration: Number(data.value?.defaultExpiration) || defaultLinksConfig.defaultExpiration
        }
    } catch {
        return defaultLinksConfig
    }
}


// 公告设置类型
export interface AnnouncementConfig {
    enabled: boolean
    content: string
    type: "default" | "destructive" | "outline" | "secondary"
    duration?: number // duration in milliseconds, defaults to 5000 if undefined
}

// 默认公告设置
const defaultAnnouncementConfig: AnnouncementConfig = {
    enabled: false,
    content: "",
    type: "default",
    duration: 5000
}

// 获取公告配置
export async function getAnnouncementConfig(): Promise<AnnouncementConfig> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'announcement')
            .single()

        if (error || !data) {
            return defaultAnnouncementConfig
        }

        return {
            ...defaultAnnouncementConfig,
            ...data.value
        }
    } catch {
        return defaultAnnouncementConfig
    }
}
// Maintenance Configuration
export interface MaintenanceConfig {
    enabled: boolean
    message: string
}

const defaultMaintenanceConfig: MaintenanceConfig = {
    enabled: false,
    message: ""
}

export async function getMaintenanceConfig(): Promise<MaintenanceConfig> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'maintenance')
            .single()

        if (error || !data) {
            return defaultMaintenanceConfig
        }

        return {
            ...defaultMaintenanceConfig,
            ...data.value
        }
    } catch {
        return defaultMaintenanceConfig
    }
}

// Security Configuration
export interface SecurityConfig {
    turnstileEnabled: boolean
    turnstileSiteKey: string
    turnstileSecretKey: string
    turnstileAnonymousShortenEnabled: boolean
    safeBrowsingEnabled: boolean
    safeBrowsingApiKey: string
    blacklistSuffix: string
    blacklistDomain: string
    blacklistSlug: string
    skipAllChecks: boolean
}

const defaultSecurityConfig: SecurityConfig = {
    turnstileEnabled: false,
    turnstileSiteKey: "",
    turnstileSecretKey: "",
    turnstileAnonymousShortenEnabled: false,
    safeBrowsingEnabled: false,
    safeBrowsingApiKey: "",
    blacklistSuffix: "",
    blacklistDomain: "",
    blacklistSlug: "",
    skipAllChecks: false
}

export async function getSecurityConfig(): Promise<SecurityConfig> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'security')
            .single()

        if (error || !data) {
            return defaultSecurityConfig
        }

        return {
            ...defaultSecurityConfig,
            ...data.value
        }
    } catch {
        return defaultSecurityConfig
    }
}
