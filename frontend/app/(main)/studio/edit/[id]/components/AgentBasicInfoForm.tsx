import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Upload, Trash, FileImage, MessageSquare } from "lucide-react";
import FileUpload from "@/components/ui/file-upload";

interface AgentFormData {
  name: string;
  avatar: string | null;
  description: string;
  enabled: boolean;
  multiModal: boolean;
}

interface AgentBasicInfoFormProps {
  formData: AgentFormData;
  selectedType: "chat" | "agent";
  updateFormField: (field: string, value: any) => void;
}

const AgentBasicInfoForm: React.FC<AgentBasicInfoFormProps> = ({
  formData,
  selectedType,
  updateFormField,
}) => {
  return (
    <div className="space-y-6">
      {/* 名称和头像 */}
      <div>
        <h2 className="text-lg font-medium mb-4">名称 & 头像</h2>
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <Label htmlFor="agent-name" className="mb-2 block">
              名称
            </Label>
            <Input
              id="agent-name"
              placeholder={`给你的${selectedType === "chat" ? "聊天助理" : "功能性助理"}起个名字`}
              value={formData.name}
              onChange={(e) => updateFormField("name", e.target.value)}
              className="mb-2"
            />
          </div>
          <div>
            <Label className="mb-2 block">头像</Label>
            <FileUpload
              variant="avatar"
              size="lg"
              value={formData.avatar}
              onChange={(url) => updateFormField("avatar", url)}
              placeholder={
                <div className="text-primary">
                  {formData.name ? formData.name.charAt(0).toUpperCase() : "🤖"}
                </div>
              }
              uploadText="上传头像"
              changeText="更换头像"
              removeText="移除头像"
              maxSize={2 * 1024 * 1024} // 2MB
            />
          </div>
        </div>
      </div>

      {/* 描述 */}
      <div>
        <h2 className="text-lg font-medium mb-2">描述</h2>
        <Textarea
          placeholder={`输入${selectedType === "chat" ? "聊天助理" : "功能性助理"}的描述`}
          value={formData.description}
          onChange={(e) => updateFormField("description", e.target.value)}
          rows={4}
        />
      </div>

      {/* 功能配置 */}
      <div>
        <h2 className="text-lg font-medium mb-4">功能配置</h2>
        <div className="space-y-4">
          {/* 多模态开关 */}
          <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <FileImage className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">多模态功能</p>
                <p className="text-sm text-muted-foreground">
                  启用后支持上传图片、文档等文件，让助理理解多种类型的内容
                </p>
              </div>
            </div>
            <Switch
              checked={formData.multiModal}
              onCheckedChange={(checked) => updateFormField("multiModal", checked)}
            />
          </div>

          {/* 状态信息 */}
          <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-subtle rounded-lg">
                <MessageSquare className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium">启用状态</p>
                <p className="text-sm text-muted-foreground">
                  控制助理是否可以被使用
                </p>
              </div>
          </div>
          <Badge variant={formData.enabled ? "default" : "outline"}>
            {formData.enabled ? "已启用" : "已禁用"}
          </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentBasicInfoForm; 