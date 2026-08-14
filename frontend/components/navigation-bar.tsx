"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Database, FileText, Home, Menu, Search, Settings, PenToolIcon as Tool, UploadCloud, LogOut, Wrench, BarChart3, Tag, Wallet, Package, Activity, Languages } from "lucide-react"
import { toast } from "@/hooks/use-toast"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { deleteCookie } from "@/lib/utils"
import { getUserInfoWithToast, type UserInfo } from "@/lib/user-service"
import { useBalance } from "@/contexts/account-context"
import { useI18n } from "@/contexts/i18n-context"
import { debugLog } from "@/lib/debug"

const navItems = [
  {
    name: "Explore",
    href: "/explore",
    icon: Search,
  },
  {
    name: "Workspace",
    href: "/studio",
    icon: FileText,
  },
  {
    name: "Knowledge",
    href: "/knowledge",
    icon: Database,
  },
  // {
  //   name: "Tool Market",
  //   href: "/tools",
  //   icon: Wrench,我安装的知识库
  // },
]

export function NavigationBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const { balance, formatAmount } = useBalance()
  const { locale, setLocale, t } = useI18n()

  // 获取用户信息
  useEffect(() => {
    async function fetchUserInfo() {
      try {
        setLoading(true)
        const response = await getUserInfoWithToast()
        
        if (response.code === 200) {
          setUserInfo(response.data)
        } else {
          console.error("获取用户信息失败:", response.message)
        }
      } catch (error) {
        console.error("获取用户信息异常:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserInfo()
  }, [])

  // Check if current path matches the menu item's href
  const isActiveRoute = (href: string) => {
    if (href === "/explore" && pathname === "/") {
      return true // Main page also counts as explore
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  // 获取用户头像首字母
  const getUserAvatarFallback = () => {
    if (!userInfo?.nickname) return "U"
    return userInfo.nickname.charAt(0).toUpperCase()
  }

  const handleLogout = () => {
    debugLog("auth.logout")
    // 清除localStorage中的token
    localStorage.removeItem("auth_token")
    
    // 清除cookie中的token
    deleteCookie("token")
    
    // 显示退出成功提示
    toast({
      title: t("Success"),
      description: t("Logout successful"),
    })
    
    // 跳转到登录页
    window.location.href = "/login"
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">{t("Toggle Menu")}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="pr-0">
            <div className="px-7">
              <Link href="/" className="flex items-center" onClick={() => setOpen(false)}>
                <Home className="mr-2 h-5 w-5 text-primary" />
                <span className="font-semibold">{t("AgentX Plus")}</span>
              </Link>
            </div>
            <nav className="mt-6 flex flex-col gap-4 px-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                    isActiveRoute(item.href) ? "bg-accent text-accent-foreground" : "transparent",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {t(item.name)}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        <Link href="/" className="mr-6 flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline-block">
            {t("RAG Agent Platform")}
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-between">
          {/* 选中态用「前景色 + 极浅底」表达，不用色块 + 描边 + 阴影三件套：
              导航项是常驻元素，装饰越少，页面内容越清楚 */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  isActiveRoute(item.href)
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {t(item.name)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 rounded-md px-2 text-muted-foreground hover:text-foreground">
                  <Languages className="mr-1 h-4 w-4" />
                  <span className="text-xs font-medium">{locale === "zh" ? "中文" : "EN"}</span>
                  <span className="sr-only">{t("Language")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem
                  onSelect={() => setLocale("zh")}
                  className={cn(
                    "flex items-center justify-between",
                    locale === "zh" && "font-medium"
                  )}
                >
                  <span>中文</span>
                  {locale === "zh" && <span className="text-xs">已选</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setLocale("en")}
                  className={cn(
                    "flex items-center justify-between",
                    locale === "en" && "font-medium"
                  )}
                >
                  <span>English</span>
                  {locale === "en" && <span className="text-xs">Selected</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex h-8 items-center gap-2 rounded-md px-1.5">
                  <Avatar className="h-6 w-6 border border-border">
                    <AvatarImage src={userInfo?.avatarUrl || "/avatar-male.svg"} alt={t("User")} />
                    <AvatarFallback>
                      {loading ? "..." : getUserAvatarFallback()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">
                    {loading ? t("Loading...") : (userInfo?.nickname || t("Unknown user"))}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={userInfo?.avatarUrl || "/avatar-male.svg"} alt={t("User")} />
                    <AvatarFallback>
                      {loading ? "..." : getUserAvatarFallback()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-foreground">
                      {loading ? t("Loading...") : (userInfo?.nickname || t("Unknown user"))}
                    </div>
                    {userInfo?.email && (
                      <div className="text-sm text-muted-foreground">
                        {userInfo.email}
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-default">
                  <Wallet className="mr-2 h-4 w-4" />
                  <div className="flex items-center justify-between w-full">
                    <span>{t("Account balance")}</span>
                    <span className="font-medium tabular-nums">{formatAmount(balance)}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("Personal Settings")}
                  </Link>
                </DropdownMenuItem>
                {/*<DropdownMenuItem asChild>*/}
                {/*  <Link href="/settings/general">*/}
                {/*    <Settings className="mr-2 h-4 w-4" />*/}
                {/*    {t("General Model Settings")}*/}
                {/*  </Link>*/}
                {/*</DropdownMenuItem>*/}
                {/*<DropdownMenuItem asChild>*/}
                {/*  <Link href="/settings/billing">*/}
                {/*    <Settings className="mr-2 h-4 w-4" />*/}
                {/*    账户与计费*/}
                {/*  </Link>*/}
                {/*</DropdownMenuItem>*/}
                {/*<DropdownMenuItem asChild>*/}
                {/*  <Link href="/settings/pricing">*/}
                {/*    <Tag className="mr-2 h-4 w-4" />*/}
                {/*    价格说明*/}
                {/*  </Link>*/}
                {/*</DropdownMenuItem>*/}
                {/*<DropdownMenuItem asChild>*/}
                {/*  <Link href="/settings/api-keys">*/}
                {/*    <Settings className="mr-2 h-4 w-4" />*/}
                {/*    {t("API Keys")}*/}
                {/*  </Link>*/}
                {/*</DropdownMenuItem>*/}
                <DropdownMenuItem asChild>
                  <Link href="/settings/providers">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("Model Providers")}
                  </Link>
                </DropdownMenuItem>
                {/*<DropdownMenuItem asChild>*/}
                {/*  <Link href="/traces">*/}
                {/*    <Activity className="mr-2 h-4 w-4" />*/}
                {/*    执行追踪*/}
                {/*  </Link>*/}
                {/*</DropdownMenuItem>*/}
                {/*<DropdownMenuItem asChild>*/}
                {/*  <Link href="/settings/orders">*/}
                {/*    <Package className="mr-2 h-4 w-4" />*/}
                {/*    我的订单*/}
                {/*  </Link>*/}
                {/*</DropdownMenuItem>*/}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("Log out")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
