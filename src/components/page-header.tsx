import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Container({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('mx-auto w-full max-w-6xl px-4 py-6 md:py-8 text-sm leading-relaxed', className)}>{children}</div>
}

export function PageHeader({ title, description, actions, back }: {
    title: string; description?: ReactNode; actions?: ReactNode; back?: ReactNode
}) {
    return <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
            {back}
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold leading-relaxed">{title}</h1>
                {description && <div className="mt-1 break-all text-sm text-muted-foreground">{description}</div>}
            </div>
        </div>
        {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </header>
}
