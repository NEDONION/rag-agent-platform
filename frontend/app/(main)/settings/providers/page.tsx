"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MoreHorizontal, Plus, Edit, Trash, Power, PowerOff, Loader2, PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  getProviders, 
  getProviderDetail, 
  deleteProviderWithToast, 
  toggleProviderStatusWithToast,
  deleteModelWithToast,
  toggleModelStatusWithToast
} from "@/lib/api-services"
import {
  getUserSettingsWithToast,
  updateUserSettings,
  getChatModelsWithToast,
  getOcrModelsWithToast,
  getEmbeddingModelsWithToast,
  type UserSettings,
  type Model as ChatModel,
  type FallbackConfig,
} from "@/lib/user-settings-service"
import { ProviderDialog } from "@/components/provider-dialog"
import { ModelDialog } from "@/components/model-dialog"
import { toast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/contexts/i18n-context"
import { FallbackConfigComponent } from "@/components/settings/fallback-config"

// 服务商接口
interface Model {
  id: string
  userId: string
  providerId: string
  providerName: string | null
  modelId: string
  name: string
  description: string
  type: string
  config: any
  isOfficial: boolean | null
  status: boolean
  createdAt: string
  updatedAt: string
}

interface Provider {
  id: string
  protocol: string
  name: string
  description?: string
  config: any
  isOfficial: boolean
  status: boolean
  createdAt: string
  updatedAt: string
  models: Model[]
}

export default function ProvidersPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"all" | "official" | "personal">("all")
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProviderDialog, setShowProviderDialog] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)
  
  // 模型管理相关状态
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [showModelDialog, setShowModelDialog] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [deleteModelConfirmOpen, setDeleteModelConfirmOpen] = useState(false)
  const [isDeletingModel, setIsDeletingModel] = useState(false)
  const [isTogglingModelStatus, setIsTogglingModelStatus] = useState(false)

  const [settings, setSettings] = useState<UserSettings>({
    settingConfig: {
      defaultModel: null,
      defaultOcrModel: null,
      defaultEmbeddingModel: null,
      fallbackConfig: {
        enabled: false,
        fallbackChain: []
      }
    }
  })
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [chatModels, setChatModels] = useState<ChatModel[]>([])
  const [chatModelsLoading, setChatModelsLoading] = useState(true)
  const [ocrModels, setOcrModels] = useState<ChatModel[]>([])
  const [embeddingModels, setEmbeddingModels] = useState<ChatModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showSaveNotice, setShowSaveNotice] = useState(false)
  const saveNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // 加载服务商数据
  const loadProviders = async () => {
    setLoading(true)
    try {
      let type: string | undefined;
      if (activeTab === "official") {
        type = "official";
      } else if (activeTab === "personal") {
        type = "custom";
      }
      
      const response = await getProviders(type);
      if (response.code === 200) {
        console.log("服务商数据:", response.data)
        setProviders(response.data)
      } else {
        setError(response.message || t("获取服务商列表失败"))
      }
    } catch (err) {
      console.error("获取服务商错误:", err)
      setError(t("获取服务商数据失败"))
    } finally {
      setLoading(false)
    }
  }
  
  // 当标签变化时重新加载数据
  useEffect(() => {
    loadProviders()
  }, [activeTab])

  useEffect(() => {
    async function fetchSettings() {
      setSettingsLoading(true)
      try {
        const response = await getUserSettingsWithToast()
        if (response.code === 200 && response.data) {
          setSettings({
            ...response.data,
            settingConfig: {
              ...response.data.settingConfig,
              defaultOcrModel: response.data.settingConfig.defaultOcrModel || null,
              defaultEmbeddingModel: response.data.settingConfig.defaultEmbeddingModel || null,
              fallbackConfig: response.data.settingConfig.fallbackConfig || {
                enabled: false,
                fallbackChain: []
              }
            }
          })
        }
      } finally {
        setSettingsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const fetchChatModels = useCallback(async () => {
    setChatModelsLoading(true)
    try {
      const response = await getChatModelsWithToast()
      if (response.code === 200 && response.data) {
        console.log("[Model Settings] raw chat models:", response.data)
        const activeModels = response.data.filter((model: ChatModel) => {
          const modelType = typeof model.type === "string" ? model.type : (model.type as { code?: string })?.code
          console.log("[Model Settings] chat model type:", model.id, model.name, modelType, model.status)
          return model.status !== false && modelType === "CHAT"
        })
        setChatModels(activeModels)
      }
    } finally {
      setChatModelsLoading(false)
    }
  }, [])

  const fetchAdditionalModels = useCallback(async () => {
    setModelsLoading(true)
    try {
      const [ocrResponse, embeddingResponse] = await Promise.all([
        getOcrModelsWithToast(),
        getEmbeddingModelsWithToast()
      ])

      if (ocrResponse.code === 200 && ocrResponse.data) {
        console.log("[Model Settings] raw vision models:", ocrResponse.data)
        const visionModels = ocrResponse.data.filter((model: ChatModel) => {
          const modelType = typeof model.type === "string" ? model.type : (model.type as { code?: string })?.code
          console.log("[Model Settings] vision model type:", model.id, model.name, modelType, model.status)
          return model.status !== false && modelType === "VISION"
        })
        setOcrModels(visionModels)
      }

      if (embeddingResponse.code === 200 && embeddingResponse.data) {
        console.log("[Model Settings] raw embedding models:", embeddingResponse.data)
        const embeddingList = embeddingResponse.data.filter((model: ChatModel) => {
          const modelType = typeof model.type === "string" ? model.type : (model.type as { code?: string })?.code
          console.log("[Model Settings] embedding model type:", model.id, model.name, modelType, model.status)
          return model.status !== false && modelType === "EMBEDDING"
        })
        setEmbeddingModels(embeddingList)
      }
    } finally {
      setModelsLoading(false)
    }
  }, [])

  const refreshModels = useCallback(async () => {
    await Promise.all([fetchChatModels(), fetchAdditionalModels()])
  }, [fetchAdditionalModels, fetchChatModels])

  useEffect(() => {
    fetchChatModels()
  }, [fetchChatModels])

  useEffect(() => {
    fetchAdditionalModels()
  }, [fetchAdditionalModels])

  useEffect(() => {
    return () => {
      if (saveNoticeTimeoutRef.current) {
        clearTimeout(saveNoticeTimeoutRef.current)
      }
    }
  }, [])

  const handleDefaultModelChange = async (modelId: string) => {
    const nextSettings = {
      ...settings,
      settingConfig: {
        ...settings.settingConfig,
        defaultModel: modelId,
      }
    }
    setSettings(nextSettings)
    const response = await updateUserSettings({
      settingConfig: nextSettings.settingConfig,
    })
    if (response.code !== 200) {
      toast({
        title: t("配置保存失败"),
        description: t("保存失败，请重试"),
        variant: "destructive",
      })
    }
  }

  const handleDefaultOcrModelChange = (modelId: string) => {
    setSettings(prev => ({
      ...prev,
      settingConfig: {
        ...prev.settingConfig,
        defaultOcrModel: modelId
      }
    }))
  }

  const handleDefaultEmbeddingModelChange = (modelId: string) => {
    setSettings(prev => ({
      ...prev,
      settingConfig: {
        ...prev.settingConfig,
        defaultEmbeddingModel: modelId
      }
    }))
  }

  const handleFallbackConfigChange = (fallbackConfig: FallbackConfig) => {
    setSettings(prev => ({
      ...prev,
      settingConfig: {
        ...prev.settingConfig,
        fallbackConfig
      }
    }))
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      const response = await updateUserSettings({
        settingConfig: {
          defaultModel: settings.settingConfig.defaultModel,
          defaultOcrModel: settings.settingConfig.defaultOcrModel,
          defaultEmbeddingModel: settings.settingConfig.defaultEmbeddingModel,
          fallbackConfig: settings.settingConfig.fallbackConfig
        }
      })
      if (response.code === 200 && response.data) {
        setSettings(response.data)
        setShowSaveNotice(true)
        if (saveNoticeTimeoutRef.current) {
          clearTimeout(saveNoticeTimeoutRef.current)
        }
        saveNoticeTimeoutRef.current = setTimeout(() => {
          setShowSaveNotice(false)
          router.back()
        }, 1200)
      } else {
        toast({
          title: t("配置保存失败"),
          description: t("保存失败，请重试"),
          variant: "destructive",
        })
      }
    } finally {
      setSubmitting(false)
    }
  }
  
  // 根据标签筛选服务商（已通过API过滤，无需本地再次过滤）
  const filteredProviders = providers;

  const renderProviders = (items: Provider[]) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-10 border rounded-md bg-gray-50">
          <p className="text-muted-foreground">{t("No model providers data")}</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {items.map((provider) => (
          <Card key={provider.id} className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                    {provider.protocol.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-base">{provider.name}</CardTitle>
                    <CardDescription className="text-xs flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {provider.protocol}
                      </Badge>
                      {provider.isOfficial && (
                        <Badge variant="outline" className="text-[10px]">
                          {t("Official")}
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      provider.status
                        ? "bg-green-50 text-green-600 border-green-200"
                        : "bg-red-50 text-red-600 border-red-200"
                    }
                  >
                    {provider.status ? t("Enabled") : t("Disabled")}
                  </Badge>
                  {!provider.isOfficial && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{t("Open menu")}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => openEditDialog(provider, e)}>
                          <Edit className="mr-2 h-4 w-4" />
                          {t("Edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => openDeleteConfirm(provider, e)}>
                          <Trash className="mr-2 h-4 w-4" />
                          {t("Delete")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => toggleProviderStatus(provider, e)} disabled={isTogglingStatus}>
                          {provider.status ? (
                            <>
                              <PowerOff className="mr-2 h-4 w-4" />
                              {t("Disable")}
                            </>
                          ) : (
                            <>
                              <Power className="mr-2 h-4 w-4" />
                              {t("Enable")}
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {provider.description || t("No description")}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("Model List")}</span>
                {!provider.isOfficial && (
                  <Button variant="outline" size="sm" onClick={() => openAddModelDialog(provider)}>
                    <PlusCircle className="h-4 w-4 mr-1" />
                    {t("Add Model")}
                  </Button>
                )}
              </div>
              {provider.models && provider.models.length > 0 ? (
                <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50/60 p-3">
                  {provider.models.map((model) => (
                    <div key={model.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{model.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t("ID")}: {model.modelId} · {t("Type")}: {model.type}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!provider.isOfficial && (
                          <Switch
                            checked={model.status}
                            onCheckedChange={() => toggleModelStatus(provider, model)}
                            disabled={isTogglingModelStatus}
                          />
                        )}
                        {!provider.isOfficial && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditModelDialog(provider, model)}>
                                <Edit className="mr-2 h-4 w-4" />
                                {t("Edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDeleteModelConfirm(provider, model)}>
                                <Trash className="mr-2 h-4 w-4" />
                                {t("Delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-muted-foreground">
                  {provider.isOfficial ? t("No model yet") : t("No model yet, click Add to create one")}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // 打开编辑弹窗
  const openEditDialog = async (provider: Provider, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // 获取服务商详情
    try {
      const response = await getProviderDetail(provider.id);
      if (response.code === 200) {
        setEditingProvider(response.data);
        setShowProviderDialog(true);
      } else {
        toast({
          title: t("获取提供商详情失败"),
          description: response.message,
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("获取服务商详情错误:", err);
      toast({
        title: t("获取提供商详情失败"),
        description: t("请稍后重试"),
        variant: "destructive"
      });
    }
  }
  
  // 打开添加弹窗
  const openAddDialog = () => {
    setEditingProvider(null);
    setShowProviderDialog(true);
  }
  
  // 打开删除确认
  const openDeleteConfirm = (provider: Provider, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProvider(provider);
    setDeleteConfirmOpen(true);
  }
  
  // 确认删除
  const confirmDelete = async () => {
    if (!selectedProvider) return;
    
    setIsDeleting(true);
    try {
      const response = await deleteProviderWithToast(selectedProvider.id);
      if (response.code === 200) {
        setDeleteConfirmOpen(false);
        loadProviders();
      }
    } catch (error) {
      console.error("删除服务商失败:", error);
    } finally {
      setIsDeleting(false);
    }
  }
  
  // 切换服务商状态
  const toggleProviderStatus = async (provider: Provider, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    setIsTogglingStatus(true);
    try {
      const response = await toggleProviderStatusWithToast(provider.id);
      if (response.code === 200) {
        // 更新本地状态
        if (selectedProvider && selectedProvider.id === provider.id) {
          setSelectedProvider({
            ...selectedProvider,
            status: !selectedProvider.status
          });
        }
        // 更新列表
        setProviders(prev => prev.map(p => {
          if (p.id === provider.id) {
            return { ...p, status: !p.status };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error("切换服务商状态失败:", error);
    } finally {
      setIsTogglingStatus(false);
    }
  }
  
  // 打开添加模型对话框
  const openAddModelDialog = (provider: Provider) => {
    setSelectedProvider(provider);
    setEditingModel(null);
    setShowModelDialog(true);
  }
  
  // 打开编辑模型对话框
  const openEditModelDialog = (provider: Provider, model: Model) => {
    setSelectedProvider(provider);
    setEditingModel(model);
    setShowModelDialog(true);
  }
  
  // 打开删除模型确认
  const openDeleteModelConfirm = (provider: Provider, model: Model) => {
    setSelectedProvider(provider);
    setSelectedModel(model);
    setDeleteModelConfirmOpen(true);
  }
  
  // 确认删除模型
  const confirmDeleteModel = async () => {
    if (!selectedModel || !selectedProvider) return;
    
    setIsDeletingModel(true);
    try {
      const response = await deleteModelWithToast(selectedModel.id);
      if (response.code === 200) {
        setDeleteModelConfirmOpen(false);
        
        // 更新服务商详情中的模型列表
        try {
          const detailResponse = await getProviderDetail(selectedProvider.id);
          if (detailResponse.code === 200) {
            const updatedProvider = detailResponse.data;
            setSelectedProvider(updatedProvider);
            
            // 局部更新providers数组中的对应服务商
            setProviders(prev => prev.map(p => {
              if (p.id === selectedProvider.id) {
                return {
                  ...p,
                  models: updatedProvider.models || []
                };
              }
              return p;
            }));
          }
        } catch (error) {
          console.error("刷新服务商详情失败:", error);
        }
      }
    } catch (error) {
      console.error("删除模型失败:", error);
    } finally {
      setIsDeletingModel(false);
    }
  }
  
  // 切换模型状态
  const toggleModelStatus = async (provider: Provider, model: Model) => {
    setSelectedProvider(provider);
    
    setIsTogglingModelStatus(true);
    try {
      const response = await toggleModelStatusWithToast(model.id);
      if (response.code === 200) {
        const updatedStatus = !model.status;
        
        // 更新详情页模型状态
        const updatedModels = provider.models.map(m => 
          m.id === model.id ? { ...m, status: updatedStatus } : m
        );
        
        // 更新选中的服务商
        setSelectedProvider(prev => {
          if (!prev || prev.id !== provider.id) return prev;
          return {
            ...prev,
            models: updatedModels
          };
        });
        
        // 局部更新providers数组中的对应服务商
        setProviders(prev => prev.map(p => {
          if (p.id === provider.id) {
            return {
              ...p,
              models: updatedModels
            };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error("切换模型状态失败:", error);
    } finally {
      setIsTogglingModelStatus(false);
    }
  }
  
  // 显示加载中状态
  if (loading) {
    return (
      <div className="container py-6">
        <div className="mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[320px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">{t("加载服务商...")}</p>
        </div>
      </div>
    )
  }
  
  // 显示错误状态
  if (error) {
    return (
      <div className="container py-6">
        <div className="mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <h3 className="text-red-800 font-medium">{t("加载失败")}</h3>
          <p className="text-red-600">{error}</p>
          <Button 
            variant="outline" 
            className="mt-2" 
            onClick={() => window.location.reload()}
          >
            {t("重试")}
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <>
      {showSaveNotice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-4 text-emerald-700 shadow-lg">
            {t("配置保存成功")}
          </div>
        </div>
      )}
      <div className="container py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("Model Provider")}</h1>
          <p className="text-muted-foreground">{t("Manage your Model Providers and API keys")}</p>
          </div>
        </div>
        <Button className="flex items-center gap-2" onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          {t("Add a Model Provider")}
        </Button>
      </div>

      <div className="mt-8 space-y-10">
        <section className="space-y-4">
          <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200/70 bg-gradient-to-r from-sky-50 via-white to-amber-50 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
                    {t("Model Providers")}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {t("Manage your Model Providers and API keys")}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {t("在这里配置服务商、密钥与可用模型")}
                  </p>
                </div>
                <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 md:flex">
                  <span className="rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-slate-200">
                    {t("官方")}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-slate-200">
                    {t("自定义")}
                  </span>
                </div>
              </div>
            </div>
            <CardContent className="bg-slate-50/40 pt-6">
              <Tabs defaultValue="all" className="space-y-4" value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">{t("All")}</TabsTrigger>
                  <TabsTrigger value="official">{t("Official Providers")}</TabsTrigger>
                  <TabsTrigger value="personal">{t("Personal Providers")}</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4">
                  {renderProviders(filteredProviders)}
                </TabsContent>

                <TabsContent value="official" className="space-y-4">
                  {renderProviders(filteredProviders)}
                </TabsContent>

                <TabsContent value="personal" className="space-y-4">
                  {renderProviders(filteredProviders)}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t("通用模型设置")}</h2>
            <p className="text-sm text-muted-foreground">{t("选择默认模型与降级策略")}</p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("默认模型")}</CardTitle>
                <CardDescription>{t("选择您的默认AI模型，这将作为新对话的默认选择")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="default-model">{t("默认模型")}</Label>
                  {settingsLoading || chatModelsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={settings.settingConfig.defaultModel || ""}
                      onValueChange={handleDefaultModelChange}
                    >
                      <SelectTrigger
                        className={`data-[state=open]:ring-2 data-[state=open]:ring-blue-200 data-[state=open]:border-blue-300 ${
                          settings.settingConfig.defaultModel ? "[&>span]:text-blue-700 [&>span]:font-medium" : ""
                        }`}
                      >
                        <SelectValue placeholder={t("选择默认模型")} />
                      </SelectTrigger>
                      <SelectContent>
                        {chatModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
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
                  )}
                  {!chatModelsLoading && (
                    <div className="text-sm text-muted-foreground">
                      {chatModels.length === 0
                        ? t("暂无可用模型，请先在模型服务配置中配置")
                        : t("未找到想要的模型？去模型服务配置")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
              <CardTitle>{t("默认视觉VLM模型")}</CardTitle>
              <CardDescription>
                {t("选择用于文档OCR识别的默认模型，用于RAG系统的文档处理")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="default-ocr-model">{t("默认视觉VLM模型")}</Label>
                  {modelsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={settings.settingConfig.defaultOcrModel || ""}
                      onValueChange={handleDefaultOcrModelChange}
                    >
                      <SelectTrigger
                        className={`data-[state=open]:ring-2 data-[state=open]:ring-blue-200 data-[state=open]:border-blue-300 ${
                          settings.settingConfig.defaultOcrModel ? "[&>span]:text-blue-700 [&>span]:font-medium" : ""
                        }`}
                      >
                        <SelectValue placeholder={t("选择默认OCR模型")} />
                      </SelectTrigger>
                      <SelectContent>
                        {ocrModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
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
                  )}
                {!modelsLoading && (
                  <div className="text-sm text-muted-foreground">
                    {ocrModels.length === 0
                      ? t("暂无可用视觉模型，请先添加类型为视觉的模型")
                      : t("未找到想要的模型？去模型服务配置")}
                  </div>
                )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
              <CardTitle>{t("默认Embedding模型")}</CardTitle>
              <CardDescription>
                {t("选择用于向量化的默认嵌入模型，用于RAG系统的语义搜索")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="default-embedding-model">{t("默认Embedding模型")}</Label>
                  {modelsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={settings.settingConfig.defaultEmbeddingModel || ""}
                      onValueChange={handleDefaultEmbeddingModelChange}
                    >
                      <SelectTrigger
                        className={`data-[state=open]:ring-2 data-[state=open]:ring-blue-200 data-[state=open]:border-blue-300 ${
                          settings.settingConfig.defaultEmbeddingModel
                            ? "[&>span]:text-blue-700 [&>span]:font-medium"
                            : ""
                        }`}
                      >
                        <SelectValue placeholder={t("选择默认嵌入模型")} />
                      </SelectTrigger>
                      <SelectContent>
                        {embeddingModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
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
                  )}
                </div>
              </CardContent>
            </Card>

            {!chatModelsLoading && (
              <FallbackConfigComponent
                fallbackConfig={settings.settingConfig.fallbackConfig || { enabled: false, fallbackChain: [] }}
                models={chatModels}
                onConfigChange={handleFallbackConfigChange}
              />
            )}

            <Card>
              <CardFooter className="pt-6">
                <Button
                  type="button"
                  disabled={submitting}
                  className="w-full"
                  onClick={handleSubmit}
                >
                  {submitting ? t("保存中...") : t("保存设置")}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>
      </div>
      
      {/* 删除确认对话框 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Delete Model Provider")}</DialogTitle>
            <DialogDescription>
              {t("您确定要删除此服务商吗？此操作无法撤销。")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleting}>
              {t("取消")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("删除中...")}
                </>
              ) : t("确认删除")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 添加/编辑服务商对话框 */}
      <ProviderDialog 
        open={showProviderDialog} 
        onOpenChange={setShowProviderDialog}
        provider={editingProvider}
        onSuccess={async () => {
          await loadProviders()
          await refreshModels()
        }}
      />
      
      {/* 删除模型确认对话框 */}
      <Dialog open={deleteModelConfirmOpen} onOpenChange={setDeleteModelConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("删除模型")}</DialogTitle>
            <DialogDescription>
              {t("您确定要删除此模型吗？此操作无法撤销。")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModelConfirmOpen(false)} disabled={isDeletingModel}>
              {t("取消")}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteModel} disabled={isDeletingModel}>
              {isDeletingModel ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("删除中...")}
                </>
              ) : t("确认删除")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 添加/编辑模型对话框 */}
      {selectedProvider && (
        <ModelDialog
          open={showModelDialog}
          onOpenChange={setShowModelDialog}
          providerId={selectedProvider.id}
          providerName={selectedProvider.name}
          model={editingModel}
          onSuccess={async () => {
            const isNewModel = !editingModel
            // 更新详情页数据
            try {
              const response = await getProviderDetail(selectedProvider.id);
              if (response.code === 200) {
                const updatedProvider = response.data;
                setSelectedProvider(updatedProvider);
                
                // 局部更新providers数组中的对应服务商
                setProviders(prev => prev.map(p => {
                  if (p.id === selectedProvider.id) {
                    return {
                      ...p,
                      models: updatedProvider.models || []
                    };
                  }
                  return p;
                }));
              }
            } catch (error) {
              console.error("刷新服务商详情失败:", error);
            }
            await refreshModels()
            if (isNewModel) {
              toast({
                title: t("模型添加成功"),
                description: t("已更新可用模型列表"),
                className: "border-emerald-200 bg-emerald-50 text-emerald-900",
              })
            }
          }}
        />
      )}
    </div>
    </>
  )
} 
