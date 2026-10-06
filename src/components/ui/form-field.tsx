import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { ComponentProps, ReactNode } from 'react'

export function FormField({ id, label, description, error, children }: {
    id: string; label: string; description?: string; error?: string; children: ReactNode
}) {
    return <div className="min-w-0 space-y-2">
        <Label htmlFor={id}>{label}</Label>
        {children}
        {description && <p id={`${id}-description`} className="text-xs text-muted-foreground">{description}</p>}
        {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
}

export function FormInput({ label, description, error, id, ...props }: ComponentProps<typeof Input> & {
    id: string; label: string; description?: string; error?: string
}) {
    return <FormField id={id} label={label} description={description} error={error}>
        <Input {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={[
            description && `${id}-description`, error && `${id}-error`
        ].filter(Boolean).join(' ') || undefined} />
    </FormField>
}
