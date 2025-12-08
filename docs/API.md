# API 接口文档

## 1. 概述

RAG Agent Platform 提供完整的 RESTful API 与 WebSocket/SSE 实时通信接口,支持 Agent 管理、RAG 检索、对话交互、工具集成等核心功能。

### 1.1 技术栈

- **API 架构**: RESTful API
- **实时通信**: SSE (Server-Sent Events)
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON
- **编码**: UTF-8

### 1.2 基础信息

**Base URL**:
```
开发环境: http://localhost:8080
生产环境: https://api.agentx.ai
```

**API 版本**: v1

**请求头**:
```http
Content-Type: application/json
Authorization: Bearer {token}
```

**统一响应格式**:
```json
{
  "code": 200,           // 状态码 (200-成功, 4xx-客户端错误, 5xx-服务端错误)
  "message": "操作成功",  // 提示信息
  "data": {},            // 响应数据
  "timestamp": 1733654400000  // 时间戳
}
```

---

## 2. 认证与授权

### 2.1 用户注册

**接口**: `POST /register`

**说明**: 新用户注册

**请求参数**:
```json
{
  "username": "user123",
  "email": "user@example.com",
  "password": "SecurePass123!",
  "emailCode": "123456",        // 邮箱验证码
  "captchaUuid": "uuid-xxx",    // 图形验证码UUID
  "captchaCode": "ABCD"         // 图形验证码
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "注册成功",
  "data": null
}
```

### 2.2 用户登录

**接口**: `POST /login`

**说明**: 用户登录获取 JWT Token

**请求参数**:
```json
{
  "username": "user123",
  "password": "SecurePass123!"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Token 使用**:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.3 获取图形验证码

**接口**: `POST /get-captcha`

**说明**: 获取图形验证码 (用于注册/登录)

**请求参数**: 无

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "uuid": "captcha-uuid-123",
    "imageBase64": "data:image/png;base64,iVBORw0KGgoAAAANS..."
  }
}
```

### 2.4 发送邮箱验证码

**接口**: `POST /send-email-code`

**说明**: 发送邮箱验证码

**请求参数**:
```json
{
  "email": "user@example.com",
  "captchaUuid": "captcha-uuid-123",
  "captchaCode": "ABCD"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "验证码已发送，请查收邮件"
}
```

### 2.5 重置密码

**接口**: `POST /reset-password`

**说明**: 通过邮箱验证码重置密码

**请求参数**:
```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "NewSecurePass123!"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "密码重置成功"
}
```

---

## 3. Agent 管理 API

### 3.1 创建 Agent

**接口**: `POST /api/agents`

**说明**: 创建新的 Agent

**请求参数**:
```json
{
  "name": "客服助手",
  "avatar": "https://example.com/avatar.png",
  "description": "专业的客服 Agent",
  "systemPrompt": "你是一个专业、友好的客服助手...",
  "welcomeMessage": "您好！有什么可以帮您的？",
  "toolIds": ["tool-001", "tool-002"],
  "knowledgeBaseIds": ["kb-001"],
  "toolPresetParams": {
    "weather_api": {
      "api_key": "xxx",
      "default_city": "北京"
    }
  },
  "multiModal": false
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": "agent-123",
    "name": "客服助手",
    "avatar": "https://example.com/avatar.png",
    "enabled": true,
    "createdAt": "2025-12-08T10:00:00Z"
  }
}
```

### 3.2 更新 Agent

**接口**: `PUT /api/agents/{agentId}`

**说明**: 更新 Agent 配置

**路径参数**:
- `agentId`: Agent ID

**请求参数**:
```json
{
  "name": "客服助手 Pro",
  "description": "升级版客服 Agent",
  "systemPrompt": "更新后的系统提示词...",
  "toolIds": ["tool-001", "tool-002", "tool-003"]
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "id": "agent-123",
    "name": "客服助手 Pro",
    "updatedAt": "2025-12-08T11:00:00Z"
  }
}
```

### 3.3 发布 Agent 版本

**接口**: `POST /api/agents/{agentId}/publish`

**说明**: 发布 Agent 新版本

**路径参数**:
- `agentId`: Agent ID

**请求参数**:
```json
{
  "versionNumber": "1.0.0",
  "changeLog": "初始版本发布\n- 添加客服知识库\n- 集成订单查询工具"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "版本发布成功",
  "data": {
    "versionId": "version-456",
    "agentId": "agent-123",
    "versionNumber": "1.0.0",
    "publishStatus": 1,  // 1-审核中
    "createdAt": "2025-12-08T12:00:00Z"
  }
}
```

