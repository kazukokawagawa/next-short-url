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
    vm.runInNewContext(source, { exports, require: name => mocks[name] || require(name), Buffer, Date, process, console })
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
