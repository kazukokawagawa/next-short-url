import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, mkdir, symlink, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const root = process.cwd()
const temp = await mkdtemp(path.join(tmpdir(), 'linkflow-browser-'))
const adminId = '00000000-0000-4000-8000-000000000001'
const targetId = '00000000-0000-4000-8000-000000000002'
const now = '2026-10-07T00:00:00.000Z'
const admin = { id: adminId, email: 'admin@example.test', role: 'admin', status: 'active', created_at: now, updated_at: now, last_seen_at: now, link_count: 0, display_name: null }
const target = { ...admin, id: targetId, email: 'very-long-address-for-mobile-layout-testing@example.test', role: 'user', link_count: 1 }
let failMutation = false
let targetDeleted = false
const audits = []
const mock = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Expose-Headers', 'content-range')
    if (req.method === 'OPTIONS') { res.end(); return }
    const send = value => res.end(JSON.stringify(value))
    if (url.pathname === '/auth/v1/user') return send({ ...admin, aud: 'authenticated', app_metadata: {}, user_metadata: {}, identities: [] })
    if (url.pathname === '/rest/v1/profiles') { if (req.method === 'HEAD') res.setHeader('Content-Range', '0-1/2'); return send(url.searchParams.get('id')?.includes(targetId) ? { ...target, display_name: null } : { ...admin, display_name: null }) }
    if (url.pathname === '/rest/v1/settings') return send({ value: {} })
    if (url.pathname === '/rest/v1/rpc/admin_list_users') {
        const chunks = []; for await (const c of req) chunks.push(c)
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
        const users = [admin, ...(targetDeleted ? [] : [target])].filter(user => (body.p_role === 'all' || body.p_role === user.role) && (body.p_status === 'all' || body.p_status === user.status) && user.email.includes(body.p_search || ''))
        return send({ users, total: users.length, page: body.p_page || 1, pageSize: 20 })
    }
    if (url.pathname === '/rest/v1/rpc/admin_delete_user') {
        const chunks = []; for await (const c of req) chunks.push(c)
        const body = JSON.parse(Buffer.concat(chunks).toString())
        assert.equal(body.p_confirmation, target.email)
        assert.equal(body.p_id, targetId)
        targetDeleted = true
        return send(null)
    }
    if (url.pathname === '/rest/v1/rpc/admin_update_user') {
        if (failMutation) { res.statusCode = 400; return send({ message: 'LAST_ADMIN', code: 'P0001' }) }
        const chunks = []; for await (const c of req) chunks.push(c)
        const body = JSON.parse(Buffer.concat(chunks).toString())
        const user = body.p_id === targetId ? target : admin
        const before = { role: user.role, status: user.status }
        user[body.p_field] = body.p_value
        user.updated_at = new Date().toISOString()
        audits.push({ id: audits.length + 1, actor_email: admin.email, action: `user.${body.p_field}`, before_value: before, after_value: { role: user.role, status: user.status }, reason: body.p_reason, created_at: now })
        return send(null)
    }
    if (url.pathname === '/rest/v1/links') {
        res.setHeader('Content-Range', '0-0/1')
        return send([{ id: 1, slug: 'sample-link', original_url: 'https://example.test/product', user_id: targetId, user_email: target.email, password_type: 'none', clicks: 5, created_at: now, expires_at: null }])
    }
    if (url.pathname === '/rest/v1/admin_audit_logs') { res.setHeader('Content-Range', `0-${Math.max(0, audits.length - 1)}/${audits.length}`); return send(audits) }
    send(null)
})
await new Promise(resolve => mock.listen(54329, '127.0.0.1', resolve))
for (const file of ['src', 'public', 'tsconfig.json', 'postcss.config.mjs']) await cp(path.join(root, file), path.join(temp, file), { recursive: true })
await writeFile(path.join(temp, 'package.json'), JSON.stringify({ private: true, dependencies: JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).dependencies }))
await writeFile(path.join(temp, 'next.config.mjs'), 'export default { devIndicators: false }')
await symlink(path.join(root, 'node_modules'), path.join(temp, 'node_modules'), 'junction')
const logs = []
const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '-p', '3101'], { cwd: temp, env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', NEXT_PUBLIC_BASE_URL: 'http://localhost:3101' }, stdio: ['ignore', 'pipe', 'pipe'] })
child.stdout.on('data', chunk => logs.push(chunk.toString()))
child.stderr.on('data', chunk => logs.push(chunk.toString()))
let browser
let currentPage
try {
    for (let attempt = 0; attempt < 90; attempt++) {
        if (logs.join('').includes('Ready in')) break
        await new Promise(resolve => setTimeout(resolve, 1000))
        if (attempt === 89) throw new Error(logs.join(''))
    }
    browser = await chromium.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: adminId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`
    const cookie = `base64-${Buffer.from(JSON.stringify({ access_token: jwt, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: admin })).toString('base64url')}`
    await context.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: 'localhost', path: '/' }])
    const page = await context.newPage()
    currentPage = page
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://localhost:3101/admin/users')
    await page.getByRole('heading', { name: '用户与权限' }).waitFor()
    await page.getByRole('link', { name: target.email, exact: true }).waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => Object.keys(button).some(key => key.startsWith('__reactProps$') && typeof button[key]?.onClick === 'function')))
    const screenshots = path.join(root, 'reports', 'user-permissions-screenshots')
    await mkdir(screenshots, { recursive: true })
    await page.screenshot({ path: path.join(screenshots, 'users-desktop.png'), fullPage: true })
    await page.getByRole('button', { name: `用户操作：${target.email}` }).click()
    await page.getByRole('menuitem', { name: '调整角色' }).click()
    await page.getByLabel('角色', { exact: true }).click()
    await page.getByRole('option', { name: '管理员' }).click()
    await page.getByLabel('操作原因').fill('浏览器回归测试')
    await page.getByRole('button', { name: '确认调整' }).click()
    await page.getByText('角色已更新', { exact: true }).waitFor()
    assert.equal(target.role, 'admin')
    await page.getByRole('link', { name: target.email, exact: true }).click()
    await page.getByRole('heading', { name: '用户详情' }).waitFor()
    await page.getByRole('tab', { name: /操作记录/ }).click()
    await page.getByText('浏览器回归测试', { exact: true }).waitFor()
    await page.screenshot({ path: path.join(screenshots, 'user-detail-desktop.png'), fullPage: true })
    await page.getByRole('button', { name: '禁用账号', exact: true }).click()
    await page.getByLabel('操作原因').fill('停用测试')
    await page.getByRole('button', { name: '确认禁用' }).click()
    await page.getByText('账号已禁用', { exact: true }).waitFor()
    assert.equal(target.status, 'disabled')
    await page.getByRole('button', { name: '启用账号', exact: true }).click()
    await page.getByLabel('操作原因').fill('恢复测试')
    await page.getByRole('button', { name: '确认启用' }).click()
    await page.getByText('账号已启用', { exact: true }).waitFor()
    assert.equal(target.status, 'active')
    failMutation = true
    await page.getByRole('button', { name: '调整角色', exact: true }).click()
    await page.getByLabel('角色', { exact: true }).click()
    await page.getByRole('option', { name: '普通用户' }).click()
    await page.getByLabel('操作原因').fill('错误反馈测试')
    await page.getByRole('button', { name: '确认调整' }).click()
    await page.getByRole('alert').filter({ hasText: '不能降权或禁用最后一个有效管理员' }).waitFor()
    await page.getByRole('button', { name: '取消', exact: true }).click()
    for (const width of [390, 768]) {
        await page.setViewportSize({ width, height: 844 })
        await page.screenshot({ path: path.join(screenshots, `user-detail-${width}.png`), fullPage: true })
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Detail page must not overflow')
        await page.getByRole('button', { name: '调整角色', exact: true }).click()
        await page.screenshot({ path: path.join(screenshots, `user-dialog-${width}.png`), fullPage: true })
        assert.ok(await page.evaluate(() => { const box = document.querySelector('[role="alertdialog"]').getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight }), 'Dialog must fit viewport')
        await page.getByRole('button', { name: '取消', exact: true }).click()
        await page.goto('http://localhost:3101/admin/users')
        await page.getByRole('heading', { name: '用户与权限' }).waitFor()
        await page.screenshot({ path: path.join(screenshots, `users-${width}.png`), fullPage: true })
        const listOverflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, classes: el.className, right: el.getBoundingClientRect().right })).slice(0, 20) }))
        assert.ok(listOverflow.scroll <= listOverflow.width, JSON.stringify(listOverflow))
        await page.getByRole('link', { name: target.email, exact: true }).click()
        await page.getByRole('heading', { name: '用户详情' }).waitFor()
    }
    await page.goto('http://localhost:3101/admin/users')
    await page.getByRole('heading', { name: '用户与权限' }).waitFor()
    await page.goto('http://localhost:3101/admin')
    await page.getByRole('heading', { name: '管理控制台' }).waitFor()
    await page.screenshot({ path: path.join(screenshots, 'admin-mobile.png'), fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Admin must fit mobile')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({ path: path.join(screenshots, 'admin-desktop.png'), fullPage: true })
    await page.getByRole('link', { name: /用户与权限/ }).click()
    await page.getByRole('heading', { name: '用户与权限' }).waitFor()
    await page.getByRole('button', { name: `用户操作：${target.email}` }).click()
    await page.getByRole('menuitem', { name: '删除账号' }).click()
    await page.getByLabel('确认账号').fill('incorrect')
    await page.getByLabel('操作原因').fill('删除回归测试')
    assert.ok(await page.getByRole('button', { name: '永久删除', exact: true }).isDisabled())
    await page.getByLabel('确认账号').fill(target.email)
    await page.getByRole('button', { name: '永久删除', exact: true }).click()
    await page.getByText('账号已删除，关联短链接已清理', { exact: true }).waitFor()
    assert.ok(targetDeleted)
    assert.equal(await page.locator('[data-sonner-toast] [data-close-button]').count(), 0)
    await page.getByRole('textbox', { name: '搜索邮箱、名称或用户 ID' }).fill('missing-user')
    await page.getByRole('button', { name: '搜索用户', exact: true }).click()
    await page.getByText('没有符合条件的用户', { exact: true }).waitFor()
    await page.goto('http://localhost:3101/login')
    await page.getByRole('heading', { name: '账户', exact: true }).waitFor()
    const selectedLogin = page.getByRole('group', { name: '账户模式' }).getByRole('button', { name: '登录', exact: true })
    await selectedLogin.waitFor()
    assert.equal(await selectedLogin.getAttribute('data-variant'), 'default')
    assert.equal(await selectedLogin.getAttribute('aria-pressed'), 'true')
    await page.screenshot({ path: path.join(screenshots, 'login-active.png'), fullPage: true })
    assert.deepEqual(errors, [])
    console.log('Browser checks passed: admin overview, delete confirmation, login selected state, role/status changes, audit, error feedback, search, 1440/768/390px, dialogs and Sonner without close buttons.')
} catch (error) { console.error(logs.join('')); console.error('Page:', currentPage?.url(), await currentPage?.locator('body').innerText()); throw error }
finally {
    await browser?.close()
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'])
    else child.kill('SIGTERM')
    await new Promise(resolve => mock.close(resolve))
}
