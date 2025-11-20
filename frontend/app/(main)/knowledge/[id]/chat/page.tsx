"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SplitLayout } from "@/components/layout/SplitLayout"
import { ChatMessageList } from "@/components/rag-chat/ChatMessageList"
import { ChatInputArea } from "@/components/rag-chat/ChatInputArea"
import { FileDetailPanel } from "@/components/rag-chat/FileDetailPanel"
import { useRagChatSession } from "@/hooks/rag-chat/useRagChatSession"
import { useChatLayout } from "@/hooks/rag-chat/useChatLayout"
import { getDatasetDetailWithToast } from "@/lib/rag-dataset-service"
import type { RagDataset, RetrievedFileInfo } from "@/types/rag-dataset"

export default function FullscreenRagChatPage() {
  const params = useParams()
  const router = useRouter()
  const datasetId = params.id as string

  const [dataset, setDataset] = useState<RagDataset | null>(null)
  const [loading, setLoading] = useState(true)

  const {
    uiState,
    selectFile,
    closeFileDetail,
    setFileDetailData,
    resetState
  } = useChatLayout()

  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    stopGeneration
  } = useRagChatSession({
    datasetId // 传入 datasetId 以支持持久化
  })

  // 加载数据集信息
  useEffect(() => {
    if (datasetId) {
      loadDataset()
    }
  }, [datasetId])

  const loadDataset = async () => {
    try {
      setLoading(true)
      const response = await getDatasetDetailWithToast(datasetId)
      if (response.code === 200) {
        setDataset(response.data)
      }
    } catch (error) {
      console.error('Failed to load dataset:', error)
    } finally {
      setLoading(false)
    }
  }

  // 处理文件点击
  const handleFileClick = (file: RetrievedFileInfo) => {
    console.log('[FullscreenRagChat] File clicked:', file)
    selectFile(file)
  }

  // 处理文件详情数据加载
  const handleFileDetailDataLoad = (data: any) => {
    setFileDetailData(data)
  }

  // 处理发送消息
  const handleSendMessage = async (message: string) => {
    if (!dataset?.id) return
    await sendMessage(message, [dataset.id])
  }

  // 处理清空对话
  const handleClearMessages = () => {
    clearMessages()
    closeFileDetail()
  }

  // 返回知识库详情页
  const handleBack = () => {
    resetState()
    stopGeneration()
    router.back()
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex items-center gap-4 px-6 py-4 border-b">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Skeleton className="h-12 w-12 mx-auto mb-4 rounded-full" />
            <Skeleton className="h-6 w-32 mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  if (!dataset) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex items-center gap-4 px-6 py-4 border-b">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Knowledge Base Not Found</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p>The knowledge base does not exist or has been deleted</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* 顶部导航栏 */}
      <div className="flex items-center gap-4 px-6 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <MessageSquare className="h-5 w-5" />
        <h1 className="text-lg font-semibold">RAG Smart Q&A</h1>
        <Badge variant="secondary">{dataset.name}</Badge>
        {uiState.layout === 'split' && (
          <Badge variant="outline" className="text-xs">
            Split View
          </Badge>
        )}
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 overflow-hidden">
        <SplitLayout
          leftPanel={
            <div className="flex flex-col h-full">
              <ChatMessageList
                messages={messages}
                onFileClick={handleFileClick}
                selectedFileId={uiState.selectedFile?.fileId}
                className="flex-1"
              />

              <ChatInputArea
                onSend={handleSendMessage}
                onStop={stopGeneration}
                onClear={handleClearMessages}
                isLoading={isLoading}
                hasMessages={messages.length > 0}
              />
            </div>
          }
          rightPanel={
            <FileDetailPanel
              selectedFile={uiState.selectedFile}
              onDataLoad={handleFileDetailDataLoad}
            />
          }
          showRightPanel={uiState.showFileDetail}
          onCloseRightPanel={closeFileDetail}
        />
      </div>
    </div>
  )
}
