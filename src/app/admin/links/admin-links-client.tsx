'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Container, PageHeader } from '@/components/page-header'
import { IconButton } from '@/components/ui/icon-button'
import { LinkList } from '@/app/dashboard/link-list'
import type { LinkSummary } from '@/lib/link-model'

export function AdminLinksClient({ links, viewerId, showClickStats }: { links: LinkSummary[]; viewerId: string; showClickStats: boolean }) {
    const router = useRouter()
    return <Container><PageHeader title="全局链接管理" description={`共 ${links.length} 条链接`} back={<IconButton label="返回管理控制台" onClick={() => router.push('/admin')}><ArrowLeft /></IconButton>} />
        <LinkList links={links} viewerId={viewerId} isAdmin onDeleteSuccess={() => router.refresh()} showClickStats={showClickStats} showCreator enableMultiSelect />
    </Container>
}
