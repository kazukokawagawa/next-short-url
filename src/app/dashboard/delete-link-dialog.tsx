'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { deleteLink } from './actions'
import { toast } from 'sonner'

export function DeleteLinkDialog({ id, onSuccess }: { id: number; onSuccess?: () => void }) {
    const [open, setOpen] = useState(false)
    return <><Button variant="destructive" onClick={() => setOpen(true)}><Trash2 />删除</Button>
        <ConfirmDeleteDialog open={open} onOpenChange={setOpen} count={1} object="链接" onConfirm={async () => {
            const result = await deleteLink(id)
            if (result.error) { toast.error(result.error); return false }
            onSuccess?.(); return true
        }} />
    </>
}
