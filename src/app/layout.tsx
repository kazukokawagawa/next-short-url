import type { Metadata, Viewport } from "next";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { ThemeColorProvider } from "@/components/theme-color-provider";
import { Toaster } from "@/components/ui/sonner";
import { SiteFooter } from "@/components/site-footer";
import { VerificationToast } from "@/components/verification-toast";
import React from "react";
import { getCachedSiteConfig, getAppearanceConfig, getMaintenanceConfig } from "@/lib/site-config";
import { LoadingProvider } from "@/components/providers/loading-provider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { createClient } from "@/utils/supabase/server";
import { AppSurface } from '@/components/app-surface';
import { getAccountProfile } from '@/utils/auth';
import { hasSupabaseConfig } from '@/lib/supabase-config';


// PWA Viewport 配置
export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  // 移除 maximumScale 限制，允许低视力用户缩放页面
};

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getCachedSiteConfig();

  return {
    title: {
      template: `%s | ${siteConfig.name}`,
      default: `${siteConfig.name} - ${siteConfig.subtitle}`,
    },
    description: siteConfig.description,
    keywords: siteConfig.keywords.split(/[,，]/).map(k => k.trim()), // Support both English and Chinese commas
    authors: [{ name: siteConfig.authorName, url: siteConfig.authorUrl }],
    icons: {
      apple: "/icons/icon-192x192.png",
    },
    openGraph: {
      title: `${siteConfig.name} - ${siteConfig.subtitle}`,
      description: siteConfig.description,
      type: "website",
      siteName: siteConfig.name,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 从数据库读取外观配置
  const appearanceConfig = await getAppearanceConfig();

  // 读取维护模式配置
  const maintenanceConfig = await getMaintenanceConfig();

  // 检查管理员权限用于绕过维护模式
  let isAdmin = false;

  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await getAccountProfile(supabase, user.id);
      isAdmin = profile?.role === 'admin' && profile?.status === 'active';
    }
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
      </head>
      <body
        className="flex min-h-screen flex-col antialiased font-sans"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme={appearanceConfig.themeMode}
          enableSystem
          disableTransitionOnChange
        >
          <ThemeColorProvider primaryColor={appearanceConfig.primaryColor} />
          {/* 仅公开首页使用品牌背景 */}
          <AppSurface maintenance={maintenanceConfig.enabled} message={maintenanceConfig.message} bypass={isAdmin}>
            <LoadingProvider>
              <main className="flex-1 w-full">
                {children}
              </main>
            </LoadingProvider>
            <SiteFooter />
          </AppSurface>
          <Toaster position={appearanceConfig.toastPosition} />
          <React.Suspense fallback={null}>
            <VerificationToast />
          </React.Suspense>
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}

