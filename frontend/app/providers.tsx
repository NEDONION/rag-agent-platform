"use client"

import { Toaster } from "@/components/ui/toaster"
import { useEffect, Suspense } from "react"
import { usePathname } from "next/navigation"
import { getCookie } from "@/lib/utils"
import { AccountProvider } from "@/contexts/account-context"
import { I18nProvider } from "@/contexts/i18n-context"
import type { Locale } from "@/lib/i18n"
import { RouteLogger } from "@/components/debug/route-logger"

export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  initialLocale?: Locale
}) {
  const pathname = usePathname()

  useEffect(() => {
    // 页面加载时，从cookie中恢复token到localStorage
    const tokenFromCookie = getCookie("token")
    if (tokenFromCookie && typeof window !== "undefined") {
      // 如果localStorage中没有token，但cookie中有，则恢复它
      if (!localStorage.getItem("auth_token")) {
        localStorage.setItem("auth_token", tokenFromCookie)
      }
    }
  }, [])

  // 如果是Widget或认证路由，不加载认证相关的Provider
  const isWidgetRoute = pathname?.startsWith('/widget')
  const isAuthRoute = pathname
    ? ["/login", "/register", "/reset-password"].some((route) =>
        pathname.startsWith(route)
      )
    : false

  if (isWidgetRoute || isAuthRoute) {
    return (
      <I18nProvider initialLocale={initialLocale} enableDomTranslation={false}>
        <Suspense fallback={null}>
          <RouteLogger />
        </Suspense>
        {children}
        <Toaster />
      </I18nProvider>
    )
  }

  return (
    <I18nProvider initialLocale={initialLocale}>
      <AccountProvider>
        <Suspense fallback={null}>
          <RouteLogger />
        </Suspense>
        {children}
        <Toaster />
      </AccountProvider>
    </I18nProvider>
  )
}
