import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { AgentVersion } from "@/types/agent"

interface AgentVersionDetailDialogProps {
  version: AgentVersion | null
  onClose: () => void
  onRollback: (version: AgentVersion) => void
  isRollingBack: boolean
}

const AgentVersionDetailDialog: React.FC<AgentVersionDetailDialogProps> = ({
  version,
  onClose,
  onRollback,
  isRollingBack,
}) => {
  if (!version) return null

  return (
    <Dialog open={!!version} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>版本详情: {version.versionNumber}</DialogTitle>
          <DialogDescription>发布于 {new Date(version.publishedAt).toLocaleString()}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={version.avatar || undefined} alt="Avatar" />
              <AvatarFallback className="bg-accent text-primary">
                {version.name ? version.name.charAt(0).toUpperCase() : "🤖"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium">{version.name}</h3>
              <p className="text-sm text-muted-foreground">{version.description}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">更新日志</h3>
            <div className="p-3 bg-muted/40 rounded-md">{version.changeLog}</div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">配置信息</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">工具数量</span>
                <span className="text-sm">{version.tools.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">知识库数量</span>
                <span className="text-sm">{version.knowledgeBaseIds.length}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">系统提示词</h3>
            <div className="p-3 bg-muted/40 rounded-md text-sm">
              {version.systemPrompt || "无系统提示词"}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">欢迎消息</h3>
            <div className="p-3 bg-muted/40 rounded-md text-sm">
              {version.welcomeMessage || "无欢迎消息"}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          <Button onClick={() => onRollback(version)} disabled={isRollingBack}>
            {isRollingBack ? "回滚中..." : "回滚到此版本"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AgentVersionDetailDialog 