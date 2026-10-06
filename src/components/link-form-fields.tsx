'use client'

import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormInput, FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PasswordFields } from '@/components/password-fields'
import { LinkPreview } from '@/components/link-preview'
import type { PasswordType } from '@/lib/link-model'
import { defaultAccessPolicy, type AccessPolicy } from '@/lib/access-policy'
export type { PasswordType } from '@/lib/link-model'

interface LinkFormFieldsProps {
    url: string; setUrl: (value: string) => void; slug: string; setSlug: (value: string) => void
    showCustomOption: boolean; setShowCustomOption: (value: boolean) => void
    placeholderSlug?: string; defaultExpiration?: number
    expiresAt?: string; setExpiresAt?: (value: string | undefined) => void
    passwordType: PasswordType; setPasswordType: (value: PasswordType) => void
    password: string; setPassword: (value: string) => void
    passwordError?: string; setPasswordError: (value: string) => void
    accessPolicy?: AccessPolicy; setAccessPolicy?: (value: AccessPolicy) => void
    urlError?: string; slugError?: string; disabled?: boolean
}

export function LinkFormFields(props: LinkFormFieldsProps) {
    const id = useId()
    const reducedMotion = useReducedMotion()
    const [duration, setDuration] = useState('default')
    const [custom, setCustom] = useState('1')
    const [unit, setUnit] = useState('1440')
    const defaultMinutes = props.defaultExpiration || 0
    const defaultDurationLabel = defaultMinutes <= 0 ? '永不过期'
        : defaultMinutes >= 2880 && defaultMinutes % 1440 === 0 ? `${defaultMinutes / 1440} 天`
            : defaultMinutes % 60 === 0 ? `${defaultMinutes / 60} 小时` : `${defaultMinutes} 分钟`
    const updateExpiration = (option: string, amount = custom, multiplier = unit) => {
        setDuration(option)
        const minutes = option === 'default' ? props.defaultExpiration || 0 : option === 'custom' ? Number(amount) * Number(multiplier) : Number(option)
        if (!Number.isFinite(minutes) || minutes < 0) return
        props.setExpiresAt?.(minutes > 0 ? new Date(Date.now() + Math.min(minutes, 525600 * 1440) * 60000).toISOString() : '')
    }
    return <div className="min-w-0 space-y-4">
        <FormInput id={`${id}-url`} name="url" label="原始 URL" type="url" placeholder="https://example.com/" value={props.url} onChange={event => props.setUrl(event.target.value)} error={props.urlError} disabled={props.disabled} autoComplete="url" required />
        <Button disabled={props.disabled} type="button" variant="ghost" className="justify-start px-0" aria-expanded={props.showCustomOption} aria-controls={`${id}-advanced`} onClick={() => props.setShowCustomOption(!props.showCustomOption)}>
            <ChevronDown className={`transition-transform duration-200 ${props.showCustomOption ? 'rotate-180' : ''}`} />高级选项
        </Button>
            <AnimatePresence initial={false}>
                {props.showCustomOption && <motion.div
                    id={`${id}-advanced`}
                    key="advanced-options"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                >
                    <div className="space-y-4 p-1">
                        <LinkPreview url={props.url} slug={props.slug} placeholder={props.placeholderSlug || 'my-link'} />
                        <FormInput id={`${id}-slug`} label="自定义后缀（可选）" placeholder={props.placeholderSlug || 'my-link'} value={props.slug} onChange={event => props.setSlug(event.target.value)} error={props.slugError} disabled={props.disabled} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} className={props.slug ? 'suffix-text-shine' : undefined} description="字母、数字、连字符和下划线" />
                        <FormField id={`${id}-expiration`} label="有效期">
                            <Select value={duration} onValueChange={value => updateExpiration(value)} disabled={props.disabled}>
                                <SelectTrigger id={`${id}-expiration`} className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="default">默认（{defaultDurationLabel}）</SelectItem>
                                    <SelectItem value="0">永不过期</SelectItem><SelectItem value="60">1 小时</SelectItem><SelectItem value="1440">24 小时</SelectItem><SelectItem value="10080">7 天</SelectItem><SelectItem value="43200">30 天</SelectItem><SelectItem value="custom">自定义时间</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormField>
                        <AnimatePresence initial={false}>
                            {duration === 'custom' && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="grid grid-cols-2 gap-2">
                                <FormInput id={`${id}-duration`} label="时长" disabled={props.disabled} type="number" min={1} max={525600} value={custom} onChange={event => { setCustom(event.target.value); updateExpiration('custom', event.target.value) }} required />
                                <FormField id={`${id}-unit`} label="单位"><Select disabled={props.disabled} value={unit} onValueChange={value => { setUnit(value); updateExpiration('custom', custom, value) }}><SelectTrigger id={`${id}-unit`} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">分钟</SelectItem><SelectItem value="60">小时</SelectItem><SelectItem value="1440">天</SelectItem></SelectContent></Select></FormField>
                            </motion.div>}
                        </AnimatePresence>
                        <PasswordFields accessPolicy={props.accessPolicy} onAccessPolicyChange={props.setAccessPolicy} type={props.passwordType} value={props.password} onTypeChange={props.setPasswordType} onChange={value => { props.setPassword(value); props.setPasswordError('') }} error={props.passwordError} disabled={props.disabled} />
                    </div>
                </motion.div>}
            </AnimatePresence>
        <input type="hidden" name="slug" value={props.slug} />
        <input type="hidden" name="passwordType" value={props.passwordType} />
        <input type="hidden" name="accessPolicy" value={JSON.stringify(props.accessPolicy || defaultAccessPolicy)} />
        <input type="hidden" name="password" value={props.password} />
    </div>
}
