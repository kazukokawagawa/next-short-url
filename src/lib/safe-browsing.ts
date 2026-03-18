'use server'

/**
 * Google Safe Browsing API v5 Lookup
 * 检测 URL 是否为恶意网址
 * 
 * 支持检测的威胁类型：
 * - MALWARE: 恶意软件
 * - SOCIAL_ENGINEERING: 社会工程/钓鱼
 * - UNWANTED_SOFTWARE: 不需要的软件
 * - POTENTIALLY_HARMFUL_APPLICATION: 潜在有害应用
 */

interface ThreatUrl {
    url: string
    threatTypes: string[]
}

interface SearchUrlsResponse {
    threats?: ThreatUrl[]
    cacheDuration?: string
}

export interface SafeBrowsingResult {
    isSafe: boolean
    threats?: string[]
    error?: string
}

// 威胁类型映射（用于友好显示）
const THREAT_TYPE_MAP: Record<string, string> = {
    'MALWARE': '恶意软件',
    'SOCIAL_ENGINEERING': '钓鱼/社会工程攻击',
    'UNWANTED_SOFTWARE': '不需要的软件',
    'POTENTIALLY_HARMFUL_APPLICATION': '潜在有害应用'
}

const THREAT_TYPE_NUMBER_TO_NAME: Record<number, string> = {
    0: 'THREAT_TYPE_UNSPECIFIED',
    1: 'MALWARE',
    2: 'SOCIAL_ENGINEERING',
    3: 'UNWANTED_SOFTWARE',
    4: 'POTENTIALLY_HARMFUL_APPLICATION'
}

const SAFE_BROWSING_CACHE = new Map<string, { expiresAtMs: number; result: SafeBrowsingResult }>()

const TEXT_DECODER = new TextDecoder()

function parseCacheDurationToMs(cacheDuration: string | undefined): number {
    const seconds = cacheDuration?.endsWith('s')
        ? Number.parseFloat(cacheDuration.slice(0, -1))
        : Number.NaN
    if (!Number.isFinite(seconds) || seconds < 0) return 0
    return Math.floor(seconds * 1000)
}

type ProtoParseResult =
    | { ok: true; value: number; nextOffset: number }
    | { ok: false; nextOffset: number }

function readVarint(bytes: Uint8Array, offset: number): ProtoParseResult {
    let result = 0
    let shift = 0
    let i = offset

    while (i < bytes.length) {
        const b = bytes[i]!
        if (shift >= 53) return { ok: false, nextOffset: i }
        result += (b & 0x7f) * Math.pow(2, shift)
        i += 1
        if ((b & 0x80) === 0) {
            return { ok: true, value: result, nextOffset: i }
        }
        shift += 7
    }

    return { ok: false, nextOffset: i }
}

function skipField(bytes: Uint8Array, offset: number, wireType: number): number {
    if (wireType === 0) {
        const v = readVarint(bytes, offset)
        return v.nextOffset
    }
    if (wireType === 1) return Math.min(bytes.length, offset + 8)
    if (wireType === 2) {
        const len = readVarint(bytes, offset)
        if (!len.ok) return len.nextOffset
        return Math.min(bytes.length, len.nextOffset + len.value)
    }
    if (wireType === 5) return Math.min(bytes.length, offset + 4)
    return bytes.length
}

function parseThreatUrlProto(bytes: Uint8Array): ThreatUrl {
    let url = ''
    const threatTypes: string[] = []
    let offset = 0
    const toThreatTypeName = (n: number) => THREAT_TYPE_NUMBER_TO_NAME[n] ?? String(n)

    while (offset < bytes.length) {
        const tag = readVarint(bytes, offset)
        if (!tag.ok) break
        offset = tag.nextOffset

        const fieldNumber = tag.value >>> 3
        const wireType = tag.value & 0x7

        if (fieldNumber === 1 && wireType === 2) {
            const len = readVarint(bytes, offset)
            if (!len.ok) break
            offset = len.nextOffset
            const end = Math.min(bytes.length, offset + len.value)
            url = TEXT_DECODER.decode(bytes.slice(offset, end))
            offset = end
            continue
        }

        if (fieldNumber === 2) {
            if (wireType === 0) {
                const v = readVarint(bytes, offset)
                if (!v.ok) break
                threatTypes.push(toThreatTypeName(v.value))
                offset = v.nextOffset
                continue
            }

            if (wireType === 2) {
                const len = readVarint(bytes, offset)
                if (!len.ok) break
                offset = len.nextOffset
                const end = Math.min(bytes.length, offset + len.value)
                while (offset < end) {
                    const v = readVarint(bytes, offset)
                    if (!v.ok) break
                    threatTypes.push(toThreatTypeName(v.value))
                    offset = v.nextOffset
                }
                offset = end
                continue
            }
        }

        offset = skipField(bytes, offset, wireType)
    }

    return { url, threatTypes }
}

function parseDurationMsProto(bytes: Uint8Array): number {
    let seconds = 0
    let nanos = 0
    let offset = 0

    while (offset < bytes.length) {
        const tag = readVarint(bytes, offset)
        if (!tag.ok) break
        offset = tag.nextOffset

        const fieldNumber = tag.value >>> 3
        const wireType = tag.value & 0x7

        if (wireType !== 0) {
            offset = skipField(bytes, offset, wireType)
            continue
        }

        const v = readVarint(bytes, offset)
        if (!v.ok) break
        offset = v.nextOffset

        if (fieldNumber === 1) seconds = v.value
        if (fieldNumber === 2) nanos = v.value
    }

    if (!Number.isFinite(seconds) || seconds < 0) return 0
    if (!Number.isFinite(nanos) || nanos < 0) nanos = 0
    return Math.floor(seconds * 1000 + nanos / 1_000_000)
}

