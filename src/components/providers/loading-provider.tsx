'use client'

import { createContext, useContext, useState, type ReactNode, useEffect, useCallback } from 'react'

interface LoadingContextType {
    isLoading: boolean
    setIsLoading: (loading: boolean) => void
    message: string
    showContent: boolean
    showRefresh: boolean
}

export const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: ReactNode }) {
    const [isLoading, update] = useState(false)
    const setIsLoading = useCallback((value: boolean) => update(value), [])

    useEffect(() => {
        if (!isLoading) return
        const timer = setTimeout(() => update(false), 1500)
        return () => clearTimeout(timer)
    }, [isLoading])

    return <LoadingContext.Provider value={{
        isLoading,
        setIsLoading,
        message: '正在加载',
        showContent: isLoading,
        showRefresh: false
    }}>{children}</LoadingContext.Provider>
}

export function useLoading() {
    const context = useContext(LoadingContext)
    if (!context) throw new Error('useLoading must be used within LoadingProvider')
    return context
}
