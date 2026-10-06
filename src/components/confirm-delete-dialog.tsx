'use client'

import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { LoadingButton } from '@/components/ui/loading-button'

export function ConfirmDeleteDialog({ open, onOpenChange, count, object, onConfirm }: {
    open: boolean; onOpenChange: (open: boolean) => void; count?: number; object: string; onConfirm: () => Promise<boolean>
}) {
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const locked = useRef(false)
    const confirm = async () => {
        if (locked.current || count === 0) return
        locked.current = true
        setPending(true)
        setError('')
        try { if (await onConfirm()) onOpenChange(false) }
        catch { setError('删除失败，请稍后重试。') }
        finally { locked.current = false; setPending(false) }
    }
    return <AlertDialog open={open} onOpenChange={value => { if (!pending) { setError(''); onOpenChange(value) } }}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>确认删除{object}？</AlertDialogTitle>
                <AlertDialogDescription className="break-all">{count !== undefined ? `将删除 ${count} 条记录。` : ''}此操作无法撤销。</AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <AlertDialogFooter><AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
                <LoadingButton variant="destructive" loading={pending} disabled={count === 0} icon={<Trash2 />} onClick={confirm}>确认删除</LoadingButton>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
}
