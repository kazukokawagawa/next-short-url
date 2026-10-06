'use client'

import { motion, HTMLMotionProps } from "framer-motion"
import { forwardRef, ReactNode } from "react"

interface ActionScaleProps extends HTMLMotionProps<"div"> {
    children: ReactNode
}

export const ActionScale = forwardRef<HTMLDivElement, ActionScaleProps>(
    ({ children, className, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                whileHover={{}}
                whileTap={{}}
                className={`inline-block ${className || ''}`}
                {...props}
            >
                {children}
            </motion.div>
        )
    }
)
ActionScale.displayName = "ActionScale"
