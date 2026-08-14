"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, ExternalLink } from "lucide-react";
import { AgentWidget } from "@/types/widget";

interface WidgetCodeDialogProps {
  open: boolean;
  onClose: () => void;
  widget: AgentWidget;
  onCopy: (code: string) => void;
}

export default function WidgetCodeDialog({ open, onClose, widget, onCopy }: WidgetCodeDialogProps) {
  const [activeTab, setActiveTab] = useState("iframe");

  const widgetUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/widget/${widget.publicId}`;

  // 生成不同格式的嵌入代码
  const generateEmbedCode = (type: string) => {
    switch (type) {
      case "iframe":
        return `<!-- AgentX 智能助手小组件 - iframe模式 -->
<iframe 
  src="${widgetUrl}"
  width="400" 
  height="600"
  frameborder="0"
  style="border: 1px solid #e2e8f0; border-radius: 8px;"
  allow="microphone">
</iframe>`;

      case "floating":
        return `<!-- AgentX 智能助手小组件 - 悬浮窗模式 -->
<script>
  (function() {
    const agentButton = document.createElement('div');
    agentButton.innerHTML = '💬 智能助手';
    agentButton.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;' +
      'background:#007bff;color:white;padding:12px 20px;border-radius:25px;' +
      'cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-family:sans-serif;';
    
    agentButton.onclick = function() {
      const iframe = document.createElement('iframe');
      iframe.src = '${widgetUrl}';
      iframe.style.cssText = 'position:fixed;bottom:80px;right:20px;width:400px;' +
        'height:600px;border:none;border-radius:8px;z-index:10000;' +
        'box-shadow:0 8px 32px rgba(0,0,0,0.1);';
      
      const closeBtn = document.createElement('div');
      closeBtn.innerHTML = '×';
      closeBtn.style.cssText = 'position:fixed;bottom:685px;right:25px;width:20px;' +
        'height:20px;background:#ff4757;color:white;border-radius:50%;' +
        'text-align:center;line-height:20px;cursor:pointer;z-index:10001;' +
        'font-family:sans-serif;';
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
</script>`;

      case "responsive":
        return `<!-- AgentX 智能助手小组件 - 响应式模式 -->
<div style="width: 100%; max-width: 500px; margin: 0 auto;">
  <iframe 
    src="${widgetUrl}"
    width="100%" 
    height="600"
    frameborder="0"
    style="border: 1px solid #e2e8f0; border-radius: 8px; min-width: 300px;"
    allow="microphone">
  </iframe>
</div>`;

      default:
        return widget.widgetCode;
    }
  };

  const widgetCodes = {
    iframe: generateEmbedCode("iframe"),
    floating: generateEmbedCode("floating"),
    responsive: generateEmbedCode("responsive"),
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>小组件嵌入代码</DialogTitle>
          <DialogDescription>
            复制以下代码到你的网站中，即可嵌入 "{widget.name}" 小组件
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 小组件信息 */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/40 rounded-lg">
            <div>
              <Label className="text-sm text-muted-foreground">小组件名称</Label>
              <p className="font-medium">{widget.name}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">状态</Label>
              <p className={`font-medium ${widget.enabled ? 'text-success' : 'text-destructive'}`}>
                {widget.enabled ? '已启用' : '已禁用'}
              </p>
            </div>
            <div className="col-span-2">
              <Label className="text-sm text-muted-foreground">访问链接</Label>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-background px-2 py-1 rounded border flex-1 break-all">
                  {widgetUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(widgetUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* 嵌入代码选项 */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="iframe">固定iframe</TabsTrigger>
              <TabsTrigger value="floating">悬浮窗口</TabsTrigger>
              <TabsTrigger value="responsive">响应式</TabsTrigger>
            </TabsList>

            <TabsContent value="iframe" className="space-y-2">
              <Label>固定大小的iframe嵌入</Label>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-48 border whitespace-pre-wrap break-words">
                  <code className="block overflow-x-auto">{widgetCodes.iframe}</code>
                </pre>
                <Button
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => onCopy(widgetCodes.iframe)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  复制
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                适合在网页中固定位置显示，推荐用于专门的客服页面
              </p>
            </TabsContent>

            <TabsContent value="floating" className="space-y-2">
              <Label>悬浮窗口模式</Label>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-48 border whitespace-pre-wrap break-words">
                  <code className="block overflow-x-auto">{widgetCodes.floating}</code>
                </pre>
                <Button
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => onCopy(widgetCodes.floating)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  复制
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                在页面右下角显示聊天按钮，点击后弹出聊天窗口，适合所有页面
              </p>
            </TabsContent>

            <TabsContent value="responsive" className="space-y-2">
              <Label>响应式嵌入</Label>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-48 border whitespace-pre-wrap break-words">
                  <code className="block overflow-x-auto">{widgetCodes.responsive}</code>
                </pre>
                <Button
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => onCopy(widgetCodes.responsive)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  复制
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                自适应容器宽度，适合移动端和响应式布局
              </p>
            </TabsContent>
          </Tabs>

          {/* 使用说明 */}
          <div className="p-4 bg-accent/60 rounded-lg">
            <h4 className="font-medium text-primary mb-2">使用说明</h4>
            <ul className="text-sm text-primary space-y-1">
              <li>• 将代码复制到你的网站HTML中即可使用</li>
              <li>• 建议将代码放在 &lt;/body&gt; 标签前</li>
              <li>• 确保小组件配置已启用且域名在允许列表中</li>
              <li>• 支持HTTPS网站，建议在安全环境下使用</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          <Button onClick={() => onCopy(widgetCodes[activeTab as keyof typeof widgetCodes])}>
            <Copy className="h-4 w-4 mr-2" />
            复制当前代码
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}