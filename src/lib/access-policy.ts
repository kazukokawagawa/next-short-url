export interface AccessPolicy {
    requireCaptcha: boolean
    waitSeconds: number
    revealText: string
}

export const defaultAccessPolicy: AccessPolicy = { requireCaptcha: false, waitSeconds: 0, revealText: '' }

export function parseAccessPolicy(value: unknown): AccessPolicy {
    if (value === undefined || value === null) return { ...defaultAccessPolicy }
    if (typeof value !== 'object' || Array.isArray(value)) throw new Error('访问保护设置无效')
    const input = value as Record<string, unknown>
    const requireCaptcha = input.requireCaptcha ?? false
    const waitSeconds = input.waitSeconds ?? 0
    const revealText = input.revealText ?? ''
    if (typeof requireCaptcha !== 'boolean') throw new Error('人机验证设置无效')
    if (typeof waitSeconds !== 'number' || !Number.isInteger(waitSeconds) || waitSeconds < 0 || waitSeconds > 300) throw new Error('等待时间须为 0–300 秒的整数')
    if (typeof revealText !== 'string' || revealText.length > 2000) throw new Error('展示内容不能超过 2000 字')
    return { requireCaptcha, waitSeconds, revealText: revealText.trim() }
}

export function hasAccessProtection(policy?: AccessPolicy | null): boolean {
    return Boolean(policy && (policy.requireCaptcha || policy.waitSeconds || policy.revealText))
}
