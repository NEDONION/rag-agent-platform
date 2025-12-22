"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ShieldCheck, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import { getCurrentUserId, getUserInfo, updateUserInfoWithToast, changePasswordWithToast, type UserUpdateRequest, type ChangePasswordRequest } from "@/lib/user-service"
import { useI18n } from "@/contexts/i18n-context"

export default function ProfilePage() {
  const { t } = useI18n()
  const router = useRouter()
  const [formData, setFormData] = useState({
    nickname: "",
    email: "",
    phone: "",
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取用户信息
  useEffect(() => {
    async function fetchUserInfo() {
      try {
        setLoading(true)
        setError(null)
        
        const response = await getUserInfo()
        
        if (response.code === 200 && response.data) {
          setFormData({
            nickname: response.data.nickname || "",
            email: response.data.email || "",
            phone: response.data.phone || "",
          })
        } else {
          setError(response.message)
          toast({
            title: t("获取用户信息失败"),
            description: response.message,
            variant: "destructive",
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t("未知错误")
        setError(errorMessage)
        toast({
          title: t("获取用户信息失败"),
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchUserInfo()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setPasswordData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nickname.trim()) {
      toast({
        title: t("昵称不能为空"),
        variant: "destructive",
      })
      return
    }
    
    try {
      setSubmitting(true)
      
      // 后端API只支持更新昵称
      const userData: UserUpdateRequest = {
        nickname: formData.nickname,
      }
      
      const response = await updateUserInfoWithToast(userData)
      
      if (response.code === 200) {
        // 更新成功，提示信息由withToast处理
      }
    } catch (error) {
      // 错误由withToast处理
      console.error("更新用户信息失败:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 客户端验证
    if (!passwordData.currentPassword) {
      toast({
        title: t("请输入当前密码"),
        variant: "destructive",
      })
      return
    }
    
    if (!passwordData.newPassword) {
      toast({
        title: t("请输入新密码"),
        variant: "destructive",
      })
      return
    }
    
    if (passwordData.newPassword.length < 6) {
      toast({
        title: t("新密码长度不能少于6位"),
        variant: "destructive",
      })
      return
    }
    
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]+$/
    if (!passwordRegex.test(passwordData.newPassword)) {
      toast({
        title: t("新密码必须包含至少一个字母和一个数字"),
        variant: "destructive",
      })
      return
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: t("新密码和确认密码不一致"),
        variant: "destructive",
      })
      return
    }
    
    try {
      setPasswordSubmitting(true)
      
      const response = await changePasswordWithToast(passwordData)
      
      if (response.code === 200) {
        // 修改成功，清空表单
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        })
      }
    } catch (error) {
      console.error("修改密码失败:", error)
    } finally {
      setPasswordSubmitting(false)
    }
  }

  // 渲染加载状态
  if (loading) {
    return (
      <div className="container py-6">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 个人资料 Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-24" />
            </CardFooter>
          </Card>

          {/* 修改密码 Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-24" />
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("个人资料")}</h1>
          <p className="text-muted-foreground">{t("更新您的个人信息和账户安全设置")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        {/* 个人资料 */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70">
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-600" />
              {t("个人资料")}
            </CardTitle>
            <CardDescription>{t("更新您的个人信息")}</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nickname">{t("昵称")}</Label>
                <Input 
                  id="nickname" 
                  name="nickname" 
                  value={formData.nickname} 
                  onChange={handleChange}
                  placeholder={t("请输入昵称")} 
                />
                <p className="text-xs text-muted-foreground">{t("昵称是您在平台上显示的名称")}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("手机号")}</Label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    type="tel"
                    value={formData.phone} 
                    onChange={handleChange}
                    placeholder={t("请输入手机号")}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">{t("手机号不可修改")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("电子邮件")}</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    value={formData.email} 
                    onChange={handleChange}
                    placeholder={t("请输入电子邮件")}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">{t("邮箱地址不可修改")}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-slate-100 bg-slate-50/40">
              <Button type="submit" disabled={submitting}>
                {submitting ? t("保存中...") : t("保存更改")}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* 修改密码 */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-600" />
              {t("修改密码")}
            </CardTitle>
            <CardDescription>{t("为了账户安全，建议定期修改密码")}</CardDescription>
          </CardHeader>
          <form onSubmit={handlePasswordSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t("当前密码")}</Label>
                <Input 
                  id="currentPassword" 
                  name="currentPassword"
                  type="password"
                  value={passwordData.currentPassword} 
                  onChange={handlePasswordChange}
                  placeholder={t("请输入当前密码")} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">{t("新密码")}</Label>
                <Input 
                  id="newPassword" 
                  name="newPassword"
                  type="password"
                  value={passwordData.newPassword} 
                  onChange={handlePasswordChange}
                  placeholder={t("请输入新密码")} 
                />
                <p className="text-xs text-muted-foreground">{t("密码至少6位，包含字母和数字")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("确认新密码")}</Label>
                <Input 
                  id="confirmPassword" 
                  name="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword} 
                  onChange={handlePasswordChange}
                  placeholder={t("请再次输入新密码")} 
                />
              </div>
            </CardContent>
            <CardFooter className="border-t border-slate-100 bg-slate-50/40">
              <Button type="submit" disabled={passwordSubmitting}>
                {passwordSubmitting ? t("修改中...") : t("修改密码")}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