function parseSearchUrlsResponseProto(bytes: Uint8Array): { threats: ThreatUrl[]; cacheMs: number } {
    const threats: ThreatUrl[] = []
    let cacheMs = 0
    let offset = 0

    while (offset < bytes.length) {
        const tag = readVarint(bytes, offset)
        if (!tag.ok) break
        offset = tag.nextOffset

        const fieldNumber = tag.value >>> 3
        const wireType = tag.value & 0x7

        if (wireType !== 2) {
            offset = skipField(bytes, offset, wireType)
            continue
        }

        const len = readVarint(bytes, offset)
        if (!len.ok) break
        offset = len.nextOffset
        const end = Math.min(bytes.length, offset + len.value)
        const chunk = bytes.slice(offset, end)
        offset = end

        if (fieldNumber === 1) {
            threats.push(parseThreatUrlProto(chunk))
            continue
        }

        if (fieldNumber === 2) {
            cacheMs = parseDurationMsProto(chunk)
            continue
        }
    }

    return { threats, cacheMs }
}

function normalizeThreatTypes(threatTypes: string[]): string[] {
    return threatTypes.map(type => THREAT_TYPE_MAP[type] || type)
}

async function readSearchUrlsResponse(response: Response): Promise<{ threats: ThreatUrl[]; cacheMs: number }> {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
        const data: SearchUrlsResponse = await response.json()
        return {
            threats: data.threats ?? [],
            cacheMs: parseCacheDurationToMs(data.cacheDuration)
        }
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    const parsed = parseSearchUrlsResponseProto(bytes)
    return {
        threats: parsed.threats,
        cacheMs: parsed.cacheMs
    }
}

/**
 * 使用 Google Safe Browsing API v5 检测 URL 安全性
 * 
 * @param url - 要检测的 URL
 * @param apiKey - Google API Key
 * @returns SafeBrowsingResult - 包含 isSafe 和可能的威胁列表
 */
export async function checkUrlSafety(url: string, apiKey: string): Promise<SafeBrowsingResult> {
    console.log('[Safe Browsing] ========== 开始检测 ==========')
    console.log('[Safe Browsing] 检测 URL:', url)
    console.log('[Safe Browsing] API Key 已配置:', apiKey ? `是 (长度: ${apiKey.length})` : '否')

    if (!apiKey) {
        console.log('[Safe Browsing] 跳过检测: API Key 未配置')
        return { isSafe: true, error: 'API Key 未配置' }
    }

    const cached = SAFE_BROWSING_CACHE.get(url)
    if (cached && cached.expiresAtMs > Date.now()) {
        console.log('[Safe Browsing] 命中缓存，跳过 API 请求')
        return cached.result
    }

    const requestUrl = new URL('https://safebrowsing.googleapis.com/v5/urls:search')
    requestUrl.searchParams.set('key', apiKey)
    requestUrl.searchParams.append('urls', url)

    console.log('[Safe Browsing] 发送 API 请求...', requestUrl.origin + requestUrl.pathname)

    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时

        const response = await fetch(requestUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: controller.signal
        })

        clearTimeout(timeoutId)

        console.log('[Safe Browsing] API 响应状态:', response.status, response.statusText)

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[Safe Browsing] API 请求失败:', response.status, response.statusText)
            console.error('[Safe Browsing] 错误详情:', errorText)
            // API 错误时 fallback 为安全，避免阻塞正常链接创建
            return { isSafe: true, error: `API 请求失败: ${response.status}` }
        }

        const decoded = await readSearchUrlsResponse(response)
        console.log('[Safe Browsing] API 响应解析完成:', {
            threatCount: decoded.threats.length,
            cacheMs: decoded.cacheMs
        })

        const cacheResult = (result: SafeBrowsingResult) => {
            if (decoded.cacheMs > 0) {
                SAFE_BROWSING_CACHE.set(url, { expiresAtMs: Date.now() + decoded.cacheMs, result })
            }
            return result
        }

        if (decoded.threats.length > 0) {
            const threats = normalizeThreatTypes(decoded.threats.flatMap(threat => threat.threatTypes))

            console.log('[Safe Browsing] ⚠️ 检测到威胁:', threats)
            console.log('[Safe Browsing] ========== 检测完成 (不安全) ==========')
            return cacheResult({
                isSafe: false,
                threats: [...new Set(threats)]
            })
        }

        console.log('[Safe Browsing] ✅ URL 安全，未检测到威胁')
        console.log('[Safe Browsing] ========== 检测完成 (安全) ==========')
        return cacheResult({ isSafe: true })

    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('[Safe Browsing] API 请求超时')
            // 超时时 fallback 为安全
            return { isSafe: true, error: 'API 请求超时' }
        }

        console.error('[Safe Browsing] API 调用异常:', error)
        // 其他错误也 fallback 为安全
        return { isSafe: true, error: '检测服务暂时不可用' }
    }
}
