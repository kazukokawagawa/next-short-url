"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  LoaderCircleIcon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton={false}
      visibleToasts={3}
      duration={4000}
      gap={10}
      toastOptions={{ classNames: { toast: 'font-sans shadow-sm', description: '!text-muted-foreground', success: '[&_[data-icon]]:text-success', error: '[&_[data-icon]]:text-destructive', warning: '[&_[data-icon]]:text-warning' } }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <LoaderCircleIcon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "8px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
