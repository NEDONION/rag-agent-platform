import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "../providers"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // 固定浅色为默认：enableSystem 会跟随操作系统，用户系统是深色时应用会直接变深色，
  // 与产品默认不符。需要暗色时由用户显式切换。
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <Providers>
        {children}
      </Providers>
    </ThemeProvider>
  )
}