### 3.4 获取 Agent 列表

**接口**: `GET /api/agents`

**说明**: 获取用户的 Agent 列表 (分页)

**查询参数**:
- `page` (默认: 1): 页码
- `size` (默认: 20): 每页数量
- `keyword` (可选): 搜索关键词
- `enabled` (可选): 启用状态过滤

**请求示例**:
```http
GET /api/agents?page=1&size=20&keyword=客服
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "total": 50,
    "page": 1,
    "size": 20,
    "items": [
      {
        "id": "agent-123",
        "name": "客服助手",
        "avatar": "https://example.com/avatar.png",
        "description": "专业的客服 Agent",
        "enabled": true,
        "publishedVersion": "version-456",
        "createdAt": "2025-12-08T10:00:00Z"
      }
    ]
  }
}
```

### 3.5 获取 Agent 详情

**接口**: `GET /api/agents/{agentId}`

**说明**: 获取 Agent 详细信息

**路径参数**:
- `agentId`: Agent ID

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": "agent-123",
    "name": "客服助手",
    "avatar": "https://example.com/avatar.png",
    "description": "专业的客服 Agent",
    "systemPrompt": "你是一个专业、友好的客服助手...",
    "welcomeMessage": "您好！有什么可以帮您的？",
    "toolIds": ["tool-001", "tool-002"],
    "knowledgeBaseIds": ["kb-001"],
    "toolPresetParams": {...},
    "multiModal": false,
    "enabled": true,
    "publishedVersion": "version-456",
    "createdAt": "2025-12-08T10:00:00Z"
  }
}
```

### 3.6 删除 Agent

**接口**: `DELETE /api/agents/{agentId}`

**说明**: 删除 Agent (软删除)

**路径参数**:
- `agentId`: Agent ID

**响应示例**:
```json
{
  "code": 200,
  "message": "删除成功"
}
```

### 3.7 启用/禁用 Agent

**接口**: `PATCH /api/agents/{agentId}/status`

**说明**: 切换 Agent 启用状态

**路径参数**:
- `agentId`: Agent ID

**请求参数**:
```json
{
  "enabled": false
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "状态更新成功",
  "data": {
    "id": "agent-123",
    "enabled": false
  }
}
```

### 3.8 生成 System Prompt

**接口**: `POST /api/agents/generate-system-prompt`

**说明**: AI 辅助生成 System Prompt

**请求参数**:
```json
{
  "agentType": "客服助手",
  "capabilities": ["订单查询", "退换货处理", "产品咨询"],
  "tone": "友好、专业",
  "language": "中文"
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "systemPrompt": "你是一个专业、友好的客服助手。\n\n【核心职责】\n- 回答用户关于产品、订单、售后的问题...",
    "suggestions": [
      "建议添加知识库以提供准确的产品信息",
      "建议集成订单查询工具"
    ]
  }
}
```

### 3.9 获取 Agent 版本历史

**接口**: `GET /api/agents/{agentId}/versions`

**说明**: 获取 Agent 的版本历史

**路径参数**:
- `agentId`: Agent ID

**响应示例**:
```json
{
  "code": 200,
  "data": [
    {
      "versionId": "version-456",
      "versionNumber": "1.0.0",
      "changeLog": "初始版本发布",
      "publishStatus": 2,  // 2-已发布
      "publishedAt": "2025-12-08T12:00:00Z"
    },
    {
      "versionId": "version-457",
      "versionNumber": "1.1.0",
      "changeLog": "添加新工具",
      "publishStatus": 1,  // 1-审核中
      "createdAt": "2025-12-09T10:00:00Z"
    }
  ]
}
```

---

## 4. 对话 API

### 4.1 创建会话

**接口**: `POST /api/sessions`

**说明**: 创建新的对话会话

**请求参数**:
```json
{
  "agentId": "agent-123",
  "title": "咨询产品问题"
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": "session-789",
    "agentId": "agent-123",
    "title": "咨询产品问题",
    "createdAt": "2025-12-08T13:00:00Z"
  }
}
```

### 4.2 发送消息 (SSE 流式响应)

**接口**: `POST /api/sessions/{sessionId}/messages`

**说明**: 发送消息并接收流式响应

**请求头**:
```http
Accept: text/event-stream
```

**路径参数**:
- `sessionId`: 会话 ID

**请求参数**:
```json
{
  "content": "你们的退货政策是什么？",
  "messageType": "TEXT"
}
```

**SSE 响应流**:
```
event: message
data: {"type": "text", "content": "我们的"}

