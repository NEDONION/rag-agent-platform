import { API_CONFIG } from "@/lib/api-config"

// 请求配置类型
export interface RequestConfig extends RequestInit {
  params?: Record<string, any>; // 查询参数
  timeout?: number; // 超时时间（毫秒）
}

// 请求选项类型
export interface RequestOptions {
  raw?: boolean; // 是否返回原始响应，不自动解析json
}

// 公开HTTP客户端类 - 专用于不需要认证的公开API
class PublicHttpClient {
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(
    baseUrl: string = API_CONFIG.BASE_URL,
    defaultTimeout: number = 30000
  ) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
  }

  // 构建URL
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    let url = this.baseUrl + endpoint;

    if (params && Object.keys(params).length > 0) {
      const query = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => {
          return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        })
        .filter(Boolean)
        .join("&");

      if (query) {
        url += `?${query}`;
      }
    }

    return url;
  }

  // 执行请求
  private async request<T>(endpoint: string, config: RequestConfig = {}, options?: RequestOptions): Promise<T> {
    // 设置默认headers（不包含认证信息）
    const processedConfig = {
      ...config,
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
        ...(config.headers || {}),
      },
    };

    // 构建完整URL
    const url = this.buildUrl(endpoint, processedConfig.params);

    try {
      // 处理超时
      let timeoutId: NodeJS.Timeout | null = null;
      let abortController: AbortController | null = null;
      
      if (processedConfig.timeout || this.defaultTimeout) {
        abortController = new AbortController();
        processedConfig.signal = abortController.signal;
        
        timeoutId = setTimeout(() => {
          if (abortController) {
            abortController.abort();
          }
        }, processedConfig.timeout || this.defaultTimeout);
      }

      const response = await fetch(url, processedConfig);
      
      // 清除超时定时器
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // 如果是原始响应模式，直接返回
      if (options?.raw) {
        return response as unknown as T;
      }

      // 解析响应
      let result: any;
      
      try {
        result = await response.json();
      } catch (e) {
        result = {
          code: response.status,
          message: response.statusText || `请求失败 (${response.status})`,
          data: null
        };
      }
      
      return result;
      
    } catch (error: any) {
      // 处理异常
      const errorResult = {
        code: error.status || 500,
        message: error.message || "未知错误",
        data: null,
        timestamp: Date.now(),
      };
      
      return errorResult as unknown as T;
    }
  }

  // HTTP方法
  async get<T>(endpoint: string, config: RequestConfig = {}, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: "GET" }, options);
  }

  async post<T>(endpoint: string, data?: any, config: RequestConfig = {}, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }, options);
  }
}

// 导出单例实例
export const publicHttpClient = new PublicHttpClient();

// API响应类型接口
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp?: number;
}