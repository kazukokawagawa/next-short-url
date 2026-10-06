'use server'

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 500): Promise<T> {
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try { return await fn() }
        catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(errorMessage(error))
            console.log(`[Retry] Attempt ${attempt}/${maxRetries} failed:`, errorMessage(error))
            if (attempt < maxRetries) await new Promise(resolve => setTimeout(resolve, delay))
        }
    }
    throw lastError ?? new Error('Operation failed')
}

export async function retryQuery<T>(
    queryFn: () => PromiseLike<{ data: T | null; error: { message?: string } | null }>,
    maxRetries = 3
): Promise<{ data: T | null; error: { message?: string } | null }> {
    let lastResult: { data: T | null; error: { message?: string } | null } = { data: null, error: null }
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            lastResult = await queryFn()
            if (!lastResult.error) return lastResult
            const errorMsg = lastResult.error.message?.toLowerCase() || ''
            const isNetworkError = ['fetch failed', 'network', 'timeout'].some(value => errorMsg.includes(value))
            if (!isNetworkError) return lastResult
            console.log(`[Retry] Query attempt ${attempt}/${maxRetries} failed (network error), retrying...`)
            if (attempt < maxRetries) await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error: unknown) {
            console.log(`[Retry] Query attempt ${attempt}/${maxRetries} threw exception:`, errorMessage(error))
            lastResult = { data: null, error: { message: errorMessage(error) } }
            if (attempt < maxRetries) await new Promise(resolve => setTimeout(resolve, 500))
        }
    }
    return lastResult
}
