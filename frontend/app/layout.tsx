import type React from "react"
import { cookies } from "next/headers"
import { Providers } from "./providers"
import { ThemeProvider } from "@/components/theme-provider"
import { LOCALE_STORAGE_KEY, normalizeLocale, translate } from "@/lib/i18n"
import "@/styles/globals.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const localeCookie = cookies().get(LOCALE_STORAGE_KEY)?.value
    const locale = normalizeLocale(localeCookie)
    const htmlLang = locale === "zh" ? "zh-CN" : "en"
    return (
        <html lang={htmlLang} suppressHydrationWarning>
        <head>
            <title>AgentX</title>
            <meta name="description" content={translate(locale, "您的全方位 AI 代理平台")} />
        </head>
        <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <Providers initialLocale={locale}>{children}</Providers>
        </ThemeProvider>
        </body>
        </html>
    )
}
