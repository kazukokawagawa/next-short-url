'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, LoaderCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function AsyncState({ error, onRetry, fullScreen = true }: { error?: string; onRetry?: () => void; fullScreen?: boolean }) {
    const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
    const reducedMotion = useReducedMotion()
    const content = <motion.div role={error ? 'alert' : 'status'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={fullScreen ? 'fixed inset-0 z-40 flex items-center justify-center bg-background px-4 text-center' : 'flex min-h-48 items-center justify-center px-4 py-8 text-center'}>
        <motion.div initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="relative isolate flex w-full max-w-sm flex-col items-center gap-4">
            <div aria-hidden="true" className="loading-halo pointer-events-none absolute -top-8 -z-10 size-28 rounded-full bg-primary/10 blur-2xl" />
            {error ? <AlertCircle className="size-7 text-destructive" /> : <LoaderCircle className="size-8 animate-spin text-primary" />}
            <p className={`max-w-lg break-words text-sm text-muted-foreground ${error ? '' : 'loading-caption'}`}>{error || '正在加载'}</p>
            {error && onRetry && <Button variant="outline" onClick={onRetry}><RotateCcw />重试</Button>}
        </motion.div>
    </motion.div>
    // Portals keep viewport centering independent of animated parent transforms.
    return fullScreen && mounted ? createPortal(content, document.body) : content
}
