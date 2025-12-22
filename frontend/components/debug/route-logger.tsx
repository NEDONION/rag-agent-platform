"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { debugLog, isDebugEnabled } from "@/lib/debug"

export function RouteLogger() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isDebugEnabled()) {
      return
    }
    debugLog("route", {
      pathname,
      search: searchParams.toString(),
    })
  }, [pathname, searchParams])

  useEffect(() => {
    if (!isDebugEnabled()) {
      return
    }

    const onError = (event: ErrorEvent) => {
      debugLog("window.error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      debugLog("unhandledrejection", event.reason)
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
