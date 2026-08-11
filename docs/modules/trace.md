# 执行追踪模块

> 💬 **一句话人话**：把 Agent 每次干活的过程录下来——哪一步、调了哪个模型、
> 用了哪个工具、花了多少 Token、卡在哪儿失败的。出问题时不用猜，翻记录就行。

本模块共 29 个类，是平台的**可观测性基础**。

---

## 目录

- [1. 模块职责](#1-模块职责)
- [2. 两级数据模型](#2-两级数据模型)
- [3. 执行阶段与步骤类型](#3-执行阶段与步骤类型)
- [4. TraceCollector](#4-tracecollector)
- [5. 事件驱动的采集](#5-事件驱动的采集)
- [6. 统计与查询](#6-统计与查询)
- [7. 已知坑与注意事项](#7-已知坑与注意事项)

---

## 1. 模块职责

| 职责 | 说明 |
| --- | --- |
| **执行记录** | 记录每次 Agent 执行的起止、成败、耗时 |
| **步骤明细** | 记录用户消息、AI 回复、工具调用等每一步 |
| **模型调用信息** | 模型 ID、输入输出 Token、延迟 |
| **工具调用信息** | 工具名、参数、结果 |
| **失败定位** | 记录失败发生在哪个阶段、错误详情 |
| **统计聚合** | 按 Agent / 会话维度出统计 |

---

## 2. 两级数据模型

```
AgentExecutionSummaryEntity     摘要：一次执行一条
└── AgentExecutionDetailEntity  明细：一次执行 N 条（每步一条）

配套值对象：
├── TraceContext      贯穿一次执行的上下文，串起 summary 与 detail
├── ModelCallInfo     模型调用信息
└── ToolCallInfo      工具调用信息
```

> **为什么分两级**：列表页只需要摘要（谁、什么时候、成没成、多久），
> 明细只在点进某一次执行时才加载。一次执行可能有几十上百步，
> 全部塞进一张表会让列表查询变慢。

---

## 3. 执行阶段与步骤类型

### ExecutionPhase — 执行阶段（失败定位用）

```java
INITIALIZATION            // 初始化
ENVIRONMENT_PREPARATION   // 环境准备
BALANCE_CHECK             // 余额检查
MEMORY_INITIALIZATION     // 记忆初始化
MODEL_CALL                // 模型调用
TOOL_EXECUTION            // 工具执行
BILLING                   // 计费
RESULT_PROCESSING         // 结果处理
```

这套阶段划分**就是一次 Agent 执行的骨架**。失败时记录 `errorPhase`，
排查时先看是哪个阶段挂的，直接缩小一个数量级的范围。

### ExecutionStepType — 步骤类型

```java
USER_MESSAGE     // 用户消息
AI_RESPONSE      // AI 回复
TOOL_CALL        // 工具调用
ERROR_MESSAGE    // 错误消息
```

---

## 4. TraceCollector

`TraceCollector` 是采集入口，业务代码只跟它打交道。

| 方法 | 用途 |
| --- | --- |
| `getOrStartExecution(userId, sessionId, agentId, userMessage, ...)` | 开始一次执行，返回 `TraceContext` |
| `recordModelCall(ctx, aiResponse, modelCallInfo)` | 记录一次模型调用 |
| `recordToolCall(ctx, toolCallInfo)` | 记录一次工具调用 |
| `updateUserMessageTokens(ctx, inputTokens)` | 补记输入 Token |
| `recordSuccess(ctx)` | 标记成功 |
| `recordFailure(ctx, errorPhase, errorMessage)` | 标记失败（字符串） |
| `recordFailure(ctx, errorPhase, throwable)` | 标记失败（异常） |
| `recordErrorDetail(ctx, errorPhase, throwable)` | 记录错误明细 |
| `completeExecution(ctx, success, errorPhase, ...)` | 收尾 |

方法名以 `getOrStart` 开头是有意的——**同一次执行可能被多次进入**
（如工作流的多个步骤），不能每次都新建一条记录。

---

## 5. 事件驱动的采集

追踪采集通过 Spring 事件解耦，业务代码发事件，追踪模块订阅。

```
domain/trace/event/
├── ExecutionStartedEvent      执行开始
├── ExecutionCompletedEvent    执行结束
├── ModelCalledEvent           模型被调用
└── ToolExecutedEvent          工具被执行
        ↓ 发布
ApplicationEventPublisher
        ↓ 订阅
application/trace/listener/TraceEventListener
        ↓
TraceCollector → AgentExecutionTraceDomainService → 落库
```

> **好处**：业务链路不直接依赖追踪模块，追踪逻辑出问题不会拖垮主流程；
> 想关闭追踪只需停掉监听器。
>
> **代价**：事件默认是**同步**的——监听器抛异常会影响发布方，
> 落库慢也会拖慢主链路。见[第 7 节](#7-已知坑与注意事项)。

---

## 6. 统计与查询

```
AgentTraceListRequest         按 Agent 查执行列表
SessionTraceListRequest       按会话查执行列表
QueryExecutionHistoryRequest  查历史

AgentTraceStatisticsDTO       Agent 维度统计
SessionTraceStatisticsDTO     会话维度统计
ExecutionStatisticsDTO        执行统计
TraceDetailResponse           单次执行详情
```

---

## 7. 已知坑与注意事项

### 7.1 Spring 事件默认同步

`@EventListener` 若不加 `@Async`，监听器与发布方**跑在同一个线程**。

这意味着追踪落库的耗时会**直接计入用户可感知的响应时间**，
监听器抛异常还可能中断主流程。

排查对话变慢时，别忘了这条链路也在其中。

### 7.2 ⚠️ 追踪与 ThreadLocal 的组合风险

`TraceCollector` 需要 `userId`。如果在异步线程里通过
`UserContext.getCurrentUserId()` 取，**必得 `null`**——
详见 [用户认证模块 8.1](user-auth.md#81-️-threadlocal-不跨线程传递)。

现有代码把 `userId` 作为参数显式传入 `getOrStartExecution()`，是正确做法。
新增追踪点时保持这个约定。

### 7.3 明细表会持续增长

一次执行产生多条明细，且**没有看到自动清理机制**。
长期运行后 `AgentExecutionDetailEntity` 对应的表会成为最大的表之一。

上线一段时间后需要考虑：分区、归档或 TTL 清理。
可参照 [容器清理服务](mcp-tool.md#5-容器隔离)的做法补一个定时任务。

### 7.4 BALANCE_CHECK 阶段的存在说明计费在执行前

`ExecutionPhase` 里 `BALANCE_CHECK` 排在 `MODEL_CALL` 之前、`BILLING` 在之后——
**先查余额、再调模型、最后扣费**。

如果调用成功但 `BILLING` 阶段失败，会出现「用了但没扣费」。
对账时这是需要专门核查的场景。

---

## 相关文档

- [系统架构](../architecture/overview.md) —— 整体分层
- [Agent 模块](agent.md) —— 被追踪的执行主体
- [对话模块](conversation.md) —— 追踪点所在的主链路
- [用户认证模块](user-auth.md) —— userId 的来源与 ThreadLocal 约束
- [数据库设计](../reference/database.md) —— 追踪表结构
- [性能优化](../operations/performance.md) —— 同步事件对延迟的影响