event: message
data: {"type": "text", "content": "退货政策"}

event: message
data: {"type": "text", "content": "是："}

event: tool_call
data: {"toolName": "query_policy", "args": {"type": "refund"}, "status": "calling"}

event: tool_call
data: {"toolName": "query_policy", "status": "success", "result": "7天无理由退货"}

event: message
data: {"type": "text", "content": "根据我们的政策，"}

event: message
data: {"type": "text", "content": "商品签收后7天内可申请退货..."}

event: done
data: {"messageId": "msg-001", "totalTokens": 150, "cost": 0.003}
```

**事件类型**:
- `message`: 文本消息片段
- `tool_call`: 工具调用事件
- `done`: 响应完成

### 4.3 发送多模态消息

**接口**: `POST /api/sessions/{sessionId}/messages/multimodal`

**说明**: 发送包含图片的多模态消息

**请求参数**:
```json
{
  "content": "这张图片是什么？",
  "messageType": "MULTIMODAL",
  "fileUrls": [
    "https://example.com/image.jpg"
  ]
}
```

**响应**: 同 4.2 (SSE 流式响应)

### 4.4 获取会话列表

**接口**: `GET /api/sessions`

**说明**: 获取用户的会话列表

**查询参数**:
- `page` (默认: 1): 页码
- `size` (默认: 20): 每页数量
- `agentId` (可选): 按 Agent 过滤
- `isArchived` (可选): 是否归档

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "total": 30,
    "items": [
      {
        "id": "session-789",
        "title": "咨询产品问题",
        "agentId": "agent-123",
        "agentName": "客服助手",
        "isArchived": false,
        "lastMessageAt": "2025-12-08T13:30:00Z",
        "createdAt": "2025-12-08T13:00:00Z"
      }
    ]
  }
}
```

### 4.5 获取会话消息历史

**接口**: `GET /api/sessions/{sessionId}/messages`

**说明**: 获取会话的消息历史

**路径参数**:
- `sessionId`: 会话 ID

**查询参数**:
- `limit` (默认: 50): 最多返回消息数
- `before` (可选): 游标 (消息ID)

**响应示例**:
```json
{
  "code": 200,
  "data": [
    {
      "id": "msg-001",
      "role": "user",
      "content": "你们的退货政策是什么？",
      "messageType": "TEXT",
      "createdAt": "2025-12-08T13:10:00Z"
    },
    {
      "id": "msg-002",
      "role": "assistant",
      "content": "我们的退货政策是：商品签收后7天内可申请退货...",
      "messageType": "TEXT",
      "metadata": {
        "toolCalls": [
          {
            "toolName": "query_policy",
            "args": {"type": "refund"}
          }
        ]
      },
      "tokenCount": 150,
      "createdAt": "2025-12-08T13:10:05Z"
    }
  ]
}
```

### 4.6 删除会话

**接口**: `DELETE /api/sessions/{sessionId}`

**说明**: 删除会话 (软删除)

**路径参数**:
- `sessionId`: 会话 ID

**响应示例**:
```json
{
  "code": 200,
  "message": "会话已删除"
}
```

### 4.7 归档会话

**接口**: `PATCH /api/sessions/{sessionId}/archive`

**说明**: 归档/取消归档会话

**路径参数**:
- `sessionId`: 会话 ID

**请求参数**:
```json
{
  "isArchived": true
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "会话已归档"
}
```

---

## 5. RAG 管理 API

### 5.1 创建知识库

**接口**: `POST /api/rags`

**说明**: 创建新的 RAG 知识库

**请求参数**:
```json
{
  "name": "产品知识库",
  "icon": "📚",
  "description": "包含所有产品文档与FAQ",
  "type": "PRIVATE",
  "embeddingModelId": "embed-model-001"
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": "rag-001",
    "name": "产品知识库",
    "type": "PRIVATE",
    "createdAt": "2025-12-08T14:00:00Z"
  }
}
```

### 5.2 上传文件到知识库

**接口**: `POST /api/rags/{ragId}/files/upload`

