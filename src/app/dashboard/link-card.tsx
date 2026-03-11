'use client'

import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CopyButton } from "@/components/copy-button"
import { motion } from "framer-motion"
import { Link2, MoreVertical, ExternalLink, Clock, MousePointerClick, Mail, Trash2, Timer, Lock, QrCode, Check } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { ResetPasswordDialog } from "./reset-password-dialog"
import { deleteLink } from "./actions"
import { adminDeleteLink } from "@/app/admin/actions"
import { toast } from "sonner"
import { SessionExpiredDialog } from "@/components/session-expired-dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { QRCodeDialog } from "@/components/qrcode-dialog"

interface LinkCardProps {
    link: {
        id: number
        slug: string
        original_url: string
        created_at: string
        clicks: number
        user_email?: string
        expires_at?: string | null
        password_type?: string | null
    }
    isAdmin?: boolean
    onDeleteSuccess?: () => void
    index?: number
    showClickStats?: boolean
    showCreator?: boolean
    multiSelectEnabled?: boolean
    selected?: boolean
    onToggleSelected?: (id: number) => void
}

export function LinkCard({
    link,
    isAdmin = false,
    onDeleteSuccess,
    index = 0,
    showClickStats = true,
    showCreator = false,
    multiSelectEnabled = false,
    selected = false,
    onToggleSelected
}: LinkCardProps) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, '') || 'short.link'
    const isFirstScreen = index < 12
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showSessionExpired, setShowSessionExpired] = useState(false)
    const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
    const [qrDialogOpen, setQrDialogOpen] = useState(false)

    const fullUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://short.link'}/${link.slug}`

    const handleDelete = async () => {
        setIsDeleting(true)
        const result = isAdmin ? await adminDeleteLink(link.id) : await deleteLink(link.id)

        if (result?.needsLogin) {
            setIsDeleting(false)
            setShowSessionExpired(true)
            return
        }

        if (result?.error) {
            toast.error("删除失败", { description: result.error })
            setIsDeleting(false)
        } else {
            toast.success("链接已删除")
            setIsDeleting(false)
            setDeleteDialogOpen(false)
            if (onDeleteSuccess) onDeleteSuccess()
        }
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={isFirstScreen ? { opacity: 1, y: 0, scale: 1 } : undefined}
                whileInView={!isFirstScreen ? { opacity: 1, y: 0, scale: 1 } : undefined}
                whileHover={{
                    scale: 1.02,
                    y: -4,
                    transition: {
                        type: "spring",
                        stiffness: 400,
                        damping: 25
                    }
                }}
                whileTap={{
                    scale: 0.98,
                    transition: {
                        type: "spring",
                        stiffness: 500,
                        damping: 30
                    }
                }}
                viewport={{ once: true, margin: "0px", amount: 0.2 }}
                transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: isFirstScreen ? index * 0.06 : 0,
                }}
                className={`group relative rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-lg hover:border-primary/20 cursor-default ${selected ? "ring-2 ring-primary/60" : ""}`}
            >
                {/* 主行：短链接 + 操作 */}
                <div className="flex items-center justify-between gap-3">
                    {/* 左侧：短链接容器（带 hover 高亮和复制按钮） */}
                    <div className="group/link relative flex items-center gap-2 min-w-0 flex-1 rounded-md transition-colors hover:bg-primary/5 -mx-1.5 px-1.5 py-0.5">
                        {multiSelectEnabled ? (
                            <>
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={selected}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        onToggleSelected?.(link.id)
                                    }}
                                    className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border/70 text-muted-foreground hover:bg-muted"}`}
                                >
                                    {selected ? <Check className="h-4 w-4" /> : <span className="h-4 w-4" />}
                                </button>
                                <a
                                    href={`/${link.slug}`}
                                    target="_blank"
                                    className="flex items-center gap-2 text-primary font-medium transition-colors hover:text-primary/80 min-w-0 flex-1"
                                >
                                    <span className="truncate">
                                        {baseUrl}/{link.slug}
                                    </span>
                                </a>
                            </>
                        ) : (
                            <a
                                href={`/${link.slug}`}
                                target="_blank"
                                className="flex items-center gap-2 text-primary font-medium transition-colors hover:text-primary/80 min-w-0 flex-1"
                            >
                                <Link2 className="h-4 w-4 shrink-0 opacity-70" />
                                <span className="truncate">
                                    {baseUrl}/{link.slug}
                                </span>
                            </a>
                        )}
                        {/* 桌面端：hover 时显示复制按钮 */}
                        <div className="hidden md:block opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0">
                            <CopyButton slug={link.slug} />
                        </div>
                    </div>

                    {/* 右侧：操作区 */}
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                        {/* 移动端：始终显示复制按钮 */}
                        <div className="md:hidden">
                            <CopyButton slug={link.slug} />
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">更多操作</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium">链接详情</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                {/* 原始链接 */}
                                <DropdownMenuItem asChild>
                                    <a
                                        href={link.original_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-start gap-2 cursor-pointer"
                                    >
                                        <ExternalLink className="h-4 w-4 mt-0.5 shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs text-muted-foreground">原始链接</span>
                                            <span className="text-sm truncate">{link.original_url}</span>
                                        </div>
                                    </a>
                                </DropdownMenuItem>

                                {/* 创建时间 */}
                                <DropdownMenuItem disabled className="flex items-center gap-2 opacity-100">
                                    <Clock className="h-4 w-4 shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground">创建时间</span>
                                        <span className="text-sm">
                                            {formatDistanceToNow(new Date(link.created_at), {
                                                addSuffix: true,
                                                locale: zhCN
                                            })}
                                        </span>
                                    </div>
                                </DropdownMenuItem>

                                {/* 点击次数 (根据设置显示/隐藏) */}
                                {showClickStats && (
                                    <DropdownMenuItem disabled className="flex items-center gap-2 opacity-100">
                                        <MousePointerClick className="h-4 w-4 shrink-0" />
                                        <div className="flex flex-col">
                                            <span className="text-xs text-muted-foreground">点击次数</span>
                                            <span className="text-sm font-medium">{link.clicks} 次</span>
                                        </div>
                                    </DropdownMenuItem>
                                )}

                                {/* 有效期 (始终显示) */}
                                <DropdownMenuItem disabled className="flex items-center gap-2 opacity-100">
                                    <Timer className="h-4 w-4 shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground">有效期</span>
                                        <span className="text-sm">
                                            {link.expires_at ? (
                                                <>
                                                    还剩 {formatDistanceToNow(new Date(link.expires_at), {
                                                        addSuffix: false, // Don't use "in" or "ago"
                                                        locale: zhCN
                                                    })}
                                                </>
                                            ) : (
                                                "永久"
                                            )}
                                        </span>
                                    </div>
                                </DropdownMenuItem>


                                {/* 管理员：显示创建者邮箱 (仅在 showCreator 为 true 时显示) */}
                                {showCreator && link.user_email && (
                                    <DropdownMenuItem disabled className="flex items-center gap-2 opacity-100">
                                        <Mail className="h-4 w-4 shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs text-muted-foreground">创建者</span>
                                            <span className="text-sm truncate">{link.user_email}</span>
                                        </div>
                                    </DropdownMenuItem>
                                )}

                                {/* 密码保护 (仅在有密码时显示) */}
                                {link.password_type && link.password_type !== 'none' && (
                                    <DropdownMenuItem disabled className="flex items-center gap-2 opacity-100">
                                        <Lock className="h-4 w-4 shrink-0" />
                                        <div className="flex flex-col">
                                            <span className="text-xs text-muted-foreground">密码保护</span>
                                            <span className="text-sm">
                                                {link.password_type === 'six_digit' ? '6位数字密码' : '自定义口令'}
                                            </span>
                                        </div>
                                    </DropdownMenuItem>
                                )}

                                {/* 二维码 */}
                                <DropdownMenuItem
                                    onClick={() => setQrDialogOpen(true)}
                                    className="flex items-center gap-2"
                                >
                                    <QrCode className="h-4 w-4" />
                                    <span>生成二维码</span>
                                </DropdownMenuItem>

                                {/* 重置密码按钮 */}
                                <DropdownMenuItem
                                    onClick={() => setResetPasswordDialogOpen(true)}
                                    className="flex items-center gap-2"
                                >
                                    <Lock className="h-4 w-4" />
                                    <span>{link.password_type && link.password_type !== 'none' ? '修改密码' : '添加密码'}</span>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                {/* 删除操作 */}
                                <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setDeleteDialogOpen(true)}
                                    className="flex items-center gap-2"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span>删除链接</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* 次要信息行：仅显示原始链接（带图标 + 省略号截断） */}
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                    <span className="truncate" title={link.original_url}>
                        {link.original_url}
                    </span>
                </div>
            </motion.div>

            {/* 删除对话框 */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确定删除吗？</AlertDialogTitle>
                        <AlertDialogDescription>
                            此操作无法撤销，这将永久删除此短链接并从服务器中移除所有相关数据。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
                        <LoadingButton
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
                            loading={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeleting ? "删除中..." : "删除"}
                        </LoadingButton>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Session 过期弹窗 */}
            <SessionExpiredDialog
                open={showSessionExpired}
                onOpenChange={setShowSessionExpired}
            />

            {/* 重置密码对话框 */}
            <ResetPasswordDialog
                open={resetPasswordDialogOpen}
                onOpenChange={setResetPasswordDialogOpen}
                linkId={link.id}
                currentPasswordType={link.password_type}
                onSuccess={onDeleteSuccess}
            />

            {/* 二维码弹窗 */}
            <QRCodeDialog
                open={qrDialogOpen}
                onOpenChange={setQrDialogOpen}
                url={fullUrl}
                slug={link.slug}
            />
        </>
    )
}
