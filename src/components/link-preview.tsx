'use client'

import { useSyncExternalStore } from 'react'
import { Globe, Link2, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { buildShortUrl } from '@/lib/link-model'

const subscribe = () => () => {}
const getOrigin = () => window.location.origin
const getServerOrigin = () => ''

export function LinkPreview({ url, slug, placeholder }: { url: string; slug: string; placeholder: string }) {
    const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin)
    const host = origin ? new URL(buildShortUrl(placeholder, origin)).host : '…'
    return <div className="min-w-0 space-y-3 rounded-[8px] border border-border/70 bg-muted/30 p-4">
        <div className="flex min-h-4 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>预览效果</span>
            <AnimatePresence>
                {slug && <motion.span initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400"><Sparkles className="size-3" />开启自定义后缀</motion.span>}
            </AnimatePresence>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <span className="flex size-8 shrink-0 items-center justify-center rounded border bg-background"><Link2 className="size-4" /></span>
            <p className="min-w-0 flex-1 truncate border-b border-dashed py-1 text-sm" title={url}>{url || 'https://example.com/long-url'}</p>
        </div>
        <div aria-hidden="true" className="-my-2 ml-4 h-5 border-l" />
        <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded border bg-background"><Globe className="size-4 text-primary" /></span>
            <p className="min-w-0 flex-1 break-all rounded border bg-background px-2 py-1 text-sm">
                <span className="text-muted-foreground">{host}/</span>{slug ? <span className="rounded bg-purple-500/10 px-1 font-bold"><span className="suffix-text-shine">{slug}</span></span> : <span className="text-muted-foreground">{placeholder}</span>}
            </p>
        </div>
    </div>
}
