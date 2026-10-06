'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Link2, Settings2, UserRoundCog } from 'lucide-react'
import { Container, PageHeader } from '@/components/page-header'
import { IconButton } from '@/components/ui/icon-button'
import { AsyncState } from '@/components/async-state'
import { hasSupabaseConfig, SUPABASE_CONFIG_ERROR } from '@/lib/supabase-config'

export default function AdminPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)
    useEffect(() => {
        let active = true
        const check = async () => {
            setLoading(true)
            setError('')
            if (!hasSupabaseConfig()) {
                setError(SUPABASE_CONFIG_ERROR)
                setLoading(false)
                return
            }
            try {
                const client = createClient()
                const { data: { user } } = await client.auth.getUser()
                if (!user) { router.replace('/login'); return }
                const { data, error } = await client.from('profiles').select('role').eq('id', user.id).single()
                if (error) throw error
                if (data?.role !== 'admin') { router.replace('/dashboard'); return }
            } catch { if (active) setError('管理员权限验证失败，请重试。') }
            finally { if (active) setLoading(false) }
        }
        check()
        return () => { active = false }
    }, [router, attempt])
    return <Container><PageHeader title="管理控制台" back={<IconButton label="返回用户控制台" onClick={() => router.push('/dashboard')}><ArrowLeft /></IconButton>} />
        {loading || error ? <AsyncState error={error} onRetry={() => setAttempt(value => value + 1)} /> : <div className="grid gap-4 md:grid-cols-3">
            <Link href="/admin/links" className="flex items-center gap-3 rounded-[8px] border bg-card p-4 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><Link2 className="size-5 text-info" /><span className="font-semibold">全局链接管理</span></Link>
            <Link href="/admin/settings" className="flex items-center gap-3 rounded-[8px] border bg-card p-4 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><Settings2 className="size-5 text-muted-foreground" /><span className="font-semibold">系统设置</span></Link>
            <Link href="/admin/users" className="flex items-center gap-3 rounded-[8px] border bg-card p-4 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><UserRoundCog className="size-5 text-info" /><span className="font-semibold">用户与权限</span></Link>
        </div>}
    </Container>
}
