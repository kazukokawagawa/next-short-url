'use client'

import { QRCodeSVG } from 'qrcode.react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useRef } from "react"
import { toast } from 'sonner'

interface QRCodeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    url: string
    slug: string
}

/**
 * 二维码弹窗组件
 */
export function QRCodeDialog({ open, onOpenChange, url, slug }: QRCodeDialogProps) {
    const qrRef = useRef<HTMLDivElement>(null)

    const handleDownload = () => {
        if (!qrRef.current) return

        const svg = qrRef.current.querySelector('svg')
        if (!svg) return

        // 创建 canvas 来转换 SVG 为 PNG
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) { toast.error('当前浏览器无法导出二维码'); return }

        const svgData = new XMLSerializer().serializeToString(svg)
        const img = new Image()

        img.onload = () => {
            try {
                canvas.width = 256
                canvas.height = 256
                ctx.fillStyle = 'white'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(img, 0, 0, 256, 256)
                const link = document.createElement('a')
                link.download = `qrcode-${slug}.png`
                link.href = canvas.toDataURL('image/png')
                link.click()
                toast.success('二维码已下载')
            } catch { toast.error('二维码下载失败，请重试。') }
        }
        img.onerror = () => toast.error('二维码加载失败，请重试。')
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[360px]">
                <DialogHeader>
                    <DialogTitle className="text-center">二维码</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                    {/* 二维码 */}
                    <div
                        ref={qrRef}
                        className="w-full max-w-[256px] bg-white"
                    >
                        <QRCodeSVG
                            value={url}
                            size={256}
                            className="h-auto w-full"
                            marginSize={4}
                            level="H"
                            includeMargin={true}
                        />
                    </div>

                    {/* 链接显示 */}
                    <p className="text-sm text-muted-foreground text-center break-all px-4">
                        {url}
                    </p>

                    {/* 下载按钮 */}
                    <Button
                        onClick={handleDownload}
                        variant="outline"
                        className="w-full gap-2"
                    >
                        <Download className="h-4 w-4" />
                        下载二维码
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
