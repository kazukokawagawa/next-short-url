'use client'

import { useRouter } from "next/navigation"
import { LinksTable, type Link } from "@/app/dashboard/links-table"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { FadeIn } from "@/components/animations/fade-in"
import { useLoading } from "@/components/providers/loading-provider"

export function AdminLinksClient({ links }: { links: Link[] }) {
    const router = useRouter()
    const { setIsLoading: setGlobalLoading } = useLoading()

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8">
            <div className="mb-8 flex flex-col items-start justify-between gap-4 border-b border-border/40 pb-6 md:flex-row md:items-center">
                <FadeIn delay={0} className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setGlobalLoading(true)
                            router.push("/admin")
                        }}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">全局链接管理</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            查看和管理系统内的所有短链接
                        </p>
                    </div>
                </FadeIn>
            </div>

            <LinksTable
                links={links}
                isAdmin={true}
                onDeleteSuccess={() => router.refresh()}
                showCreator={true}
                enableMultiSelect={true}
            />
        </div>
    )
}

