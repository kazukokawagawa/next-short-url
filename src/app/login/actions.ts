'use server'

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getFriendlyErrorMessage } from "@/utils/error-mapping"
import { getAccountProfile } from '@/utils/auth'
import { getSiteSettings } from "@/app/dashboard/settings-actions"

export async function login(formData: FormData) {
    const supabase = await createClient()
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        // 2. 使用工具函数转换错误信息
        return { error: getFriendlyErrorMessage(error) }
    }

    const { data: profile, error: profileError } = await getAccountProfile(supabase, authData.user.id)
    if (profileError || !profile || profile.status !== 'active') {
        await supabase.auth.signOut()
        return { error: profile?.status === 'disabled' ? '账号已被禁用，请联系管理员' : '账号信息暂不可用，请稍后重试' }
    }

    // 3. 检查维护模式
    const { getMaintenanceConfig } = await import("@/lib/site-config")
    const maintenanceConfig = await getMaintenanceConfig()

    if (maintenanceConfig.enabled) {
        // 检查用户角色
        if (profile.role !== 'admin') {
            // 如果不是管理员，强制登出并报错
            await supabase.auth.signOut()
            return { error: maintenanceConfig.message || "系统维护中，暂时无法登录" }
        }
    }

    await supabase.rpc('record_account_activity')
    revalidatePath('/', 'layout')
    return { success: true }
}

export async function signup(formData: FormData) {
    const supabase = await createClient()
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const turnstileToken = formData.get('turnstileToken') as string | null

    const origin = (await headers()).get("origin")

    const siteConfig = await getSiteSettings()
    if (siteConfig.error) return { error: '注册配置暂不可用，请稍后重试' }
    if (!siteConfig.openRegistration) return { error: "暂未开放用户注册" }

    // 检查是否需要验证 Turnstile
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js')
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const { data: securitySetting } = await supabaseAdmin
            .from('settings')
            .select('value')
            .eq('key', 'security')
            .single()

        const security = securitySetting?.value


        // 如果启用了 Turnstile 验证
        if (security?.turnstileEnabled && security?.turnstileSecretKey) {
            if (!turnstileToken) {
                return { error: "请完成人机验证" }
            }

            // 验证 token
            const verifyFormData = new URLSearchParams()
            verifyFormData.append('secret', security.turnstileSecretKey)
            verifyFormData.append('response', turnstileToken)

            try {
                const verifyResponse = await fetch(
                    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: verifyFormData.toString(),
                    }
                )

                const verifyResult = await verifyResponse.json()

                if (!verifyResult.success) {
                    console.error('Turnstile verification failed:', verifyResult)
                    return { error: "人机验证失败，请重试" }
                }

                // Turnstile 验证成功后，检查邮箱是否已存在
                const { data: existingUser } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('email', email)
                    .single()

                if (existingUser) {
                    return { error: "该邮箱已被注册，请直接登录", emailExists: true }
                }
            } catch (error) {
                console.error('Turnstile verification error:', error)
                return { error: "验证服务暂时不可用，请稍后重试" }
            }
        }
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${origin}/auth/callback`,
        },
    })

    if (error) {
        // 2. 使用工具函数转换错误信息
        return { error: getFriendlyErrorMessage(error) }
    }

    // 在注册成功后，创建 profile 记录
    // 使用 admin client 绕过 RLS 策略
    if (data.user) {
        // 检查是否配置了 service role key
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('SUPABASE_SERVICE_ROLE_KEY is not configured. Profile creation skipped.')
            console.error('Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file')
            // 不阻止注册流程，只是跳过 profile 创建
            return { success: true, sessionReady: Boolean(data.session) }
        }

        try {
            // 创建 admin client（需要 service role key）
            const { createClient: createAdminClient } = await import('@supabase/supabase-js')
            const supabaseAdmin = createAdminClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    }
                }
            )

            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert([
                    {
                        id: data.user.id,
                        email: data.user.email,
                        role: 'user' // 默认角色为普通用户
                    }
                ], { onConflict: 'id', ignoreDuplicates: true })

            if (profileError) {
                console.error('Failed to create profile:', profileError)
                // 注意：即使 profile 创建失败，我们也不阻止注册流程
                // 因为用户账号已经创建，可以稍后修复 profile
            }
        } catch (error) {
            console.error('Error creating profile:', error)
        }
    }

    return { success: true, sessionReady: Boolean(data.session) }
}