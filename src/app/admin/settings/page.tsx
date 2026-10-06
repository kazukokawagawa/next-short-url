'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { ArrowLeft, Save, RotateCcw, Download, Trash2 } from 'lucide-react'
import { getSettings, saveSettings, cleanExpiredLinks, type AllSettings } from '@/app/admin/actions'
import { Container, PageHeader } from '@/components/page-header'
import { IconButton } from '@/components/ui/icon-button'
import { FormInput, FormField } from '@/components/ui/form-field'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import { AsyncState } from '@/components/async-state'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { generatePrimaryColors, generateDarkModePrimaryColors } from '@/lib/color-utils'
import { toast } from 'sonner'

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
    return <section id={id} className="scroll-mt-6 border-b pb-6"><h2 className="mb-4 text-lg font-semibold">{title}</h2><div className="grid min-w-0 gap-4 md:grid-cols-2">{children}</div></section>
}
function Toggle({ id, label, checked, onChange, disabled }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
    return <div className="flex min-w-0 items-center justify-between gap-4 py-2"><label htmlFor={id} className="text-sm">{label}</label><Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} /></div>
}
function Options({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
    return <FormField id={id} label={label}><Select value={value} onValueChange={onChange}><SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map(([value, title]) => <SelectItem value={value} key={value}>{title}</SelectItem>)}</SelectContent></Select></FormField>
}
export default function AdminSettingsPage() {
    const router = useRouter()
    const { theme, setTheme, resolvedTheme } = useTheme()
    const [settings, setSettings] = useState<AllSettings | null>(null)
    const [saved, setSaved] = useState<AllSettings | null>(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [cleanOpen, setCleanOpen] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const initialTheme = useRef<string | undefined>(undefined)
    const originalColors = useRef<Record<string, string>>({})
    const currentSaved = useRef<AllSettings | null>(null)
    const lock = useRef(false)
    const dirty = Boolean(settings && saved && JSON.stringify(settings) !== JSON.stringify(saved))
    useEffect(() => {
        initialTheme.current = theme
        originalColors.current = Object.fromEntries(['--primary', '--primary-foreground', '--sidebar-primary', '--sidebar-primary-foreground'].map(key => [key, document.documentElement.style.getPropertyValue(key)]))
        return () => {
            const appearance = currentSaved.current?.appearance
            if (appearance) {
                const dark = appearance.themeMode === 'dark' || (appearance.themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
                const colors = dark ? generateDarkModePrimaryColors(appearance.primaryColor) : generatePrimaryColors(appearance.primaryColor)
                document.documentElement.style.setProperty('--primary', colors.primary)
                document.documentElement.style.setProperty('--primary-foreground', colors.primaryForeground)
                setTheme(appearance.themeMode)
            } else { Object.entries(originalColors.current).forEach(([key, value]) => document.documentElement.style.setProperty(key, value)); if (initialTheme.current) setTheme(initialTheme.current) }
        }
        // Capture the theme once for preview rollback.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    useEffect(() => {
        let active = true
        getSettings().then(result => {
            if (!active) return
            if (result.needsLogin) { router.replace('/login'); return }
            if (result.error || !result.data) { setError(result.error || '设置加载失败'); return }
            setSettings(result.data); setSaved(result.data); currentSaved.current = result.data; setError('')
        }).catch(() => { if (active) setError('设置加载失败，请重试。') }).finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [attempt, router])
    useEffect(() => {
        const unload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
        window.addEventListener('beforeunload', unload)
        return () => window.removeEventListener('beforeunload', unload)
    }, [dirty])
    useEffect(() => {
        const color = settings?.appearance.primaryColor
        if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return
        const colors = resolvedTheme === 'dark' ? generateDarkModePrimaryColors(color) : generatePrimaryColors(color)
        document.documentElement.style.setProperty('--primary', colors.primary)
        document.documentElement.style.setProperty('--primary-foreground', colors.primaryForeground)
    }, [settings?.appearance.primaryColor, resolvedTheme])
    function update<K extends keyof AllSettings>(section: K, patch: Partial<AllSettings[K]>) {
        setSettings(current => current ? { ...current, [section]: { ...current[section], ...patch } } : current)
    }
    const save = async () => {
        if (!settings || lock.current) return
        if (!settings.site.name.trim() || !/^#[0-9a-f]{6}$/i.test(settings.appearance.primaryColor) || settings.links.slugLength < 1 || settings.links.slugLength > 30) { setError('请填写站点名称、有效 HEX 品牌色与 1–30 位短码长度。'); return }
        if (settings.security.turnstileEnabled && (!settings.security.turnstileSiteKey.trim() || !settings.security.turnstileSecretKey.trim())) { setError('启用 Turnstile 需要 Site Key 与 Secret Key。'); return }
        if (settings.security.safeBrowsingEnabled && !settings.security.safeBrowsingApiKey.trim()) { setError('启用 Safe Browsing 需要 API Key。'); return }
        if (settings.data.autoCleanExpired && settings.data.expiredDays <= 0) { setError('过期天数必须大于 0。'); return }
        lock.current = true; setSaving(true); setError('')
        try {
            const result = await saveSettings(settings)
            if (result.error) { setError(result.error); return }
            setSaved(settings); currentSaved.current = settings; toast.success('设置已保存'); router.refresh()
        } catch { setError('保存失败，请重试。输入已保留。') }
        finally { lock.current = false; setSaving(false) }
    }
    const exportLinks = async () => {
        if (exporting) return
        const notification = toast.loading('正在导出链接…')
        setExporting(true)
        try {
            const response = await fetch('/api/admin/export')
            if (!response.ok) throw new Error('导出失败')
            const url = URL.createObjectURL(await response.blob())
            const a = document.createElement('a'); a.href = url; a.download = `links-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
            toast.success('链接已导出', { id: notification })
        } catch { toast.error('导出失败，请重试。', { id: notification }) }
        finally { setExporting(false) }
    }
    const reset = () => { if (saved) { setSettings(saved); setTheme(saved.appearance.themeMode); setError(''); toast.success('已撤销未保存更改') } }
    const back = () => { if (dirty) { setError('存在未保存更改，请先保存或撤销。'); return } router.push('/admin') }
    return <Container className="pb-24"><PageHeader title="系统设置" back={<IconButton label="返回管理控制台" onClick={back}><ArrowLeft /></IconButton>} />
        {loading || (!settings && error) ? <AsyncState error={error} onRetry={() => setAttempt(value => value + 1)} /> : settings && <>
            <nav aria-label="设置分区" className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">{[['site', '站点'], ['links', '链接'], ['appearance', '外观'], ['security', '安全'], ['data', '数据'], ['maintenance', '维护']].map(([id, title]) => <a href={`#${id}`} key={id} className="text-muted-foreground hover:text-foreground focus-visible:underline">{title}</a>)}</nav>
            <fieldset disabled={saving} className="min-w-0 space-y-6">
                <Section id="site" title="站点">
                    <FormInput id="site-name" label="站点名称" value={settings.site.name} onChange={e => update('site', { name: e.target.value })} />
                    <FormInput id="site-subtitle" label="副标题" value={settings.site.subtitle} onChange={e => update('site', { subtitle: e.target.value })} />
                    <FormInput id="site-description" label="描述" value={settings.site.description} onChange={e => update('site', { description: e.target.value })} />
                    <FormInput id="site-keywords" label="关键词" value={settings.site.keywords} onChange={e => update('site', { keywords: e.target.value })} />
                    <FormInput id="author-name" label="作者名称" value={settings.site.authorName} onChange={e => update('site', { authorName: e.target.value })} />
                    <FormInput id="author-url" label="作者链接" value={settings.site.authorUrl} onChange={e => update('site', { authorUrl: e.target.value })} />
                    <Toggle id="public-create" label="允许公开创建短链接" checked={settings.site.allowPublicShorten} onChange={value => update('site', { allowPublicShorten: value })} />
                    <Toggle id="registration" label="开放注册" checked={settings.site.openRegistration} onChange={value => update('site', { openRegistration: value })} />
                    <Toggle id="announcement" label="首页公告" checked={settings.announcement.enabled} onChange={value => update('announcement', { enabled: value })} />
                    {settings.announcement.enabled && <>
                        <FormField id="announcement-content" label="公告内容"><Textarea id="announcement-content" value={settings.announcement.content} onChange={e => update('announcement', { content: e.target.value })} /></FormField>
                        <Options id="announcement-type" label="公告类型" value={settings.announcement.type} onChange={value => update('announcement', { type: value as AllSettings['announcement']['type'] })} options={[[ 'default', '默认' ], [ 'destructive', '危险' ], [ 'outline', '信息' ], [ 'secondary', '成功' ]]} />
                        <FormInput id="announcement-duration" label="公告时长（毫秒）" type="number" min={2000} max={30000} step={1000} value={settings.announcement.duration} onChange={e => update('announcement', { duration: Number(e.target.value) })} />
                    </>}
                </Section>
                <Section id="links" title="链接">
                    <FormInput id="slug-length" label="默认短码长度" type="number" min={1} max={30} value={settings.links.slugLength} onChange={e => update('links', { slugLength: Number(e.target.value) })} />
                    <Options id="default-expiration" label="默认有效期" value={String(settings.links.defaultExpiration)} onChange={value => update('links', { defaultExpiration: Number(value) })} options={[[ '0', '永不过期' ], [ '60', '1 小时' ], [ '1440', '24 小时' ], [ '10080', '7 天' ], [ '43200', '30 天' ]]} />
                    <Toggle id="click-stats" label="记录点击统计" checked={settings.links.enableClickStats} onChange={value => update('links', { enableClickStats: value })} />
                </Section>
                <Section id="appearance" title="外观">
                    <FormField id="brand-color" label="品牌色"><div className="flex items-center gap-2"><input id="brand-color" type="color" aria-label="品牌色" value={/^#[0-9a-f]{6}$/i.test(settings.appearance.primaryColor) ? settings.appearance.primaryColor : '#1a1a1f'} onChange={e => update('appearance', { primaryColor: e.target.value })} className="size-9 shrink-0 cursor-pointer" /><FormInput id="brand-hex" label="HEX" value={settings.appearance.primaryColor} onChange={e => update('appearance', { primaryColor: e.target.value })} /></div></FormField>
                    <Options id="theme-mode" label="主题模式" value={settings.appearance.themeMode} onChange={value => { update('appearance', { themeMode: value as AllSettings['appearance']['themeMode'] }); setTheme(value) }} options={[[ 'light', '浅色' ], [ 'dark', '深色' ], [ 'system', '跟随系统' ]]} />
                    <Options id="toast-position" label="通知位置" value={settings.appearance.toastPosition} onChange={value => update('appearance', { toastPosition: value as AllSettings['appearance']['toastPosition'] })} options={[[ 'top-right', '右上' ], [ 'top-center', '顶部居中' ], [ 'bottom-right', '右下' ], [ 'bottom-center', '底部居中' ]]} />
                </Section>
                <Section id="security" title="安全">
                    <Toggle id="turnstile-enabled" label="启用 Turnstile" checked={settings.security.turnstileEnabled} onChange={value => update('security', { turnstileEnabled: value })} />
                    <Toggle id="anonymous-captcha" label="匿名创建需要验证" checked={settings.security.turnstileAnonymousShortenEnabled} onChange={value => update('security', { turnstileAnonymousShortenEnabled: value })} disabled={!settings.security.turnstileEnabled || !settings.site.allowPublicShorten} />
                    <FormInput id="turnstile-site-key" label="Site Key" value={settings.security.turnstileSiteKey} onChange={e => update('security', { turnstileSiteKey: e.target.value })} />
                    <FormInput id="turnstile-secret" label="Secret Key" type="password" autoComplete="new-password" value={settings.security.turnstileSecretKey} onChange={e => update('security', { turnstileSecretKey: e.target.value })} />
                    <Toggle id="safe-browsing" label="Google Safe Browsing" checked={settings.security.safeBrowsingEnabled} onChange={value => update('security', { safeBrowsingEnabled: value })} />
                    <FormInput id="safe-browsing-key" label="API Key" type="password" autoComplete="new-password" value={settings.security.safeBrowsingApiKey} onChange={e => update('security', { safeBrowsingApiKey: e.target.value })} />
                    <FormField id="blacklist-suffix" label="后缀黑名单"><Textarea id="blacklist-suffix" value={settings.security.blacklistSuffix} onChange={e => update('security', { blacklistSuffix: e.target.value })} /></FormField>
                    <FormField id="blacklist-domain" label="域名黑名单"><Textarea id="blacklist-domain" value={settings.security.blacklistDomain} onChange={e => update('security', { blacklistDomain: e.target.value })} /></FormField>
                    <FormField id="blacklist-slug" label="短码黑名单"><Textarea id="blacklist-slug" value={settings.security.blacklistSlug} onChange={e => update('security', { blacklistSlug: e.target.value })} /></FormField>
                    <div className="text-destructive"><Toggle id="skip-checks" label="跳过全部安全检查" checked={settings.security.skipAllChecks} onChange={value => update('security', { skipAllChecks: value })} /><p className="text-xs">开启后不会执行安全检测。</p></div>
                </Section>
                <Section id="data" title="数据">
                    <Toggle id="auto-clean" label="自动清理" checked={settings.data.autoCleanExpired} onChange={value => update('data', { autoCleanExpired: value })} />
                    <FormInput id="expired-days" label="过期天数" type="number" min={1} value={settings.data.expiredDays} onChange={e => update('data', { expiredDays: Number(e.target.value) })} />
                    <div className="flex flex-wrap gap-2 md:col-span-2"><LoadingButton variant="outline" loading={exporting} icon={<Download />} onClick={exportLinks}>导出全部链接</LoadingButton><Button variant="destructive" onClick={() => setCleanOpen(true)}><Trash2 />清理过期链接</Button></div>
                </Section>
                <Section id="maintenance" title="维护">
                    <Toggle id="maintenance-enabled" label="维护模式" checked={settings.maintenance.enabled} onChange={value => update('maintenance', { enabled: value })} />
                    <FormField id="maintenance-message" label="维护消息"><Textarea id="maintenance-message" value={settings.maintenance.message} onChange={e => update('maintenance', { message: e.target.value })} /></FormField>
                </Section>
            </fieldset>
            {error && <p role="alert" className="my-4 break-words text-destructive">{error}</p>}
            <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 border-t bg-background py-3">
                <span role="status" className="text-sm text-muted-foreground">{dirty ? '存在未保存更改' : '已保存'}</span>
                <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!dirty || saving} onClick={reset}><RotateCcw />撤销更改</Button><LoadingButton loading={saving} disabled={!dirty} onClick={save} icon={<Save />}>保存全部设置</LoadingButton></div>
            </div>
            <ConfirmDeleteDialog open={cleanOpen} onOpenChange={setCleanOpen} object="所有过期链接" onConfirm={async () => { const result = await cleanExpiredLinks(); if (result.error) { toast.error(result.error); return false } toast.success(`已清理 ${result.count || 0} 条链接`); return true }} />
        </>}
    </Container>
}
