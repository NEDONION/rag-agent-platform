"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Wrench, Clock, Square } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { streamChat } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { getSessionMessages, getSessionMessagesWithToast, type MessageDTO } from "@/lib/session-message-service"
import { AgentSessionService } from "@/lib/agent-session-service"
import { API_CONFIG, API_ENDPOINTS } from "@/lib/api-config"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageMarkdown } from "@/components/ui/message-markdown"
import { MessageType, type Message as MessageInterface } from "@/types/conversation"
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { nanoid } from 'nanoid'
import MultiModalUpload, { type ChatFile } from "@/components/multi-modal-upload"
import MessageFileDisplay from "@/components/message-file-display"

interface ChatPanelProps {
  conversationId: string
  isFunctionalAgent?: boolean
  agentName?: string

  onToggleScheduledTaskPanel?: () => void // 新增：切换定时任务面板的回调
  multiModal?: boolean // 新增：是否启用多模态功能
}

interface Message {
  id: string
  role: "USER" | "SYSTEM" | "assistant"
  content: string
  messageType?: string // 消息类型
  type?: MessageType // 消息类型枚举
  createdAt?: string
  updatedAt?: string
  fileUrls?: string[] // 修改：文件URL列表
}

interface AssistantMessage {
  id: string
  hasContent: boolean
}

interface StreamData {
  content: string
  done: boolean
  sessionId: string
  provider?: string
  model?: string
  timestamp: number
  messageType?: string // 消息类型
  files?: string[] // 新增：文件URL列表
}

// 定义消息类型为字符串字面量类型
type MessageTypeValue = 
  | "TEXT" 
  | "TOOL_CALL";