**说明**: 上传文件到知识库 (支持 PDF/DOCX/TXT)

**请求头**:
```http
Content-Type: multipart/form-data
```

**路径参数**:
- `ragId`: 知识库 ID

**表单参数**:
- `file`: 文件 (multipart)

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "fileId": "file-001",
    "fileName": "product-manual.pdf",
    "fileSize": 2048576,
    "uploadStatus": 2,  // 2-上传成功
    "processingStatus": 1  // 1-等待处理
  }
}
```

### 5.3 获取文件处理状态

**接口**: `GET /api/rags/{ragId}/files/{fileId}/status`

**说明**: 查询文件处理状态

**路径参数**:
- `ragId`: 知识库 ID
- `fileId`: 文件 ID

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "fileId": "file-001",
    "processingStatus": 3,  // 3-处理完成
    "metadata": {
      "pageCount": 50,
      "chunkCount": 120,
      "characterCount": 50000
    }
  }
}
```

### 5.4 RAG 检索

**接口**: `POST /rag/search`

**说明**: 在知识库中检索相关文档

**请求参数**:
```json
{
  "ragId": "rag-001",
  "query": "如何申请退货？",
  "maxResults": 5,
  "minScore": 0.7,
  "enableRerank": true,
  "enableQueryExpansion": true
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": [
    {
      "id": "doc-unit-001",
      "pageContent": "退货政策：商品签收后7天内，未拆封未使用的商品可申请退货...",
      "score": 0.92,
      "metadata": {
        "source": "product-manual.pdf",
        "page": 15
      }
    },
    {
      "id": "doc-unit-002",
      "pageContent": "退货流程：1. 登录账户 2. 进入订单详情 3. 点击申请退货...",
      "score": 0.88,
      "metadata": {
        "source": "faq.pdf",
        "page": 3
      }
    }
  ]
}
```

### 5.5 RAG 流式问答

**接口**: `POST /rag/search/stream-chat`

**说明**: 基于知识库的流式问答 (SSE)

**请求头**:
```http
Accept: text/event-stream
```

**请求参数**:
```json
{
  "ragId": "rag-001",
  "question": "如何申请退货？",
  "maxResults": 5,
  "enableRerank": true
}
```

**SSE 响应流**:
```
event: retrieval
data: {"status": "searching", "query": "如何申请退货？"}

event: retrieval
data: {"status": "found", "count": 5, "sources": ["product-manual.pdf", "faq.pdf"]}

event: message
data: {"type": "text", "content": "根据我们的"}

event: message
data: {"type": "text", "content": "退货政策，"}

...

event: done
data: {"messageId": "msg-003", "totalTokens": 200, "sources": ["doc-unit-001", "doc-unit-002"]}
```

### 5.6 发布 RAG 版本

**接口**: `POST /api/rags/{ragId}/publish`

**说明**: 发布知识库版本

**路径参数**:
- `ragId`: 知识库 ID

**请求参数**:
```json
{
  "versionNumber": "1.0.0",
  "versionType": 2,  // 2-快照型
  "description": "初始版本发布"
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "versionId": "rag-version-001",
    "versionNumber": "1.0.0",
    "status": 2  // 2-已发布
  }
}
```

### 5.7 获取知识库列表

**接口**: `GET /api/rags`

**说明**: 获取用户的知识库列表

