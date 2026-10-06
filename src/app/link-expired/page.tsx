import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LinkExpiredPage() {
    return <section className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center"><h1 className="text-2xl font-semibold">链接已过期</h1><p className="text-muted-foreground">此短链接已超过有效期，无法继续访问。</p><Button asChild variant="outline"><Link href="/"><ArrowLeft />返回首页</Link></Button></section>
}
