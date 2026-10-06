'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { IconButton } from '@/components/ui/icon-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PasswordType } from '@/lib/link-model'
import { Reveal } from '@/components/animations/reveal'

export function PasswordFields({ type, value, onChange, onTypeChange, error, disabled, autoFocus, purpose = 'create' }: {
    type: PasswordType; value: string; onChange: (value: string) => void; onTypeChange?: (type: PasswordType) => void
    error?: string; disabled?: boolean; autoFocus?: boolean; purpose?: 'create' | 'edit' | 'verify'
}) {
    const id = useId()
    const [visible, setVisible] = useState(false)
    return <div className="min-w-0 space-y-4">
        {onTypeChange && <FormField id={`${id}-type`} label="密码保护">
            <Select value={type} onValueChange={value => { onTypeChange(value as PasswordType); onChange('') }} disabled={disabled}>
                <SelectTrigger id={`${id}-type`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">无密码</SelectItem><SelectItem value="six_digit">6 位数字密码</SelectItem><SelectItem value="custom">自定义口令</SelectItem></SelectContent>
            </Select>
        </FormField>}
        <Reveal show={type !== 'none'}><FormField id={id} label={purpose === 'verify' ? '访问密码' : '链接密码'} error={error}>
            {type === 'six_digit' ? <InputOTP id={id} maxLength={6} value={value} onChange={value => onChange(value.replace(/\D/g, ''))}
                disabled={disabled} autoFocus={autoFocus} inputMode="numeric" pattern="[0-9]*" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
                autoComplete={purpose === 'verify' ? 'one-time-code' : 'off'} containerClassName="grid w-full min-w-0 grid-cols-6 gap-2">
                {Array.from({ length: 6 }, (_, index) => <InputOTPGroup key={index} className="min-w-0"><InputOTPSlot index={index} className="h-11 w-full min-w-0 rounded-[6px]" aria-invalid={Boolean(error)} /></InputOTPGroup>)}
            </InputOTP> : <div className="relative">
                <Input id={id} type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} maxLength={128}
                    autoFocus={autoFocus} disabled={disabled} autoComplete={purpose === 'verify' ? 'off' : 'new-password'} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="pr-12" />
                <IconButton label={visible ? '隐藏口令' : '显示口令'} onClick={() => setVisible(!visible)} className="absolute right-0 top-0" disabled={disabled}>{visible ? <EyeOff /> : <Eye />}</IconButton>
            </div>}
        </FormField></Reveal>
    </div>
}
