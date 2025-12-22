"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { NavigationBar } from "@/components/navigation-bar"
import { WorkspaceProvider } from "@/contexts/workspace-context"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdminPage = pathname?.startsWith('/admin')

  return (
    <WorkspaceProvider>
      <div className="relative flex h-full flex-col">
        {!isAdminPage && <NavigationBar />}
        <div className="flex-1 flex">
          {children}
        </div>
      </div>
    </WorkspaceProvider>
  )
} 
