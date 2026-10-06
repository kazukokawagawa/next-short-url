import * as React from "react"
import { LoaderCircle } from "lucide-react"
import { Button, ButtonProps } from "@/components/ui/button"

export interface LoadingButtonProps extends ButtonProps {
    loading?: boolean
    icon?: React.ReactNode
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
    ({ loading, children, disabled, icon, ...props }, ref) => {
        return (
            <Button ref={ref} {...props} disabled={loading || disabled} aria-busy={loading || undefined}>
                <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center">
                    {loading ? <LoaderCircle className="size-4 animate-spin" /> : icon}
                </span>
                {children}
            </Button>
        )
    }
)
LoadingButton.displayName = "LoadingButton"
