"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  translate,
  type Locale,
} from "@/lib/i18n"
import { debugLog } from "@/lib/debug"

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, params) => translate(DEFAULT_LOCALE, key, params),
})

export function I18nProvider({
  children,
  initialLocale,
  enableDomTranslation = true,
}: {
  children: React.ReactNode
  initialLocale?: Locale
  enableDomTranslation?: boolean
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || DEFAULT_LOCALE)

  useEffect(() => {
    if (initialLocale) {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, initialLocale)
      return
    }
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    const resolved = stored ? normalizeLocale(stored) : DEFAULT_LOCALE
    setLocaleState(resolved)
    window.localStorage.setItem(LOCALE_STORAGE_KEY, resolved)
  }, [initialLocale])

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"
  }, [locale])

  useEffect(() => {
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        translate(locale, "您的全方位 AI 代理平台")
      )
    }
  }, [locale])

  useEffect(() => {
    if (!enableDomTranslation) {
      return
    }
    const attributeKeys = ["placeholder", "title", "aria-label", "alt"]

    const translateTextNode = (node: Text) => {
      const raw = node.nodeValue || ""
      const trimmed = raw.trim()
      if (!trimmed) return
      const translated = translate(locale, trimmed)
      if (translated !== trimmed) {
        node.nodeValue = raw.replace(trimmed, translated)
      }
    }

    const translateElement = (element: Element) => {
      attributeKeys.forEach((attr) => {
        const value = element.getAttribute(attr)
        if (!value) return
        const translated = translate(locale, value)
        if (translated !== value) {
          element.setAttribute(attr, translated)
        }
      })
    }

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        translateTextNode(node as Text)
        return
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        const tagName = element.tagName.toLowerCase()
        if (tagName === "script" || tagName === "style") {
          return
        }
        translateElement(element)
        element.childNodes.forEach(walk)
      }
    }

    const root = document.body
    if (!root) {
      return
    }

    const runInitialWalk = () => {
      walk(root)
    }

    const requestIdleCallback =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback
    const cancelIdleCallback =
      (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback
    const idleId = requestIdleCallback
      ? requestIdleCallback(runInitialWalk)
      : window.setTimeout(runInitialWalk, 0)

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(walk)
        if (mutation.type === "attributes" && mutation.target) {
          translateElement(mutation.target as Element)
        }
      })
    })

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: attributeKeys,
    })

    return () => {
      observer.disconnect()
      if (requestIdleCallback && typeof idleId === "number") {
        cancelIdleCallback?.(idleId)
      } else {
        window.clearTimeout(idleId)
      }
    }
  }, [locale])

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale)
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale)
    document.cookie = `${LOCALE_STORAGE_KEY}=${nextLocale}; path=/; max-age=31536000`
    debugLog("i18n.locale.set", nextLocale)
  }

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
    }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
