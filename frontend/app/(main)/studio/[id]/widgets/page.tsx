"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Plus, Copy, ExternalLink, Settings, Trash2, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAgentWidgetsWithToast,
  createWidgetWithToast,
  toggleWidgetStatusWithToast,
  deleteWidgetWithToast,
  type Widget,
  type CreateWidgetRequest
} from "@/lib/widget-service";
import { getAgentDetailWithToast } from "@/lib/agent-service";

interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
}

// Widget接口已从lib/widget-service导入

interface CreateWidgetData {
  name: string;
  description: string;
  dailyLimit: number;
  allowedDomains: string[];
  modelId: string;
  providerId?: string;
}

export default function AgentWidgetsPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // 创建Widget表单状态
  const [createForm, setCreateForm] = useState<CreateWidgetData>({
    name: '',
    description: '',
    dailyLimit: -1,
    allowedDomains: [],
    modelId: '',
    providerId: ''
  });

  // 加载Agent和Widget数据
  useEffect(() => {
    loadData();
  }, [agentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 加载Agent信息
      const agentResponse = await getAgentDetailWithToast(agentId);
      if (agentResponse.code === 200) {
        setAgent(agentResponse.data);
      }

      // 加载Widget列表
      const widgetsResponse = await getAgentWidgetsWithToast(agentId);
      if (widgetsResponse.code === 200) {
        setWidgets(widgetsResponse.data);
      }
    } catch (error) {
      // 错误已由withToast处理
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWidget = async () => {
    if (!createForm.name.trim()) {
      toast({
        title: "请输入组件名称",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreateLoading(true);
      
      const request: CreateWidgetRequest = {
        name: createForm.name,
        description: createForm.description,
        dailyLimit: createForm.dailyLimit,
        allowedDomains: createForm.allowedDomains,
        modelId: createForm.modelId || '', // 暂时用空字符串，实际需要选择模型
        providerId: createForm.providerId
      };

      const response = await createWidgetWithToast(agentId, request);
      if (response.code === 200) {
        setCreateDialogOpen(false);
        // 重置表单
        setCreateForm({
          name: '',
          description: '',
          dailyLimit: -1,
          allowedDomains: [],
          modelId: '',
          providerId: ''
        });
        loadData();
      }
    } catch (error) {
      // 错误已由withToast处理
    } finally {
      setCreateLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "已复制",
      description: "嵌入代码已复制到剪贴板",
    });
  };

  const toggleWidgetStatus = async (widget: Widget) => {
    try {
      const response = await toggleWidgetStatusWithToast(agentId, widget.id);
      if (response.code === 200) {
        loadData();
      }
    } catch (error) {
      // 错误已由withToast处理
    }
  };

  const deleteWidget = async (widget: Widget) => {
    if (!confirm(`确定要删除组件 "${widget.name}" 吗？`)) {
      return;
    }

    try {
      const response = await deleteWidgetWithToast(agentId, widget.id);
      if (response.code === 200) {
        loadData();
      }
    } catch (error) {
      // 错误已由withToast处理
    }
  };

  if (loading) {
    return (
      <div className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">嵌入组件管理</h1>
          <p className="text-muted-foreground">
            为 "{agent?.name}" 创建和管理嵌入组件，让其他网站可以集成您的AI助理
          </p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              创建组件
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>创建嵌入组件</DialogTitle>
              <DialogDescription>
                创建一个可嵌入到其他网站的AI助理组件
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">组件名称 *</Label>
                  <Input
                    id="name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="例如：客服助手"
                  />
                </div>
                <div>
                  <Label htmlFor="dailyLimit">每日调用限制</Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    value={createForm.dailyLimit}
                    onChange={(e) => setCreateForm({ ...createForm, dailyLimit: parseInt(e.target.value) || -1 })}
                    placeholder="-1 表示无限制"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">组件描述</Label>
                <Textarea
                  id="description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="简单描述这个组件的用途"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="allowedDomains">允许的域名 (可选)</Label>
                <Textarea
                  id="allowedDomains"
                  value={createForm.allowedDomains.join('\n')}
                  onChange={(e) => setCreateForm({ 
                    ...createForm, 
                    allowedDomains: e.target.value.split('\n').filter(d => d.trim()) 
                  })}
                  placeholder="每行一个域名，例如：&#10;example.com&#10;*.example.com&#10;留空表示允许所有域名"
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreateWidget} disabled={createLoading}>
                {createLoading ? "创建中..." : "创建组件"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {widgets.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/40">
          <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">还没有创建任何嵌入组件</h3>
          <p className="text-muted-foreground mb-6">
            创建嵌入组件，让其他网站可以集成您的AI助理
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            创建第一个组件
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {widgets.map((widget) => (
            <Card key={widget.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{widget.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={widget.enabled ? "default" : "secondary"}>
                      {widget.enabled ? "启用" : "禁用"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleWidgetStatus(widget)}
                    >
                      {widget.enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {widget.description && (
                  <CardDescription>{widget.description}</CardDescription>
                )}
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <strong>公开ID:</strong> 
                  <code className="ml-2 px-2 py-1 bg-muted rounded text-xs">
                    {widget.publicId}
                  </code>
                </div>
                
                {widget.dailyLimit !== -1 && (
                  <div className="text-sm">
                    <strong>使用量:</strong> {widget.dailyCalls} / {widget.dailyLimit}
                  </div>
                )}
                
                <div className="text-sm">
                  <strong>访问地址:</strong>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 px-2 py-1 bg-muted rounded text-xs break-all">
                      {window.location.origin}/widget/{widget.publicId}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(`${window.location.origin}/widget/${widget.publicId}`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(`/widget/${widget.publicId}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      <Copy className="mr-2 h-4 w-4" />
                      查看嵌入代码
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>嵌入代码 - {widget.name}</DialogTitle>
                      <DialogDescription>
                        复制以下代码到您的网站HTML中即可使用
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* iframe嵌入模式 */}
                      <div>
                        <Label className="text-sm font-semibold">固定iframe嵌入模式</Label>
                        <div className="mt-2 relative">
                          <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto max-h-48 overflow-y-auto">
{`<!-- AgentX 智能助手小组件嵌入代码 -->
<iframe 
  src="${window.location.origin}/widget/${widget.publicId}"
  width="400" 
  height="600"
  frameborder="0"
  style="border: 1px solid #e2e8f0; border-radius: 8px;"
  allow="microphone">
</iframe>`}
                          </pre>
                          <Button
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`<!-- AgentX 智能助手小组件嵌入代码 -->
<iframe 
  src="${window.location.origin}/widget/${widget.publicId}"
  width="400" 
  height="600"
  frameborder="0"
  style="border: 1px solid #e2e8f0; border-radius: 8px;"
  allow="microphone">
</iframe>`)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* 悬浮窗嵌入模式 */}
                      <div>
                        <Label className="text-sm font-semibold">悬浮窗嵌入模式</Label>
                        <div className="mt-2 relative">
                          <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto max-h-64 overflow-y-auto">
{`<!-- 悬浮窗模式嵌入代码 -->
<script>
  (function() {
    const agentButton = document.createElement('div');
    agentButton.innerHTML = '💬 智能助手';
    
    // 按钮样式
    agentButton.style.position = 'fixed';
    agentButton.style.bottom = '20px';
    agentButton.style.right = '20px';
    agentButton.style.zIndex = '9999';
    agentButton.style.background = '#007bff';
    agentButton.style.color = 'white';
    agentButton.style.padding = '12px 20px';
    agentButton.style.borderRadius = '25px';
    agentButton.style.cursor = 'pointer';
    agentButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    agentButton.style.fontFamily = 'sans-serif';
    
    agentButton.onclick = function() {
      const iframe = document.createElement('iframe');
      iframe.src = '${window.location.origin}/widget/${widget.publicId}';
      
      // iframe样式
      iframe.style.position = 'fixed';
      iframe.style.bottom = '80px';
      iframe.style.right = '20px';
      iframe.style.width = '400px';
      iframe.style.height = '600px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.style.zIndex = '10000';
      iframe.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';
      
      const closeBtn = document.createElement('div');
      closeBtn.innerHTML = '×';
      
      // 关闭按钮样式
      closeBtn.style.position = 'fixed';
      closeBtn.style.bottom = '685px';
      closeBtn.style.right = '25px';
      closeBtn.style.width = '20px';
      closeBtn.style.height = '20px';
      closeBtn.style.background = '#ff4757';
      closeBtn.style.color = 'white';
      closeBtn.style.borderRadius = '50%';
      closeBtn.style.textAlign = 'center';
      closeBtn.style.lineHeight = '20px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.zIndex = '10001';
      closeBtn.style.fontFamily = 'sans-serif';
      
      closeBtn.onclick = function() {
        document.body.removeChild(iframe);
        document.body.removeChild(closeBtn);
        agentButton.style.display = 'block';
      };
      
      document.body.appendChild(iframe);
      document.body.appendChild(closeBtn);
      agentButton.style.display = 'none';
    };
    
    document.body.appendChild(agentButton);
  })();
</script>`}
                          </pre>
                          <Button
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`<!-- 悬浮窗模式嵌入代码 -->
<script>
  (function() {
    const agentButton = document.createElement('div');
    agentButton.innerHTML = '💬 智能助手';
    
    // 按钮样式
    agentButton.style.position = 'fixed';
    agentButton.style.bottom = '20px';
    agentButton.style.right = '20px';
    agentButton.style.zIndex = '9999';
    agentButton.style.background = '#007bff';
    agentButton.style.color = 'white';
    agentButton.style.padding = '12px 20px';
    agentButton.style.borderRadius = '25px';
    agentButton.style.cursor = 'pointer';
    agentButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    agentButton.style.fontFamily = 'sans-serif';
    
    agentButton.onclick = function() {
      const iframe = document.createElement('iframe');
      iframe.src = '${window.location.origin}/widget/${widget.publicId}';
      
      // iframe样式
      iframe.style.position = 'fixed';
      iframe.style.bottom = '80px';
      iframe.style.right = '20px';
      iframe.style.width = '400px';
      iframe.style.height = '600px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.style.zIndex = '10000';
      iframe.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';
      
      const closeBtn = document.createElement('div');
      closeBtn.innerHTML = '×';
      
      // 关闭按钮样式
      closeBtn.style.position = 'fixed';
      closeBtn.style.bottom = '685px';
      closeBtn.style.right = '25px';
      closeBtn.style.width = '20px';
      closeBtn.style.height = '20px';
      closeBtn.style.background = '#ff4757';
      closeBtn.style.color = 'white';
      closeBtn.style.borderRadius = '50%';
      closeBtn.style.textAlign = 'center';
      closeBtn.style.lineHeight = '20px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.zIndex = '10001';
      closeBtn.style.fontFamily = 'sans-serif';
      
      closeBtn.onclick = function() {
        document.body.removeChild(iframe);
        document.body.removeChild(closeBtn);
        agentButton.style.display = 'block';
      };
      
      document.body.appendChild(iframe);
      document.body.appendChild(closeBtn);
      agentButton.style.display = 'none';
    };
    
    document.body.appendChild(agentButton);
  })();
</script>`)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => deleteWidget(widget)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}