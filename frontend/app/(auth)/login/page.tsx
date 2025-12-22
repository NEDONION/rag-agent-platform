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
  const prefillEnabled = process.env.NEXT_PUBLIC_PREFILL_LOGIN === "true"
  const defaultAccount = prefillEnabled
    ? process.env.NEXT_PUBLIC_PREFILL_ACCOUNT || ""
    : ""
  const defaultPassword = prefillEnabled
    ? process.env.NEXT_PUBLIC_PREFILL_PASSWORD || ""
    : ""
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { account, password } = formData
      if (!account || !password) {
        toast({
          variant: "destructive",
          title: "错误",
          description: "请输入账号和密码",
          className: "border-red-200 bg-red-50 text-red-900",
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
          title: "登录成功",
          description: "欢迎回来",
          className: "border-emerald-200 bg-emerald-50 text-emerald-900",
        })
        setTimeout(() => {
          router.push("/")
        }, 300)
      } else {
        toast({
          variant: "destructive",
          title: "登录失败",
          description: res.message || "账号或密码不正确",
          className: "border-red-200 bg-red-50 text-red-900",
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "登录失败",
        description: error?.message || "登录时发生错误",
        className: "border-red-200 bg-red-50 text-red-900",
      })
    } finally {
      setLoading(false)
    }
  }

  const pageShellClass =
    "min-h-screen bg-slate-50 text-slate-900"

  // 配置加载中
  if (configLoading) {
    return (
      <div className={pageShellClass}>
        <div className="container max-w-[440px] min-h-screen flex flex-col justify-center py-16 px-4">
          <div className="rounded-2xl bg-white/90 px-8 py-10 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/60">
            <div className="mb-8 space-y-2 text-center">
              <div className="h-7 bg-slate-100 rounded animate-pulse"></div>
              <div className="h-4 bg-slate-100 rounded animate-pulse"></div>
            </div>
            <div className="space-y-4">
              <div className="h-11 bg-slate-100 rounded animate-pulse"></div>
              <div className="h-11 bg-slate-100 rounded animate-pulse"></div>
              <div className="h-10 bg-slate-100 rounded animate-pulse"></div>
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
          <div className="rounded-2xl bg-white/90 px-8 py-10 text-center shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/60">
            <h1 className="text-2xl font-semibold tracking-tight">暂时无法登录</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              系统暂时关闭了所有登录方式，请稍后再试或联系管理员。
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
          <div className="rounded-2xl bg-white/90 px-8 py-10 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.4)] ring-1 ring-slate-200/70">
            <div className="mb-8 space-y-2 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">
                Account Login
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                登录 RAG Agent 智能平台
              </h1>
              <p className="text-sm text-muted-foreground">
                👋 欢迎！请登录以开始使用。
              </p>
            </div>

            <div className="space-y-6">
              {/* 普通登录表单 */}
              {hasNormalLogin && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="account" className="text-sm text-slate-600">
                      账号 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="account"
                      name="account"
                      type="text"
                      placeholder="请输入账号/邮箱/手机号"
                      value={formData.account}
                      onChange={handleChange}
                      required
                      className="h-11 border-slate-200 bg-slate-50/70 focus-visible:ring-blue-500/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm text-slate-600">
                      密码 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="请输入密码"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="h-11 border-slate-200 bg-slate-50/70 focus-visible:ring-blue-500/40"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="h-11 w-full bg-blue-600 text-white hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? "登录中..." : "登录"}
                  </Button>
                </form>
              )}

            {/* SSO登录分隔线 */}
            {hasNormalLogin && hasSsoLogin && (
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-background text-muted-foreground">
                    或者
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
                  使用 GitHub 登录
                </Button>
              </div>
            )}

            {/* 底部链接 */}
              <div className="flex justify-between text-sm text-muted-foreground">
                <div>
                  {authConfig?.registerEnabled && (
                    <>
                      还没有账号？{" "}
                      <Link href="/register" className="text-blue-600 hover:underline">
                        立即注册
                      </Link>
                    </>
                  )}
                </div>
                {/* 只有普通登录启用时才显示忘记密码 */}
                {hasNormalLogin && (
                  <div>
                    <Link href="/reset-password" className="text-blue-600 hover:underline">
                      忘记密码
                    </Link>
                  </div>
                )}
              </div>
              <p className="pt-2 text-xs text-muted-foreground text-center">
                使用即代表您同意我们的 使用协议 & 隐私政策
              </p>
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </>
  )
}
