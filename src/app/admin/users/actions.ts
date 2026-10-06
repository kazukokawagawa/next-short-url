'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/utils/auth'
import { getFriendlyErrorMessage } from '@/utils/error-mapping'

export type AdminUser = {
    id: string
    email: string | null
    display_name: string | null
    role: 'user' | 'admin'
    status: 'active' | 'disabled'
    created_at: string
    updated_at: string
    last_seen_at: string | null
    link_count: number
}

export type UserFilters = { search?: string; role?: 'all' | 'user' | 'admin'; status?: 'all' | 'active' | 'disabled'; page?: number }

export async function listAdminUsers(filters: UserFilters = {}): Promise<{ users: AdminUser[]; total: number; page: number; pageSize: number; error?: string; needsLogin?: boolean }> {
    const supabase = await createClient()
    const authResult = await requireAdmin(supabase)
    if (authResult.error) return { users: [], total: 0, page: 1, pageSize: 20, error: authResult.error, needsLogin: authResult.needsLogin }

    const search = String(filters.search ?? '').trim().slice(0, 200)
    const role = filters.role === 'user' || filters.role === 'admin' ? filters.role : 'all'
    const status = filters.status === 'active' || filters.status === 'disabled' ? filters.status : 'all'
    const page = Number.isInteger(filters.page) && (filters.page ?? 1) > 0 ? Math.min(filters.page ?? 1, 100000) : 1
    const { data, error } = await supabase.rpc('admin_list_users', { p_search: search, p_role: role, p_status: status, p_page: page })
    if (error) return { users: [], total: 0, page, pageSize: 20, error: error.code === 'PGRST202' || error.code === '42883' || error.code === '42703' ? '用户与权限数据库尚未升级，请执行 supabase/migrations/202610070001_user_permissions.sql 后重试' : getFriendlyErrorMessage(error) }
    const result = (data ?? {}) as { users?: AdminUser[]; total?: number; page?: number; pageSize?: number }
    return { users: Array.isArray(result.users) ? result.users : [], total: Number(result.total ?? 0), page: Number(result.page ?? page), pageSize: Number(result.pageSize ?? 20) }
}

export async function updateAdminUser(input: { id: string; field: 'role' | 'status'; value: 'user' | 'admin' | 'active' | 'disabled'; expectedUpdatedAt: string; reason: string }) {
    const supabase = await createClient()
    const authResult = await requireAdmin(supabase)
    if (authResult.error) return { error: authResult.error, needsLogin: authResult.needsLogin }
    if (!/^[0-9a-f-]{36}$/i.test(input.id) || input.reason.trim().length < 1 || input.reason.trim().length > 500) return { error: '请填写有效的操作原因' }

    const { error } = await supabase.rpc('admin_update_user', {
        p_id: input.id,
        p_field: input.field,
        p_value: input.value,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_reason: input.reason.trim()
    })
    if (error) {
        const message = error.message.includes('LAST_ADMIN') ? '不能降权或禁用最后一个有效管理员'
            : error.message.includes('SELF_DISABLE') ? '不能禁用当前登录账号'
                : error.message.includes('STALE_USER') ? '用户信息已更新，请刷新后重试'
                    : error.message.includes('NO_CHANGE') ? '没有需要保存的变化' : getFriendlyErrorMessage(error)
        return { error: message }
    }
    revalidatePath('/admin/users')
    revalidatePath('/admin')
    revalidatePath('/dashboard')
    return { success: true }
}
