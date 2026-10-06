'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

/** Height transitions for optional form content; keeps the surrounding layout flowing. */
export function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
    const reducedMotion = useReducedMotion()
    return <AnimatePresence initial={false}>
        {show && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'clip' }}>
            <div className="py-1">{children}</div>
        </motion.div>}
    </AnimatePresence>
}
