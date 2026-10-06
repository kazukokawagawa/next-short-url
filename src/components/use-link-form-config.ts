'use client'

import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import { getLinksSettings } from '@/app/dashboard/settings-actions'

export function useLinkFormConfig() {
    const [config, setConfig] = useState({ slugLength: 6, defaultExpiration: 0, placeholderSlug: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [attempt, setAttempt] = useState(0)
    useEffect(() => {
        let active = true
        getLinksSettings().then(settings => {
            if (settings.error) throw new Error(settings.error)
            if (active) { setConfig({ ...settings, placeholderSlug: nanoid(settings.slugLength) }); setError('') }
        }).catch(() => { if (active) setError('链接配置加载失败，请重试。') }).finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [attempt])
    return { ...config, error, loading, retry: () => { setLoading(true); setAttempt(value => value + 1) } }
}