**查询参数**:
- `page` (默认: 1): 页码
- `size` (默认: 20): 每页数量
- `type` (可选): 类型过滤 (PRIVATE/PUBLIC)

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "total": 10,
    "items": [
      {
        "id": "rag-001",
        "name": "产品知识库",
        "icon": "📚",
        "type": "PRIVATE",
        "fileCount": 5,
        "publishedVersion": "rag-version-001",
        "createdAt": "2025-12-08T14:00:00Z"
      }
    ]
  }
}
```

### 5.8 删除知识库

**接口**: `DELETE /api/rags/{ragId}`

**说明**: 删除知识库 (软删除)

**路径参数**:
- `ragId`: 知识库 ID

**响应示例**:
```json
{
  "code": 200,
  "message": "知识库已删除"
}
```

---

## 6. 工具管理 API

### 6.1 创建工具

**接口**: `POST /api/tools`

**说明**: 创建新的 MCP 工具

**请求参数**:
```json
{
  "name": "天气查询工具",
  "icon": "🌤️",
  "description": "查询全球天气信息",
  "toolType": "MCP",
  "uploadType": "DOCKER",
  "uploadUrl": "docker.io/myrepo/weather-mcp:latest",
  "labels": ["天气", "工具"],
  "toolList": [
    {
      "name": "get_weather",
      "description": "获取指定城市的天气",
      "inputSchema": {
        "type": "object",
        "properties": {
          "city": {"type": "string", "description": "城市名称"}
        },
        "required": ["city"]
      }
    }
  ],
  "mcpServerName": "weather-mcp-server",
  "isGlobal": true
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": "tool-001",
    "name": "天气查询工具",
    "status": "pending",  // 等待审核
    "createdAt": "2025-12-08T15:00:00Z"
  }
}
```

### 6.2 获取工具列表

**接口**: `GET /api/tools`

**说明**: 获取可用工具列表

**查询参数**:
- `page` (默认: 1): 页码
- `size` (默认: 20): 每页数量
- `isOffice` (可选): 是否官方工具
- `status` (可选): 审核状态

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "total": 25,
    "items": [
      {
        "id": "tool-001",
        "name": "天气查询工具",
        "icon": "🌤️",
        "description": "查询全球天气信息",
        "isOffice": true,
        "status": "approved",
        "toolList": [...]
      }
    ]
  }
}
```

### 6.3 订阅工具

**接口**: `POST /api/tools/{toolId}/subscribe`

**说明**: 用户订阅工具

**路径参数**:
- `toolId`: 工具 ID

**响应示例**:
```json
{
  "code": 200,
  "message": "订阅成功",
  "data": {
    "userToolId": "user-tool-001",
    "toolId": "tool-001"
  }
}
```

### 6.4 取消订阅工具

**接口**: `DELETE /api/tools/{toolId}/subscribe`

**说明**: 取消订阅工具

**路径参数**:
- `toolId`: 工具 ID

**响应示例**:
```json
{
  "code": 200,
  "message": "取消订阅成功"
}
```

---

## 7. LLM 管理 API

### 7.1 创建模型提供商

**接口**: `POST /api/llm/providers`

**说明**: 添加 LLM 模型提供商

**请求参数**:
```json
{
  "name": "OpenAI",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-xxxxxxxxxxxxxxxx",
  "description": "OpenAI 官方API"
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": "provider-001",
    "name": "OpenAI",
    "status": true,
    "createdAt": "2025-12-08T16:00:00Z"
  }
}
```

### 7.2 创建模型

**接口**: `POST /api/llm/models`

**说明**: 添加 LLM 模型

**请求参数**:
```json
{
  "providerId": "provider-001",
  "modelId": "gpt-4-turbo",
  "name": "GPT-4 Turbo",
  "modelEndpoint": "/chat/completions",
  "type": "CHAT",
  "description": "GPT-4 Turbo 模型"
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": "model-001",
    "name": "GPT-4 Turbo",
    "type": "CHAT",
    "status": true
  }
}
```

### 7.3 获取模型列表

**接口**: `GET /api/llm/models`

**说明**: 获取可用模型列表

**查询参数**:
- `type` (可选): 模型类型 (CHAT/EMBEDDING)
- `isOfficial` (可选): 是否官方模型

**响应示例**:
```json
{
  "code": 200,
  "data": [
    {
      "id": "model-001",
      "name": "GPT-4 Turbo",
      "modelId": "gpt-4-turbo",
      "type": "CHAT",
      "provider": "OpenAI",
      "isOfficial": true,
      "status": true
    }
  ]
}
```

---

## 8. 计费 API

### 8.1 创建充值订单

**接口**: `POST /api/orders/recharge`

**说明**: 创建充值订单

**请求参数**:
```json
{
  "amount": 100.00,
  "paymentPlatform": "alipay",
  "paymentType": "qr_code"
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "orderId": "order-001",
    "orderNo": "20251208160000001",
    "amount": 100.00,
    "status": 1,  // 1-待支付
    "paymentUrl": "https://qr.alipay.com/xxx",
    "expiredAt": "2025-12-08T16:30:00Z"
  }
}
```

### 8.2 查询订单状态

**接口**: `GET /api/orders/{orderId}`

**说明**: 查询订单支付状态

