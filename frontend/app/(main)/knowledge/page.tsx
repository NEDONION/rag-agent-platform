"use client"

import { useState } from "react"
import { Plus, Database, Brain } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { CreateDatasetDialog } from "@/components/knowledge/CreateDatasetDialog"
import { CreatedRagsSection } from "@/components/knowledge/sections/CreatedRagsSection"
import { InstalledRagsSection } from "@/components/knowledge/sections/InstalledRagsSection"
import { RecommendedRagsSection } from "@/components/knowledge/sections/RecommendedRagsSection"
import { useI18n } from "@/contexts/i18n-context"

export default function KnowledgePage() {
  const { t } = useI18n()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // 触发刷新
  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="py-6 min-h-screen bg-muted/40">
      <div className="container max-w-7xl mx-auto px-2">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-8 bg-card p-6 rounded-xl border border-border">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("知识库")}</h1>
            <p className="text-muted-foreground mt-1">{t("管理 RAG 数据集，发现并使用高质量知识库")}</p>
          </div>
          
          <CreateDatasetDialog onSuccess={triggerRefresh} />
        </div>
        
        {/* 我创建的知识库部分 */}
        <CreatedRagsSection key={`created-${refreshTrigger}`} />
        
        {/* 我安装的知识库部分 */}
        <InstalledRagsSection key={`installed-${refreshTrigger}`} />
        
        {/* 推荐知识库部分 */}
        <RecommendedRagsSection key={`recommended-${refreshTrigger}`} />
      </div>
    </div>
  )
}
