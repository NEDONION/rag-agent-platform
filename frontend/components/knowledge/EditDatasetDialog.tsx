"use client"

import { useState, useEffect } from "react"
import { Book, Edit } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"

import { updateDatasetWithToast } from "@/lib/rag-dataset-service"
import type { RagDataset, UpdateDatasetRequest } from "@/types/rag-dataset"
import { useI18n } from "@/contexts/i18n-context"

interface EditDatasetDialogProps {
  dataset: RagDataset | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditDatasetDialog({ 
  dataset, 
  open, 
  onOpenChange, 
  onSuccess 
}: EditDatasetDialogProps) {
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<UpdateDatasetRequest>({
    name: "",
    icon: "",
    description: "",
  })

  // 当数据集变化时更新表单数据
  useEffect(() => {
    if (dataset) {
      setFormData({
        name: dataset.name || "",
        icon: dataset.icon || "",
        description: dataset.description || "",
      })
    }
  }, [dataset])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!dataset) return

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

      const response = await updateDatasetWithToast(dataset.id, {
        name: formData.name.trim(),
        icon: formData.icon?.trim() || undefined,
        description: formData.description?.trim() || undefined,
      })

      if (response.code === 200) {
        onOpenChange(false)
        onSuccess?.()
      }
    } catch (error) {
      // 错误已由withToast处理
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof UpdateDatasetRequest, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {t("编辑数据集")}
            </DialogTitle>
            <DialogDescription>
              {t("修改数据集的基本信息")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">
                {t("数据集名称")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
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
              <Label htmlFor="edit-icon">{t("图标URL（可选）")}</Label>
              <Input
                id="edit-icon"
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
              <Label htmlFor="edit-description">{t("数据集说明（可选）")}</Label>
              <Textarea
                id="edit-description"
                placeholder={t("请输入数据集说明")}
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
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("取消")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("保存中...") : t("保存")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