export function ChatPanel({ conversationId, isFunctionalAgent = false, agentName = "AI助手", onToggleScheduledTaskPanel, multiModal = false }: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<MessageInterface[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isThinking, setIsThinking] = useState(false)
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState<AssistantMessage | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<ChatFile[]>([]) // 新增：已上传的文件列表
  const [isInterrupting, setIsInterrupting] = useState(false) // 新增：中断状态
  const [canInterrupt, setCanInterrupt] = useState(false) // 新增：是否可以中断

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null) // 新增：中断控制器
  
  // 新增：使用useRef保存不需要触发重新渲染的状态
  const hasReceivedFirstResponse = useRef(false);
  const messageContentAccumulator = useRef({
    content: "",
    type: MessageType.TEXT as MessageType
  });

  // 在组件顶部添加状态来跟踪已完成的TEXT消息
  const [completedTextMessages, setCompletedTextMessages] = useState<Set<string>>(new Set());
  // 添加消息序列计数器
  const messageSequenceNumber = useRef(0);

  // 在组件初始化和conversationId变更时重置状态
  useEffect(() => {
    hasReceivedFirstResponse.current = false;
    messageContentAccumulator.current = {
      content: "",
      type: MessageType.TEXT
    };
    setCompletedTextMessages(new Set());
    messageSequenceNumber.current = 0;
    
    // 重置中断相关状态
    setCanInterrupt(false);
    setIsInterrupting(false);
    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }
  }, [conversationId]);

  // 添加消息到列表的辅助函数
  const addMessage = (message: {
    id: string;
    role: "USER" | "SYSTEM" | "assistant";
    content: string;
    type?: MessageType;
    createdAt?: string | Date;
    fileUrls?: string[]; // 修改：使用fileUrls
  }) => {
    const messageObj: MessageInterface = {
      id: message.id,
      role: message.role,
      content: message.content,
      type: message.type || MessageType.TEXT,
      createdAt: message.createdAt instanceof Date 
        ? message.createdAt.toISOString() 
        : message.createdAt || new Date().toISOString(),
      fileUrls: message.fileUrls || [] // 修改：使用fileUrls
    };
    
    setMessages(prev => [...prev, messageObj]);
  };

  // 获取会话消息
  useEffect(() => {
    const fetchSessionMessages = async () => {
      if (!conversationId) return
      
      try {
        setLoading(true)
        setError(null)
        // 清空之前的消息，避免显示上一个会话的内容
        setMessages([])
        
        // 获取会话消息
        const messagesResponse = await getSessionMessagesWithToast(conversationId)
        
        if (messagesResponse.code === 200 && messagesResponse.data) {
          // 转换消息格式
          const formattedMessages = messagesResponse.data.map((msg: MessageDTO) => {
            // 将SYSTEM角色的消息视为assistant
            const normalizedRole = msg.role === "SYSTEM" ? "assistant" : msg.role as "USER" | "SYSTEM" | "assistant"
            
            // 获取消息类型，优先使用messageType字段
            let messageType = MessageType.TEXT
            if (msg.messageType) {
              // 尝试转换为枚举值
              try {
                messageType = msg.messageType as MessageType
              } catch (e) {
 
              }
            }
            
            return {
              id: msg.id,
              role: normalizedRole,
              content: msg.content,
              type: messageType,
              createdAt: msg.createdAt,
              updatedAt: msg.updatedAt,
              fileUrls: msg.fileUrls || [] // 添加文件URL列表
            }
          })
          
          setMessages(formattedMessages)
        } else {
          const errorMessage = messagesResponse.message || "获取会话消息失败"
 
          setError(errorMessage)
        }
      } catch (error) {
 
        setError(error instanceof Error ? error.message : "获取会话消息时发生未知错误")
      } finally {
        setLoading(false)
      }
    }

    fetchSessionMessages()
  }, [conversationId])

  // 滚动到底部
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isTyping, autoScroll])

  // 处理对话中断
  const handleInterrupt = async () => {
    if (!conversationId || !canInterrupt || isInterrupting) {
      return
    }

    setIsInterrupting(true)
    
    try {
      // 1. 取消当前的网络请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      // 2. 调用AgentSessionService中断接口
      const response = await AgentSessionService.interruptSession(conversationId)
      
      if (response.code === 200) {
        toast({
          title: "对话已中断",
          variant: "default"
        })
      } else {
        throw new Error(response.message || "中断失败")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "中断对话失败"
 
      toast({
        title: "中断失败",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsInterrupting(false)
      setCanInterrupt(false)
      setIsTyping(false)
      setIsThinking(false)
    }
  }

  // 监听滚动事件
  useEffect(() => {
    const chatContainer = chatContainerRef.current
    if (!chatContainer) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer
      // 判断是否滚动到底部附近（20px误差范围）
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 20
      setAutoScroll(isAtBottom)
    }

    chatContainer.addEventListener('scroll', handleScroll)
    return () => chatContainer.removeEventListener('scroll', handleScroll)
  }, [])

  // 处理用户主动发送消息时强制滚动到底部
  const scrollToBottom = () => {
    setAutoScroll(true)
    // 使用setTimeout确保在下一个渲染周期执行
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }

  // 处理发送消息
  const handleSendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return

    // 添加调试信息
 
    
    // 获取已完成上传的文件URL
    const completedFiles = uploadedFiles.filter(file => file.url && file.uploadProgress === 100)
    const fileUrls = completedFiles.map(file => file.url)

    const userMessage = input.trim()
    setInput("")
    setUploadedFiles([]) // 清空已上传的文件
    setIsTyping(true)
    setIsThinking(true) // 设置思考状态
    setCurrentAssistantMessage(null) // 重置助手消息状态
    setCanInterrupt(true) // 启用中断功能
    setIsInterrupting(false) // 重置中断状态
    scrollToBottom() // 用户发送新消息时强制滚动到底部
    
    // 创建新的AbortController
    abortControllerRef.current = new AbortController()
    
    // 重置所有状态
    setCompletedTextMessages(new Set())
    resetMessageAccumulator()
    hasReceivedFirstResponse.current = false
    messageSequenceNumber.current = 0; // 重置消息序列计数器

    // 输出文件URL到控制台
    if (fileUrls.length > 0) {
 
    }

    // 添加用户消息到消息列表
    const userMessageId = `user-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: "USER",
        content: userMessage,
        type: MessageType.TEXT,
        createdAt: new Date().toISOString(),
        fileUrls: fileUrls.length > 0 ? fileUrls : undefined // 修改：使用fileUrls
      },
    ])

    try {
      // 发送消息到服务器并获取流式响应，包含文件URL
      const response = await streamChat(userMessage, conversationId, fileUrls.length > 0 ? fileUrls : undefined)

      // 检查响应状态，如果不是成功状态，则关闭思考状态并返回
      if (!response.ok) {
        // 错误已在streamChat中处理并显示toast
        setIsTyping(false)
        setIsThinking(false) // 关闭思考状态，修复动画一直显示的问题
        return // 直接返回，不继续处理
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No reader available")
      }

      // 生成基础消息ID，作为所有消息序列的前缀
      const baseMessageId = Date.now().toString()
      
      // 重置状态
      hasReceivedFirstResponse.current = false;
      messageContentAccumulator.current = {
        content: "",
        type: MessageType.TEXT
      };
      
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        // 检查是否被中断
        if (abortControllerRef.current?.signal.aborted) {
 
          break
        }
        
        const { done, value } = await reader.read()
        if (done) break

        // 解码数据块并添加到缓冲区
        buffer += decoder.decode(value, { stream: true })
        
        // 处理缓冲区中的SSE数据
        const lines = buffer.split("\n\n")
        // 保留最后一个可能不完整的行
        buffer = lines.pop() || ""
        
        for (const line of lines) {
          if (line.startsWith("data:")) {
            try {
              // 提取JSON部分（去掉前缀"data:"，处理可能的重复前缀情况）
              let jsonStr = line.substring(5);
              // 处理可能存在的重复data:前缀
              if (jsonStr.startsWith("data:")) {
                jsonStr = jsonStr.substring(5);
              }
 
              
              const data = JSON.parse(jsonStr) as StreamData
 
              
              // 处理消息 - 传递baseMessageId作为前缀
              handleStreamDataMessage(data, baseMessageId);
            } catch (e) {
 
            }
          }
        }
      }
    } catch (error) {
 
      
      // 如果是中断导致的错误，不显示错误提示
      if (error instanceof Error && error.name === 'AbortError') {
 
      } else {
        setIsThinking(false) // 错误发生时关闭思考状态
        toast({
          title: "发送消息失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        })
      }
    } finally {
      setIsTyping(false)
      setCanInterrupt(false) // 重置中断状态
      setIsInterrupting(false)
      if (abortControllerRef.current) {
        abortControllerRef.current = null
      }
    }
  }

  // 消息处理主函数 - 完全重构
  const handleStreamDataMessage = (data: StreamData, baseMessageId: string) => {
    // 首次响应处理
    if (!hasReceivedFirstResponse.current) {
      hasReceivedFirstResponse.current = true;
      setIsThinking(false);
    }
    
    // 处理错误消息
    if (isErrorMessage(data)) {
      handleErrorMessage(data);
      return;
    }
    
    // 获取消息类型，默认为TEXT
    const messageType = data.messageType as MessageType || MessageType.TEXT;
    
    // 生成当前消息序列的唯一ID
    const currentMessageId = `assistant-${messageType}-${baseMessageId}-seq${messageSequenceNumber.current}`;
    
 
    
    // 处理消息内容（用于UI显示）
    const displayableTypes = [undefined, "TEXT", "TOOL_CALL"];
    const isDisplayableType = displayableTypes.includes(data.messageType);
    
    if (isDisplayableType && data.content) {
      // 累积消息内容
      messageContentAccumulator.current.content += data.content;
      messageContentAccumulator.current.type = messageType;
      
      // 更新UI显示
      updateOrCreateMessageInUI(currentMessageId, messageContentAccumulator.current);
    }
    
    // 消息结束信号处理
    if (data.done) {
 
      
      // 如果是可显示类型且有内容，完成该消息
      if (isDisplayableType && messageContentAccumulator.current.content) {
        finalizeMessage(currentMessageId, messageContentAccumulator.current);
      }
      
      // 无论如何，都重置消息累积器，准备接收下一条消息
      resetMessageAccumulator();
      
      // 增加消息序列计数
      messageSequenceNumber.current += 1;
      
 
    }
  }
  
  // 更新或创建UI消息
  const updateOrCreateMessageInUI = (messageId: string, messageData: {
    content: string;
    type: MessageType;
  }) => {
    // 使用函数式更新，在一次原子操作中检查并更新/创建消息
    setMessages(prev => {
      // 检查消息是否已存在
      const messageIndex = prev.findIndex(msg => msg.id === messageId);
      
      if (messageIndex >= 0) {
        // 消息已存在，只需更新内容
 
        const newMessages = [...prev];
        newMessages[messageIndex] = {
          ...newMessages[messageIndex],
          content: messageData.content
        };
        return newMessages;
      } else {
        // 消息不存在，创建新消息
 
        return [
          ...prev,
          {
            id: messageId,
            role: "assistant",
            content: messageData.content,
            type: messageData.type,
            createdAt: new Date().toISOString()
          }
        ];
      }
    });
    
    // 更新当前助手消息状态
    setCurrentAssistantMessage({ id: messageId, hasContent: true });
  }
  
  // 完成消息处理
  const finalizeMessage = (messageId: string, messageData: {
    content: string;
    type: MessageType;
  }) => {
 
    
    // 如果消息内容为空，不处理
    if (!messageData.content || messageData.content.trim() === "") {
 
      return;
    }
    
    // 确保UI已更新到最终状态，使用相同的原子操作模式
    setMessages(prev => {
      // 检查消息是否已存在
      const messageIndex = prev.findIndex(msg => msg.id === messageId);
      
      if (messageIndex >= 0) {
        // 消息已存在，更新内容
 
        const newMessages = [...prev];
        newMessages[messageIndex] = {
          ...newMessages[messageIndex],
          content: messageData.content
        };
        return newMessages;
      } else {
        // 消息不存在，创建新消息
 
        return [
          ...prev,
          {
            id: messageId,
            role: "assistant",
            content: messageData.content,
            type: messageData.type,
            createdAt: new Date().toISOString()
          }
        ];
      }
    });
    
    // 标记消息为已完成
    setCompletedTextMessages(prev => {
      const newSet = new Set(prev);
      newSet.add(messageId);
      return newSet;
    });
  }

  // 重置消息累积器
  const resetMessageAccumulator = () => {
 
    messageContentAccumulator.current = {
      content: "",
      type: MessageType.TEXT
    };
  };

  // 处理按键事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 格式化消息时间
  const formatMessageTime = (timestamp?: string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  // 根据消息类型获取图标和文本
  const getMessageTypeInfo = (type: MessageType) => {
    switch (type) {
      case MessageType.TOOL_CALL:
        return {
          icon: <Wrench className="h-5 w-5 text-muted-foreground" />,
          text: '工具调用'
        };
      case MessageType.TEXT:
      default:
        return {
          icon: null,
          text: agentName
        };
    }
  };


  // 判断是否为错误消息
  const isErrorMessage = (data: StreamData): boolean => {
    return !!data.content && (
      data.content.includes("Error updating database") || 
      data.content.includes("PSQLException") || 
      data.content.includes("任务执行过程中发生错误")
    );
  };

  // 处理错误消息
  const handleErrorMessage = (data: StreamData) => {
 
    toast({
      title: "任务执行错误",
      description: "服务器处理任务时遇到问题，请稍后再试",
      variant: "destructive",
    });
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-4 w-full"
      >
        {loading ? (
          // 加载状态
          <div className="flex items-center justify-center h-full w-full">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary mb-2"></div>
              <p className="text-muted-foreground">正在加载消息...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {error && (
              <div className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            
            {/* 消息内容 */}
            <div className="space-y-6 w-full">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-20 w-full">
                  <p className="text-muted-foreground">暂无消息，开始发送消息吧</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`w-full`}
                  >
                    {/* 用户消息 */}
                    {message.role === "USER" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[80%]">
                          {/* 文件显示 - 在消息内容之前 */}
                          {message.fileUrls && message.fileUrls.length > 0 && (
                            <div className="mb-3">
                              <MessageFileDisplay fileUrls={message.fileUrls} />
                            </div>
                          )}
                          
                          {/* 消息内容 */}
                          {message.content && (
                            <div className="rounded-2xl rounded-br-md bg-muted px-3.5 py-2 text-sm leading-[1.7] text-foreground">
                              {message.content}
                            </div>
                          )}
                          
                          <div className="mt-1 text-right text-[11px] text-muted-foreground">
                            {formatMessageTime(message.createdAt)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* AI消息 */
                      <div className="flex">
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
                            <span>{formatMessageTime(message.createdAt)}</span>
                          </div>
                          
                          {/* 文件显示 - 在消息内容之前 */}
                          {message.fileUrls && message.fileUrls.length > 0 && (
                            <div className="mb-3">
                              <MessageFileDisplay fileUrls={message.fileUrls} />
                            </div>
                          )}
                          
                          {/* 消息内容 */}
                          {message.content && (
                            <div className="p-3 rounded-lg">
                              <MessageMarkdown showCopyButton={true}
                                content={message.content}
                                isStreaming={message.isStreaming}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {/* 思考中提示 */}
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
              
              <div ref={messagesEndRef} />
              {!autoScroll && isTyping && (
                <Button
                  variant="outline"
                  size="sm"
                  className="fixed bottom-20 right-6 rounded-full shadow-md bg-background"
                  onClick={scrollToBottom}
                >
                  <span>↓</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className="border-t border-border bg-background p-2">
        {/* 已上传文件显示区域 - 在输入框上方 */}
        {uploadedFiles.length > 0 && (
          <div className="mb-2 px-2">
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm"
                >
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-background">
                    {file.type.startsWith('image/') ? (
                      <span className="text-sm">🖼️</span>
                    ) : (
                      <span className="text-sm">📄</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="max-w-32 truncate text-sm font-medium text-foreground">
                      {file.name}
                    </p>
                    {/* 上传进度条 */}
                    {file.uploadProgress !== undefined && file.uploadProgress < 100 && (
                      <div className="mt-1 h-1 w-full rounded-full bg-muted">
                        <div
                          className="h-1 rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${file.uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setUploadedFiles(prev => prev.filter(f => f.id !== file.id))
                    }}
                    className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                    disabled={isTyping}
                  >
                    <span className="text-xs">×</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 输入框和按钮区域 */}
        <div className="flex items-end gap-2">
          {/* 多模态文件上传按钮 */}
          <MultiModalUpload
            multiModal={multiModal}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
            disabled={isTyping}
            className="flex-shrink-0"
            showFileList={false}
          />
          
          {/* 定时任务按钮 */}
          {isFunctionalAgent && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 flex-shrink-0"
              onClick={onToggleScheduledTaskPanel}
              title="定时任务"
            >
              <Clock className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </Button>
          )}
          
          <Textarea
            placeholder="输入消息...(Shift+Enter换行, Enter发送)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            className="min-h-[56px] flex-1 resize-none overflow-hidden rounded-xl px-3 py-2 font-normal"
            rows={Math.min(5, Math.max(2, input.split('\n').length))}
          />
          
          {/* 中断/发送按钮 - 根据状态条件渲染 */}
          {canInterrupt ? (
            <Button 
              onClick={handleInterrupt}
              disabled={isInterrupting}
              className="h-10 w-10 flex-shrink-0 rounded-xl bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
              title="中断对话"
            >
              <Square className="h-5 w-5" />
            </Button>
          ) : (
            <Button 
              onClick={handleSendMessage} 
              disabled={(!input.trim() && uploadedFiles.length === 0) || isTyping} 
              className="h-10 w-10 flex-shrink-0 rounded-xl shadow-sm"
              title="发送消息"
            >
              <Send className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

