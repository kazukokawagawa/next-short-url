'use client'

import { AsyncState } from '@/components/async-state'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <AsyncState error="页面加载失败，请重试。" onRetry={reset} />
}
