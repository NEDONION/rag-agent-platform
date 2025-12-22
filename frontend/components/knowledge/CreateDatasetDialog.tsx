"use client"

import { useState } from "react"
import { Book, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"

import { createDatasetWithToast } from "@/lib/rag-dataset-service"
import type { CreateDatasetRequest } from "@/types/rag-dataset"
import { useI18n } from "@/contexts/i18n-context"

interface CreateDatasetDialogProps {
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function CreateDatasetDialog({ onSuccess, trigger }: CreateDatasetDialogProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CreateDatasetRequest>({
    name: "",
    icon: "",
    description: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 客户端验证
    if (!formData.name.trim()) {
      toast({
        title: t("请输入数据集名称"),
        variant: "destructive",
      })
      return
    }

    if (formData.name.length > 100) {
      toast({
        title: t("数据集名称不能超过100个字符"),
        variant: "destructive",
      })
      return
    }

    if (formData.description && formData.description.length > 1000) {
      toast({
        title: t("数据集说明不能超过1000个字符"),
        variant: "destructive",
      })
      return
    }

    if (formData.icon && formData.icon.length > 500) {
      toast({
        title: t("图标URL不能超过500个字符"),
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const response = await createDatasetWithToast({
        name: formData.name.trim(),
        icon: formData.icon?.trim() || undefined,
        description: formData.description?.trim() || undefined,
      })

      if (response.code === 200) {
        // 重置表单
        setFormData({
          name: "",
          icon: "",
          description: "",
        })
        setOpen(false)
        onSuccess?.()
      }
    } catch (error) {
      // 错误已由withToast处理
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof CreateDatasetRequest, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("创建数据集")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Book className="h-5 w-5" />
              {t("创建数据集")}
            </DialogTitle>
            <DialogDescription>
              {t("创建新的 RAG 数据集，用于管理你的知识文档")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                {t("数据集名称")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder={t("请输入数据集名称")}
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                maxLength={100}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("已输入 {current}/{max} 字符", { current: formData.name.length, max: 100 })}
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="icon">{t("图标URL（可选）")}</Label>
              <Input
                id="icon"
                placeholder={t("请输入图标URL")}
                value={formData.icon}
                onChange={(e) => handleInputChange("icon", e.target.value)}
                maxLength={500}
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                {t("已输入 {current}/{max} 字符", { current: formData.icon?.length || 0, max: 500 })}
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">{t("数据集描述（可选）")}</Label>
              <Textarea
                id="description"
                placeholder={t("请输入数据集描述")}
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                maxLength={1000}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {t("已输入 {current}/{max} 字符", { current: formData.description?.length || 0, max: 1000 })}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              {t("取消")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("创建中...") : t("创建")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
