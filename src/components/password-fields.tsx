'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff, ChevronDown } from 'lucide-react'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { IconButton } from '@/components/ui/icon-button'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuCheckboxItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { AccessPolicyFields } from '@/components/access-policy-fields'
import { defaultAccessPolicy, type AccessPolicy } from '@/lib/access-policy'
import type { PasswordType } from '@/lib/link-model'
import { Reveal } from '@/components/animations/reveal'

export function PasswordFields({ type, value, onChange, onTypeChange, error, disabled, autoFocus, purpose = 'create', accessPolicy = defaultAccessPolicy, onAccessPolicyChange }: {
    type: PasswordType; value: string; onChange: (value: string) => void; onTypeChange?: (type: PasswordType) => void
    accessPolicy?: AccessPolicy; onAccessPolicyChange?: (value: AccessPolicy) => void
    error?: string; disabled?: boolean; autoFocus?: boolean; purpose?: 'create' | 'edit' | 'verify'
}) {
    const id = useId()
    const [visible, setVisible] = useState(false)
    const [contentEnabled, setContentEnabled] = useState(Boolean(accessPolicy.revealText))
    const summary = [type === 'six_digit' ? '6 位数字密码' : type === 'custom' ? '自定义口令' : '', accessPolicy.requireCaptcha ? '人机验证' : '', accessPolicy.waitSeconds ? `等待 ${accessPolicy.waitSeconds} 秒` : '', contentEnabled || accessPolicy.revealText ? '展示内容' : ''].filter(Boolean).join('、') || '无保护'
    return <div className="min-w-0 space-y-4">
        {onTypeChange && <FormField id={`${id}-type`} label="密码保护">
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button id={`${id}-type`} type="button" variant="outline" disabled={disabled} className="h-auto min-h-9 w-full justify-between"><span className="min-w-0 whitespace-normal text-left">{summary}</span><ChevronDown className="size-4 shrink-0" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                    <DropdownMenuRadioGroup value={type} onValueChange={value => { onTypeChange(value as PasswordType); onChange('') }}>
                        <DropdownMenuRadioItem value="none">无密码</DropdownMenuRadioItem><DropdownMenuRadioItem value="six_digit">6 位数字密码</DropdownMenuRadioItem><DropdownMenuRadioItem value="custom">自定义口令</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    {onAccessPolicyChange && <><DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem checked={accessPolicy.requireCaptcha} onSelect={event => event.preventDefault()} onCheckedChange={requireCaptcha => onAccessPolicyChange({ ...accessPolicy, requireCaptcha })}>人机验证</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={accessPolicy.waitSeconds > 0} onSelect={event => event.preventDefault()} onCheckedChange={checked => onAccessPolicyChange({ ...accessPolicy, waitSeconds: checked ? 5 : 0 })}>等待后访问</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={contentEnabled || Boolean(accessPolicy.revealText)} onSelect={event => event.preventDefault()} onCheckedChange={checked => { setContentEnabled(checked); if (!checked) onAccessPolicyChange({ ...accessPolicy, revealText: '' }) }}>展示内容</DropdownMenuCheckboxItem>
                    </>}
                </DropdownMenuContent>
            </DropdownMenu>
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
        {onAccessPolicyChange && <AccessPolicyFields value={accessPolicy} onChange={onAccessPolicyChange} disabled={disabled} showWait={accessPolicy.waitSeconds > 0} showContent={contentEnabled || Boolean(accessPolicy.revealText)} />}
    </div>
}
