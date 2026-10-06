// Used only by server-side authentication and middleware.
import { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * 认证工具函数
 * 封装重复的用户认证检查逻辑
 */

// 认证成功返回类型
export interface AuthSuccess {
    user: User
    error?: never
    needsLogin?: never
}

// 认证失败返回类型
export interface AuthError {
    user?: never
    error: string
    needsLogin?: boolean
}

// 认证结果联合类型
export type AuthResult = AuthSuccess | AuthError

/**
 * 获取当前用户，不强制登录
 * @returns 用户对象或 null
 */
export async function getCurrentUser(supabase: SupabaseClient): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

/**
 * 验证用户必须登录（用于 Server Actions）
 * 如果未登录，返回包含 needsLogin 标记的错误对象
 */
export async function getAccountProfile(supabase: SupabaseClient, userId: string) {
    const result = await supabase.from('profiles').select('id, role, status').eq('id', userId).single()
    // During rollout, legacy profiles have no status column. Never fall back for
    // permission/network errors or when a real disabled status is present.
    if (result.error?.code === '42703' && result.error.message.includes('status')) {
        const legacy = await supabase.from('profiles').select('id, role').eq('id', userId).single()
        return { ...legacy, data: legacy.data ? { ...legacy.data, status: 'active' as const } : null, legacySchema: true }
    }
    return { ...result, legacySchema: false }
}

export async function requireAuth(supabase: SupabaseClient): Promise<AuthResult> {
    const user = await getCurrentUser(supabase)

    if (!user) {
        return {
            error: "用户未登录",
            needsLogin: true
        }
    }

    const { data: profile, error } = await getAccountProfile(supabase, user.id)
    if (error || !profile) return { error: '账号信息暂不可用，请稍后重试' }
    if (profile.status !== 'active') return { error: '账号已被禁用' }

    return { user }
}

/**
 * 验证用户必须登录（用于 API 路由）
 * 如果未登录，抛出包含状态码的对象供 API 路由使用
 */
export async function requireAuthForApi(supabase: SupabaseClient) {
    const auth = await requireAuth(supabase)
    if (!auth.user) return { authenticated: false as const, user: null, error: auth.error, needsLogin: auth.needsLogin }
    return { authenticated: true as const, user: auth.user }
}

export async function requireAdmin(supabase: SupabaseClient): Promise<AuthResult> {
    const authResult = await requireAuth(supabase)
    if (!authResult.user) return authResult

    const { data: profile, error } = await getAccountProfile(supabase, authResult.user.id)

    if (error || profile?.role !== 'admin') {
        return { error: '无权限：需要管理员身份' }
    }

    if (profile.status && profile.status !== 'active') {
        return { error: '账号已被禁用' }
    }

    return { user: authResult.user }
}

/**
 * 检查用户是否可以执行公开操作
 * 用于支持 allowPublicShorten 的场景
 */
export interface PublicAccessSuccess {
    user: User | null
    error?: never
    needsLogin?: never
}

export interface PublicAccessError {
    user?: never
    error: string
    needsLogin?: boolean
}

export type PublicAccessResult = PublicAccessSuccess | PublicAccessError

export async function checkPublicAccess(
    supabase: SupabaseClient,
    allowPublic: boolean
): Promise<PublicAccessResult> {
    const user = await getCurrentUser(supabase)
    if (user) {
        const authResult = await requireAuth(supabase)
        if (authResult.error) return authResult
    }

    // 如果不允许公开操作且用户未登录
    if (!user && !allowPublic) {
        return {
            error: "用户未登录",
            needsLogin: true
        }
    }

    return { user }
}

