import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, mocks = {}) {
    const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const exports = {}
    vm.runInNewContext(source, { exports, require: name => mocks[name] || require(name), Buffer, Date, URL, process, console })
    return exports
}
const policy = load('src/lib/access-policy.ts')
const tickets = load('src/lib/access-ticket.ts')

test('access policy defaults and strict input limits', () => {
    assert.equal(JSON.stringify(policy.parseAccessPolicy(null)), JSON.stringify(policy.defaultAccessPolicy))
    for (const value of [{ waitSeconds: -1 }, { waitSeconds: 301 }, { waitSeconds: 1.5 }, { waitSeconds: '5' }, { requireCaptcha: 'true' }, { revealText: 'x'.repeat(2001) }, []]) assert.throws(() => policy.parseAccessPolicy(value))
    assert.equal(policy.parseAccessPolicy({ waitSeconds: 300, revealText: ' hello ' }).revealText, 'hello')
    assert.equal(policy.hasAccessProtection({ requireCaptcha: true }), true)
})

test('wait tickets reject tampering, wrong link, changed configuration and expiry', () => {
    const fingerprint = tickets.accessFingerprint({ slug: 'sample', password_hash: 'hash', access_policy: { waitSeconds: 10 } }, '127.0.0.1')
    const ticket = tickets.signAccessTicket(fingerprint, 20000, 'secret', 10000)
    assert.equal(tickets.readAccessTicket(ticket, fingerprint, 'secret', 15000).readyAt, 20000)
    assert.equal(tickets.readAccessTicket(`X${ticket}`, fingerprint, 'secret', 15000), null)
    assert.equal(tickets.readAccessTicket(ticket, 'another-link', 'secret', 15000), null)
    assert.equal(tickets.readAccessTicket(ticket, fingerprint, 'different-secret', 15000), null)
    assert.equal(tickets.readAccessTicket(ticket, fingerprint, 'secret', 910000), null)
    assert.notEqual(fingerprint, tickets.accessFingerprint({ slug: 'sample', password_hash: 'new-hash', access_policy: { waitSeconds: 10 } }, '127.0.0.1'))
})

test('legacy links redirect while expiration, passwords and access policies remain enforced', async () => {
    let link = { id: 1, original_url: 'https://example.test/legacy', password_type: 'none', expires_at: null }
    let databaseError = null
    let clicks = 0
    const supabase = {
        from: () => {
            const query = {
                select: columns => {
                    // An old schema rejects explicit access_policy projections.
                    assert.equal(columns, '*')
                    return query
                },
                eq: () => query,
                single: async () => ({ data: databaseError ? null : link, error: databaseError })
            }
            return query
        },
        rpc: async () => { clicks++; return { error: null } }
    }
    const { GET } = load('src/app/[slug]/route.ts', {
        'next/server': { NextResponse: {
            redirect: (url, options) => ({ location: String(url), status: options?.status || 307, headers: new Map() }),
            json: (body, options) => ({ body, status: options.status })
        } },
        '@/lib/supabase': { createPublicSupabaseClient: () => supabase },
        '@/lib/access-policy': policy
    })
    const get = () => GET({ url: 'https://short.test/legacy' }, { params: Promise.resolve({ slug: 'legacy' }) })
    const legacy = await get()
    assert.equal(legacy.location, link.original_url)
    assert.equal(legacy.status, 302)
    assert.match(legacy.headers.get('Cache-Control'), /no-store/)
    assert.equal(clicks, 1)
    link.password_type = 'custom'
    assert.equal((await get()).location, 'https://short.test/legacy/verify')
    link.password_type = 'none'
    link.access_policy = { requireCaptcha: true, waitSeconds: 0, revealText: '' }
    assert.equal((await get()).location, 'https://short.test/legacy/verify')
    link.expires_at = '2000-01-01T00:00:00Z'
    assert.equal((await get()).location, 'https://short.test/link-expired')
    assert.equal(clicks, 1)
    databaseError = { code: '42501', message: 'permission denied' }
    assert.equal((await get()).status, 503)
    databaseError = { code: 'PGRST116' }
    assert.equal((await get()).location, 'https://short.test/link-not-found')
})

