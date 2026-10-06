import { getSiteConfig, getAnnouncementConfig } from "@/lib/site-config"
import { getSiteSettings } from "@/app/dashboard/settings-actions"
import { HomeClient } from "./home-client"
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default async function Home() {
  // 并行获取所有配置，减少数据库往返
  const [siteConfig, announcementConfig, siteSettings] = await Promise.all([
    getSiteConfig(),
    getAnnouncementConfig(),
    getSiteSettings()
  ])

  return (
    <HomeClient
      announcementConfig={announcementConfig}
      allowPublicShorten={siteSettings.allowPublicShorten}
      configError={siteSettings.error}
    >
      <CardHeader className="text-center pb-2 sm:pb-6">
        {/* LCP 关键: 静态渲染，无 JS 依赖，无初始隐藏 */}
        <CardTitle className="text-2xl font-semibold lg:text-3xl">
          {siteConfig.name}
        </CardTitle>
        {/* 描述文本: 应用 CSS 动画，无需 JS */}
        <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '0.05s', animationDuration: '0.2s', animationFillMode: 'forwards' }}>
          <CardDescription className="text-base mt-2">
            {siteConfig.description}
          </CardDescription>
        </div>
      </CardHeader>
    </HomeClient>
  )
}
