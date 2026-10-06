'use client'

import { useId } from 'react'
import { FormField, FormInput } from '@/components/ui/form-field'
import { Textarea } from '@/components/ui/textarea'
import type { AccessPolicy } from '@/lib/access-policy'

export function AccessPolicyFields({ value, onChange, disabled, showWait = false, showContent = false }: { value: AccessPolicy; onChange: (value: AccessPolicy) => void; disabled?: boolean; showWait?: boolean; showContent?: boolean }) {
    const id = useId()
    if (!showWait && !showContent) return null
    return <div className="space-y-4">
        {showWait && <FormInput id={`${id}-wait`} label="访问前等待（秒）" type="number" min={0} max={300} step={1} required value={value.waitSeconds} onChange={event => onChange({ ...value, waitSeconds: Number(event.target.value) })} disabled={disabled} />}
        {showContent && <FormField id={`${id}-text`} label="等待期间展示的内容（可选）"><Textarea id={`${id}-text`} value={value.revealText} onChange={event => onChange({ ...value, revealText: event.target.value })} maxLength={2000} disabled={disabled} rows={3} /></FormField>}
    </div>
}
