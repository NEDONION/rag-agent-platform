"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ApiKeyResponse } from "@/types/api-key"

interface DeleteApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKey: ApiKeyResponse | null
  onConfirm: () => Promise<void>
  loading: boolean
}

export function DeleteApiKeyDialog({
  open,
  onOpenChange,
  apiKey,
  onConfirm,
  loading
}: DeleteApiKeyDialogProps) {
  if (!apiKey) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN")
  }

  const getStatusBadge = (status: boolean) => {
    return status ? (
      <Badge variant="default" className="bg-success">
        Enabled
      </Badge>
    ) : (
      <Badge variant="secondary">
        Disabled
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Deleting an API Key
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this API key? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Key Name：</span>
              <span className="text-sm">{apiKey.name}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Associate Agent：</span>
              <span className="text-sm">{apiKey.agentName || apiKey.agentId}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">state：</span>
              {getStatusBadge(apiKey.status)}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Use times：</span>
              <span className="text-sm">{apiKey.usageCount.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Creation time：</span>
              <span className="text-sm">{formatDate(apiKey.createdAt)}</span>
            </div>
            
            {apiKey.lastUsedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last used：</span>
                <span className="text-sm">{formatDate(apiKey.lastUsedAt)}</span>
              </div>
            )}
          </div>

          <div className="bg-background border border-destructive/30 p-3 rounded-md">
            <p className="text-sm text-destructive font-medium mb-2">⚠️ Deletion Consequences：</p>
            <ul className="text-sm text-destructive space-y-1">
              <li>• All applications using this key will immediately lose access</li>
              <li>• API calls will return a 401 Unauthorized error</li>
              <li>• This operation cannot be undone and requires re-keying</li>
              {apiKey.usageCount > 0 && (
                <li>• The key has already been used {apiKey.usageCount} times, which may affect running services</li>
              )}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Confirm Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}