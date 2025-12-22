"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Edit } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { AuthSetting } from "@/lib/types/auth-config";
import { AUTH_FEATURE_KEY } from "@/lib/types/auth-config";
import { updateAuthSettingWithToast } from "@/lib/auth-config-service";
import { useI18n } from "@/contexts/i18n-context";

interface SSOConfigDialogProps {
  setting: AuthSetting;
  onConfigUpdate?: (setting: AuthSetting) => void;
}

interface SSOConfig {
  // GitHub配置
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  
  // Community配置
  baseUrl?: string;
  appKey?: string;
  appSecret?: string;
  callbackUrl?: string;
}

export default function SSOConfigDialog({ setting, onConfigUpdate }: SSOConfigDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<SSOConfig>(() => {
    try {
      return setting.configData || {};
    } catch {
      return {};
    }
  });

  const isGitHub = setting.featureKey === AUTH_FEATURE_KEY.GITHUB_LOGIN;
  const isCommunity = setting.featureKey === AUTH_FEATURE_KEY.COMMUNITY_LOGIN;

  const handleSave = async () => {
    setLoading(true);
    try {
      // 验证必填字段
        if (isGitHub) {
          if (!config.clientId || !config.clientSecret) {
            toast({
            title: t("配置错误"),
            description: t("GitHub配置需要填写Client ID和Client Secret"),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        if (!config.redirectUri) {
          toast({
            title: t("配置错误"),
            description: t("GitHub配置需要填写Redirect URI"),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

        if (isCommunity) {
          if (!config.appKey || !config.appSecret) {
            toast({
            title: t("配置错误"), 
            description: t("敲鸭配置需要填写App Key和App Secret"),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        if (!config.baseUrl || !config.callbackUrl) {
          toast({
            title: t("配置错误"),
            description: t("敲鸭配置需要填写Base URL和Callback URL"),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // 调用API保存配置
      const updateRequest = {
        configData: config,
      };

      const response = await updateAuthSettingWithToast(setting.id, updateRequest);
      
      if (response.code === 200) {
        toast({
          title: t("配置保存成功"),
          description: t("{name} 配置已更新", { name: setting.featureName }),
          variant: "default",
        });

        setOpen(false);
        onConfigUpdate?.(response.data);
      } else {
        toast({
          title: t("配置保存失败"),
          description: response.message || t("保存失败，请重试"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("配置保存失败"),
        description: t("请检查输入信息后重试"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderGitHubConfig = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="clientId">{t("Client ID *")}</Label>
          <Input
            id="clientId"
            placeholder={t("GitHub应用的Client ID")}
            value={config.clientId || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, clientId: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientSecret">{t("Client Secret *")}</Label>
          <Input
            id="clientSecret"
            type="password"
            placeholder={t("GitHub应用的Client Secret")}
            value={config.clientSecret || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="redirectUri">{t("Redirect URI *")}</Label>
        <Input
          id="redirectUri"
          placeholder={t("例如: http://localhost:3000/oauth/github/callback")}
          value={config.redirectUri || ''}
          onChange={(e) => setConfig(prev => ({ ...prev, redirectUri: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t("在GitHub应用配置中设置的Authorization callback URL")}
        </p>
      </div>
    </div>
  );

  const renderCommunityConfig = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="baseUrl">{t("Base URL *")}</Label>
        <Input
          id="baseUrl"
          placeholder={t("例如: https://community.example.com")}
          value={config.baseUrl || ''}
          onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t("敲鸭社区服务器的基础地址")}
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="appKey">{t("App Key *")}</Label>
          <Input
            id="appKey"
            placeholder={t("敲鸭应用密钥")}
            value={config.appKey || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, appKey: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="appSecret">{t("App Secret *")}</Label>
          <Input
            id="appSecret"
            type="password"
            placeholder={t("敲鸭应用秘钥")}
            value={config.appSecret || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, appSecret: e.target.value }))}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="callbackUrl">{t("Callback URL *")}</Label>
        <Input
          id="callbackUrl"
          placeholder={t("例如: http://localhost:3000/sso/community/callback")}
          value={config.callbackUrl || ''}
          onChange={(e) => setConfig(prev => ({ ...prev, callbackUrl: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t("敲鸭OAuth授权完成后的回调地址")}
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
        >
          <Edit className="h-3 w-3 mr-1" />
          {t("配置")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("{name} 配置", { name: setting.featureName })}</DialogTitle>
          <DialogDescription>
            {t("配置 {name} 的OAuth参数信息", { name: setting.featureName })}
          </DialogDescription>
        </DialogHeader>
        
        <Separator />
        
        <div className="space-y-6">
          {isGitHub && renderGitHubConfig()}
          {isCommunity && renderCommunityConfig()}
          
          <div className="space-y-2">
            <Label htmlFor="description">{t("描述")}</Label>
            <Textarea
              id="description"
              placeholder={t("配置说明或备注信息")}
              value={setting.description || ''}
              readOnly
            />
          </div>
        </div>

        <Separator />

        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {t("取消")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? t("保存中...") : t("保存配置")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
