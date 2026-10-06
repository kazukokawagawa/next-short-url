'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LinkSummary } from '@/lib/link-model'
import { LinkCard } from './link-card'
import { CreateLinkDialog } from './create-link-dialog'
import { Link2, ListChecks, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { adminDeleteLinks } from '@/app/admin/actions'
import { toast } from 'sonner'

export function LinkList({ links, viewerId, isAdmin = false, onDeleteSuccess, showClickStats = true, showCreator = false, enableMultiSelect = false }: {
    links: LinkSummary[]; viewerId?: string; isAdmin?: boolean; onDeleteSuccess?: () => void; showClickStats?: boolean; showCreator?: boolean; enableMultiSelect?: boolean
}) {
    const [storedSelected, setSelected] = useState<number[]>([])
    const [multi, setMulti] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const ids = useMemo(() => links.map(link => link.id), [links])
    const selected = storedSelected.filter(id => ids.includes(id))
    const all = ids.length > 0 && selected.length === ids.length
    const empty = !links.length
    if (empty) return <section className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-[8px] border border-dashed p-8 text-center"><Link2 className="size-6 text-muted-foreground" /><h2 className="font-semibold">暂无短链接</h2><p className="text-sm text-muted-foreground">创建第一个链接后，它会显示在这里。</p><CreateLinkDialog onSuccess={onDeleteSuccess} /></section>
    const confirmBatch = async () => {
        const result = await adminDeleteLinks(selected)
        if (result.needsLogin) { toast.error('登录已过期'); return false }
        if (result.error) { toast.error('删除失败', { description: result.error }); return false }
        toast.success(`已删除 ${selected.length} 条链接`); setSelected([]); onDeleteSuccess?.(); return true
    }
    return <>
        {enableMultiSelect && isAdmin && <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant={multi ? 'secondary' : 'outline'} onClick={() => { setMulti(!multi); setSelected([]) }}><ListChecks />{multi ? '退出多选' : '多选'}</Button>
            {multi && <><Button variant="outline" onClick={() => setSelected(all ? [] : ids)}>{all ? '取消全选' : '全选'}</Button><span className="text-sm text-muted-foreground">已选 {selected.length} 条</span><Button variant="destructive" disabled={!selected.length} onClick={() => setDeleteOpen(true)}><Trash2 />删除选中</Button></>}
        </div>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><AnimatePresence initial={false}>{links.map((link, index) => <motion.div key={link.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="min-w-0"><LinkCard link={link} viewerId={viewerId} isAdmin={isAdmin} onDeleteSuccess={onDeleteSuccess} index={index} showClickStats={showClickStats} showCreator={showCreator} multiSelectEnabled={multi} selected={selected.includes(link.id)} onToggleSelected={id => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])} /></motion.div>)}</AnimatePresence></div>
        <ConfirmDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} count={selected.length} object="选中链接" onConfirm={confirmBatch} />
    </>
}
export { LinkList as LinksTable }
export type { LinkSummary as Link }
