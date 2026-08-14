"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, MessageCircle, Send, Bot, User, AlertCircle, Paperclip, X, Wrench, Square } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { previewAgentStream, handlePreviewStream, parseStreamData, createStreamDecoder, type AgentPreviewRequest, type MessageHistoryItem, type AgentChatResponse } from '@/lib/agent-preview-service'
import { uploadMultipleFiles, type UploadResult, type UploadFileInfo } from '@/lib/file-upload-service'
import { MessageType } from '@/types/conversation'
import { Highlight, themes } from 'prism-react-renderer'
import { MessageMarkdown } from '@/components/ui/message-markdown'
import { useInterruptableChat } from '@/hooks/use-interruptable-chat'

// 文件类型 - 使用URL而不是base64内容
interface ChatFile {
  id: string
  name: string
  type: string
  size: number
  url: string // 改为使用URL
  uploadProgress?: number // 新增：上传进度
}

// 消息类型
interface ChatMessage {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  timestamp: number
  isStreaming?: boolean
  files?: ChatFile[] // 消息附带的文件
  fileUrls?: string[] // 新增：文件URL列表（用于发送给后端）
  type?: MessageType // 消息类型
}

// 组件属性
interface AgentPreviewChatProps {
  // Agent基本信息
  agentName: string
  agentAvatar?: string | null
  systemPrompt?: string
  welcomeMessage?: string
  
  // Agent配置
  toolIds?: string[]
  toolPresetParams?: Record<string, Record<string, Record<string, string>>>
  modelId?: string
  multiModal?: boolean // 新增：是否启用多模态功能
  knowledgeBaseIds?: string[] // 新增：知识库ID列表，用于RAG功能
  
  // 样式控制
  className?: string
  disabled?: boolean
  placeholder?: string
}

