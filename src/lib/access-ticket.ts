import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export function accessCookieName(slug: string): string {
    return `link_access_${createHash('sha256').update(slug).digest('hex').slice(0, 20)}`
}

export function accessFingerprint(link: { slug: string; password_hash?: string | null; access_policy?: unknown }, ip: string): string {
    return createHash('sha256').update(JSON.stringify([link.slug, link.password_hash, link.access_policy, ip])).digest('hex')
}

export function signAccessTicket(fingerprint: string, readyAt: number, secret: string, now = Date.now()): string {
    const payload = Buffer.from(JSON.stringify({ fingerprint, readyAt, expiresAt: now + 900000 })).toString('base64url')
    return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
}

export function readAccessTicket(value: string | undefined, fingerprint: string, secret: string, now = Date.now()): { readyAt: number } | null {
    if (!value || value.length > 1000) return null
    try {
        const [payload, signature, extra] = value.split('.')
        if (!payload || !signature || extra) return null
        const expected = createHmac('sha256', secret).update(payload).digest()
        const actual = Buffer.from(signature, 'base64url')
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
        const ticket = JSON.parse(Buffer.from(payload, 'base64url').toString())
        if (ticket.fingerprint !== fingerprint || !Number.isFinite(ticket.readyAt) || !Number.isFinite(ticket.expiresAt) || ticket.expiresAt <= now) return null
        return { readyAt: ticket.readyAt }
    } catch { return null }
}
