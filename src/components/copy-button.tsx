'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { IconButton } from '@/components/ui/icon-button'
import { buildShortUrl } from '@/lib/link-model'

export function CopyButton({ slug }: { slug: string }) {
    const [copied, setCopied] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    useEffect(() => () => clearTimeout(timer.current), [])
    const copy = async () => {
        try {
            const url = buildShortUrl(slug, window.location.origin)
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url)
            else {
                const input = document.createElement('textarea')
                input.value = url
                input.style.position = 'fixed'
                document.body.appendChild(input)
                input.select()
                try { if (!document.execCommand('copy')) throw new Error('Copy failed') }
                finally { input.remove() }
            }
            setCopied(true)
            toast.success('链接已复制')
            clearTimeout(timer.current)
            timer.current = setTimeout(() => setCopied(false), 2000)
        } catch { toast.error('复制失败，请手动复制链接。') }
    }
    return <IconButton label="复制链接" onClick={copy} className="transition-transform active:scale-95">{copied ? <Check className="text-success" /> : <Copy className="text-muted-foreground" />}</IconButton>
}
