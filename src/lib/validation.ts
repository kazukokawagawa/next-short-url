import { toast } from "sonner"

/**
 * 统一的 Toast 通知工具
 */

// URL 验证相关的 toast
export const toastMessages = {
    // URL 验证
    urlRequired: () => toast.error("请输入 URL", {
        description: "请输入需要缩短的 URL 地址"
    }),

    urlInvalidFormat: () => toast.error("URL 格式错误", {
        description: "请输入以 http:// 或 https:// 开头的有效 URL"
    }),

    // Slug 验证
    slugInvalidFormat: () => toast.error("后缀格式错误", {
        description: "自定义后缀只能包含字母、数字、连字符和下划线"
    }),

    // 链接创建
    linkCreating: () => toast.loading("创建链接中...", {
        description: "正在检查 URL 可用性和安全性..."
    }),

    linkCreateSuccess: (toastId?: string | number) => toast.success("链接创建成功!", {
        id: toastId,
        description: "短链接已准备就绪。"
    }),

    linkCreateError: (error: string, toastId?: string | number) => toast.error("无法创建链接", {
        id: toastId,
        description: error
    }),

    // 通用错误
    networkError: (toastId?: string | number) => toast.error("网络错误", {
        id: toastId
    }),

    // 链接删除
    linkDeleted: () => toast.success("链接已删除"),

    linkDeleteError: (error: string) => toast.error("删除失败", {
        description: error
    }),

    // URL 可访问性检测
    urlNotAccessible: (statusCode?: number) => toast.error("无法创建链接", {
        description: statusCode
            ? `该链接无法访问 (HTTP ${statusCode})，请检查后重试`
            : "该链接无法访问或已失效，请检查后重试"
    }),

    urlTimeout: () => toast.error("无法创建链接", {
        description: "链接访问超时，目标网站可能过慢或无法访问"
    }),

    urlVerificationFailed: () => toast.error("无法创建链接", {
        description: "无法验证链接可用性，请稍后再试"
    }),

    urlMalicious: (threats?: string[]) => {
        const threatText = threats?.length ? threats.join("、") : "潜在安全威胁"
        return toast.warning("安全风险警告", {
            description: `Google Safe Browsing 检测到该链接存在安全风险：${threatText}。为保护用户安全，已阻止创建此短链接。`,
            duration: 8000  // 显示更长时间让用户看清
        })
    },

    urlSuffixBlocked: () => toast.error("无法创建链接", {
        description: "该链接的文件后缀被网站管理员禁止"
    }),

    urlDomainBlocked: () => toast.error("无法创建链接", {
        description: "该链接的域名被网站管理员禁止"
    }),

    urlBlocked: () => toast.error("无法创建链接", {
        description: "该链接被网站管理员禁止"
    }),

    slugBlocked: () => toast.error("无法创建链接", {
        description: "该自定义后缀被网站管理员禁止"
    }),

    // 密码验证
    passwordSixDigitRequired: () => toast.error("密码格式错误", {
        description: "请输入完整的6位数字密码"
    }),

    passwordCustomRequired: () => toast.error("密码格式错误", {
        description: "请输入自定义口令"
    }),

    // 登录相关
    loginRequired: (icon: React.ReactNode, action: { label: React.ReactNode, onClick: () => void }) =>
        toast("需要登录", {
            description: "你需要登录以创建短链接",
            icon,
            action
        }),

    loginSuccess: () => toast.success("登录成功", {
        description: "正在跳转到控制台..."
    }),

    loginError: (error: string) => toast.error("登录失败", {
        description: error
    }),

    // 注册相关
    signupSending: () => toast.loading("正在发送验证邮件..."),

    signupSuccess: (toastId?: string | number) => toast.success("验证邮件已发送！", {
        id: toastId,
        description: "请检查你的邮箱并点击验证链接。"
    }),

    signupError: (error: string, toastId?: string | number) => toast.error("注册失败", {
        id: toastId,
        description: error
    }),

    // 验证相关
    verificationSuccess: () => toast.success("邮箱验证成功！", {
        description: "正在跳转到控制台..."
    }),

    verificationError: (error: string) => toast.error("验证失败", {
        description: error
    }),

    // 通用的错误和成功消息
    error: (message: string, description?: string, toastId?: string | number) =>
        toast.error(message, {
            id: toastId,
            description
        }),

    success: (message: string, description?: string, toastId?: string | number) =>
        toast.success(message, {
            id: toastId,
            description
        })
}

/**
 * 验证 URL 格式
 * @param url - 要验证的 URL 字符串
 * @returns 如果有效返回 true，无效返回 false 并显示 toast 错误
 */
export function validateUrl(url: string): boolean {
    if (!url) {
        toastMessages.urlRequired()
        return false
    }

    try {
        const urlObject = new URL(url)
        // 只允许 http 和 https 协议
        if (!['http:', 'https:'].includes(urlObject.protocol)) {
            toastMessages.urlInvalidFormat()
            return false
        }
        return true
    } catch {
        toastMessages.urlInvalidFormat()
        return false
    }
}

/**
 * 验证自定义 Slug 格式
 * @param slug - 要验证的 slug 字符串
 * @returns 如果有效返回 true，无效返回 false 并显示 toast 错误
 */
export function validateSlug(slug: string): boolean {
    if (!slug) return true // slug 是可选的

    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
        toastMessages.slugInvalidFormat()
        return false
    }
    return true
}
