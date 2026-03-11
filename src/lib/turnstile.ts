'use server'

export async function verifyTurnstileToken(input: {
    token: string
    secretKey: string
    remoteIp?: string | null
}): Promise<{ success: boolean }> {
    if (!input.secretKey?.trim()) {
        return { success: false }
    }

    const body = new URLSearchParams({
        secret: input.secretKey,
        response: input.token
    })

    if (input.remoteIp) {
        body.set('remoteip', input.remoteIp)
    }

    try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        })

        if (!res.ok) {
            return { success: false }
        }

        const data = await res.json() as { success?: boolean }
        return { success: Boolean(data.success) }
    } catch {
        return { success: false }
    }
}

