"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginApi } from "@/lib/api-services"
import { setCookie } from "@/lib/utils"
import { getAuthConfigWithToast } from "@/lib/auth-config-service"
import type { AuthConfig } from "@/lib/types/auth-config"
import { AUTH_FEATURE_KEY } from "@/lib/types/auth-config"
import { useI18n } from "@/contexts/i18n-context"

// GitHub 图标组件
const GitHubIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
  </svg>
)

export default function LoginPage() {
  const router = useRouter()
  const { locale, setLocale, t } = useI18n()
  const defaultAccount = "nedjiachenghu@gmail.com"
  const defaultPassword = "test123"
  const showTestCredentials = true
  const [formData, setFormData] = useState({
    account: defaultAccount,
    password: defaultPassword,
  })
  const [loading, setLoading] = useState(false)
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)

  // 加载认证配置
  useEffect(() => {
    async function fetchAuthConfig() {
      try {
        const response = await getAuthConfigWithToast()
        if (response.code === 200) {
          setAuthConfig(response.data)
        }
      } catch (error) {
        console.error("获取认证配置失败:", error)
      } finally {
        setConfigLoading(false)
      }
    }

    fetchAuthConfig()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePrefill = () => {
    setFormData({
      account: defaultAccount,
      password: defaultPassword,
    })
    toast({
      title: t("已填充测试账号"),
      description: t("可直接点击登录"),
      className: "border-border bg-info-subtle text-foreground",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { account, password } = formData
      if (!account || !password) {
        toast({
          variant: "destructive",
          title: t("错误"),
          description: t("请输入账号和密码"),
          className: "border-destructive/30 bg-background text-foreground",
        })
        setLoading(false)
        return
      }

      // 使用带toast参数的API
      const res = await loginApi({ account, password }, false)
      if (res.code === 200 && res.data?.token) {
        localStorage.setItem("auth_token", res.data.token)
        setCookie("token", res.data.token, 30)
        toast({
          title: t("登录成功"),
          description: t("欢迎回来"),
          className: "border-border bg-success-subtle text-foreground",
        })
        setTimeout(() => {
          router.push("/")
        }, 300)
      } else {
        toast({
          variant: "destructive",
          title: t("登录失败"),
          description: res.message || t("账号或密码不正确"),
          className: "border-destructive/30 bg-background text-foreground",
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t("登录失败"),
        description: error?.message || t("登录时发生错误"),
        className: "border-destructive/30 bg-background text-foreground",
      })
    } finally {
      setLoading(false)
    }
  }

  // 圆角只用两档：卡片 xl(12px)、控件 lg(8px)。阴影极轻，层次靠描边而非投影。
  const pageShellClass = "min-h-screen bg-muted/40 text-foreground"
  const cardClass =
    "rounded-xl border border-border bg-card px-8 py-9 shadow-sm"

  // 配置加载中
  if (configLoading) {
    return (
      <div className={pageShellClass}>
        <div className="container max-w-[440px] min-h-screen flex flex-col justify-center py-16 px-4">
          <div className={cardClass}>
            <div className="mb-8 space-y-2">
              <div className="h-6 w-2/3 rounded bg-muted animate-pulse"></div>
              <div className="h-4 w-1/2 rounded bg-muted animate-pulse"></div>
            </div>
            <div className="space-y-4">
              <div className="h-10 rounded-lg bg-muted animate-pulse"></div>
              <div className="h-10 rounded-lg bg-muted animate-pulse"></div>
              <div className="h-10 rounded-lg bg-muted animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 检查是否有可用的登录方式
  const availableLoginMethods = authConfig?.loginMethods || {}
  const hasNormalLogin =
    availableLoginMethods[AUTH_FEATURE_KEY.NORMAL_LOGIN]?.enabled
  const hasSsoLogin = false

  // 如果没有可用的登录方式
  if (!hasNormalLogin && !hasSsoLogin) {
    return (
      <div className={pageShellClass}>
        <div className="container max-w-[440px] min-h-screen flex flex-col justify-center py-16 px-4">
          <div className={`${cardClass} text-center`}>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("暂时无法登录")}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("系统暂时关闭了所有登录方式，请稍后再试或联系管理员。")}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={pageShellClass}>
        <div className="container max-w-[440px] min-h-screen flex flex-col justify-center py-16 px-4">
          <div className={cardClass}>
            <div className="mb-6 flex items-center justify-end">
              <div className="inline-flex items-center rounded-lg border border-border bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setLocale("zh")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    locale === "zh"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  中文
                </button>
                <button
                  type="button"
                  onClick={() => setLocale("en")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    locale === "en"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            <div className="mb-7 space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {t("登录 RAG Agent 智能平台")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("👋 欢迎！请登录以开始使用。")}
              </p>
            </div>

            <div className="space-y-6">
              {showTestCredentials && (
                <div className="rounded-lg bg-muted/60 px-3.5 py-3 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-background px-2 py-0.5 text-[10px] font-medium text-foreground">
                        {t("测试账号")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">Demo</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handlePrefill}
                      className="h-7 rounded-md px-2 text-[11px] font-medium"
                    >
                      {t("一键填充")}
                    </Button>
                  </div>
                  <div className="mt-2.5 grid gap-1.5 text-[12px]">
                    <div className="flex items-center justify-between rounded-md bg-background px-3 py-1.5">
                      <span className="text-muted-foreground">{t("账号")}</span>
                      <span className="font-mono text-foreground">
                        {defaultAccount || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-background px-3 py-1.5">
                      <span className="text-muted-foreground">{t("密码")}</span>
                      <span className="font-mono text-foreground">
                        {defaultPassword || "-"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* 普通登录表单 */}
              {hasNormalLogin && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="account" className="text-sm text-foreground">
                      {t("账号")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="account"
                      name="account"
                      type="text"
                      placeholder={t("请输入账号/邮箱/手机号")}
                      value={formData.account}
                      onChange={handleChange}
                      autoFocus
                      required
                      className="h-10 rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm text-foreground">
                      {t("密码")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder={t("请输入密码")}
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="h-10 rounded-lg"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="h-10 w-full rounded-lg"
                    disabled={loading}
                  >
                    {loading ? t("登录中...") : t("登录")}
                  </Button>
                </form>
              )}

            {/* SSO登录分隔线 */}
            {hasNormalLogin && hasSsoLogin && (
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-background text-muted-foreground">
                    {t("或者")}
                  </span>
                </div>
              </div>
            )}

            {/* SSO登录按钮 */}
            {hasSsoLogin && (
              <div className="space-y-2">
                {/* GitHub登录（暂时禁用） */}
                <Button variant="outline" className="w-full" type="button">
                  <GitHubIcon className="mr-2 h-4 w-4" />
                  {t("使用 GitHub 登录")}
                </Button>
              </div>
            )}

            {/* 底部链接 */}
              <div className="flex justify-between text-sm text-muted-foreground">
                <div>
                  {authConfig?.registerEnabled && (
                    <>
                      {t("还没有账号？")}{" "}
                      <Link href="/register" className="font-medium text-foreground underline underline-offset-4 decoration-muted-foreground/40 hover:decoration-foreground">
                        {t("立即注册")}
                      </Link>
                    </>
                  )}
                </div>
                {/* 只有普通登录启用时才显示忘记密码 */}
                {hasNormalLogin && (
                  <div>
                    <Link href="/reset-password" className="text-muted-foreground underline underline-offset-4 decoration-transparent hover:decoration-muted-foreground">
                      {t("忘记密码")}
                    </Link>
                  </div>
                )}
              </div>
              <p className="pt-2 text-xs text-muted-foreground text-center">
                {t("使用即代表您同意我们的 使用协议 & 隐私政策")}
              </p>
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </>
  )
}
