"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  getCaptchaApi, 
  sendResetPasswordCodeApi, 
  resetPasswordApi 
} from "@/lib/api-services"

// 定义重置密码的步骤
enum ResetStep {
  VerifyEmail = 0,
  ResetPassword = 1,
  Done = 2
}

export default function ResetPasswordPage() {
  const router = useRouter()
  
  // 表单数据
  const [formData, setFormData] = useState({
    email: "",
    captchaCode: "",
    code: "",
    newPassword: "",
    confirmPassword: ""
  })
  
  // 验证码相关状态
  const [captchaData, setCaptchaData] = useState({
    uuid: "",
    imageBase64: ""
  })
  const [loadingCaptcha, setLoadingCaptcha] = useState(false)
  
  // 步骤控制
  const [currentStep, setCurrentStep] = useState<ResetStep>(ResetStep.VerifyEmail)
  
  // 操作状态
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)
  
  // 页面加载时获取验证码
  useEffect(() => {
    fetchCaptcha()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // 倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])
  
  // 处理表单输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }
  
  // 获取图形验证码
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
      console.error("获取图形验证码失败:", error)
    } finally {
      setLoadingCaptcha(false)
    }
  }
  
  // 验证邮箱及发送验证码
  const handleVerifyEmail = async () => {
    if (!formData.email) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入邮箱"
      })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入有效的邮箱地址"
      })
      return
    }
    
    if (!formData.captchaCode) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入图形验证码"
      })
      return
    }

    setSendingCode(true)
    try {
      const res = await sendResetPasswordCodeApi(
        formData.email,
        captchaData.uuid,
        formData.captchaCode
      )
      
      if (res.code === 200) {
        setCurrentStep(ResetStep.ResetPassword)
        setCountdown(60)
        toast({
          title: "成功",
          description: "验证码已发送，请查收邮件"
        })
      }
    } catch (error) {
      console.error("发送验证码失败:", error)
      fetchCaptcha() // 刷新验证码
    } finally {
      setSendingCode(false)
    }
  }
  
  // 重置密码
  const handleResetPassword = async () => {
    // 验证码验证
    if (!formData.code) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入验证码"
      })
      return
    }
    
    // 密码验证
    if (!formData.newPassword) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入新密码"
      })
      return
    }
    
    if (formData.newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "密码长度不能少于6位"
      })
      return
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "两次输入的密码不一致"
      })
      return
    }

    setLoading(true)
    try {
      const res = await resetPasswordApi(
        formData.email, 
        formData.newPassword, 
        formData.code
      )
      
      if (res.code === 200) {
        setCurrentStep(ResetStep.Done)
        toast({
          title: "成功",
          description: "密码重置成功，请使用新密码登录"
        })
      }
    } catch (error) {
      console.error("重置密码失败:", error)
    } finally {
      setLoading(false)
    }
  }
  
  // 处理重新发送验证码
  const handleResendCode = async () => {
    if (countdown > 0) return
    
    setSendingCode(true)
    try {
      await fetchCaptcha()
      const res = await sendResetPasswordCodeApi(
        formData.email,
        captchaData.uuid,
        formData.captchaCode
      )
      
      if (res.code === 200) {
        setCountdown(60)
        toast({
          title: "成功",
          description: "验证码已重新发送，请查收邮件"
        })
      }
    } catch (error) {
      console.error("重新发送验证码失败:", error)
    } finally {
      setSendingCode(false)
    }
  }
  
  // 根据当前步骤渲染不同内容
  const renderCurrentStep = () => {
    switch (currentStep) {
      case ResetStep.VerifyEmail:
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">
                邮箱 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="请输入您注册时使用的邮箱"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="captcha">
                图形验证码 <span className="text-destructive">*</span>
              </Label>
              <div className="flex space-x-2">
                <Input
                  id="captchaCode"
                  name="captchaCode"
                  type="text"
                  placeholder="请输入图形验证码"
                  value={formData.captchaCode}
                  onChange={handleChange}
                  className="flex-1"
                  required
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
                    <div className="w-full h-full bg-muted flex items-center justify-center text-sm">
                      {loadingCaptcha ? "加载中..." : "点击获取"}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <Button 
              type="button" 
              className="w-full" 
              onClick={handleVerifyEmail}
              disabled={sendingCode}
            >
              {sendingCode ? "发送中..." : "发送验证码"}
            </Button>
          </>
        );
        
      case ResetStep.ResetPassword:
        return (
          <>
            <div className="text-sm text-muted-foreground mb-4">
              验证码已发送至: <span className="font-medium">{formData.email}</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="code">
                验证码 <span className="text-destructive">*</span>
              </Label>
              <div className="flex space-x-2">
                <Input
                  id="code"
                  name="code"
                  type="text"
                  placeholder="请输入邮箱验证码"
                  value={formData.code}
                  onChange={handleChange}
                  className="flex-1"
                  required
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleResendCode}
                  disabled={countdown > 0 || sendingCode}
                >
                  {countdown > 0 ? `${countdown}s` : sendingCode ? "发送中..." : "重新发送"}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newPassword">
                新密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="请输入新密码"
                value={formData.newPassword}
                onChange={handleChange}
                required
              />
              <p className="text-xs text-muted-foreground">密码长度不少于6位</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                确认密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="flex space-x-2">
              <Button 
                type="button" 
                variant="outline"
                className="flex-1"
                onClick={() => setCurrentStep(ResetStep.VerifyEmail)}
              >
                上一步
              </Button>
              <Button 
                type="button" 
                className="flex-1"
                onClick={handleResetPassword}
                disabled={loading}
              >
                {loading ? "提交中..." : "重置密码"}
              </Button>
            </div>
          </>
        );
        
      case ResetStep.Done:
        return (
          <>
            <div className="py-8 text-center">
              <div className="mb-4 text-5xl">🎉</div>
              <h3 className="text-xl font-medium mb-2">密码重置成功!</h3>
              <p className="text-muted-foreground mb-6">您可以使用新密码登录系统</p>
              <Button 
                type="button" 
                className="w-full"
                onClick={() => router.push('/login')}
              >
                返回登录
              </Button>
            </div>
          </>
        );
    }
  };
  
  return (
    <div className="container max-w-[400px] py-10 h-screen flex flex-col justify-center">
      <div className="mb-8 space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">重置密码</h1>
        <p className="text-sm text-muted-foreground">
          {currentStep === ResetStep.VerifyEmail && "请输入您的邮箱，我们将发送验证码"}
          {currentStep === ResetStep.ResetPassword && "请输入验证码并设置新密码"}
          {currentStep === ResetStep.Done && "密码重置成功"}
        </p>
      </div>
      
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {[ResetStep.VerifyEmail, ResetStep.ResetPassword].map((step, index) => (
            <div key={step} className="flex flex-col items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm mb-1
                  ${currentStep >= step 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'}`}
              >
                {index + 1}
              </div>
              <div className="text-xs text-muted-foreground">
                {step === ResetStep.VerifyEmail && "验证邮箱"}
                {step === ResetStep.ResetPassword && "重置密码"}
              </div>
            </div>
          ))}
        </div>
        <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${(currentStep / (Object.keys(ResetStep).length / 2 - 1)) * 100}%` }}
          ></div>
        </div>
      </div>
      
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">带 <span className="text-destructive">*</span> 的字段为必填项</p>
        {renderCurrentStep()}
      </div>
      
      <div className="mt-6 text-sm text-center text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          返回登录
        </Link>
      </div>
    </div>
  )
} 