export default function AgentPreviewChat({
  agentName,
  agentAvatar,
  systemPrompt,
  welcomeMessage = "你好！我是你的AI助手，有什么可以帮助你的吗？",
  toolIds,
  toolPresetParams,
  modelId,
  multiModal = false,
  knowledgeBaseIds,
  className = "",
  disabled = false,
  placeholder = "输入消息进行预览..."
}: AgentPreviewChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<ChatFile[]>([]) // 新增：待发送的文件列表
  const [isUploadingFiles, setIsUploadingFiles] = useState(false) // 新增：文件上传状态
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null) // 新增：当前会话ID
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null) // 新增：文件输入引用
  
  // 新增：使用中断Hook
  const {
    canInterrupt,
    isInterrupting,
    abortControllerRef,
    startChat,
    handleInterrupt,
    reset: resetInterrupt
  } = useInterruptableChat({
    onInterruptSuccess: () => {
      setIsLoading(false)
      setIsThinking(false)
      setStreamingMessageId(null)
      setCurrentSessionId(null)
    },
    onInterruptError: (error) => {
 
    }
  })
  
  // 新增：消息处理状态管理（参考chat-panel.tsx）
  const hasReceivedFirstResponse = useRef(false)
  const messageContentAccumulator = useRef({
    content: "",
    type: MessageType.TEXT as MessageType
  })
  const messageSequenceNumber = useRef(0)
  const [completedTextMessages, setCompletedTextMessages] = useState<Set<string>>(new Set())
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState<{ id: string; hasContent: boolean } | null>(null)
  const [autoScroll, setAutoScroll] = useState(true) // 新增：自动滚动控制
  const chatContainerRef = useRef<HTMLDivElement>(null) // 新增：聊天容器引用

  // 初始化欢迎消息和状态重置
  useEffect(() => {
    // 重置消息处理状态
    hasReceivedFirstResponse.current = false
    messageContentAccumulator.current = {
      content: "",
      type: MessageType.TEXT
    }
    setCompletedTextMessages(new Set())
    messageSequenceNumber.current = 0
    setCurrentAssistantMessage(null)
    
    if (welcomeMessage) {
      setMessages([{
        id: 'welcome',
        role: 'ASSISTANT',
        content: welcomeMessage,
        timestamp: Date.now(),
        type: MessageType.TEXT
      }])
    }
  }, [welcomeMessage])

  // 智能滚动到底部 - 只在自动滚动开启时滚动
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [messages, isThinking, autoScroll])

  // 监听滚动事件 - 检测用户是否手动滚动
  useEffect(() => {
    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollElement) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement
      // 判断是否滚动到底部附近（20px误差范围）
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 20
      setAutoScroll(isAtBottom)
    }

    scrollElement.addEventListener('scroll', handleScroll)
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [])

  // 处理用户主动发送消息时强制滚动到底部
  const scrollToBottom = useCallback(() => {
    setAutoScroll(true)
    // 使用setTimeout确保在下一个渲染周期执行
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight
        }
      }
    }, 100)
  }, [])

  // 发送消息 - 重新实现，使用和chat-panel相同的消息处理逻辑
  const sendMessage = async () => {
    if ((!inputValue.trim() && uploadedFiles.length === 0) || isLoading || disabled) return

    // 获取已完成上传的文件URL
    const completedFiles = uploadedFiles.filter(file => file.url && file.uploadProgress === 100)
    const fileUrls = completedFiles.map(file => file.url)

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'USER',
      content: inputValue.trim(),
      timestamp: Date.now(),
      files: completedFiles.length > 0 ? [...completedFiles] : undefined,
      fileUrls: fileUrls.length > 0 ? fileUrls : undefined,
      type: MessageType.TEXT
    }

    // 输出文件URL到控制台
    if (fileUrls.length > 0) {
 
    }

    // 添加用户消息
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setUploadedFiles([]) // 清空已上传的文件
    setIsLoading(true)
    setIsThinking(true) // 设置思考状态
    setCurrentAssistantMessage(null) // 重置助手消息状态
    
    // 生成新的会话ID
    const sessionId = Date.now().toString()
    setCurrentSessionId(sessionId)
    
    // 开始可中断的对话
    startChat()
    
    scrollToBottom() // 用户发送新消息时强制滚动到底部
    
    // 重置所有状态
    setCompletedTextMessages(new Set())
    resetMessageAccumulator()
    hasReceivedFirstResponse.current = false
    messageSequenceNumber.current = 0

    try {
      // 构建消息历史 - 包含文件URL信息
      const messageHistory: MessageHistoryItem[] = messages
        .filter(msg => msg.id !== 'welcome') // 排除欢迎消息
        .map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: new Date(msg.timestamp).toISOString(),
          fileUrls: msg.fileUrls // 包含文件URL
        }))

      // 构建预览请求
      const previewRequest: AgentPreviewRequest = {
        userMessage: userMessage.content,
        systemPrompt,
        toolIds,
        toolPresetParams,
        messageHistory,
        modelId,
        fileUrls: fileUrls.length > 0 ? fileUrls : undefined, // 当前消息的文件URL
        knowledgeBaseIds: knowledgeBaseIds && knowledgeBaseIds.length > 0 ? knowledgeBaseIds : undefined // RAG知识库配置
      }

 

      // 使用新的流式处理方式，传入AbortController
      const stream = await previewAgentStream(previewRequest, abortControllerRef.current?.signal)
      if (!stream) {
        throw new Error('Failed to get preview stream')
      }

      // 生成基础消息ID，作为所有消息序列的前缀
      const baseMessageId = Date.now().toString()
      
      // 重置状态
      hasReceivedFirstResponse.current = false
      messageContentAccumulator.current = {
        content: "",
        type: MessageType.TEXT
      }

      await handlePreviewStream(
        stream,
        (response: AgentChatResponse) => {
 
          // 处理消息 - 传递baseMessageId作为前缀
          handleStreamDataMessage(response, baseMessageId)
        },
        (error: Error) => {
 
          // 检查是否是用户主动中断
          if (error.name === 'AbortError') {
 
            setIsLoading(false)
            setIsThinking(false)
            return
          }
          handleStreamError(error)
        },
        () => {
 
          setIsLoading(false)
          setIsThinking(false)
          setCurrentSessionId(null)
          resetInterrupt() // 重置中断状态
        }
      )
    } catch (error) {
 
      // 检查是否是用户主动中断
      if (error instanceof Error && error.name === 'AbortError') {
 
        setIsLoading(false)
        setIsThinking(false)
        setCurrentSessionId(null)
        return
      }
      handleStreamError(error instanceof Error ? error : new Error('未知错误'))
    }
  }

  // 消息处理主函数 - 与chat-panel保持一致
  const handleStreamDataMessage = (data: AgentChatResponse, baseMessageId: string) => {
    // 首次响应处理
    if (!hasReceivedFirstResponse.current) {
      hasReceivedFirstResponse.current = true
      setIsThinking(false)
    }
    
    // 处理错误消息
    if (isErrorMessage(data)) {
      handleErrorMessage(data)
      return
    }
    
    // 获取消息类型，默认为TEXT
    const messageType = (data.messageType as MessageType) || MessageType.TEXT
    
    // 生成当前消息序列的唯一ID
    const currentMessageId = `assistant-${messageType}-${baseMessageId}-seq${messageSequenceNumber.current}`
    
 
    
    // 处理消息内容（用于UI显示）
    const displayableTypes = [undefined, "TEXT", "TOOL_CALL"]
    const isDisplayableType = displayableTypes.includes(data.messageType)
    
    if (isDisplayableType && data.content) {
      // 累积消息内容
      messageContentAccumulator.current.content += data.content
      messageContentAccumulator.current.type = messageType
      
      // 更新UI显示
      updateOrCreateMessageInUI(currentMessageId, messageContentAccumulator.current)
    }
    
    // 消息结束信号处理
    if (data.done) {
 
      
      // 如果是可显示类型且有内容，完成该消息
      if (isDisplayableType && messageContentAccumulator.current.content) {
        finalizeMessage(currentMessageId, messageContentAccumulator.current)
      }
      
      // 无论如何，都重置消息累积器，准备接收下一条消息
      resetMessageAccumulator()
      
      // 增加消息序列计数
      messageSequenceNumber.current += 1
      
 
    }
  }
  
  // 更新或创建UI消息
  const updateOrCreateMessageInUI = (messageId: string, messageData: {
    content: string
    type: MessageType
  }) => {
    // 使用函数式更新，在一次原子操作中检查并更新/创建消息
    setMessages(prev => {
      // 检查消息是否已存在
      const messageIndex = prev.findIndex(msg => msg.id === messageId)
      
      if (messageIndex >= 0) {
        // 消息已存在，只需更新内容
 
        const newMessages = [...prev]
        newMessages[messageIndex] = {
          ...newMessages[messageIndex],
          content: messageData.content
        }
        return newMessages
      } else {
        // 消息不存在，创建新消息
 
        return [
          ...prev,
          {
            id: messageId,
            role: "ASSISTANT" as const,
            content: messageData.content,
            type: messageData.type,
            timestamp: Date.now(),
            isStreaming: true
          }
        ]
      }
    })
    
    // 更新当前助手消息状态
    setCurrentAssistantMessage({ id: messageId, hasContent: true })
    setStreamingMessageId(messageId)
  }
  
  // 完成消息处理
  const finalizeMessage = (messageId: string, messageData: {
    content: string
    type: MessageType
  }) => {
 
    
    // 如果消息内容为空，不处理
    if (!messageData.content || messageData.content.trim() === "") {
 
      return
    }
    
    // 确保UI已更新到最终状态，使用相同的原子操作模式
    setMessages(prev => {
      // 检查消息是否已存在
      const messageIndex = prev.findIndex(msg => msg.id === messageId)
      
      if (messageIndex >= 0) {
        // 消息已存在，更新内容
 
        const newMessages = [...prev]
        newMessages[messageIndex] = {
          ...newMessages[messageIndex],
          content: messageData.content,
          isStreaming: false
        }
        return newMessages
      } else {
        // 消息不存在，创建新消息
 
        return [
          ...prev,
          {
            id: messageId,
            role: "ASSISTANT" as const,
            content: messageData.content,
            type: messageData.type,
            timestamp: Date.now(),
            isStreaming: false
          }
        ]
      }
    })
    
    // 标记消息为已完成
    setCompletedTextMessages(prev => {
      const newSet = new Set(prev)
      newSet.add(messageId)
      return newSet
    })
    
    setStreamingMessageId(null)
  }

  // 重置消息累积器
  const resetMessageAccumulator = () => {
 
    messageContentAccumulator.current = {
      content: "",
      type: MessageType.TEXT
    }
  }

  // 判断是否为错误消息
  const isErrorMessage = (data: AgentChatResponse): boolean => {
    return !!data.content && (
      data.content.includes("Error updating database") || 
      data.content.includes("PSQLException") || 
      data.content.includes("任务执行过程中发生错误")
    )
  }

  // 处理错误消息
  const handleErrorMessage = (data: AgentChatResponse) => {
 
    toast({
      title: "任务执行错误",
      description: "服务器处理任务时遇到问题，请稍后再试",
      variant: "destructive",
    })
  }

  // 处理流处理错误
  const handleStreamError = (error: Error) => {
    setIsThinking(false)
    setIsLoading(false)
    setStreamingMessageId(null)
    setCurrentSessionId(null)
    resetInterrupt() // 重置中断状态
    
    toast({
      title: "预览失败",
      description: error.message,
      variant: "destructive"
    })
  }


  // 处理按键事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // 根据消息类型获取图标和文本
  const getMessageTypeInfo = (type?: MessageType) => {
    switch (type) {
      case MessageType.TOOL_CALL:
        return {
          icon: <Wrench className="h-4 w-4 text-muted-foreground" />,
          text: '工具调用'
        }
      case MessageType.TEXT:
      default:
        return {
          icon: <Bot className="h-4 w-4" />,
          text: agentName
        }
    }
  }

  // 格式化消息时间
  const formatMessageTime = (timestamp?: number | string) => {
    if (!timestamp) return '刚刚'
    try {
      const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp)
      return date.toLocaleString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        month: '2-digit',
        day: '2-digit'
      })
    } catch (e) {
      return '刚刚'
    }
  }

  // 清空对话
  const clearChat = () => {
    // 如果正在对话中，先中断
    if (isLoading && currentSessionId) {
      handleInterrupt(currentSessionId)
    }
    
    setMessages(welcomeMessage ? [{
      id: 'welcome',
      role: 'ASSISTANT',
      content: welcomeMessage,
      timestamp: Date.now(),
      type: MessageType.TEXT
    }] : [])
    setIsThinking(false)
    setIsLoading(false)
    setStreamingMessageId(null)
    setCurrentAssistantMessage(null)
    setCurrentSessionId(null)
    resetInterrupt() // 重置中断状态
    
    // 重置消息处理状态
    hasReceivedFirstResponse.current = false
    messageContentAccumulator.current = {
      content: "",
      type: MessageType.TEXT
    }
    setCompletedTextMessages(new Set())
    messageSequenceNumber.current = 0
  }

  // 处理中断
  const onInterruptChat = async () => {
    if (!currentSessionId || !canInterrupt) return
    await handleInterrupt(currentSessionId)
  }

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (!multiModal) {
      toast({
        title: "多模态功能未启用",
        description: "请在Agent配置中启用多模态功能",
        variant: "destructive"
      })
      return
    }

    setIsUploadingFiles(true)

    // 准备上传文件信息
    const uploadFiles: UploadFileInfo[] = Array.from(files).map(file => ({
      file,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    }))

    // 创建临时文件状态（显示上传进度）
    const tempFiles: ChatFile[] = uploadFiles.map((fileInfo, index) => ({
      id: Date.now().toString() + index,
      name: fileInfo.fileName,
      type: fileInfo.fileType,
      size: fileInfo.fileSize,
      url: '', // 暂时为空
      uploadProgress: 0
    }))

    try {
      // 先添加临时文件到状态中
      setUploadedFiles(prev => [...prev, ...tempFiles])

      // 批量上传文件
      const uploadResults = await uploadMultipleFiles(
        uploadFiles,
        // 进度回调
        (fileIndex, progress) => {
          const tempFileId = tempFiles[fileIndex].id
          setUploadedFiles(prev => 
            prev.map(file => 
              file.id === tempFileId 
                ? { ...file, uploadProgress: progress }
                : file
            )
          )
        },
        // 单个文件完成回调
        (fileIndex, result) => {
          const tempFileId = tempFiles[fileIndex].id
          setUploadedFiles(prev => 
            prev.map(file => 
              file.id === tempFileId 
                ? { 
                    ...file, 
                    url: result.url, 
                    uploadProgress: 100,
                    name: result.fileName,
                    type: result.fileType,
                    size: result.fileSize
                  }
                : file
            )
          )
 
        },
        // 错误回调
        (fileIndex, error) => {
          const tempFileId = tempFiles[fileIndex].id
 
          
          // 移除失败的文件
          setUploadedFiles(prev => prev.filter(file => file.id !== tempFileId))
          
          toast({
            title: "文件上传失败",
            description: `${uploadFiles[fileIndex].fileName}: ${error.message}`,
            variant: "destructive"
          })
        }
      )

      if (uploadResults.length > 0) {
        toast({
          title: "文件上传成功",
          description: `已上传 ${uploadResults.length} 个文件`
        })
      }
    } catch (error) {
 
      
      // 清理所有临时文件
      setUploadedFiles(prev => 
        prev.filter(file => !tempFiles.some((temp: ChatFile) => temp.id === file.id))
      )
      
      toast({
        title: "文件上传失败",
        description: error instanceof Error ? error.message : "请重试",
        variant: "destructive"
      })
    } finally {
      setIsUploadingFiles(false)
      // 清空文件选择
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 移除文件
  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
  }

  // 触发文件选择
  const triggerFileSelect = () => {
    if (!multiModal) {
      toast({
        title: "多模态功能未启用",
        description: "请在Agent配置中启用多模态功能",
        variant: "destructive"
      })
      return
    }
    fileInputRef.current?.click()
  }

  return (
    <Card className={`flex flex-col h-full ${className}`}>
      {/* 头部 */}
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={agentAvatar || undefined} alt="Agent Avatar" />
              <AvatarFallback className="bg-muted text-muted-foreground">
                {agentName ? agentName.charAt(0).toUpperCase() : <Bot className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{agentName || "预览助理"}</h3>
              <p className="text-sm text-muted-foreground">预览模式</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearChat}
            disabled={isLoading}
          >
            清空对话
          </Button>
        </div>
      </CardHeader>

      {/* 消息区域 */}
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-6" ref={scrollAreaRef}>
          <div className="py-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="w-full">
                {/* 用户消息 */}
                {message.role === 'USER' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%]">
                      {/* 文件显示 - 在消息内容之前 */}
                      {message.files && message.files.length > 0 && (
                        <div className="mb-2 space-y-2">
                          {message.files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-2 rounded border border-border bg-background p-2"
                            >
                              {file.type.startsWith('image/') && file.url && file.url.trim() !== '' && (
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="w-8 h-8 rounded object-cover"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="truncate text-xs font-medium text-foreground">
                                  {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* 消息内容 */}
                      {message.content && (
                        <div className="rounded-2xl rounded-br-md bg-muted px-3.5 py-2 text-sm leading-[1.7] text-foreground">
                          <div className="text-sm whitespace-pre-wrap">
                            {message.content}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-1 text-right text-[11px] text-muted-foreground">
                        {formatMessageTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* AI消息 */
                  <div className="flex items-start">
                    <div className="h-8 w-8 mr-2 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                      {message.type && message.type !== MessageType.TEXT 
                        ? getMessageTypeInfo(message.type).icon 
                        : <div className="text-lg">🤖</div>
                      }
                    </div>
                    <div className="max-w-[95%]">
                      {/* 消息类型指示 */}
                      <div className="mb-1 flex items-center text-xs text-muted-foreground">
                        <span className="font-medium">
                          {message.type ? getMessageTypeInfo(message.type).text : agentName}
                        </span>
                        <span className="mx-1 text-muted-foreground">·</span>
                        <span>{formatMessageTime(message.timestamp)}</span>
                      </div>
                      {/* 文件显示 - 在消息内容之前 */}
                      {message.files && message.files.length > 0 && (
                        <div className="mb-2 space-y-2">
                          {message.files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-2 rounded border border-border bg-background p-2"
                            >
                              {file.type.startsWith('image/') && file.url && file.url.trim() !== '' && (
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="w-8 h-8 rounded object-cover"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="truncate text-xs font-medium text-foreground">
                                  {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* 消息内容 */}
                      {message.content && (
                        <div className={`p-3 rounded-lg ${
                          message.content.startsWith('预览出错:')
                            ? 'rounded-lg border border-destructive/30 text-destructive'
                            : ''
                        }`}>
                          {message.content.startsWith('预览出错:') ? (
                            // 错误消息使用简单文本显示
                            <>
                              <div className="text-sm whitespace-pre-wrap">
                                {message.content}
                                {message.isStreaming && (
                                  <span className="inline-block w-2 h-4 bg-current opacity-75 animate-pulse ml-1" />
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-xs">
                                <AlertCircle className="h-3 w-3" />
                                <span>请检查Agent配置或网络连接</span>
                              </div>
                            </>
                          ) : (
                            // 正常消息使用Markdown渲染
                            <div className="markdown-content">
                              <MessageMarkdown showCopyButton={true}
                                content={message.content + (message.isStreaming ? ' ▌' : '')}
                                
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* 思考中提示 - 和chat-panel保持一致 */}
            {isThinking && (!currentAssistantMessage || !currentAssistantMessage.hasContent) && (
              <div className="flex items-start">
                <div className="h-8 w-8 mr-2 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="text-lg">🤖</div>
                </div>
                <div className="max-w-[95%]">
                  <div className="mb-1 flex items-center text-xs text-muted-foreground">
                    <span className="font-medium">{agentName}</span>
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span>刚刚</span>
                  </div>
                  <div className="space-y-2 p-3 rounded-lg">
                    <div className="flex space-x-2 items-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse"></div>
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse delay-75"></div>
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse delay-150"></div>
                      <div className="text-sm text-muted-foreground animate-pulse">思考中...</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* 滚动到底部按钮 - 当用户手动滚动离开底部时显示 */}
            {!autoScroll && (isLoading || isThinking) && (
              <Button
                variant="outline"
                size="sm"
                className="fixed bottom-32 right-6 z-10 rounded-full bg-background shadow-md hover:bg-accent"
                onClick={scrollToBottom}
              >
                <span className="text-sm">↓ 回到底部</span>
              </Button>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* 输入区域 */}
      <div className="flex-shrink-0 p-4 border-t">
        {/* 已上传文件预览 */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="relative flex items-center gap-2 rounded-lg border border-border bg-muted/60 p-2"
              >
                {file.type.startsWith('image/') && file.url && file.url.trim() !== '' && (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-6 h-6 rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    {typeof file.uploadProgress === 'number' && file.uploadProgress < 100 && (
                      <div className="flex items-center gap-1">
                        <div className="h-1 w-8 overflow-hidden rounded-full bg-muted">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${file.uploadProgress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {file.uploadProgress}%
                        </span>
                      </div>
                    )}
                    {file.uploadProgress === 100 && (
                      <span className="text-xs text-success">✓</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file.id)}
                  disabled={typeof file.uploadProgress === 'number' && file.uploadProgress < 100}
                  className="h-6 w-6 p-0 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {/* 文件上传按钮 */}
          {multiModal && (
            <Button
              variant="outline"
              size="icon"
              onClick={triggerFileSelect}
              disabled={disabled || isLoading || isUploadingFiles}
              className="flex-shrink-0"
            >
              {isUploadingFiles ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
          )}

          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={disabled ? "预览功能已禁用" : placeholder}
            disabled={disabled || isLoading}
            className="flex-1"
          />
          
          {/* 发送/中断按钮 */}
          {canInterrupt ? (
            <Button
              onClick={onInterruptChat}
              disabled={disabled || isInterrupting}
              size="icon"
              variant="destructive"
            >
              {isInterrupting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button
              onClick={sendMessage}
              disabled={disabled || isLoading || (!inputValue.trim() && uploadedFiles.length === 0)}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* 隐藏的文件输入 */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*,.pdf,.doc,.docx,.txt,.md"
          multiple
          className="hidden"
        />

        {disabled && (
          <p className="text-xs text-muted-foreground mt-2">
            请填写必要的Agent信息后进行预览
          </p>
        )}
        
        {/* 中断状态提示 */}
        {canInterrupt && (
          <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
            <Square className="h-3 w-3" />
            点击停止按钮可中断对话
          </p>
        )}
      </div>
    </Card>
  )
} 