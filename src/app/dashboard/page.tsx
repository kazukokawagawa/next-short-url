'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { ShieldCheck, LogOut, ArrowLeft } from 'lucide-react'
import { Container, PageHeader } from '@/components/page-header'
import { IconButton } from '@/components/ui/icon-button'
import { AsyncState } from '@/components/async-state'
import { LinkList } from './link-list'
import type { LinkSummary } from '@/lib/link-model'
import { CreateLinkDialog } from './create-link-dialog'
import { getLinkSettings, signOut } from './actions'
import { hasSupabaseConfig, SUPABASE_CONFIG_ERROR } from '@/lib/supabase-config'

export default function Dashboard() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [links, setLinks] = useState<LinkSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [isAdmin, setIsAdmin] = useState(false)
    const [stats, setStats] = useState(true)
    const [attempt, setAttempt] = useState(0)
    useEffect(() => {
        let active = true
        const load = async () => {
            setLoading(true)
            setError('')
            if (!hasSupabaseConfig()) {
                setError(SUPABASE_CONFIG_ERROR)
                setLoading(false)
                return
            }
            try {
                const client = createClient()
                const { data: { user }, error: authError } = await client.auth.getUser()
                if (!user) { router.replace('/login'); return }
                if (authError) throw authError
                const [{ data: profile, error: profileError }, { data, error: queryError }, settings] = await Promise.all([
                    client.from('profiles').select('role').eq('id', user.id).single(),
                    client.from('links').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                    getLinkSettings()
                ])
                if (queryError || profileError || settings.error) throw new Error(queryError?.message || profileError?.message || settings.error)
                if (active) { setUser(user); setLinks(data || []); setIsAdmin(profile?.role === 'admin'); setStats('enableClickStats' in settings ? settings.enableClickStats ?? true : true) }
            } catch { if (active) setError('控制台加载失败，请重试。') }
            finally { if (active) setLoading(false) }
        }
        load()
        return () => { active = false }
    }, [router, attempt])
    const refresh = () => setAttempt(value => value + 1)
    return <Container><PageHeader title="控制台" description={user?.email} actions={<>
        <IconButton label="返回首页" onClick={() => router.push('/')}><ArrowLeft /></IconButton>
        <CreateLinkDialog onSuccess={refresh} />
        {isAdmin && <IconButton label="管理控制台" onClick={() => router.push('/admin')}><ShieldCheck /></IconButton>}
        <form action={signOut}><IconButton type="submit" label="登出"><LogOut /></IconButton></form>
    </>} />
        {loading || error ? <AsyncState error={error} onRetry={refresh} /> : <LinkList links={links} viewerId={user?.id} isAdmin={isAdmin} onDeleteSuccess={refresh} showClickStats={stats} />}
    </Container>
}
