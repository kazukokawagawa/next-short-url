/**
 * 统一的设置类型定义
 * 将分散在各处的 interface 整合到一个文件中
 */

// 站点设置
export interface SiteSettings {
    name: string
    subtitle: string
    description: string
    keywords: string
    authorName: string
    authorUrl: string
    allowPublicShorten: boolean
    openRegistration: boolean
}

// 链接设置
export interface LinksSettings {
    slugLength: number
    enableClickStats: boolean
    defaultExpiration?: number
}

// 外观设置
export interface AppearanceSettings {
    primaryColor: string
    themeMode: 'light' | 'dark' | 'system'
    toastPosition: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'
}

// 数据管理设置
export interface DataSettings {
    autoCleanExpired: boolean
    expiredDays: number
}

// 维护模式设置
export interface MaintenanceSettings {
    enabled: boolean
    message: string
}

// 安全设置
export interface SecuritySettings {
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

// 公告设置
export interface AnnouncementConfig {
    enabled: boolean
    content: string
    type: "default" | "destructive" | "outline" | "secondary"
    duration?: number
}

// 所有设置的聚合类型
export interface AllSettings {
    site: SiteSettings
    links: LinksSettings
    appearance: AppearanceSettings
    data: DataSettings
    maintenance: MaintenanceSettings
    security: SecuritySettings
    announcement: AnnouncementConfig
}

// 默认值
export const defaultSiteSettings: SiteSettings = {
    name: "LinkFlow",
    subtitle: "下一代短链接生成器",
    description: "让链接更短，让分享更简单",
    keywords: "短链接,URL Shortener,Link Management,Next.js",
    authorName: "池鱼",
    authorUrl: "https://chiyu.it",
    allowPublicShorten: true,
    openRegistration: true
}

export const defaultLinksSettings: LinksSettings = {
    slugLength: 6,
    enableClickStats: true,
    defaultExpiration: 0
}

export const defaultAppearanceSettings: AppearanceSettings = {
    primaryColor: "#1a1a1f",
    themeMode: "system",
    toastPosition: "bottom-right"
}

export const defaultDataSettings: DataSettings = {
    autoCleanExpired: false,
    expiredDays: 30
}

export const defaultMaintenanceSettings: MaintenanceSettings = {
    enabled: false,
    message: ""
}

export const defaultSecuritySettings: SecuritySettings = {
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

export const defaultAnnouncementConfig: AnnouncementConfig = {
    enabled: false,
    content: "",
    type: "default",
    duration: 5000
}
