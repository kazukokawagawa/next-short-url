import type { AccessPolicy } from '@/lib/access-policy'

export type PasswordType = 'none' | 'six_digit' | 'custom'

export function validateLinkPassword(type: PasswordType, value: string): string | undefined {
    if (type === 'six_digit' && !/^\d{6}$/.test(value)) return '请输入完整的 6 位数字密码'
    if (type === 'custom' && (!value || value.length > 128)) return '口令长度须为 1–128 位'
}

export interface LinkSummary {
    id: number
    slug: string
    original_url: string
    created_at: string
    expires_at?: string | null
    clicks: number
    user_id?: string | null
    user_email?: string | null
    access_policy?: AccessPolicy | null
    password_type?: string | null
}

export function buildShortUrl(slug: string, origin?: string): string {
    const configured = process.env.NEXT_PUBLIC_BASE_URL || origin || 'https://short.link'
    const base = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
    return new URL(encodeURIComponent(slug), `${base.replace(/\/+$/, '')}/`).href
}

export function canEditLinkPassword(link: LinkSummary, viewerId?: string): boolean {
    return Boolean(viewerId && link.user_id === viewerId)
}
