# 对话模块

> 💬 **一句话人话**：用户在页面上打的每一句话，从进后端到吐字返回，走的都是这个模块。
> 它管三件事：把历史消息组织好喂给模型（不能超长）、把模型的回答一个字一个字推回浏览器、
> 以及在需要时把一个复杂问题拆成几步分别执行再汇总。

本模块共 61 个类，是平台**请求量最大、链路最长**的模块。

---

## 目录

- [1. 模块职责](#1-模块职责)
- [2. 核心概念](#2-核心概念)
- [3. 分层结构](#3-分层结构)
- [4. 消息处理器体系](#4-消息处理器体系)
- [5. 一次对话的完整链路](#5-一次对话的完整链路)
- [6. 上下文与 Token 溢出](#6-上下文与-token-溢出)
- [7. Agent 工作流](#7-agent-工作流)
- [8. 消息类型与前端协议](#8-消息类型与前端协议)
- [9. 已知坑与注意事项](#9-已知坑与注意事项)

---

## 1. 模块职责

| 职责 | 说明 |
| --- | --- |
| **会话管理** | 创建/查询会话，维护会话与 Agent 的绑定关系 |
| **消息持久化** | 用户消息与模型回复落库，供历史回溯 |
| **上下文组装** | 从历史消息构造送入模型的上下文，超长时按策略裁剪 |
| **流式传输** | 通过 SSE 把模型输出增量推给前端 |
| **工具编排** | 把 RAG 检索与 MCP 工具统一包装成 function calling 提供给模型 |
| **工作流执行** | 复杂任务的拆分 → 执行 → 汇总 |

---

## 2. 核心概念

### 三个实体

```
SessionEntity    会话：一次持续的对话，绑定一个 Agent
MessageEntity    消息：会话中的一条，含角色、内容、Token 数
ContextEntity    上下文：会话当前的有效消息窗口
```

> **为什么 Context 要单独建实体**：消息是**只增不改**的历史记录，
> 而上下文是**会被裁剪**的工作集。两者分开后，裁剪上下文不会破坏历史。

### MessageType — 15 种消息类型

```java
TEXT                      // 普通文本
TOOL_CALL                 // 工具调用
TASK_EXEC                 // 任务执行
TASK_STATUS_TO_LOADING    // 任务转为进行中
TASK_STATUS_TO_FINISH     // 任务转为完成
TASK_SPLIT_FINISH         // 任务拆分结束

RAG_RETRIEVAL_START / _PROGRESS / _END    // RAG 检索三阶段
RAG_THINKING_START  / _PROGRESS / _END    // RAG 思考三阶段
RAG_ANSWER_START    / _PROGRESS / _END    // RAG 回答三阶段
```

RAG 相关的九个类型是 **START / PROGRESS / END 三段式**，前端据此渲染阶段性进度条。

> ⚠️ 这套类型是**前后端契约**。后端漏发某个阶段的事件，前端就会一直停在上一个阶段——
> 线上「卡在正在检索」的故障正是这么来的，见
> [排查记录 1.3](../operations/troubleshooting-log.md#13-根因二进度提示与实际执行不同步)。

---

## 3. 分层结构

```
interfaces/api/portal/agent/PortalAgentSessionController
        ↓
application/conversation/
  ├── service/ConversationAppService          会话与消息的应用编排
  ├── service/ChatSessionManager              活跃会话管理
  ├── service/handler/MessageHandlerFactory   处理器选择
  └── service/message/
        ├── AbstractMessageHandler            ★ 对话主流程模板
        ├── chat/ChatMessageHandler           标准对话
        ├── agent/AgentMessageHandler         带工作流的 Agent 对话
        └── preview/PreviewMessageHandler     Agent 预览（不落库）
        ↓
domain/conversation/
  ├── service/ContextProcessor                上下文裁剪
  ├── service/ConversationDomainService
  ├── service/MessageDomainService
  └── service/SessionDomainService
        ↓
infrastructure/transport/
  ├── SseMessageTransport                     流式
  └── SyncMessageTransport                    同步
```

---

## 4. 消息处理器体系

`AbstractMessageHandler` 是**模板方法模式**的典型应用，三个子类共享主流程、各自定制细节。

```
              AbstractMessageHandler
              ├── chat()              入口，创建连接
              ├── processStreamingChat()
              ├── processSyncChat()
              ├── processChat()       核心
              ├── buildHistoryMessage()
              ├── initMemory()
              ├── provideTools()      ← 子类覆写以定制工具
              └── smartRenameSession()
                       ↑
        ┌──────────────┼──────────────┐
ChatMessageHandler  AgentMessageHandler  PreviewMessageHandler
   标准对话           带工作流编排         预览，不落库
```

### 传输层抽象

`MessageTransport<T>` 让主流程与传输方式解耦：

```java
public interface MessageTransport<T> {
    T createConnection(long timeout);
    void sendMessage(T connection, AgentChatResponse response);
    void completeConnection(T connection);
}
```

- `SseMessageTransport` → `SseEmitter`，流式
- `SyncMessageTransport` → `ChatResponse`，一次性返回

**同一套对话逻辑，换个 transport 就能在流式和同步之间切换。**

---

## 5. 一次对话的完整链路

```
POST /agents/sessions/chat
        ↓
PortalAgentSessionController        ← 直接返回 SseEmitter，本身不开线程
        ↓
MessageHandlerFactory.getHandler(agent)
        ↓
AbstractMessageHandler.chat(ctx, transport)
        ↓
transport.createConnection(CONNECTION_TIMEOUT)   ← 10 分钟兜底
        ↓
buildHistoryMessage()  从历史构造 MessageWindowChatMemory
        ↓
provideTools()         装配 RAG 工具 + MCP 工具
        ↓
highAvailabilityDomainService.selectBestProvider()   选模型实例
        ↓
llmServiceFactory.getStreamingClient()               建客户端
        ↓
processChat()          流式消费模型输出
        ↓ 每个 token
transport.sendMessage()  → SSE 推给前端
        ↓ 结束
createLlmMessage()     落库
reportCallResult()     上报高可用统计
smartRenameSession()   首轮对话后自动命名会话
```

> `smartRenameSession()` 是个细节设计：会话创建时没有标题，
> 第一轮对话结束后用模型给会话起个名字，用户不必手动命名。

---

## 6. 上下文与 Token 溢出

`ContextProcessor.processContext()` 负责在**送入模型前**把上下文压到限额内。

```java
public ContextResult processContext(String sessionId, int maxTokens,
                                    TokenOverflowStrategyEnum strategyType, ...)
```

它把 `MessageEntity` 转成 `TokenMessage`，再交给
[LLM 模块的 Token 溢出策略](llm.md#7-token-溢出处理)处理：

| 策略 | 行为 | 代价 |
| --- | --- | --- |
| `NONE` | 不处理 | 超长直接报错 |
| `SLIDING_WINDOW` | 丢弃最早的消息 | 丢失早期信息 |
| `SUMMARIZE` | 把旧消息压缩成摘要 | 多一次 LLM 调用 |

> `SUMMARIZE` 会**额外发起一次模型调用**。这次调用同样受
> `LLM_REQUEST_TIMEOUT_SECONDS` 约束，上游慢时会直接拖慢用户可感知的首字延迟。

---

## 7. Agent 工作流

`AgentMessageHandler` 在标准对话之上加了一层任务编排，用于处理需要多步完成的复杂请求。

### 状态机

```java
public enum AgentWorkflowState {
    ANALYSER_MESSAGE,    // 分析用户消息
    INITIALIZED,         // 初始化
    TASK_SPLITTING,      // 任务拆分中
    TASK_SPLIT_COMPLETED,
    TASK_EXECUTING,      // 任务执行中
    TASK_EXECUTED,
    SUMMARIZING,         // 结果汇总中
    COMPLETED,
    FAILED,
    WAITING_INPUT_FOR_TASK_SPLIT,      // 等用户补充信息
    WAITING_INPUT_FOR_TASK_EXECUTION
}
```

两个 `WAITING_INPUT_*` 状态是**人在回路**的设计：Agent 发现信息不足时暂停下来问用户，
而不是硬着头皮猜。由 `InfoRequirementService` 判定缺什么信息。

### 处理器与事件

```
AbstractAgentHandler
├── AnalyserMessageHandler   分析意图
├── TaskSplitHandler         拆分任务
├── TaskExecutionHandler     逐个执行
└── SummarizeHandler         汇总结果

AgentEventBus  ←  AgentWorkflowEvent  →  AgentEventHandler
AgentWorkflowContext   贯穿全流程的上下文
TaskManager            任务状态管理
```

---

## 8. 消息类型与前端协议

`AgentChatResponse` 是推给前端的统一信封：

```java
AgentChatResponse.build(content, MessageType.RAG_RETRIEVAL_PROGRESS)
```

前端按 `MessageType` 决定渲染方式（进度条 / 正文 / 工具调用卡片）。

**新增消息类型时必须前后端同步**，否则前端遇到未知类型会静默丢弃。

---

## 9. 已知坑与注意事项

### 9.1 `Role` 枚举只有 USER 一个值

```java
public enum Role {
    USER
}
```

历史消息里模型回复的角色靠其他字段区分。改这块前先确认真实的落库结构，
不要假设 `Role` 是完整的角色集合。

### 9.2 存在多个同名类，容易 import 错

| 类名 | 出现位置 |
| --- | --- |
| `Agent` | `service/handler/Agent`、`service/message/Agent`、`service/message/agent/Agent` |
| `ChatContext` | `service/handler/content/ChatContext`、`service/handler/context/ChatContext` |
| `AgentPromptTemplates` | `service/handler/context/`、`service/message/agent/template/` |

**三个 `Agent`、两个 `ChatContext`、两个 `AgentPromptTemplates`。**
IDE 自动 import 极易选错，且编译能过、运行才出错。重构时优先合并这些重复类。

### 9.3 `CONNECTION_TIMEOUT` 是兜底而非主防线

```java
protected static final long CONNECTION_TIMEOUT = 10 * 60 * 1000L;
```

真正决定「模型挂了多久能发现」的是 LLM 客户端超时
（`LLM_STREAM_TIMEOUT_SECONDS`，默认 300s）。这个 10 分钟只是最后一道保险。
曾经它是 50 分钟，配合 1 小时的 LLM 超时，导致故障被隐藏，见
[排查记录 1.6](../operations/troubleshooting-log.md#16-根因五sse-超时形同虚设)。

### 9.4 会话智能重命名用的是裸 `new Thread(...)`

Agent 对话主链路**没有应用层线程池**：请求线程一路同步执行到
`handler.chat(...)` 返回 `SseEmitter`，随后的流式输出由 LangChain4j 的
streaming 回调在 HTTP 客户端自己的线程上驱动。因此它天然**避开了
`ForkJoinPool.commonPool()` 的串行化陷阱**——RAG 那条链路当初就栽在这上面，见
[排查记录 1.4](../operations/troubleshooting-log.md#14-根因三并发被串行化)。

需要注意的是 `AbstractMessageHandler.smartRenameSession()`：

```java
Thread thread = new Thread(() -> { ... });   // 未命名、无上限
```

每次首轮对话都会新建一个**未命名**线程做会话重命名。量不大（仅首轮触发），
但线程无名会让 thread dump 难以定位，且没有上限与拒绝策略。
建议并入统一的有界线程池，并给出可辨识的线程名——参考
`RagQaDatasetAppService` 的 `rag-stream-chat` 或 `DelayedTaskQueueManager` 的
`scheduled-task-executor`。

> ⚠️ 2026-08-12 更正：本节原描述为「控制器用的是无界线程池
> `PortalAgentSessionController.executorService`」。该字段**从未被提交过任务**，
> 已作为死代码删除；控制器只是直接返回 `SseEmitter`，不开线程。

---

## 相关文档

- [系统架构](../architecture/overview.md) —— 整体分层
- [Agent 模块](agent.md) —— Agent 定义与发布
- [LLM 模块](llm.md) —— 模型调用与 Token 策略
- [RAG 模块](rag.md) —— 检索链路
- [MCP 工具模块](mcp-tool.md) —— 工具如何被装配进对话
- [API 参考](../reference/api.md) —— SSE 接口定义
- [排查记录](../operations/troubleshooting-log.md) —— 本模块相关的线上故障
