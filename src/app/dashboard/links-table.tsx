'use client'

import { LinkCard } from "./link-card"
import { CreateLinkDialog } from "./create-link-dialog"
import { Link2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { adminDeleteLinks } from "@/app/admin/actions"
import { LoadingButton } from "@/components/ui/loading-button"
import { SessionExpiredDialog } from "@/components/session-expired-dialog"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"

export interface Link {
    id: number
    slug: string
    original_url: string
    created_at: string
    expires_at?: string | null // Add expiration field
    clicks: number
    user_email?: string
}

export function LinksTable({
    links,
    isAdmin = false,
    onDeleteSuccess,
    showClickStats = true,
    showCreator = false,
    enableMultiSelect = false
}: {
    links: Link[]
    isAdmin?: boolean
    onDeleteSuccess?: () => void
    showClickStats?: boolean
    showCreator?: boolean
    enableMultiSelect?: boolean
}) {
    const [multiSelectOpen, setMultiSelectOpen] = useState(false)
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
    const [isBatchDeleting, setIsBatchDeleting] = useState(false)
    const [showSessionExpired, setShowSessionExpired] = useState(false)

    const allIds = useMemo(() => links.map(l => l.id), [links])
    const validSelectedIds = useMemo(() => selectedIds.filter(id => allIds.includes(id)), [selectedIds, allIds])
    const selectedSet = useMemo(() => new Set(validSelectedIds), [validSelectedIds])
    const isAllSelected = validSelectedIds.length > 0 && validSelectedIds.length === allIds.length

    const toggleSelected = (id: number) => {
        setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
    }

    const toggleSelectAll = () => {
        setSelectedIds(isAllSelected ? [] : allIds)
    }

    const exitMultiSelect = () => {
        setMultiSelectOpen(false)
        setSelectedIds([])
        setBatchDeleteOpen(false)
        setIsBatchDeleting(false)
    }

    const handleBatchDelete = async () => {
        if (!isAdmin || validSelectedIds.length === 0) return

        setIsBatchDeleting(true)
        const result = await adminDeleteLinks(validSelectedIds)

        if (result?.needsLogin) {
            setIsBatchDeleting(false)
            setShowSessionExpired(true)
            return
        }

        if (result?.error) {
            toast.error("删除失败", { description: result.error })
            setIsBatchDeleting(false)
            return
        }

        toast.success("链接已删除", { description: `已删除 ${validSelectedIds.length} 条` })
        setIsBatchDeleting(false)
        setBatchDeleteOpen(false)
        setSelectedIds([])
        onDeleteSuccess?.()
    }

    // Empty 状态
    if (!links?.length) {
        return (
            <div className="rounded-lg border-2 border-dashed border-muted/60 bg-muted/10 py-12">
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia>
                            <Link2 className="text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyTitle>还没有创建链接</EmptyTitle>
                        <EmptyDescription>
                            你的短链接列表是空的。创建一个新的短链接并开始追踪点击数据吧。
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <CreateLinkDialog onSuccess={onDeleteSuccess} />
                    </EmptyContent>
                </Empty>
            </div>
        )
    }

    return (
        <>
            {enableMultiSelect && isAdmin && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Button
                            variant={multiSelectOpen ? "secondary" : "outline"}
                            onClick={() => {
                                if (multiSelectOpen) {
                                    exitMultiSelect()
                                } else {
                                    setMultiSelectOpen(true)
                                }
                            }}
                        >
                            {multiSelectOpen ? "退出多选" : "多选"}
                        </Button>

                        {multiSelectOpen && (
                            <>
                                <Button variant="outline" onClick={toggleSelectAll}>
                                    {isAllSelected ? "取消全选" : "全选"}
                                </Button>
                                <div className="text-sm text-muted-foreground">
                                    已选 {validSelectedIds.length} 条
                                </div>
                            </>
                        )}
                    </div>

                    {multiSelectOpen && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="destructive"
                                disabled={validSelectedIds.length === 0}
                                onClick={() => setBatchDeleteOpen(true)}
                            >
                                删除选中
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {links.map((link, index) => (
                    <LinkCard
                        key={link.id}
                        link={link}
                        isAdmin={isAdmin}
                        onDeleteSuccess={onDeleteSuccess}
                        index={index}
                        showClickStats={showClickStats}
                        showCreator={showCreator}
                        multiSelectEnabled={enableMultiSelect && isAdmin && multiSelectOpen}
                        selected={selectedSet.has(link.id)}
                        onToggleSelected={toggleSelected}
                    />
                ))}
            </div>

            <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确定删除选中链接吗？</AlertDialogTitle>
                        <AlertDialogDescription>
                            此操作无法撤销，这将永久删除选中的 {validSelectedIds.length} 条短链接及其相关数据。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isBatchDeleting}>取消</AlertDialogCancel>
                        <LoadingButton
                            onClick={(e) => {
                                e.preventDefault()
                                handleBatchDelete()
                            }}
                            loading={isBatchDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isBatchDeleting ? "删除中..." : "删除"}
                        </LoadingButton>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <SessionExpiredDialog open={showSessionExpired} onOpenChange={setShowSessionExpired} />
        </>
    )
}
