'use server'

/**
 * URL 验证结果
 */
export interface UrlValidationResult {
    valid: boolean
    error?: string
    errorCode?: 'URL_MALICIOUS' | 'URL_NOT_ACCESSIBLE' | 'URL_TIMEOUT' | 'URL_VERIFICATION_FAILED' | 'URL_SUFFIX_BLOCKED' | 'URL_DOMAIN_BLOCKED' | 'SLUG_BLOCKED'
    threats?: string[]
    statusCode?: number
}

/**
 * Slug 验证结果
 */
export interface SlugValidationResult {
    valid: boolean
    error?: string
    errorCode?: 'SLUG_BLOCKED' | 'SLUG_INVALID_FORMAT'
}

/**
 * 验证 slug 格式
 * 只允许：大小写字母、数字、连字符、下划线
 */
export async function validateSlugFormat(slug: string): Promise<SlugValidationResult> {
    if (!slug) return { valid: true }

    const slugRegex = /^[a-zA-Z0-9_-]+$/
    if (!slugRegex.test(slug)) {
        return {
            valid: false,
            error: '自定义后缀只能包含字母、数字、连字符和下划线',
            errorCode: 'SLUG_INVALID_FORMAT'
        }
    }

    return { valid: true }
}

/**
 * 验证 slug 是否在黑名单中
 */
export async function validateSlugBlacklist(slug: string): Promise<SlugValidationResult> {
    if (!slug) return { valid: true }

    const { getSecurityConfig } = await import('@/lib/site-config')
    const securityConfig = await getSecurityConfig()

    if (securityConfig.blacklistSlug) {
        const blockedSlugs = securityConfig.blacklistSlug.split(/[,，]/).map(s => s.trim().toLowerCase()).filter(Boolean)
        if (blockedSlugs.length > 0) {
            const normalizedSlug = slug.toLowerCase()
            const matchedSlug = blockedSlugs.find(blocked => normalizedSlug === blocked)

            if (matchedSlug) {
                console.log(`[Slug Validation] 后缀被禁止: ${matchedSlug}`)
                return {
                    valid: false,
                    error: 'SLUG_BLOCKED',
                    errorCode: 'SLUG_BLOCKED'
                }
            }
        }
    }

    return { valid: true }
}

/**
 * 完整的 Slug 验证（格式 + 黑名单）
 * 用于统一替代分散的 slug 验证逻辑
 */
export async function validateSlug(slug: string): Promise<SlugValidationResult> {
    // 1. 空值直接通过
    if (!slug) return { valid: true }

    // 2. 格式验证
    const formatResult = await validateSlugFormat(slug)
    if (!formatResult.valid) {
        return formatResult
    }

    // 3. 黑名单验证
    const blacklistResult = await validateSlugBlacklist(slug)
    if (!blacklistResult.valid) {
        return blacklistResult
    }

    return { valid: true }
}


/**
 * 检查 URL 可用性
 */
async function checkUrlAvailability(url: string): Promise<{ accessible: boolean; statusCode?: number; timeout?: boolean }> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US) AppleWebKit/534.16 (KHTML, like Gecko) Chrome/10.0.648.133 Safari/534.16'
            }
        })

        clearTimeout(timeoutId)
        console.log('[URL Validation] URL 响应状态:', response.status, response.statusText)

        // 只要状态码不是 404 或 5xx，通常都视为可用
        // 注意：有些网站屏蔽 HEAD 请求会返回 405，这也算可用
        const accessible = response.status !== 404 && response.status < 500
        return { accessible, statusCode: response.status }
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.log('[URL Validation] URL 访问超时')
            return { accessible: false, timeout: true }
        }
        console.log('[URL Validation] URL 访问失败:', error)
        return { accessible: false }
    }
}

/**
 * 统一的 URL 验证函数
 * 包含 Safe Browsing 检测和可用性检查
 * 
 * @param url - 要验证的 URL
 * @param options - 配置选项
 * @returns UrlValidationResult
 */
