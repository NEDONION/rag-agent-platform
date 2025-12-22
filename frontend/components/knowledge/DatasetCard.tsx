import Link from "next/link"
import { Book, Edit, MoreHorizontal, Trash } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

import type { RagDataset } from "@/types/rag-dataset"
import { useI18n } from "@/contexts/i18n-context"

interface DatasetCardProps {
  dataset: RagDataset
  onEdit?: (dataset: RagDataset) => void
  onDelete?: (dataset: RagDataset) => void
}

export function DatasetCard({ dataset, onEdit, onDelete }: DatasetCardProps) {
  const { t } = useI18n()
  // 格式化时间
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground overflow-hidden">
              {dataset.icon ? (
                <img
                  src={dataset.icon}
                  alt={dataset.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Book className="h-4 w-4" />
              )}
            </div>
            <CardTitle className="text-base">{dataset.name}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">{t("打开菜单")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("操作")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(dataset)}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t("编辑")}
                </DropdownMenuItem>
              )}
              {onEdit && onDelete && <DropdownMenuSeparator />}
              {onDelete && (
                <DropdownMenuItem 
                  className="text-red-600" 
                  onClick={() => onDelete(dataset)}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  {t("删除")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardDescription className="text-xs">
          {t("更新于 {time}", { time: formatDate(dataset.updatedAt) })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-2">
          {dataset.description || t("暂无描述")}
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {t("文件数：{count}", { count: dataset.fileCount })}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        {onEdit && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onEdit(dataset)}
          >
            <Edit className="mr-2 h-4 w-4" />
            {t("编辑")}
          </Button>
        )}
        <Button size="sm" asChild>
          <Link href={`/knowledge/${dataset.id}`}>
            <Book className="mr-2 h-4 w-4" />
            {t("查看")}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
