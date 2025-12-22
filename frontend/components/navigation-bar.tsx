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
          console.error("Failed to fetch user details:", response.message)
        }
      } catch (error) {
        console.error("Error in fetching user details:", error)
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
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                <Home className="mr-2 h-5 w-5 text-blue-600" />
                <span className="font-bold">{t("AgentX Plus")}</span>
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
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Home className="h-6 w-6 text-blue-600" />
          <span className="hidden font-bold sm:inline-block">{t("RAG Agent Platform")}</span>
        </Link>
        <div className="flex flex-1 items-center justify-between">
          <nav className="flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1 text-sm font-medium transition-colors",
                  isActiveRoute(item.href)
                    ? "text-blue-600 font-semibold"
                    : "text-foreground/60 hover:text-foreground/80",
                )}
              >
                <item.icon className="h-5 w-5" />
                {t(item.name)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Languages className="h-4 w-4" />
                  <span className="sr-only">{t("Language")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setLocale("zh")}>
                  中文 {locale === "zh" ? "✓" : ""}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLocale("en")}>
                  English {locale === "en" ? "✓" : ""}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg?height=32&width=32" alt={t("User")} />
                    <AvatarFallback>
                      {loading ? "..." : getUserAvatarFallback()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg?height=32&width=32" alt={t("User")} />
                    <AvatarFallback>
                      {loading ? "..." : getUserAvatarFallback()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
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
                    <span className="font-medium text-green-600">{formatAmount(balance)}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("Personal Settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/general">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("General Model Settings")}
                  </Link>
                </DropdownMenuItem>
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
                <DropdownMenuItem asChild>
                  <Link href="/settings/api-keys">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("API Keys")}
                  </Link>
                </DropdownMenuItem>
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