export async function validateUrl(
    url: string,
    options: {
        checkAccessibility?: boolean  // 是否检查可用性，默认 true
        logPrefix?: string  // 日志前缀
    } = {}
): Promise<UrlValidationResult> {
    const { checkAccessibility = true, logPrefix = '[URL Validation]' } = options
    const { getSecurityConfig } = await import('@/lib/site-config')

    // 1. 获取安全配置
    const securityConfig = await getSecurityConfig()

    // 2. 检查 "跳过所有检查"
    if (securityConfig.skipAllChecks) {
        console.log(`${logPrefix} ⚠️ 安全设置已开启 "跳过所有检查"，验证直接通过`)
        return { valid: true }
    }

    // 3. 检查后缀黑名单
    if (securityConfig.blacklistSuffix) {
        const suffixes = securityConfig.blacklistSuffix.split(/[,，]/).map(s => s.trim()).filter(Boolean)
        if (suffixes.length > 0) {
            try {
                const urlObj = new URL(url)
                const path = urlObj.pathname.toLowerCase()
                // 检查是否以任意黑名单后缀结尾
                const matchedSuffix = suffixes.find(suffix => path.endsWith(suffix.toLowerCase()))

                if (matchedSuffix) {
                    console.log(`${logPrefix} URL 包含禁止的后缀: ${matchedSuffix}`)
                    return {
                        valid: false,
                        error: 'URL_SUFFIX_BLOCKED',
                        errorCode: 'URL_SUFFIX_BLOCKED', // 使用专用错误码
                        threats: [`Blocked Suffix: ${matchedSuffix}`]
                    }
                }
            } catch (e) {
                // URL 解析失败的情况，可能在前面已经被拦截，或者这里忽略
            }
        }
    }

    // 4. 检查域名黑名单
    if (securityConfig.blacklistDomain) {
        const domains = securityConfig.blacklistDomain.split(/[,，]/).map(d => d.trim()).filter(Boolean)
        if (domains.length > 0) {
            try {
                const urlObj = new URL(url)
                const hostname = urlObj.hostname.toLowerCase()
                // 检查域名是否包含或者是黑名单域名
                // 严格匹配：hostname === domain 或 hostname.endsWith('.' + domain)
                const matchedDomain = domains.find(domain => {
                    const d = domain.toLowerCase()
                    return hostname === d || hostname.endsWith('.' + d)
                })

                if (matchedDomain) {
                    console.log(`${logPrefix} URL 包含禁止的域名: ${matchedDomain}`)
                    return {
                        valid: false,
                        error: 'URL_DOMAIN_BLOCKED',
                        errorCode: 'URL_DOMAIN_BLOCKED', // 使用专用错误码
                        threats: [`Blocked Domain: ${matchedDomain}`]
                    }
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }
    }

    // --- Google Safe Browsing 检测 (优先) ---
    console.log(`${logPrefix} ===== Safe Browsing 检测开始 =====`)
    // 使用 securityConfig 中的配置
    // 注意：getSecurityConfig 返回的 key 是 safeBrowsingApiKey，而 checkUrlSafety 需要 apiKey

    if (securityConfig.safeBrowsingEnabled && securityConfig.safeBrowsingApiKey) {
        console.log(`${logPrefix} Safe Browsing 已启用，开始检测 URL:`, url)
        // 动态引入 checkUrlSafety 避免循环依赖如果 checkUrlSafety 在 safe-browsing.ts 中
        const { checkUrlSafety } = await import('@/lib/safe-browsing')
        const safetyResult = await checkUrlSafety(url, securityConfig.safeBrowsingApiKey)
        console.log(`${logPrefix} Safe Browsing 检测结果:`, safetyResult)

        if (!safetyResult.isSafe) {
            console.log(`${logPrefix} URL 被检测为恶意:`, url, safetyResult.threats)
            return {
                valid: false,
                error: 'URL_MALICIOUS',
                errorCode: 'URL_MALICIOUS',
                threats: safetyResult.threats
            }
        }
    } else {
        console.log(`${logPrefix} Safe Browsing 未启用或未配置 API Key，跳过检测`)
    }
    console.log(`${logPrefix} ===== Safe Browsing 检测结束 =====`)

    // --- URL 可用性检查 ---
    if (checkAccessibility) {
        console.log(`${logPrefix} ===== URL 可用性检查开始 =====`)
        console.log(`${logPrefix} 检测 URL:`, url)

        const availabilityResult = await checkUrlAvailability(url)

        if (!availabilityResult.accessible) {
            if (availabilityResult.timeout) {
                console.log(`${logPrefix} URL 访问超时`)
                return {
                    valid: false,
                    error: 'URL_TIMEOUT',
                    errorCode: 'URL_TIMEOUT'
                }
            }

            if (availabilityResult.statusCode) {
                console.log(`${logPrefix} URL 不可访问，状态码:`, availabilityResult.statusCode)
                return {
                    valid: false,
                    error: 'URL_NOT_ACCESSIBLE',
                    errorCode: 'URL_NOT_ACCESSIBLE',
                    statusCode: availabilityResult.statusCode
                }
            }

            console.log(`${logPrefix} URL 验证失败`)
            return {
                valid: false,
                error: 'URL_VERIFICATION_FAILED',
                errorCode: 'URL_VERIFICATION_FAILED'
            }
        }

        console.log(`${logPrefix} ✅ URL 可用性检查通过`)
        console.log(`${logPrefix} ===== URL 可用性检查结束 =====`)
    }

    return { valid: true }
}
