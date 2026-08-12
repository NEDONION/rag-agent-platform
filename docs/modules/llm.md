# LLM 模块

> 💬 **一句话人话**：这个模块负责「去哪家、用哪个模型、怎么把请求发出去」。
> 你在界面上配好服务商（比如硅基流动）和模型，它就把这些配置变成真正能调用的客户端；
> 一家挂了会自动换下一家；聊天记录太长超出模型上限时，它负责裁剪或压缩。

**涉及代码**：`domain/llm`、`domain/token`、`domain/highavailability`、
`infrastructure/llm`、`infrastructure/highavailability`、`application/llm`，共约 61 个类。

---

## 目录

- [1. 模块职责](#1-模块职责)
- [2. 核心概念](#2-核心概念)
- [3. 分层结构](#3-分层结构)
- [4. 服务商与模型](#4-服务商与模型)
- [5. 协议适配](#5-协议适配)
- [6. 高可用与降级链](#6-高可用与降级链)
- [7. Token 溢出处理](#7-token-溢出处理)
- [8. 领域事件](#8-领域事件)
- [9. 关键配置](#9-关键配置)
- [10. 已知坑与注意事项](#10-已知坑与注意事项)

---

## 1. 模块职责

| 职责 | 说明 |
|---|---|
| **服务商管理** | 用户自建或使用官方预置的模型服务商，保存 API Key、Base URL、协议类型 |
| **模型管理** | 一个服务商下挂多个模型，区分对话 / 嵌入 / 视觉三类用途 |
| **客户端构造** | 把服务商 + 模型的配置组装成 LangChain4j 的 `ChatModel` / `StreamingChatModel` |
| **高可用调度** | 通过外部网关在多个可用实例中择优，支持降级链与亲和性 |
| **调用结果上报** | 上报每次调用的成败与延迟，供网关做后续决策 |
| **Token 溢出处理** | 对话历史超出模型上下文上限时，按策略裁剪或摘要 |

**不负责**：具体的对话编排（见 [对话模块](conversation.md)）、
向量化与检索（见 [RAG 模块](rag.md)）。

---

## 2. 核心概念

### Provider（服务商）

一个模型服务的提供方，例如硅基流动、OpenAI、Anthropic，或任何兼容 OpenAI 协议的自建服务。

```java
// domain/llm/model/enums/ProviderType.java
public enum ProviderType {
    ALL("all"),           // 查询用，表示不限
    OFFICIAL("official"), // 平台预置，所有用户可见
    CUSTOM("custom");     // 用户自建，仅自己可见
}
```

**关键字段**（`ProviderEntity`）：

| 字段 | 说明 |
|---|---|
| `protocol` | 决定用哪套 SDK 说话，见[协议适配](#5-协议适配) |
| `config.apiKey` | 密钥，**对外返回时会脱敏** |
| `config.baseUrl` | 服务地址，兼容 OpenAI 协议的自建服务靠它接入 |
| `userId` | 归属用户，`OFFICIAL` 类型除外 |

> ⚠️ **密钥脱敏**在 `ProviderAssembler` 转 DTO 时调用 `dto.maskSensitiveInfo()` 完成。
> 新增任何返回 Provider 的接口时，务必走 Assembler，不要直接把 Entity 序列化出去。

### Model（模型）

挂在 Provider 下的具体模型。

```java
// domain/llm/model/enums/ModelType.java
public enum ModelType {
    CHAT("CHAT", "对话模型"),
    EMBEDDING("EMBEDDING", "嵌入模型"),
    VISION("VISION", "视觉模型");
}
```

**`modelEndpoint`** 是发给服务商的真实模型名（如 `Qwen/Qwen3-8B`），
与平台内展示的名称解耦 —— 换模型不必改前端。

---

## 3. 分层结构

```
interfaces/api/portal/llm/PortalLLMController
        │  对外 REST 接口
        ↓
application/llm/service/LLMAppService
        │  用例编排 + Assembler 转 DTO（含密钥脱敏）
        ↓
domain/llm/service/LLMDomainService          领域规则、校验、事件发布
domain/highavailability/service/…            实例择优、结果上报
domain/token/service/…                       Token 溢出策略
        ↓
infrastructure/llm/LLMServiceFactory         组装 LangChain4j 客户端
infrastructure/highavailability/…            调用外部高可用网关
```

---

## 4. 服务商与模型

### 客户端是怎么造出来的

`LLMServiceFactory` 是唯一的入口，把领域对象翻译成基础设施配置：

```java
// infrastructure/llm/LLMServiceFactory.java
public StreamingChatModel getStreamingClient(ProviderEntity provider, ModelEntity model) {
    ProviderConfig config = provider.getConfig();
    ProviderConfig providerConfig = new ProviderConfig(
            config.getApiKey(),
            config.getBaseUrl(),
            model.getModelEndpoint(),   // ← 真实模型名在这里注入
            provider.getProtocol());
    return LLMProviderService.getStream(provider.getProtocol(), providerConfig);
}
```

两个方法的区别：

| 方法 | 返回 | 用途 |
|---|---|---|
| `getStreamingClient` | `StreamingChatModel` | 面向用户的对话，逐字返回 |
| `getStrandClient` | `ChatModel` | 内部同步调用：意图识别、语义改写、查询扩展等 |

> 命名里的 `Strand` 是笔误（应为 `Standard`），已在代码中沿用，改名需同步全部调用点。

---

## 5. 协议适配

```java
// infrastructure/llm/protocol/enums/ProviderProtocol.java
public enum ProviderProtocol {
    OPENAI, ANTHROPIC;
}
```

`LLMProviderFactory` 按协议分发到不同的 LangChain4j 实现：

| 协议 | 非流式 | 流式 |
|---|---|---|
| `OPENAI` | `OpenAiChatModel` | `OpenAiStreamingChatModel` |
| `ANTHROPIC` | `AnthropicChatModel` | `AnthropicStreamingChatModel` |

**绝大多数国内服务商（硅基流动、DeepSeek、通义等）都兼容 OpenAI 协议**，
选 `OPENAI` 并把 `baseUrl` 指过去即可，无需新增协议。

### 超时配置

```java
// infrastructure/llm/factory/LLMProviderFactory.java
private static final Duration BLOCKING_TIMEOUT  = timeoutFromEnv("LLM_REQUEST_TIMEOUT_SECONDS", 60);
private static final Duration STREAMING_TIMEOUT = timeoutFromEnv("LLM_STREAM_TIMEOUT_SECONDS", 300);
```

| 变量 | 默认 | 作用范围 |
|---|---|---|
| `LLM_REQUEST_TIMEOUT_SECONDS` | 60s | 非流式。这类调用夹在 SSE 事件之间同步执行，超时必须短 |
| `LLM_STREAM_TIMEOUT_SECONDS` | 300s | 流式对话 |

> 📌 这两个值曾经都是 `Duration.ofHours(1)`，等同于没有超时，导致线上「对话卡死」。
> 完整过程见 [排查记录 1.2](../operations/troubleshooting-log.md#12-根因一llm-客户端超时是-1-小时)。

---

## 6. 高可用与降级链

### 设计意图

单个服务商会限流、会抖动、会挂。高可用模块把「选哪个实例」这件事外置给一个网关服务，
由它根据历史成功率、延迟和亲和性做决策。

### 调用流程

```
业务侧（如 RAG 问答、Agent 对话）
   │
   │ selectBestProvider(model, userId, sessionId, fallbackChain)
   ↓
HighAvailabilityDomainServiceImpl
   │  构造 SelectInstanceRequest（含降级链）
   ↓
HighAvailabilityGateway ──HTTP──> 外部高可用网关
   │
   │ 返回 ApiInstanceDTO（businessId → 定位 Provider/Model，id → instanceId）
   ↓
HighAvailabilityResult { provider, model, instanceId }
   │
   │ 业务用 provider + model 造客户端发起调用
   ↓
reportCallResult(instanceId, modelId, success, latencyMs, ...)
   └─ 把成败与延迟回传网关，影响后续择优
```

### 降级链

```java
// domain/highavailability/service/HighAvailabilityDomainServiceImpl.java:138
if (fallbackChain != null && !fallbackChain.isEmpty()) {
    request.setFallbackChain(fallbackChain);
    logger.debug("启用降级链: userId={}, primaryModel={}, fallbackModels={}",
                 userId, model.getModelId(), fallbackChain);
}
```

降级链来自用户设置（`UserSettingsDomainService.getUserFallbackChain`）：
主模型不可用时，网关按链上顺序尝试备选模型。

### 亲和性

```java
// infrastructure/highavailability/constant/AffinityType.java
SESSION   // 同一会话尽量固定同一实例，保证上下文连续
USER      // 同一用户固定实例
BATCH     // 同一批任务固定实例
REGION    // 按地域就近
```

对话场景用 `SESSION`，避免同一轮对话在不同实例间跳。

### 双重降级

`selectBestProvider` 内部有两层兜底：网关调用失败时走本地降级逻辑；
本地降级也失败才抛 `BusinessException("获取Provider失败")`。

```java
} catch (Exception fallbackException) {
    logger.error("降级逻辑也失败了: modelId={}, sessionId={}", model.getId(), sessionId, fallbackException);
    throw new BusinessException("获取Provider失败", fallbackException);
}
```

### 模型变更同步

模型的增删改都要同步到网关，通过领域事件驱动：

| 方法 | 触发时机 |
|---|---|
| `syncModelToGateway` | 新建模型 |
| `updateModelInGateway` | 修改模型 |
| `removeModelFromGateway` | 删除模型 |
| `changeModelStatusInGateway` | 启用 / 停用 |
| `batchRemoveModelsFromGateway` | 批量删除 |
| `syncAllModelsToGateway` | 全量重同步，用于修复不一致 |
| `initializeProject` | 首次启动时在网关侧建项目 |

---

## 7. Token 溢出处理

对话历史会不断增长，超出模型上下文上限就会报错。这个子模块负责在发请求前把历史裁到安全范围。

### 策略接口

```java
// domain/token/service/TokenOverflowStrategy.java
public interface TokenOverflowStrategy {
    TokenProcessResult process(List<TokenMessage> messages, TokenOverflowConfig config);
    String getName();
    boolean needsProcessing(List<TokenMessage> messages);
}
```

### 三种策略

| 策略 | 实现类 | 行为 | 适用 |
|---|---|---|---|
| `NONE` | `NoTokenOverflowStrategy` | 不处理，原样返回 | 短对话，或自行保证不超限 |
| `SLIDING_WINDOW` | `SlidingWindowTokenOverflowStrategy` | 丢弃最旧的消息，保留最近 N 条 | 默认选择，实现简单、无额外开销 |
| `SUMMARIZE` | `SummarizeTokenOverflowStrategy` | 把旧消息交给模型压缩成摘要 | 长对话需要记住早期信息 |

由 `TokenOverflowStrategyFactory` 按配置分发：

```java
switch (strategyType) {
    case SLIDING_WINDOW : ...
    case SUMMARIZE : ...
    case NONE : ...
}
```

> ⚠️ `SUMMARIZE` 会**额外发起一次 LLM 调用**，因此受
> `LLM_REQUEST_TIMEOUT_SECONDS` 约束，且会增加首字延迟。
> 长对话场景开启前建议实测。

---

## 8. 领域事件

模型的生命周期通过事件对外广播，主要消费方是高可用网关同步：

```
domain/llm/event/
├── ModelDomainEvent          抽象基类
├── ModelCreatedEvent
├── ModelUpdatedEvent
├── ModelDeletedEvent
├── ModelsBatchDeletedEvent   携带 ModelDeleteItem 列表
└── ModelStatusChangedEvent   启用 / 停用
```

用事件解耦的好处：模型 CRUD 的主流程不必关心网关是否可达，
网关同步失败不会阻断用户操作。

---

## 9. 关键配置

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `LLM_REQUEST_TIMEOUT_SECONDS` | 60 | 非流式调用超时 |
| `LLM_STREAM_TIMEOUT_SECONDS` | 300 | 流式调用超时 |
| `SILICONFLOW_API_KEY` | — | Rerank 用，见 RAG 模块 |

### 相关表

模型与服务商的表结构见 [数据库设计](../reference/database.md)。

---

## 10. 已知坑与注意事项

### 密钥必须走 Assembler 脱敏

直接返回 `ProviderEntity` 会把 `apiKey` 明文吐给前端。
所有对外接口必须经 `ProviderAssembler`，它会调 `maskSensitiveInfo()`。

### 超时值不要改回大数

把超时设成 1 小时等于关闭超时。上游挂起时故障会被无限期隐藏，
表现为「页面一直转圈且不报错」，比直接报错难排查得多。

### 非流式调用会阻塞 SSE 事件流

`getStrandClient` 拿到的是同步客户端。如果在两条 SSE 事件之间连续调用多次，
用户会看到界面卡在上一条提示上。**每个耗时步骤前都应先发进度事件**，
参见 [排查记录 1.3](../operations/troubleshooting-log.md#13-根因二进度提示与实际执行不同步)。

### 上报不能省

`reportCallResult` 是网关择优的唯一数据来源。漏报会让网关一直基于陈旧数据决策，
高可用形同虚设。新增调用路径时记得补上报。

---

## 相关文档

- [系统架构](../architecture/overview.md)
- [对话模块](conversation.md) —— 谁在使用这里的客户端
- [RAG 模块](rag.md) —— 嵌入模型的使用方
- [性能优化](../operations/performance.md) —— 超时与并发
- [排查记录](../operations/troubleshooting-log.md) —— 超时问题的完整过程
