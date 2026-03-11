'use client'

import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft, Globe, Link2, Palette, Database, Wrench, LoaderCircle, Save, Check, Shield, Megaphone, Bell, Ban, AlertTriangle, LayoutTemplate, MessageSquareQuote, FileText, Tags, User, UserPlus, Heading, AlignLeft, BarChart3, Ruler, Clock, Paintbrush, Moon, Trash2, CalendarClock, Download, Power, MessageSquareWarning, Bot, Key, Lock, ShieldAlert, KeyRound, FileWarning, GlobeLock, FastForward, Link as IconLink, Trash } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { FadeIn } from "@/components/animations/fade-in"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { getSettings, saveSettings, cleanExpiredLinks, AllSettings } from "@/app/admin/actions"
import { SmartLoading } from "@/components/smart-loading"
import { useLoading } from "@/components/providers/loading-provider"
import { useTheme } from "next-themes"
import { generatePrimaryColors } from "@/lib/color-utils"

export default function AdminSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const router = useRouter()
    const { isLoading: isGlobalLoading, setIsLoading: setGlobalLoading } = useLoading()
    const { theme, setTheme } = useTheme()

    const [siteName, setSiteName] = useState("LinkFlow")
    const [siteSubtitle, setSiteSubtitle] = useState("下一代短链接生成器")
    const [siteDescription, setSiteDescription] = useState("让链接更短，让分享更简单")
    const [siteKeywords, setSiteKeywords] = useState("短链接,URL Shortener,Link Management,Next.js")
    const [authorName, setAuthorName] = useState("池鱼")
    const [authorUrl, setAuthorUrl] = useState("https://chiyu.it")
    const [allowPublicShorten, setAllowPublicShorten] = useState(true)
    const [openRegistration, setOpenRegistration] = useState(true)
    const [announcementEnabled, setAnnouncementEnabled] = useState(false)
    const [announcementContent, setAnnouncementContent] = useState("")
    const [announcementType, setAnnouncementType] = useState<"default" | "destructive" | "outline" | "secondary">("default")
    const [announcementDuration, setAnnouncementDuration] = useState(5000)

    // 链接设置
    const [slugLength, setSlugLength] = useState<number | "">(6)
    const [defaultExpiration, setDefaultExpiration] = useState<string>("0")
    const [enableClickStats, setEnableClickStats] = useState(true)

    // 外观设置
    const [primaryColor, setPrimaryColor] = useState("#1a1a1f")
    const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system")
    const [toastPosition, setToastPosition] = useState("bottom-right")

    // 数据管理
    const [autoCleanExpired, setAutoCleanExpired] = useState(false)
    const [expiredDays, setExpiredDays] = useState<number | "">(90)

    // 维护模式
    const [maintenanceMode, setMaintenanceMode] = useState(false)
    const [maintenanceMessage, setMaintenanceMessage] = useState("")

    // 安全设置
    const [turnstileEnabled, setTurnstileEnabled] = useState(false)
    const [turnstileSiteKey, setTurnstileSiteKey] = useState("")
    const [turnstileSecretKey, setTurnstileSecretKey] = useState("")
    const [turnstileAnonymousShortenEnabled, setTurnstileAnonymousShortenEnabled] = useState(false)
    const [safeBrowsingEnabled, setSafeBrowsingEnabled] = useState(false)
    const [safeBrowsingApiKey, setSafeBrowsingApiKey] = useState("")
    const [blacklistSuffix, setBlacklistSuffix] = useState("")
    const [blacklistDomain, setBlacklistDomain] = useState("")
    const [blacklistSlug, setBlacklistSlug] = useState("")
    const [skipAllChecks, setSkipAllChecks] = useState(false)

    // 动作状态
    const [exporting, setExporting] = useState(false)
    const [cleaning, setCleaning] = useState(false)

    // 导出所有链接
    const handleExport = async () => {
        setExporting(true)
        try {
            const response = await fetch('/api/admin/export')
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Export failed')
            }

            // 获取文件名
            const contentDisposition = response.headers.get('Content-Disposition')
            const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
            const filename = filenameMatch ? filenameMatch[1] : `links_export_${new Date().toISOString().split('T')[0]}.csv`

            // 下载文件
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast.success("导出成功！")
        } catch (error: any) {
            console.error('Export error:', error)
            toast.error(error.message || "导出失败，请稍后重试")
        } finally {
            setExporting(false)
        }
    }

    // 清理过期链接
    const handleClean = async () => {
        if (!confirm("确定要删除所有已过期的链接吗？此操作不可撤销。")) {
            return
        }

        setCleaning(true)
        try {
            const result = await cleanExpiredLinks()
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(`成功清理了 ${result.count} 个过期链接`)
            }
        } catch (error) {
            toast.error("清理失败，请稍后重试")
        } finally {
            setCleaning(false)
        }
    }

    useEffect(() => {
        async function loadSettings() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.push("/login")
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            if (profile?.role !== 'admin') {
                router.push("/dashboard")
                return
            }

            // 从数据库加载设置
            const result = await getSettings()
            if (result.data) {
                const settings = result.data
                // 站点配置
                setSiteName(settings.site.name)
                setSiteSubtitle(settings.site.subtitle || "下一代短链接生成器")
                setSiteDescription(settings.site.description)
                setSiteKeywords(settings.site.keywords || "短链接,URL Shortener,Link Management,Next.js")
                setAuthorName(settings.site.authorName || "池鱼")
                setAuthorUrl(settings.site.authorUrl || "https://chiyu.it")
                setAllowPublicShorten(settings.site.allowPublicShorten)
                setOpenRegistration(settings.site.openRegistration ?? true)
                setAnnouncementEnabled(settings.announcement.enabled)
                setAnnouncementContent(settings.announcement.content)
                setAnnouncementType(settings.announcement.type)
                setAnnouncementDuration(settings.announcement.duration || 5000)
                // 链接设置
                setSlugLength(settings.links.slugLength)
                setDefaultExpiration(String(settings.links.defaultExpiration || 0))
                setEnableClickStats(settings.links.enableClickStats)
                // 外观设置
                setPrimaryColor(settings.appearance.primaryColor)
                setThemeMode(settings.appearance.themeMode)
                setToastPosition(settings.appearance.toastPosition || "bottom-right")
                // 数据管理
                setAutoCleanExpired(settings.data.autoCleanExpired)
                setExpiredDays(settings.data.expiredDays)
                // 维护模式
                setMaintenanceMode(settings.maintenance.enabled)
                setMaintenanceMessage(settings.maintenance.message)
                // 安全设置
                setTurnstileEnabled(settings.security.turnstileEnabled)
                setTurnstileSiteKey(settings.security.turnstileSiteKey)
                setTurnstileSecretKey(settings.security.turnstileSecretKey)
                setTurnstileAnonymousShortenEnabled(settings.security.turnstileAnonymousShortenEnabled ?? false)
                setSafeBrowsingEnabled(settings.security.safeBrowsingEnabled ?? false)
                setSafeBrowsingApiKey(settings.security.safeBrowsingApiKey ?? "")
                setBlacklistSuffix(settings.security.blacklistSuffix ?? "")
                setBlacklistDomain(settings.security.blacklistDomain ?? "")
                setBlacklistSlug(settings.security.blacklistSlug ?? "")
                setSkipAllChecks(settings.security.skipAllChecks ?? false)
            }

            setLoading(false)
            setGlobalLoading(false)
        }
        loadSettings()
    }, [router, setGlobalLoading])

    // 同步当前实际主题到选择器
    useEffect(() => {
        if (theme) {
            setThemeMode(theme as "light" | "dark" | "system")
        }
    }, [theme])

    const handleSave = async () => {
        // 验证短码长度
        const safeSlugLength = slugLength === "" ? 0 : slugLength
        if (safeSlugLength < 1 || safeSlugLength > 30) {
            toast.error("参数错误", { description: "短码长度必须在 1-30 位之间" })
            return
        }

        // 验证 Turnstile 配置
        if (turnstileEnabled && (!turnstileSiteKey.trim() || !turnstileSecretKey.trim())) {
            toast.error("配置不完整", { description: "启用 Turnstile 时必须填写 Site Key 和 Secret Key" })
            return
        }

        // 验证自动清理配置
        if (autoCleanExpired && (typeof expiredDays !== 'number' || expiredDays <= 0)) {
            toast.error("配置错误", { description: "过期天数必须大于 0" })
            return
        }

        // 验证 Safe Browsing 配置
        if (safeBrowsingEnabled && !safeBrowsingApiKey.trim()) {
            toast.error("配置不完整", { description: "启用 Google Safe Browsing 时必须填写 API Key" })
            return
        }

        setSaving(true)

        const settings: AllSettings = {
            site: {
                name: siteName,
                subtitle: siteSubtitle,
                description: siteDescription,
                keywords: siteKeywords,
                authorName: authorName,
                authorUrl: authorUrl,
                allowPublicShorten: allowPublicShorten,
                openRegistration: openRegistration
            },
            links: {
                slugLength: safeSlugLength,
                enableClickStats: enableClickStats,
                defaultExpiration: Number(defaultExpiration)
            },
            appearance: {
                primaryColor: primaryColor,
                themeMode: themeMode,
                toastPosition: toastPosition as any
            },
            data: {
                autoCleanExpired: autoCleanExpired,
                expiredDays: typeof expiredDays === 'number' && expiredDays > 0 ? expiredDays : 90
            },
            maintenance: {
                enabled: maintenanceMode,
                message: maintenanceMessage
            },
            security: {
                turnstileEnabled: turnstileEnabled,
                turnstileSiteKey: turnstileSiteKey,
                turnstileSecretKey: turnstileSecretKey,
                turnstileAnonymousShortenEnabled: turnstileAnonymousShortenEnabled,
                safeBrowsingEnabled: safeBrowsingEnabled,
                safeBrowsingApiKey: safeBrowsingApiKey,
                blacklistSuffix: blacklistSuffix,
                blacklistDomain: blacklistDomain,
                blacklistSlug: blacklistSlug,
                skipAllChecks: skipAllChecks
            },
            announcement: {
                enabled: announcementEnabled,
                content: announcementContent,
                type: announcementType,
                duration: announcementDuration
            }
        }

        const result = await saveSettings(settings)

        if (result.error) {
            toast.error("保存失败", { description: result.error })
            setSaving(false)
            return
        }

        toast.success("设置已保存", {
            description: "页面将自动刷新以应用更改"
        })

        // 延迟刷新页面
        setTimeout(() => {
            window.location.reload()
        }, 1000)
    }

    if (loading) {
        return <SmartLoading />
    }

    return (
        <div className="container mx-auto max-w-4xl px-4 py-8">
            {/* 页面标题 */}
            <div className="mb-8 flex flex-col items-start justify-between gap-4 border-b border-border/40 pb-6 md:flex-row md:items-center">
                <FadeIn delay={0} className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setLoading(true)
                            router.push("/admin")
                        }}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">系统设置</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            配置站点参数、链接规则和安全策略
                        </p>
                    </div>
                </FadeIn>
            </div>

            <div className="space-y-6">
                {/* 站点配置 */}
                <FadeIn delay={0.1}>
                    <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                    <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle>站点配置</CardTitle>
                                    <CardDescription>基本站点信息和公开访问设置</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="siteName">站点名称</Label>
                                    </div>
                                    <Input
                                        id="siteName"
                                        value={siteName}
                                        onChange={(e) => setSiteName(e.target.value)}
                                        placeholder="输入站点名称"
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <MessageSquareQuote className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="siteSubtitle">副标题</Label>
                                    </div>
                                    <Input
                                        id="siteSubtitle"
                                        value={siteSubtitle}
                                        onChange={(e) => setSiteSubtitle(e.target.value)}
                                        placeholder="如: 下一代短链接生成器"
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="siteDescription">站点描述</Label>
                                    </div>
                                    <Input
                                        id="siteDescription"
                                        value={siteDescription}
                                        onChange={(e) => setSiteDescription(e.target.value)}
                                        placeholder="输入站点描述"
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <div className="flex items-center gap-2">
                                        <Tags className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="siteKeywords">站点关键词</Label>
                                    </div>
                                    <Input
                                        id="siteKeywords"
                                        value={siteKeywords}
                                        onChange={(e) => setSiteKeywords(e.target.value)}
                                        placeholder="多个关键词用逗号分隔"
                                        autoComplete="off"
                                    />
                                    <p className="text-xs text-muted-foreground">多个关键词请用英文逗号分隔</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="authorName">作者名称</Label>
                                    </div>
                                    <Input
                                        id="authorName"
                                        value={authorName}
                                        onChange={(e) => setAuthorName(e.target.value)}
                                        placeholder="输入作者名称"
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <IconLink className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="authorUrl">作者链接</Label>
                                    </div>
                                    <Input
                                        id="authorUrl"
                                        value={authorUrl}
                                        onChange={(e) => setAuthorUrl(e.target.value)}
                                        placeholder="输入作者个人主页链接"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                                        <Label>开放用户注册</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        允许新用户注册账号
                                    </p>
                                </div>
                                <Switch
                                    checked={openRegistration}
                                    onCheckedChange={setOpenRegistration}
                                />
                            </div>

                            {/* 公告设置 */}
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Megaphone className="h-4 w-4" />
                                        <Label>公告弹窗</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        启用后将在首页向用户展示公告
                                    </p>
                                </div>
                                <Switch
                                    checked={announcementEnabled}
                                    onCheckedChange={setAnnouncementEnabled}
                                />
                            </div>
                            {announcementEnabled && (
                                <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <AlignLeft className="h-4 w-4 text-muted-foreground" />
                                            <Label htmlFor="announcementContent">公告内容</Label>
                                        </div>
                                        <Textarea
                                            id="announcementContent"
                                            value={announcementContent}
                                            onChange={(e) => setAnnouncementContent(e.target.value)}
                                            placeholder="输入公告内容"
                                            className="min-h-20"
                                        />
                                    </div>

                                    <div className="grid gap-6 md:grid-cols-2 bg-muted/30 p-4 rounded-lg">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 h-5">
                                                <Palette className="h-4 w-4 text-muted-foreground" />
                                                <Label>公告类型</Label>
                                            </div>
                                            <Select value={announcementType} onValueChange={(v: any) => setAnnouncementType(v)}>
                                                <SelectTrigger className="bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="default">默认 (蓝色/火箭)</SelectItem>
                                                    <SelectItem value="destructive">警告 (红色/警示)</SelectItem>
                                                    <SelectItem value="outline">提示 (边框/信息)</SelectItem>
                                                    <SelectItem value="secondary">次要 (灰色/打钩)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between h-5">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <Label>显示时长</Label>
                                                </div>
                                                <span className="text-sm font-mono bg-background px-2 py-0.5 rounded border text-muted-foreground">{announcementDuration / 1000}s</span>
                                            </div>
                                            <div className="flex items-center h-10 px-1">
                                                <Input
                                                    type="range"
                                                    value={announcementDuration}
                                                    onChange={(e) => setAnnouncementDuration(Number(e.target.value))}
                                                    min={2000}
                                                    max={30000}
                                                    step={1000}
                                                    className="cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </FadeIn>

                {/* 链接设置 */}
                <FadeIn delay={0.2}>
                    <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                    <Link2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <CardTitle>链接设置</CardTitle>
                                    <CardDescription>短链接生成规则和统计功能</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                        <Label>启用点击统计</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        记录每个链接的点击次数和访问数据
                                    </p>
                                </div>
                                <Switch
                                    checked={enableClickStats}
                                    onCheckedChange={setEnableClickStats}
                                />
                            </div>
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Ruler className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="slugLength">默认短码长度</Label>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Input
                                            id="slugLength"
                                            type="number"
                                            min={1}
                                            max={30}
                                            value={slugLength}
                                            onChange={(e) => {
                                                const value = e.target.value
                                                if (value === "") {
                                                    setSlugLength("")
                                                } else {
                                                    setSlugLength(Number(value))
                                                }
                                            }}
                                            className="w-24"
                                            autoComplete="off"
                                        />
                                        <span className="text-sm text-muted-foreground">字符 (1-30)</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="defaultExpiration">默认有效期</Label>
                                    </div>
                                    <Select value={defaultExpiration} onValueChange={setDefaultExpiration}>
                                        <SelectTrigger className="w-45">
                                            <SelectValue placeholder="选择默认有效期" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">永不过期</SelectItem>
                                            <SelectItem value="60">1 小时</SelectItem>
                                            <SelectItem value="1440">24 小时</SelectItem>
                                            <SelectItem value="10080">7 天</SelectItem>
                                            <SelectItem value="43200">30 天</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-sm text-muted-foreground">创建新链接时预设的过期时间</p>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </FadeIn>

                {/* 外观设置 */}
                <FadeIn delay={0.3}>
                    <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900/30">
                                    <Palette className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                                </div>
                                <div>
                                    <CardTitle>外观设置</CardTitle>
                                    <CardDescription>自定义站点主题和配色方案</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* 主题色选择 */}
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Paintbrush className="h-4 w-4 text-muted-foreground" />
                                        <Label>主题色</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        自定义站点的主色调
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Input
                                        value={primaryColor}
                                        onChange={(e) => {
                                            const color = e.target.value
                                            setPrimaryColor(color)
                                            // 验证是否为有效的 HEX 颜色
                                            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                                                const colors = generatePrimaryColors(color)
                                                document.documentElement.style.setProperty('--primary', colors.primary)
                                                document.documentElement.style.setProperty('--primary-foreground', colors.primaryForeground)
                                            }
                                        }}
                                        className="w-24 font-mono text-sm"
                                        placeholder="#1a1a1f"
                                    />
                                    <label className="relative cursor-pointer">
                                        <div
                                            className="h-10 w-10 rounded-lg border-2 border-border hover:border-foreground/50 transition-colors cursor-pointer"
                                            style={{ backgroundColor: primaryColor }}
                                        />
                                        <input
                                            type="color"
                                            value={primaryColor}
                                            onChange={(e) => {
                                                const color = e.target.value
                                                setPrimaryColor(color)
                                                // 实时预览主题色
                                                const colors = generatePrimaryColors(color)
                                                document.documentElement.style.setProperty('--primary', colors.primary)
                                                document.documentElement.style.setProperty('--primary-foreground', colors.primaryForeground)
                                            }}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* 主题模式选择 */}
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Moon className="h-4 w-4 text-muted-foreground" />
                                        <Label>主题模式</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {
                                            themeMode === 'light' ? '始终使用浅色主题' :
                                                themeMode === 'dark' ? '始终使用深色主题' :
                                                    '根据系统设置自动切换'
                                        }
                                    </p>
                                </div>
                                <Select value={themeMode} onValueChange={(value) => {
                                    const mode = value as "light" | "dark" | "system"
                                    setThemeMode(mode)
                                    setTheme(mode) // 立即切换主题
                                }}>
                                    <SelectTrigger className="w-35">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">
                                            <div className="flex items-center gap-2">
                                                <span>☀️</span>
                                                <span>浅色模式</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="dark">
                                            <div className="flex items-center gap-2">
                                                <span>🌙</span>
                                                <span>深色模式</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="system">
                                            <div className="flex items-center gap-2">
                                                <span>💻</span>
                                                <span>跟随系统</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Toast 位置设置 */}
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Bell className="h-4 w-4 text-muted-foreground" />
                                        <Label>通知弹窗位置</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        设置全局 Toast 通知的弹出位置
                                    </p>
                                </div>
                                <Select value={toastPosition} onValueChange={setToastPosition}>
                                    <SelectTrigger className="w-45">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="top-right">右上角 (Top Right)</SelectItem>
                                        <SelectItem value="top-center">顶部居中 (Top Center)</SelectItem>
                                        <SelectItem value="bottom-right">右下角 (Bottom Right)</SelectItem>
                                        <SelectItem value="bottom-center">底部居中 (Bottom Center)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </FadeIn>

                {/* 数据管理 */}
                <FadeIn delay={0.35}>
                    <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                                    <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                                </div>
                                <div>
                                    <CardTitle>数据管理</CardTitle>
                                    <CardDescription>链接数据清理和导出设置</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                                        <Label>自动清理过期链接</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        定期删除长时间无点击的链接
                                    </p>
                                </div>
                                <Switch
                                    checked={autoCleanExpired}
                                    onCheckedChange={setAutoCleanExpired}
                                />
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-4">
                                {autoCleanExpired && (
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                            <Label htmlFor="expiredDays" className="whitespace-nowrap">过期天数</Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="expiredDays"
                                                type="number"
                                                min={1}
                                                value={expiredDays}
                                                onChange={(e) => {
                                                    const val = e.target.value
                                                    if (val === "") {
                                                        setExpiredDays("")
                                                        return
                                                    }
                                                    const num = parseInt(val)
                                                    if (!isNaN(num) && num > 0) {
                                                        setExpiredDays(num)
                                                    }
                                                }}
                                                onBlur={() => {
                                                    if (expiredDays === "" || expiredDays <= 0) {
                                                        setExpiredDays(90)
                                                        toast.error("过期天数必须大于 0")
                                                    }
                                                }}
                                                className="w-24 h-9"
                                                autoComplete="off"
                                            />
                                            <span className="text-sm text-muted-foreground whitespace-nowrap">天</span>
                                        </div>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleExport}
                                        disabled={exporting}
                                    >
                                        {exporting ? (
                                            <>
                                                <LoaderCircle className="mr-2 h-3 w-3 animate-spin" />
                                                导出中...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="mr-2 h-4 w-4" />
                                                导出所有链接
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/30"
                                        onClick={handleClean}
                                        disabled={cleaning}
                                    >
                                        {cleaning ? (
                                            <>
                                                <LoaderCircle className="mr-2 h-3 w-3 animate-spin" />
                                                清理中...
                                            </>
                                        ) : (
                                            <>
                                                <Trash className="mr-2 h-4 w-4" />
                                                清理已过期链接
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </FadeIn>

                {/* 维护模式 */}
                <FadeIn delay={0.4}>
                    <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                                    <Wrench className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                    <CardTitle>维护模式</CardTitle>
                                    <CardDescription>临时关闭服务进行维护</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Power className="h-4 w-4 text-muted-foreground" />
                                        <Label>启用维护模式</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        开启后用户将无法访问短链接服务
                                    </p>
                                </div>
                                <Switch
                                    checked={maintenanceMode}
                                    onCheckedChange={setMaintenanceMode}
                                />
                            </div>
                            {maintenanceMode && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <MessageSquareWarning className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="maintenanceMessage">维护公告</Label>
                                    </div>
                                    <Input
                                        id="maintenanceMessage"
                                        value={maintenanceMessage}
                                        onChange={(e) => setMaintenanceMessage(e.target.value)}
                                        placeholder="输入向用户展示的维护信息..."
                                        autoComplete="off"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </FadeIn>

                {/* 安全设置 */}
                <FadeIn delay={0.45}>
                    <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                                    <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <CardTitle>安全设置</CardTitle>
                                    <CardDescription>人机验证与链接安全检测配置</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Turnstile 人机验证 */}
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Bot className="h-4 w-4 text-muted-foreground" />
                                        <Label>启用注册人机验证</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        开启后用户注册时需要完成 Turnstile 验证
                                    </p>
                                </div>
                                <Switch
                                    checked={turnstileEnabled}
                                    onCheckedChange={setTurnstileEnabled}
                                />
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <IconLink className="h-4 w-4 text-muted-foreground" />
                                        <Label>启用匿名创建人机验证</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        开启后未登录用户创建短链接时需要完成 Turnstile 验证
                                    </p>
                                </div>
                                <Switch
                                    checked={turnstileAnonymousShortenEnabled}
                                    onCheckedChange={setTurnstileAnonymousShortenEnabled}
                                    disabled={!turnstileEnabled || !allowPublicShorten}
                                />
                            </div>
                            {turnstileEnabled && (
                                <>
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Key className="h-4 w-4 text-muted-foreground" />
                                                <Label htmlFor="turnstileSiteKey">Site Key</Label>
                                            </div>
                                            <Input
                                                id="turnstileSiteKey"
                                                value={turnstileSiteKey}
                                                onChange={(e) => setTurnstileSiteKey(e.target.value)}
                                                placeholder="从 Cloudflare 控制台获取 Site Key"
                                                autoComplete="off"
                                            />
                                            <p className="text-xs text-muted-foreground">前端渲染验证组件时使用</p>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Lock className="h-4 w-4 text-muted-foreground" />
                                                <Label htmlFor="turnstileSecretKey">Secret Key</Label>
                                            </div>
                                            <Input
                                                id="turnstileSecretKey"
                                                type="password"
                                                value={turnstileSecretKey}
                                                onChange={(e) => setTurnstileSecretKey(e.target.value)}
                                                placeholder="从 Cloudflare 控制台获取 Secret Key"
                                                autoComplete="off"
                                            />
                                            <p className="text-xs text-muted-foreground">后端验证 token 时使用，请妥善保管</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 分隔线 */}
                            <div className="border-t my-2" />

                            {/* Google Safe Browsing */}
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                                        <Label>启用 Google Safe Browsing</Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        创建短链接时检测目标 URL 是否为恶意网址
                                    </p>
                                </div>
                                <Switch
                                    checked={safeBrowsingEnabled}
                                    onCheckedChange={setSafeBrowsingEnabled}
                                />
                            </div>
                            {safeBrowsingEnabled && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="safeBrowsingApiKey">API Key</Label>
                                    </div>
                                    <Input
                                        id="safeBrowsingApiKey"
                                        type="password"
                                        value={safeBrowsingApiKey}
                                        onChange={(e) => setSafeBrowsingApiKey(e.target.value)}
                                        placeholder="从 Google Cloud Console 获取 API Key"
                                        autoComplete="off"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        在 <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a> 创建 API Key 并启用 Safe Browsing API
                                    </p>
                                </div>
                            )}

                            {/* 分隔线 */}
                            <div className="border-t my-2" />

                            {/* 黑名单设置 */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <FileWarning className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="blacklistSuffix">后缀黑名单</Label>
                                    </div>
                                    <Textarea
                                        id="blacklistSuffix"
                                        value={blacklistSuffix}
                                        onChange={(e) => setBlacklistSuffix(e.target.value)}
                                        placeholder=".exe, .apk, .bat"
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        禁止缩短以此类后缀结尾的链接，多个后缀用英文逗号分隔
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <GlobeLock className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="blacklistDomain">域名黑名单</Label>
                                    </div>
                                    <Textarea
                                        id="blacklistDomain"
                                        value={blacklistDomain}
                                        onChange={(e) => setBlacklistDomain(e.target.value)}
                                        placeholder="example.com, malicious-site.net"
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        禁止缩短包含这些域名的链接，多个域名用英文逗号分隔
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Ban className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="blacklistSlug">自定义后缀黑名单</Label>
                                    </div>
                                    <Textarea
                                        id="blacklistSlug"
                                        value={blacklistSlug}
                                        onChange={(e) => setBlacklistSlug(e.target.value)}
                                        placeholder="admin, login, api, dashboard"
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        禁止用户使用这些自定义后缀，多个后缀用英文逗号分隔
                                    </p>
                                </div>
                            </div>

                            {/* 分隔线 */}
                            <div className="border-t my-2" />

                            {/* 跳过检查 */}
                            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/30 p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                        <AlertTriangle className="h-4 w-4" />
                                        <Label className="text-red-600 dark:text-red-400">设置跳过所有检查</Label>
                                    </div>
                                    <p className="text-sm text-red-600/80 dark:text-red-400/80">
                                        危险：开启后将跳过所有安全检查（Safe Browsing、黑名单等），仅用于特殊场景
                                    </p>
                                </div>
                                <Switch
                                    checked={skipAllChecks}
                                    onCheckedChange={setSkipAllChecks}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </FadeIn>
            </div>
            {/* 固定在右下角的保存按钮 */}
            <FadeIn delay={0.5}>
                <div className="fixed bottom-8 right-8">
                    <Button
                        onClick={handleSave}
                        size="lg"
                        className="shadow-lg group"
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                保存中...
                            </>
                        ) : (
                            <>
                                <span className="relative mr-2 w-4 h-4 inline-flex items-center justify-center">
                                    <Save className="absolute h-4 w-4 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] group-hover:opacity-0 group-hover:scale-50" />
                                    <Check className="absolute h-4 w-4 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100" />
                                </span>
                                保存所有设置
                            </>
                        )}
                    </Button>
                </div>
            </FadeIn>
        </div>
    )
}
