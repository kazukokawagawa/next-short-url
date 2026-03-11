import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { GitCommit, Clock } from "lucide-react"
import { format } from "date-fns"
import { getSiteConfig } from "@/lib/site-config"

export async function SiteFooter() {
    const siteConfig = await getSiteConfig()

    return (
        <footer className="w-full py-6 text-center text-xs text-muted-foreground bg-transparent">
            <div className="container mx-auto">
                <p>
                    &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
                </p>

                <div className="mt-2 flex items-center justify-center gap-4">
                    {/* 作者信息 */}
                    <span>
                        Built by <a href={siteConfig.authorUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">{siteConfig.authorName}</a>
                    </span>

                    {/* 分隔符 */}
                    <span className="text-muted-foreground/30">|</span>

                    {/* 版本信息 (带 Tooltip) */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help hover:text-foreground transition-colors">
                                    {/* 显示简短版本号: v1.0.0 */}
                                    <span>v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
                                    {/* 如果是生产环境，显示 Commit Hash 的前几位 */}
                                    {process.env.NEXT_PUBLIC_COMMIT_HASH !== 'dev-build' && (
                                        <span className="font-mono text-[10px] text-foreground/60">
                                            ({process.env.NEXT_PUBLIC_COMMIT_HASH})
                                        </span>
                                    )}
                                </div>
                            </TooltipTrigger>

                            {/* 悬停显示的详细信息 */}
                            <TooltipContent className="text-xs">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <GitCommit className="h-3 w-3" />
                                        <span>Commit: {process.env.NEXT_PUBLIC_COMMIT_HASH}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-3 w-3" />
                                        <span>Built: {process.env.NEXT_PUBLIC_BUILD_TIME ? format(new Date(process.env.NEXT_PUBLIC_BUILD_TIME), 'yyyy-MM-dd HH:mm') : 'Local'}</span>
                                    </div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* 分隔符 */}
                    <span className="text-muted-foreground/30">|</span>

                    {/* 萌ICP备 */}
                    <a href="https://icp.gov.moe/?keyword=20269222" target="_blank" className="hover:text-foreground transition-colors">
                        萌ICP备20269222号
                    </a>
                </div>
            </div>
        </footer>
    )
}