test('legacy password links still require a valid password without access_policy', async () => {
    const link = { id: 1, original_url: 'https://example.test/legacy', password_type: 'custom', password_hash: 'hash' }
    let clicks = 0
    let databaseError = null
    const supabase = {
        from: name => {
            const query = {
                select: columns => {
                    if (name === 'links') assert.equal(columns, '*')
                    return query
                },
                eq: () => query,
                single: async () => ({ data: databaseError ? null : link, error: databaseError }),
                gte: async () => ({ count: 0 }),
                insert: async () => ({ error: null })
            }
            return query
        },
        rpc: async () => { clicks++; return { error: null } }
    }
    const { POST } = load('src/app/api/verify-password/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options.status, cookies: { set() {} } }) } },
        '@/lib/supabase': { createPublicSupabaseClient: () => supabase },
        '@/lib/access-policy': policy,
        '@/lib/access-ticket': tickets,
        '@/lib/site-config': { getSecurityConfig: async () => { throw new Error('Legacy link needs no captcha') } },
        '@/lib/turnstile': { verifyTurnstileToken: async () => { throw new Error('Legacy link needs no captcha') } },
        bcryptjs: { compare: async password => password === 'password' }
    })
    const request = password => ({ json: async () => ({ slug: 'legacy', password }), headers: { get: () => null }, cookies: { get: () => undefined } })
    assert.equal((await POST(request())).status, 400)
    const wrong = await POST(request('wrong'))
    assert.equal(wrong.status, 401)
    assert.equal(wrong.body.url, undefined)
    assert.equal(clicks, 0)
    const valid = await POST(request('password'))
    assert.equal(valid.body.url, link.original_url)
    assert.equal(clicks, 1)
    databaseError = { code: '42501', message: 'permission denied' }
    assert.equal((await POST(request('password'))).status, 503)
    assert.equal(clicks, 1)
})

test('protected API displays waiting content after verification but withholds URL until wait finishes', async () => {
    const previousSecret = process.env.LINK_ACCESS_SECRET
    process.env.LINK_ACCESS_SECRET = 'test-secret'
    try {
        const link = { id: 1, original_url: 'https://example.test/private', password_type: 'custom', password_hash: 'hash', access_policy: { requireCaptcha: true, waitSeconds: 10, revealText: 'private text' } }
        let clicks = 0
        const supabase = { from: name => {
            const query = { select: () => query, eq: () => query, gte: async () => ({ count: 0 }), single: async () => ({ data: link }), insert: async () => ({ error: null }) }
            assert.ok(['links', 'password_attempts'].includes(name))
            return query
        }, rpc: async () => { clicks++; return { error: null } } }
        const { POST } = load('src/app/api/verify-password/route.ts', {
            'next/server': { NextResponse: { json: (body, options) => ({ body, status: options.status, cookies: { set(name, value) { this.ticket = { name, value } }, delete() {} } }) } },
            '@/lib/supabase': { createPublicSupabaseClient: () => supabase },
            '@/lib/access-policy': policy,
            '@/lib/access-ticket': tickets,
            '@/lib/site-config': { getSecurityConfig: async () => ({ turnstileEnabled: true, turnstileSiteKey: 'site', turnstileSecretKey: 'secret' }) },
            '@/lib/turnstile': { verifyTurnstileToken: async ({ token }) => ({ success: token === 'valid' }) },
            bcryptjs: { compare: async password => password === 'password' }
        })
        const request = (body, cookie) => ({ json: async () => ({ slug: 'sample', ...body }), headers: { get: () => null }, cookies: { get: () => cookie ? { value: cookie } : undefined }, nextUrl: { protocol: 'http:' } })
        const missingCaptcha = await POST(request({ password: 'password' }))
        assert.equal(missingCaptcha.status, 400)
        assert.equal(missingCaptcha.body.revealText, undefined)
        const wrongPassword = await POST(request({ password: 'wrong', turnstileToken: 'valid' }))
        assert.equal(wrongPassword.status, 401)
        assert.equal(wrongPassword.body.revealText, undefined)
        assert.equal((await POST(request({ stage: 'continue' }))).status, 401)
        const first = await POST(request({ password: 'password', turnstileToken: 'valid' }))
        assert.equal(first.body.waiting, true)
        assert.equal(first.body.url, undefined)
        assert.equal(first.body.revealText, 'private text')
        const early = await POST(request({ stage: 'continue' }, first.cookies.ticket.value))
        assert.equal(early.body.waiting, true)
        assert.equal(early.body.url, undefined)
        const fingerprint = tickets.accessFingerprint({ ...link, slug: 'sample' }, 'unknown')
        const readyCookie = tickets.signAccessTicket(fingerprint, Date.now() - 1, 'test-secret')
        const reveal = await POST(request({ stage: 'reveal' }, readyCookie))
        assert.equal(reveal.body.revealText, 'private text')
        assert.equal(reveal.body.url, undefined)
        assert.equal(clicks, 0)
        const finish = await POST(request({ stage: 'continue' }, readyCookie))
        assert.equal(finish.body.url, link.original_url)
        assert.equal(clicks, 1)
        link.access_policy.waitSeconds = 30
        assert.equal((await POST(request({ stage: 'continue' }, readyCookie))).status, 401)
    } finally {
        if (previousSecret === undefined) delete process.env.LINK_ACCESS_SECRET
        else process.env.LINK_ACCESS_SECRET = previousSecret
    }
})
