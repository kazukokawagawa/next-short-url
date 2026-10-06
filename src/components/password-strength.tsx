'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PasswordStrengthProps {
    password: string
    className?: string
}

/**
 * 计算密码强度
 * 返回 0-4 的强度值
 */
function calculateStrength(password: string): number {
    if (!password) return 0

    let strength = 0

    // 长度检查
    if (password.length >= 6) strength += 1
    if (password.length >= 10) strength += 1

    // 包含数字
    if (/\d/.test(password)) strength += 1

    // 包含大写字母
    if (/[A-Z]/.test(password)) strength += 0.5

    // 包含小写字母
    if (/[a-z]/.test(password)) strength += 0.5

    // 包含特殊字符
    if (/[^a-zA-Z0-9]/.test(password)) strength += 1

    return Math.min(4, Math.floor(strength))
}

/**
 * 获取强度对应的颜色和标签
 */
function getStrengthInfo(strength: number): { color: string; label: string; bgColor: string } {
    switch (strength) {
        case 0:
            return { color: 'bg-muted', label: '', bgColor: 'bg-muted' }
        case 1:
            return { color: 'bg-destructive', label: '弱', bgColor: 'bg-destructive/20' }
        case 2:
            return { color: 'bg-warning', label: '一般', bgColor: 'bg-warning/20' }
        case 3:
            return { color: 'bg-info', label: '中等', bgColor: 'bg-info/20' }
        case 4:
            return { color: 'bg-success', label: '强', bgColor: 'bg-success/20' }
        default:
            return { color: 'bg-muted', label: '', bgColor: 'bg-muted' }
    }
}

/**
 * 密码强度指示条组件
 */
export function PasswordStrength({ password, className }: PasswordStrengthProps) {
    const strength = useMemo(() => calculateStrength(password), [password])
    const { color, label, bgColor } = useMemo(() => getStrengthInfo(strength), [strength])

    if (!password) return null

    return (
        <div className={cn("space-y-1.5", className)}>
            {/* 强度条 */}
            <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                    <motion.div
                        key={level}
                        className={cn(
                            "h-1 flex-1 rounded-full transition-colors duration-300",
                            level <= strength ? color : "bg-muted"
                        )}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.2, delay: level * 0.05 }}
                    />
                ))}
            </div>

            {/* 强度标签 */}
            {label && (
                <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5"
                >
                    <span className={cn("text-xs px-1.5 py-0.5 rounded", bgColor)}>
                        密码强度: {label}
                    </span>
                </motion.div>
            )}
        </div>
    )
}