**路径参数**:
- `orderId`: 订单 ID

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "orderId": "order-001",
    "orderNo": "20251208160000001",
    "status": 2,  // 2-已支付
    "amount": 100.00,
    "paidAt": "2025-12-08T16:10:00Z"
  }
}
```

### 8.3 获取余额

**接口**: `GET /api/account/balance`

**说明**: 查询用户账户余额

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "balance": 85.50,
    "frozenBalance": 5.00,
    "currency": "CNY"
  }
}
```

### 8.4 获取使用记录

**接口**: `GET /api/account/usage-records`

**说明**: 查询使用记录

**查询参数**:
- `page` (默认: 1): 页码
- `size` (默认: 20): 每页数量
- `startDate` (可选): 开始日期
- `endDate` (可选): 结束日期

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "total": 100,
    "items": [
      {
        "id": "usage-001",
        "serviceName": "Agent 对话服务",
        "serviceType": "LLM",
        "quantityData": {
          "inputTokens": 500,
          "outputTokens": 800
        },
        "cost": 0.026,
        "billedAt": "2025-12-08T13:10:05Z"
      }
    ]
  }
}
```

---

## 9. 文件上传 API

### 9.1 通用文件上传

**接口**: `POST /api/upload`

**说明**: 上传文件到对象存储 (OSS)

**请求头**:
```http
Content-Type: multipart/form-data
```

**表单参数**:
- `file`: 文件 (multipart)
- `type` (可选): 文件类型 (avatar/document/image)

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "fileUrl": "https://cdn.example.com/uploads/20251208/abc123.jpg",
    "fileName": "avatar.jpg",
    "fileSize": 102400
  }
}
```

---

## 10. 执行追踪 API

### 10.1 获取执行详情

**接口**: `GET /api/executions/{traceId}`

**说明**: 查询 Agent 执行的详细追踪信息

**路径参数**:
- `traceId`: 追踪 ID

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "summary": {
      "traceId": "trace-abc123",
      "agentId": "agent-123",
      "sessionId": "session-789",
      "executionStartTime": "2025-12-08T13:10:00Z",
      "executionEndTime": "2025-12-08T13:10:15Z",
      "totalExecutionTime": 15000,
      "totalTokens": 1300,
      "toolCallCount": 2,
      "totalCost": 0.026,
      "executionSuccess": true
    },
    "details": [
      {
        "sequenceNo": 1,
        "stepType": "USER_MESSAGE",
        "messageContent": "帮我查一下明天的天气",
        "timestamp": "2025-12-08T13:10:00Z"
      },
      {
        "sequenceNo": 2,
        "stepType": "TOOL_CALL",
        "toolName": "weather_api",
        "toolRequestArgs": "{\"city\": \"北京\", \"date\": \"2025-12-09\"}",
        "toolResponseData": "{\"temp\": \"5°C\", \"weather\": \"晴\"}",
        "toolExecutionTime": 1200,
        "toolSuccess": true,
        "timestamp": "2025-12-08T13:10:02Z"
      },
      {
        "sequenceNo": 3,
        "stepType": "AI_RESPONSE",
        "messageContent": "明天北京的天气是晴天，气温5°C",
        "modelId": "Qwen/Qwen2.5-72B-Instruct",
        "messageTokens": 120,
        "timestamp": "2025-12-08T13:10:15Z"
      }
    ]
  }
}
```

---

## 11. 错误码说明

### 11.1 HTTP 状态码

| 状态码 | 说明 |
|-------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 (缺少或无效 Token) |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 (限流) |
| 500 | 服务器内部错误 |

### 11.2 业务错误码

| 错误码 | 说明 |
|-------|------|
| 1001 | 用户名已存在 |
| 1002 | 邮箱已注册 |
| 1003 | 验证码错误或过期 |
| 1004 | 密码强度不足 |
| 2001 | Agent 不存在 |
| 2002 | Agent 版本不存在 |
| 2003 | Agent 未启用 |
| 3001 | 会话不存在 |
| 3002 | 消息发送失败 |
| 4001 | RAG 知识库不存在 |
| 4002 | 文件处理失败 |
| 4003 | 向量检索失败 |
| 5001 | 工具不存在 |
| 5002 | 工具调用失败 |
| 6001 | 余额不足 |
| 6002 | 订单不存在 |
| 6003 | 订单已过期 |

**错误响应示例**:
```json
{
  "code": 1001,
  "message": "用户名已存在",
  "timestamp": 1733654400000
}
```

---

## 12. 速率限制

### 12.1 限流规则

| 接口类型 | 限制 |
|---------|------|
| 用户认证 | 10次/分钟 |
| Agent 对话 | 20次/分钟 |
| RAG 检索 | 30次/分钟 |
| 文件上传 | 5次/分钟 |
| 其他接口 | 60次/分钟 |

### 12.2 限流响应

**响应头**:
```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1733654460
```

**超限响应**:
```json
{
  "code": 429,
  "message": "请求过于频繁，请稍后再试",
  "retryAfter": 30
}
```

---

## 13. Webhook 通知

### 13.1 订单支付回调

**URL**: 用户配置的回调 URL

**方法**: `POST`

**请求体**:
```json
{
  "event": "order.paid",
  "orderId": "order-001",
  "orderNo": "20251208160000001",
  "amount": 100.00,
  "paidAt": "2025-12-08T16:10:00Z",
  "signature": "sha256_hash_of_payload"
}
```

### 13.2 文件处理完成回调

**请求体**:
```json
{
  "event": "file.processed",
  "fileId": "file-001",
  "ragId": "rag-001",
  "status": "success",
  "metadata": {
    "chunkCount": 120,
    "pageCount": 50
  },
  "signature": "sha256_hash_of_payload"
}
```

---

## 14. SDK 与示例

### 14.1 JavaScript/TypeScript SDK

```typescript
import { AgentXClient } from '@agentx/sdk';

