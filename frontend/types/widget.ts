import { Model } from '@/lib/user-settings-service';
import { Provider } from './provider';

/** Widget类型枚举 */
export type WidgetType = 'AGENT' | 'RAG';

/** Agent小组件配置 */
export interface AgentWidget {
  id: string;
  agentId: string;
  userId: string;
  publicId: string;
  name: string;
  description?: string;
  model: Model;
  provider?: Provider;
  allowedDomains: string[];
  dailyLimit: number;
  enabled: boolean;
  widgetType: WidgetType;
  knowledgeBaseIds?: string[];
  widgetCode: string;
  createdAt: string;
  updatedAt: string;
}

/** 创建小组件配置请求 */
export interface CreateWidgetRequest {
  name: string;
  description?: string;
  modelId: string;
  providerId?: string;
  allowedDomains: string[];
  dailyLimit: number;
  widgetType: WidgetType;
  knowledgeBaseIds?: string[];
}

/** 更新小组件配置请求 */
export interface UpdateWidgetRequest {
  name: string;
  description?: string;
  modelId: string;
  providerId?: string;
  allowedDomains: string[];
  dailyLimit: number;
  enabled: boolean;
  widgetType: WidgetType;
  knowledgeBaseIds?: string[];
}

/** 小组件聊天请求 */
export interface WidgetChatRequest {
  message: string;
  sessionId: string;
  fileUrls: string[];
}