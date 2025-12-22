export const DEBUG_PREFIX = "[debug]"

const labelMap: Record<string, string> = {
  "route": "路由",
  "window.error": "全局错误",
  "unhandledrejection": "未处理的 Promise 拒绝",
  "http.request": "HTTP 请求",
  "http.response": "HTTP 响应",
  "http.response.parsed": "HTTP 响应解析",
  "http.error": "HTTP 错误",
  "http.request.failed": "HTTP 请求失败",
  "i18n.locale.set": "语言切换",
  "workspace.selection": "工作区选择",
  "account.refresh.start": "账户刷新开始",
  "account.refresh.success": "账户刷新成功",
  "account.refresh.failed": "账户刷新失败",
  "account.refresh.error": "账户刷新异常",
  "account.update": "账户更新",
  "account.clear": "账户清理",
  "account.refresh.visibility": "账户刷新(页面可见)",
  "account.refresh.focus": "账户刷新(页面聚焦)",
  "auth.logout": "退出登录",
}

function localizeLabel(label: unknown): unknown {
  if (typeof label !== "string") {
    return label
  }
  return labelMap[label] || label
}

export function isDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return true
  }
  const localEnabled = window.localStorage.getItem("debug") === "1"
  const queryEnabled = window.location.search.includes("debug=1")
  return true || localEnabled || queryEnabled
}

export function debugLog(...args: unknown[]): void {
  if (isDebugEnabled()) {
    // eslint-disable-next-line no-console
    const [label, ...rest] = args
    console.debug(DEBUG_PREFIX, localizeLabel(label), ...rest)
  }
}

export function debugWarn(...args: unknown[]): void {
  if (isDebugEnabled()) {
    // eslint-disable-next-line no-console
    const [label, ...rest] = args
    console.warn(DEBUG_PREFIX, localizeLabel(label), ...rest)
  }
}

export function debugError(...args: unknown[]): void {
  if (isDebugEnabled()) {
    // eslint-disable-next-line no-console
    const [label, ...rest] = args
    console.error(DEBUG_PREFIX, localizeLabel(label), ...rest)
  }
}
