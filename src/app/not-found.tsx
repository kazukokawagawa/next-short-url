import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
    return <section className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center"><h1 className="text-2xl font-semibold">链接不存在</h1><p className="text-muted-foreground">此链接可能已删除或失效。</p><Button asChild variant="outline"><Link href="/"><ArrowLeft />返回首页</Link></Button></section>
}
