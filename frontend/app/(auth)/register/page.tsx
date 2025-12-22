"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginApi, registerApi, sendEmailCodeApi, verifyEmailCodeApi, getCaptchaApi } from "@/lib/api-services"
import { setCookie } from "@/lib/utils"
import { getAuthConfigWithToast } from "@/lib/auth-config-service"
import type { AuthConfig } from "@/lib/types/auth-config"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    code: "",
    captchaCode: ""
  })

  const [captchaData, setCaptchaData] = useState({
    uuid: "",
    imageBase64: ""
  })
  const [loadingCaptcha, setLoadingCaptcha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [codeVerified, setCodeVerified] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const pageShellClass =
    "min-h-screen bg-slate-50 text-slate-900"

  // 加载认证配置
  useEffect(() => {
    async function fetchAuthConfig() {
      try {
        const response = await getAuthConfigWithToast()
        if (response.code === 200) {
          setAuthConfig(response.data)
        }
      } catch (error) {

      } finally {
        setConfigLoading(false)
      }
    }

    fetchAuthConfig()
  }, [])

  // 页面初始化时获取验证码
  useEffect(() => {
    if (!configLoading && authConfig?.registerEnabled) {
      fetchCaptcha()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoading, authConfig?.registerEnabled])

  // 倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    if (name === "email") {
      setCodeVerified(false)
      setCodeSent(false)
    }
  }

  const fetchCaptcha = async () => {
    setLoadingCaptcha(true)
    try {
      const res = await getCaptchaApi()
      if (res.code === 200 && res.data) {
        setCaptchaData({
          uuid: res.data.uuid,
          imageBase64: res.data.imageBase64
        })
        setFormData(prev => ({ ...prev, captchaCode: "" }))
      }
    } catch (error) {

    } finally {
      setLoadingCaptcha(false)
    }
  }

  const handleSendCode = async () => {
    if (!formData.email) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入邮箱",
        className: "border-red-200 bg-red-50 text-red-900"
      })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入有效的邮箱地址",
        className: "border-red-200 bg-red-50 text-red-900"
      })
      return
    }

    if (!formData.captchaCode) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入图形验证码",
        className: "border-red-200 bg-red-50 text-red-900"
      })
      return
    }

    setSendingCode(true)
    try {
      const res = await sendEmailCodeApi(
          formData.email,
          captchaData.uuid,
          formData.captchaCode
      )

      if (res.code === 200) {
        setCodeSent(true)
        setCountdown(60)
        toast({
          title: "成功",
          description: "验证码已发送，请查收邮件",
          className: "border-emerald-200 bg-emerald-50 text-emerald-900"
        })
      } else {
        toast({
          variant: "destructive",
          title: "发送失败",
          description: res.message || "发送验证码失败",
          className: "border-red-200 bg-red-50 text-red-900"
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "发送失败",
        description: error?.message || "发送验证码时发生错误",
        className: "border-red-200 bg-red-50 text-red-900"
      })
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!formData.code) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入验证码",
        className: "border-red-200 bg-red-50 text-red-900"
      })
      return
    }

    setVerifying(true)
    try {
      const res = await verifyEmailCodeApi(formData.email, formData.code)
      if (res.code === 200 && res.data) {
        setCodeVerified(true)
        toast({
          title: "成功",
          description: "验证码验证成功",
          className: "border-emerald-200 bg-emerald-50 text-emerald-900"
        })
      } else {
        toast({
          variant: "destructive",
          title: "错误",
          description: res.message || "验证码无效或已过期",
          className: "border-red-200 bg-red-50 text-red-900"
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: error?.message || "验证验证码时发生错误",
        className: "border-red-200 bg-red-50 text-red-900"
      })
    } finally {
      setVerifying(false)
    }
  }

  const validateForm = () => {

    if (!formData.password) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入密码",
        className: "border-red-200 bg-red-50 text-red-900"
      })
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "两次输入的密码不一致",
        className: "border-red-200 bg-red-50 text-red-900"
      })
      return false
    }

    if (!formData.email && !formData.phone) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "邮箱和手机号至少填写一个",
        className: "border-red-200 bg-red-50 text-red-900"
      })
      return false
    }

    if (formData.email && !formData.phone) {
      if (!formData.captchaCode) {
        toast({
          variant: "destructive",
          title: "错误",
          description: "请输入验证码",
          className: "border-red-200 bg-red-50 text-red-900"
        })
        return false
      }

      if (!formData.code) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请先验证邮箱验证码",
        className: "border-red-200 bg-red-50 text-red-900"
      })
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      const { email, phone, password, code } = formData
      const res = await registerApi({
        email: email || undefined,
        phone: phone || undefined,
        password,
        code: email ? code : undefined
      }, true)

      if (res.code === 200) {
        toast({
          title: "注册成功",
          description: "正在为你自动登录",
          className: "border-emerald-200 bg-emerald-50 text-emerald-900"
        })
        const account = email || phone || ""
        const loginRes = await loginApi({ account, password }, false)
        if (loginRes.code === 200 && loginRes.data?.token) {
          localStorage.setItem("auth_token", loginRes.data.token)
          setCookie("token", loginRes.data.token, 30)
          router.push("/")
        } else {
          toast({
            variant: "destructive",
            title: "自动登录失败",
            description: loginRes.message || "请手动登录",
            className: "border-red-200 bg-red-50 text-red-900"
          })
          router.push("/login?auto=false")
        }
      } else {
        toast({
          variant: "destructive",
          title: "注册失败",
          description: res.message || "注册失败，请检查填写信息",
          className: "border-red-200 bg-red-50 text-red-900"
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "注册失败",
        description: error?.message || "注册时发生错误",
        className: "border-red-200 bg-red-50 text-red-900"
      })
    } finally {
      setLoading(false)
    }
  }

  // 配置加载中
  if (configLoading) {
    return (
      <div className={pageShellClass}>
        <div className="container max-w-[480px] min-h-screen flex flex-col justify-center py-16 px-4">
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

  // 注册功能未启用
  if (!authConfig?.registerEnabled) {
    return (
      <div className={pageShellClass}>
        <div className="container max-w-[480px] min-h-screen flex flex-col justify-center py-16 px-4">
          <div className="rounded-2xl bg-white/90 px-8 py-10 text-center shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/60">
            <h1 className="text-2xl font-semibold tracking-tight">暂停注册</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              系统暂时关闭了用户注册功能，请稍后再试或联系管理员。
            </p>
            <div className="pt-4">
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  返回登录
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={pageShellClass}>
      <div className="container max-w-[480px] min-h-screen flex flex-col justify-center py-16 px-4">
        <div className="rounded-2xl bg-white/90 px-8 py-10 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.4)] ring-1 ring-slate-200/70">
          <div className="mb-8 space-y-2 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">
              Create Account
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">注册 RAG Agent 智能平台</h1>
            <p className="text-sm text-muted-foreground">👋 欢迎！创建账号以开始使用。</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              带 <span className="text-red-500">*</span> 的字段为必填项
            </p>

            <div className="space-y-2">
              <Label htmlFor="email">电子邮件</Label>
              <div className="flex space-x-2">
                <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="请输入电子邮件"
                    value={formData.email}
                    onChange={handleChange}
                    className="flex-1 border-slate-200 bg-slate-50/70 focus-visible:ring-blue-500/40"
                />
              </div>
              <p className="text-xs text-muted-foreground">邮箱和手机号至少填写一个</p>
            </div>

            {formData.email && (
                <div className="space-y-2">
                  <Label htmlFor="captcha">
                    图形验证码 <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                        id="captchaCode"
                        name="captchaCode"
                        type="text"
                        placeholder="请输入图形验证码"
                        value={formData.captchaCode}
                        onChange={handleChange}
                        className="flex-1 border-slate-200 bg-slate-50/70 focus-visible:ring-blue-500/40"
                    />
                    <div
                        className="flex-shrink-0 w-[120px] h-[40px] relative cursor-pointer border rounded-md overflow-hidden"
                        onClick={fetchCaptcha}
                        title="点击刷新验证码"
                    >
                      {captchaData.imageBase64 ? (
                          <div className="relative w-full h-full">
                            <Image
                                src={captchaData.imageBase64}
                                alt="验证码"
                                fill
                                className="object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-70 bg-black/20 transition-opacity text-white text-xs">
                              点击刷新
                            </div>
                          </div>
                      ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-sm">
                            {loadingCaptcha ? "加载中..." : "点击获取"}
                          </div>
                      )}
                    </div>
                  </div>
                </div>
            )}

            {formData.email && (
                <div className="space-y-2">
                  <Label htmlFor="code">
                    邮箱验证码 <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                        id="code"
                        name="code"
                        type="text"
                        placeholder="请输入验证码"
                        value={formData.code}
                        onChange={handleChange}
                        className="flex-1 border-slate-200 bg-slate-50/70 focus-visible:ring-blue-500/40"
                        disabled={!codeSent}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleSendCode}
                        disabled={countdown > 0 || sendingCode || !formData.email || !formData.captchaCode}
                    >
                      {countdown > 0 ? `${countdown}s` : sendingCode ? "发送中..." : "发送验证码"}
                    </Button>
                  </div>
                </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="请输入手机号"
                  value={formData.phone}
                  onChange={handleChange}
                  className="border-slate-200 bg-slate-50/70 focus-visible:ring-blue-500/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
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
                  className="border-slate-200 bg-slate-50/70 focus-visible:ring-blue-500/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                确认密码 <span className="text-red-500">*</span>
              </Label>
              <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="请再次输入密码"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="border-slate-200 bg-slate-50/70 focus-visible:ring-blue-500/40"
              />
            </div>

            <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700" disabled={loading}>
              {loading ? "注册中..." : "注册"}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              已有账号？{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                立即登录
              </Link>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              使用即代表您同意我们的 使用协议 & 隐私政策
            </p>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
} 
