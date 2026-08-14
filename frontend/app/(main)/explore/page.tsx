"use client"

import { useEffect, useState } from "react"
import { Bot, Search, Plus, Check, AlertCircle, Info, Wrench, Database, Sparkles, Calendar, Layers, Store, Book } from "lucide-react"
import { Metadata } from "next"
import { redirect, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import { getPublishedAgents, addAgentToWorkspaceWithToast } from "@/lib/agent-service"
import { getProviders } from "@/lib/api-services"
import { getAllDatasets } from "@/lib/rag-dataset-service"
import { getCurrentUserId } from "@/lib/user-service"
import type { AgentVersion } from "@/types/agent"
import type { RagDataset } from "@/types/rag-dataset"
import { Sidebar } from "@/components/sidebar"
import { useWorkspace } from "@/contexts/workspace-context"
import { useI18n } from "@/contexts/i18n-context"
import Link from "next/link"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getChatModelsWithToast, type Model as ChatModel } from "@/lib/user-settings-service"
import { previewAgentStream, handlePreviewStream } from "@/lib/agent-preview-service"
import { RagChatDialog } from "@/components/knowledge/RagChatDialog"

export default function ExplorePage() {
  const router = useRouter()
  const { refreshWorkspace } = useWorkspace()
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [agents, setAgents] = useState<AgentVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("推荐")
  const [addingAgentId, setAddingAgentId] = useState<string | null>(null)
  const [providerStatus, setProviderStatus] = useState<"loading" | "ok" | "missing">("loading")
  const [modelStatus, setModelStatus] = useState<"loading" | "ok" | "missing">("loading")
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<AgentVersion | null>(null)
  const [previewMessages, setPreviewMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [previewInput, setPreviewInput] = useState("")
  const [previewModels, setPreviewModels] = useState<ChatModel[]>([])
  const [previewModelId, setPreviewModelId] = useState<string>("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewStreaming, setPreviewStreaming] = useState(false)
  const [previewAbortController, setPreviewAbortController] = useState<AbortController | null>(null)
  const [knowledgeBases, setKnowledgeBases] = useState<RagDataset[]>([])
  const [kbLoading, setKbLoading] = useState(true)
  const [kbError, setKbError] = useState<string | null>(null)
  const [ragChatOpen, setRagChatOpen] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState<RagDataset | null>(null)

  // 防抖处理搜索查询
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // 获取已发布的助理列表
  const fetchAgents = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getPublishedAgents(debouncedQuery)

      if (response.code === 200) {
        setAgents(response.data)
      } else {
        setError(response.message)
        toast({
          title: "Failed to get assistant list",
          description: response.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setError(errorMessage)
      toast({
        title: "Failed to get assistant list",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [debouncedQuery])

  useEffect(() => {
    let mounted = true
    async function fetchKnowledgeBases() {
      setKbLoading(true)
      setKbError(null)
      try {
        const response = await getAllDatasets()
        if (!mounted) return
        if (response.code === 200) {
          const currentUserId = getCurrentUserId()
          const records = response.data || []
          const filtered = currentUserId
            ? records.filter((rag) => rag.userId === currentUserId)
            : []
          setKnowledgeBases(filtered)
        } else {
          setKbError(response.message || "Failed to load knowledge bases")
        }
      } catch (error) {
        if (!mounted) return
        const message = error instanceof Error ? error.message : "Unknown error"
        setKbError(message)
      } finally {
        if (mounted) {
          setKbLoading(false)
        }
      }
    }

    fetchKnowledgeBases()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function fetchProviderStatus() {
      try {
        const response = await getProviders()
        if (!mounted) return
        if (response.code === 200) {
          const providers = response.data || []
          const hasProviders = providers.length > 0
          const hasModels = providers.some((provider: any) => Array.isArray(provider.models) && provider.models.length > 0)
          setProviderStatus(hasProviders ? "ok" : "missing")
          setModelStatus(hasModels ? "ok" : "missing")
        } else {
          setProviderStatus("missing")
          setModelStatus("missing")
        }
      } catch {
        if (!mounted) return
        setProviderStatus("missing")
        setModelStatus("missing")
      }
    }

    fetchProviderStatus()
    return () => {
      mounted = false
    }
  }, [])

  // 处理添加助理到工作区
  const handleAddToWorkspace = async (agentId: string) => {
    try {
      setAddingAgentId(agentId)
      const response = await addAgentToWorkspaceWithToast(agentId)
      if (response.code === 200) {
        // 局部刷新列表，而不是跳转到首页
        await fetchAgents()
        // 刷新左侧边栏的工作区列表
        refreshWorkspace()
      }
    } catch (error) {
      // 错误已由withToast处理
      console.error("Failed to add assistant to Workspace:", error)
    } finally {
      setAddingAgentId(null)
    }
  }

  const openAgentDetail = (agent: AgentVersion) => {
    setSelectedAgent(agent)
    setDetailOpen(true)
    const starter = agent.welcomeMessage || agent.description || "你好！我是这个 Agent，可以先问我 1-2 个问题试试。"
    setPreviewMessages([{ role: "assistant", content: starter }])
    setPreviewInput("")
  }

  const closeAgentDetail = () => {
    previewAbortController?.abort()
    setPreviewAbortController(null)
    setDetailOpen(false)
    setSelectedAgent(null)
    setPreviewMessages([])
    setPreviewInput("")
    setPreviewStreaming(false)
  }

  const stopPreviewStream = () => {
    previewAbortController?.abort()
    setPreviewAbortController(null)
    setPreviewStreaming(false)
  }

  useEffect(() => {
    if (!detailOpen) return
    const loadPreviewModels = async () => {
      setPreviewLoading(true)
      try {
        const response = await getChatModelsWithToast()
        if (response.code === 200 && response.data) {
          const activeModels = response.data.filter((model: ChatModel) => model.status)
          setPreviewModels(activeModels)
          if (!previewModelId && activeModels.length > 0) {
            setPreviewModelId(activeModels[0].id)
          }
        }
      } finally {
        setPreviewLoading(false)
      }
    }
    loadPreviewModels()
  }, [detailOpen, previewModelId])

  const handlePreviewSend = async () => {
    if (!selectedAgent || !previewInput.trim()) return
    const userTurns = previewMessages.filter((message) => message.role === "user").length
    if (userTurns >= 2) return
    if (!previewModelId) {
      toast({
        title: "请先选择模型",
        variant: "destructive",
      })
      return
    }

    if (previewStreaming) {
      stopPreviewStream()
    }

    const nextMessages = [...previewMessages, { role: "user", content: previewInput.trim() }]
    const assistantIndex = nextMessages.length
    nextMessages.push({ role: "assistant", content: "" })
    setPreviewMessages(nextMessages)
    setPreviewInput("")
    setPreviewStreaming(true)

    try {
      const controller = new AbortController()
      setPreviewAbortController(controller)
      const history = nextMessages.slice(0, assistantIndex).map((message) => ({
        role: message.role === "user" ? "USER" : "ASSISTANT",
        content: message.content,
      }))
      const stream = await previewAgentStream({
        userMessage: history[history.length - 1].content,
        systemPrompt: selectedAgent.systemPrompt || undefined,
        toolIds: selectedAgent.toolIds,
        toolPresetParams: selectedAgent.toolPresetParams,
        knowledgeBaseIds: selectedAgent.knowledgeBaseIds,
        messageHistory: history.slice(0, -1),
        modelId: previewModelId,
      }, controller.signal)
      if (!stream) {
        throw new Error("预览请求失败")
      }
      await handlePreviewStream(
        stream,
        (response) => {
          if (!response.content) return
          setPreviewMessages((prev) => {
            const updated = [...prev]
            const lastIndex = updated.length - 1
            if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
              updated[lastIndex] = {
                ...updated[lastIndex],
                content: `${updated[lastIndex].content}${response.content}`,
              }
            }
            return updated
          })
        },
        (error) => {
          if (controller.signal.aborted) return
          toast({
            title: "预览失败",
            description: error.message,
            variant: "destructive",
          })
        },
        () => {
          setPreviewStreaming(false)
          setPreviewAbortController(null)
        }
      )
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setPreviewStreaming(false)
        setPreviewAbortController(null)
        return
      }
      toast({
        title: "预览失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
      setPreviewStreaming(false)
      setPreviewAbortController(null)
    }
  }

  // 根据类型过滤助理
  const getFilteredAgents = (tab: string) => {
    if (tab === "推荐") return agents
    if (tab === "Agent") return agents
    return []
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full">
      {/* 左侧边栏 */}
      <Sidebar />

      {/* 右侧内容区域 */}
      <div className="flex-1 overflow-auto">
        <div className="container py-6 px-3">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Explore Agent Apps</h1>
            <p className="text-muted-foreground mt-1">Use these template Apps, or customize your own Apps based on the templates.</p>
          </div>

          <Card className="mb-6 border-border bg-muted/40 p-4 shadow-none">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  新用户引导：先完成模型服务配置
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  请先配置服务商的 API Key 与基础 URL，并确认已有可用模型。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/settings/providers">
                  <Button size="sm">
                    去配置模型服务
                  </Button>
                </Link>
                <Link href="/settings/providers">
                  <Button size="sm" variant="outline">
                    检查默认模型
                  </Button>
                </Link>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">1. 服务商配置</span>
                {providerStatus === "loading" ? (
                  <span className="text-muted-foreground">检测中...</span>
                ) : providerStatus === "ok" ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <Check className="h-4 w-4" /> 已完成
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-4 w-4" /> 未配置
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">2. 可用模型配置</span>
                {modelStatus === "loading" ? (
                  <span className="text-muted-foreground">检测中...</span>
                ) : modelStatus === "ok" ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <Check className="h-4 w-4" /> 已配置
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-4 w-4" /> 未配置
                  </span>
                )}
              </div>
            </div>
          </Card>

          <Card className="mb-6 rounded-xl border-border p-6 shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">{t("Recommended Knowledge Bases")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("Shows knowledge bases you created and can try immediately. Click the card button to start chatting.")}
                  </p>
                </div>
                <div className="ml-2 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {t("Total {count}", { count: knowledgeBases.length })}
                </div>
              </div>
              <Link href="/knowledge">
                <Button size="sm" variant="outline">
                  {t("Manage Knowledge Bases")}
                </Button>
              </Link>
            </div>

            {kbLoading ? (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-32 mb-1" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </Card>
                ))}
              </div>
            ) : kbError ? (
              <div className="mt-2 text-sm text-destructive">{kbError}</div>
            ) : knowledgeBases.length === 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">{t("No available knowledge base")}</div>
            ) : (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-border pt-4">
                {knowledgeBases.slice(0, 6).map((dataset) => (
                  <Card key={dataset.id} className="rounded-xl border-border p-0 shadow-none transition-colors hover:bg-accent/40 overflow-hidden">
                    <div className="relative p-4 bg-[linear-gradient(140deg,#ffffff_0%,#f4f6fb_55%,#ffffff_100%)]">
                      <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground overflow-hidden border border-border">
                              {dataset.icon ? (
                                <img
                                  src={dataset.icon}
                                  alt={dataset.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Book className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground line-clamp-1">{dataset.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {dataset.description || t("No description")}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {t("Available")}
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                            <Database className="h-3.5 w-3.5" />
                            {t("{count} files", { count: dataset.fileCount || 0 })}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {t("Updated")} {dataset.updatedAt ? new Date(dataset.updatedAt).toLocaleDateString() : t("Unknown")}
                          </span>
                        </div>

                        <div className="mt-4">
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSelectedDataset(dataset)
                              setRagChatOpen(true)
                            }}
                          >
                            {t("Try Now")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          <Tabs defaultValue="推荐" className="space-y-6" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-between items-center flex-wrap gap-4">
              <TabsList className="overflow-x-auto flex-nowrap max-w-full">
                <TabsTrigger value="推荐" className="flex items-center gap-1 whitespace-nowrap">
                  <Search className="h-4 w-4" />
                  推荐
                </TabsTrigger>
                <TabsTrigger value="Agent" className="whitespace-nowrap">
                  Agent
                </TabsTrigger>
                {/*<TabsTrigger value="助手" className="whitespace-nowrap">*/}
                {/*  助手*/}
                {/*</TabsTrigger>*/}
                <TabsTrigger value="DeepSeek" className="whitespace-nowrap">
                  DeepSeek
                </TabsTrigger>
                <TabsTrigger value="媒体" className="whitespace-nowrap">
                  媒体
                </TabsTrigger>
                <TabsTrigger value="工作流" className="whitespace-nowrap">
                  工作流
                </TabsTrigger>
                <TabsTrigger value="写作" className="whitespace-nowrap">
                  写作
                </TabsTrigger>
              </TabsList>

              <div className="relative w-full md:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search..."
                  className="pl-8 w-full md:w-[250px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {["推荐", "Agent", "DeepSeek", "媒体", "工作流", "写作"].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-6">
                {loading ? (
                  // 加载状态
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <Skeleton className="h-12 w-12 rounded-lg" />
                          <div className="flex-1">
                            <Skeleton className="h-5 w-32 mb-1" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                        </div>
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-3/4" />
                      </Card>
                    ))}
                  </div>
                ) : error ? (
                  // 错误状态
                  <div className="text-center py-10">
                    <div className="text-destructive mb-4">{error}</div>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                      Retry
                    </Button>
                  </div>
                ) : getFilteredAgents(tab).length === 0 ? (
                  // 空状态
                  <div className="text-center py-16 rounded-lg border border-border bg-muted/40">
                    <Search className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      {searchQuery ? "未找到匹配的 Agent" : `暂无${tab}类型的 Agent`}
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {searchQuery ? "尝试使用不同的搜索词" : "敬请期待更多内容"}
                    </p>
                  </div>
                ) : (
                  // 助理列表
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getFilteredAgents(tab).map((agent) => (
                      <Card key={agent.id} className="group relative">
                        <div className="p-5">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                              {agent.avatar ? (
                                <img
                                  src={agent.avatar || "/placeholder.svg"}
                                  alt={agent.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Bot className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold leading-tight">{agent.name}</h3>
                              <div className="text-xs text-muted-foreground uppercase font-medium mt-1">AGENT</div>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3">{agent.description || "无描述"}</p>

                          <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="space-y-2">
                              {agent.addWorkspace ? (
                                <Button 
                                  variant="secondary" className="w-full cursor-default" 
                                  disabled
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  已添加到工作区
                                </Button>
                              ) : (
                                <Button 
                                  className="w-full" 
                                  onClick={() => handleAddToWorkspace(agent.agentId)}
                                  disabled={addingAgentId === agent.agentId}
                                >
                                  {addingAgentId === agent.agentId ? (
                                    "添加中..."
                                  ) : (
                                    <>
                                      <Plus className="h-4 w-4 mr-2" />
                                      添加到工作区
                                    </>
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => openAgentDetail(agent)}
                              >
                                <Info className="h-4 w-4 mr-2" />
                                查看详情
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
      <Sheet open={detailOpen} onOpenChange={(open) => (open ? setDetailOpen(true) : closeAgentDetail())}>
        <SheetContent
          side="right"
          overlayClassName="bg-transparent"
          className="w-full sm:max-w-xl overflow-y-auto"
        >
          {selectedAgent && (
            <div className="flex h-full flex-col">
              <SheetHeader className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    {selectedAgent.avatar ? (
                      <img
                        src={selectedAgent.avatar}
                        alt={selectedAgent.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Bot className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <SheetTitle className="text-xl">{selectedAgent.name}</SheetTitle>
                    <SheetDescription className="mt-1">
                      {selectedAgent.description || "暂无描述"}
                    </SheetDescription>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">v{selectedAgent.versionNumber || "-"}</Badge>
                      {selectedAgent.publishStatusText && (
                        <Badge variant="outline">{selectedAgent.publishStatusText}</Badge>
                      )}
                      {selectedAgent.multiModal && (
                        <Badge variant="secondary">
                          多模态
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-4 space-y-6 text-sm text-muted-foreground">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-foreground">快速试聊</div>
                    <span className="text-xs text-muted-foreground">仅支持 1-2 轮</span>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="mb-3">
                      <Select
                        value={previewModelId}
                        onValueChange={setPreviewModelId}
                        disabled={previewLoading}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={previewLoading ? "加载模型中..." : "选择模型"} />
                        </SelectTrigger>
                        <SelectContent>
                          {previewModels.map((model) => (
                            <SelectItem
                              key={model.id}
                              value={model.id}
                              className="data-[state=checked]:font-medium"
                            >
                              <div className="flex items-center gap-2">
                                <span>{model.name}</span>
                                {model.providerName && (
                                  <Badge variant="secondary" className="text-xs">
                                    {model.providerName}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {previewMessages.map((message, index) => (
                        <div
                          key={`${message.role}-${index}`}
                          className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                        >
                          <div
                            className={
                              message.role === "user"
                                ? "max-w-[80%] rounded-lg bg-muted px-3 py-2 text-xs text-foreground"
                                : "max-w-[80%] rounded-lg px-3 py-2 text-xs text-foreground"
                            }
                          >
                            {message.content || (previewStreaming && index === previewMessages.length - 1 ? "..." : "")}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Input
                        value={previewInput}
                        onChange={(e) => setPreviewInput(e.target.value)}
                        placeholder="输入一句话试试..."
                        className="h-9"
                        disabled={
                          previewStreaming ||
                          previewMessages.filter((message) => message.role === "user").length >= 2
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handlePreviewSend()
                          }
                        }}
                      />
                      {previewStreaming ? (
                        <Button size="sm" variant="destructive" onClick={stopPreviewStream}>
                          停止
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handlePreviewSend}
                          disabled={
                            !previewInput.trim() ||
                            previewMessages.filter((message) => message.role === "user").length >= 2
                          }
                        >
                          发送
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4">
                  <div className="flex items-center gap-3 text-foreground">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">基础信息</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>发布时间：{selectedAgent.publishedAt || "未知"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      <span>默认模型：{selectedAgent.modelConfig?.modelName || "未配置"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span>工具数量：{selectedAgent.tools?.length || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span>知识库：{selectedAgent.knowledgeBaseIds?.length || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium text-foreground">系统提示词</div>
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-muted-foreground whitespace-pre-wrap">
                    {selectedAgent.systemPrompt || "暂无系统提示词"}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium text-foreground">欢迎语</div>
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-muted-foreground whitespace-pre-wrap">
                    {selectedAgent.welcomeMessage || "暂无欢迎语"}
                  </div>
                </div>

                {selectedAgent.changeLog && (
                  <div className="space-y-2">
                    <div className="font-medium text-foreground">更新记录</div>
                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-muted-foreground whitespace-pre-wrap">
                      {selectedAgent.changeLog}
                    </div>
                  </div>
                )}
              </div>

              <SheetFooter className="mt-8">
                {selectedAgent.addWorkspace ? (
                  <Button variant="secondary" className="w-full cursor-default" disabled>
                    <Check className="h-4 w-4 mr-2" />
                    已添加到工作区
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleAddToWorkspace(selectedAgent.agentId)}
                    disabled={addingAgentId === selectedAgent.agentId}
                  >
                    {addingAgentId === selectedAgent.agentId ? "添加中..." : "添加到工作区"}
                  </Button>
                )}
                <Button variant="outline" onClick={closeAgentDetail}>
                  关闭
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {selectedDataset && (
        <RagChatDialog
          open={ragChatOpen}
          onOpenChange={setRagChatOpen}
          dataset={selectedDataset}
        />
      )}
    </div>
  )
}