const client = new AgentXClient({
  baseURL: 'https://api.agentx.ai',
  token: 'your-jwt-token'
});

// 创建 Agent
const agent = await client.agents.create({
  name: '客服助手',
  systemPrompt: '你是一个专业的客服助手...'
});

// 发送消息 (流式)
const stream = await client.chat.sendMessage('session-123', {
  content: '你好'
});

for await (const chunk of stream) {
  console.log(chunk.content);
}
```

### 14.2 Python SDK

```python
from agentx import AgentXClient

client = AgentXClient(
    base_url='https://api.agentx.ai',
    token='your-jwt-token'
)

# 创建 Agent
agent = client.agents.create(
    name='客服助手',
    system_prompt='你是一个专业的客服助手...'
)

# 发送消息 (流式)
for chunk in client.chat.send_message('session-123', content='你好'):
    print(chunk['content'], end='', flush=True)
```

### 14.3 cURL 示例

```bash
# 登录
curl -X POST https://api.agentx.ai/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user123", "password": "pass123"}'

# 创建 Agent
curl -X POST https://api.agentx.ai/api/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "客服助手",
    "systemPrompt": "你是一个专业的客服助手..."
  }'

# 发送消息 (SSE)
curl -N https://api.agentx.ai/api/sessions/session-123/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"content": "你好"}'
```

---

## 15. 最佳实践

### 15.1 认证 Token 管理

- Token 有效期: 7天
- 建议在 Token 过期前 1天刷新
- 不要在前端暴露 Token，使用 HttpOnly Cookie

### 15.2 SSE 流式响应处理

```javascript
const eventSource = new EventSource('/api/sessions/session-123/messages');

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log(data.content);
});

eventSource.addEventListener('done', (event) => {
  const data = JSON.parse(event.data);
  console.log('Total tokens:', data.totalTokens);
  eventSource.close();
});

eventSource.addEventListener('error', (error) => {
  console.error('SSE error:', error);
  eventSource.close();
});
```

### 15.3 分页查询

- 使用游标分页 (`before`/`after`) 而非 `offset`
- 单页数量建议不超过 100

### 15.4 错误处理

```javascript
try {
  const response = await client.agents.create({...});
} catch (error) {
  if (error.code === 1001) {
    console.error('用户名已存在');
  } else if (error.code === 6001) {
    console.error('余额不足');
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## 附录

### A. 完整接口清单

| 模块 | 接口数量 |
|-----|---------|
| 认证与授权 | 5 |
| Agent 管理 | 9 |
| 对话 | 7 |
| RAG 管理 | 8 |
| 工具管理 | 4 |
| LLM 管理 | 3 |
| 计费 | 4 |
| 文件上传 | 1 |
| 执行追踪 | 1 |
| **总计** | **42** |

### B. 参考资源

- **Postman Collection**: https://api.agentx.ai/postman
- **OpenAPI Spec**: https://api.agentx.ai/openapi.json
- **SDK 文档**: https://docs.agentx.ai/sdk
