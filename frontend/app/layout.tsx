import type React from "react"
import { Providers } from "./providers"
import { ThemeProvider } from "@/components/theme-provider"
import "@/styles/globals.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <title>AgentX</title>
        <meta name="description" content="您的全方位 AI 代理平台" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        {/* 固定浅色为默认：enableSystem 会跟随操作系统，用户系统是深色时
            应用会直接变深色，与产品默认不符。需要暗色时由用户显式切换。 */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
