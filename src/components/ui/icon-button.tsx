'use client'

import { Button, type ButtonProps } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function IconButton({ label, children, ...props }: Omit<ButtonProps, 'asChild'> & { label: string }) {
    return <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" {...props} aria-label={label}>{children}</Button>
    </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip></TooltipProvider>
}
