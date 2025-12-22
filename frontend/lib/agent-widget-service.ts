import { httpClient } from './http-client';
import { withToast } from './toast-utils';
import { ApiResponse } from './user-settings-service';
import { AgentWidget, CreateWidgetRequest, UpdateWidgetRequest } from '@/types/widget';

/** Agent小组件配置API服务 */
export class AgentWidgetService {
  /** 创建小组件配置 */
  static async createWidget(agentId: string, data: CreateWidgetRequest): Promise<ApiResponse<AgentWidget>> {
    return httpClient.post(`/agents/${agentId}/widgets`, data);
  }

  /** 获取Agent的所有小组件配置 */
  static async getWidgets(agentId: string): Promise<ApiResponse<AgentWidget[]>> {
    return httpClient.get(`/agents/${agentId}/widgets`);
  }

  /** 获取小组件配置详情 */
  static async getWidgetDetail(agentId: string, widgetId: string): Promise<ApiResponse<AgentWidget>> {
    return httpClient.get(`/agents/${agentId}/widgets/${widgetId}`);
  }

  /** 更新小组件配置 */
  static async updateWidget(agentId: string, widgetId: string, data: UpdateWidgetRequest): Promise<ApiResponse<AgentWidget>> {
    return httpClient.put(`/agents/${agentId}/widgets/${widgetId}`, data);
  }

  /** 切换小组件配置启用状态 */
  static async toggleWidgetStatus(agentId: string, widgetId: string): Promise<ApiResponse<AgentWidget>> {
    return httpClient.post(`/agents/${agentId}/widgets/${widgetId}/status`);
  }

  /** 删除小组件配置 */
  static async deleteWidget(agentId: string, widgetId: string): Promise<ApiResponse<void>> {
    return httpClient.delete(`/agents/${agentId}/widgets/${widgetId}`);
  }

  /** 获取用户的所有小组件配置 */
  static async getUserWidgets(): Promise<ApiResponse<AgentWidget[]>> {
    return httpClient.get('/user/widgets');
  }
}

// 带Toast的API方法
export const createWidgetWithToast = withToast(AgentWidgetService.createWidget, {
  showSuccessToast: true,
  showErrorToast: true,
  successTitle: "创建小组件配置成功",
  errorTitle: "创建小组件配置失败"
});

export const getWidgetsWithToast = withToast(AgentWidgetService.getWidgets, {
  showErrorToast: true,
  errorTitle: "获取小组件配置失败"
});

export const updateWidgetWithToast = withToast(AgentWidgetService.updateWidget, {
  showSuccessToast: true,
  showErrorToast: true,
  successTitle: "更新小组件配置成功",
  errorTitle: "更新小组件配置失败"
});

export const toggleWidgetStatusWithToast = withToast(AgentWidgetService.toggleWidgetStatus, {
  showSuccessToast: true,
  showErrorToast: true,
  successTitle: "状态切换成功",
  errorTitle: "状态切换失败"
});

export const deleteWidgetWithToast = withToast(AgentWidgetService.deleteWidget, {
  showSuccessToast: true,
  showErrorToast: true,
  successTitle: "删除小组件配置成功",
  errorTitle: "删除小组件配置失败"
});

export const getUserWidgetsWithToast = withToast(AgentWidgetService.getUserWidgets, {
  showErrorToast: true,
  errorTitle: "获取小组件配置失败"
});