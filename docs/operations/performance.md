# 性能优化

> 💬 **一句话人话**：这篇记录「哪里会慢、为什么慢、怎么办」。
> 内容全部来自线上真实遇到的问题，不是通用性能建议清单。

---

## 目录

- [1. 资源边界](#1-资源边界)
- [2. 线程池](#2-线程池)
- [3. 超时分级](#3-超时分级)
- [4. 首字延迟](#4-首字延迟)
- [5. 数据增长](#5-数据增长)
- [6. 水平扩容的阻塞点](#6-水平扩容的阻塞点)
- [7. 排查手册](#7-排查手册)

---

## 1. 资源边界

后端容器：**1.2 CPU / 1536MB 内存 / JVM 堆 768MB**。

这个配额小到会**改变代码行为**，不只是「跑得慢一点」：

```
cpus: "1.2"
    ↓
Runtime.availableProcessors() = 2      （JVM 按 CPU 配额向上取整）
    ↓
ForkJoinPool.commonPool 并行度 = 2 - 1 = 1
```

**任何跑在 commonPool 上的阻塞任务都会被串行化。**
这是理解本项目性能问题的前提。

---

## 2. 线程池

### 现状盘点

| 位置 | 线程池 | 评价 |
| --- | --- | --- |
| `RagQaDatasetAppService` | `newFixedThreadPool(8)` | ✅ 已修复 |
| `PortalAgentSessionController` | `newCachedThreadPool()` | ⚠️ 无界 |
| `ToolStateStateMachineAppService` | 专用池 | ✅ |
| `DelayedTaskQueueManager` | `newFixedThreadPool(5)` | ✅ |

### 已修复：RAG 问答串行化

原代码：

```java
CompletableFuture.runAsync(() -> {
    processRagStreamChat(request, userId, emitter);
});   // ← 无 executor，落到 commonPool
```

commonPool 并行度为 1，而链路里跑的是**纯阻塞 IO**（HTTP 调 LLM）。
ForkJoinPool 只对 `ManagedBlocker` 做线程补偿，普通阻塞调用不补偿。

**结果：全站同一时刻只能有一个 RAG 问答在跑。**

修复为专用线程池：

```java
private final ExecutorService ragStreamExecutor = Executors.newFixedThreadPool(8, runnable -> {
    Thread thread = new Thread(runnable, "rag-stream-chat");
    thread.setDaemon(true);
    return thread;
});
```

> **验证方式**：这个问题**单人测试复现不出来**。
> 必须两个人同时发起 RAG 问答，观察是否互相排队。

### 待改进：无界线程池

```java
// PortalAgentSessionController
private final ExecutorService executorService = Executors.newCachedThreadPool();
```

`newCachedThreadPool()` 没有上限。并发暴涨时会持续创建线程，
在 1.5GB 内存的容器里可能先 OOM 而非降级。

建议改为有界线程池 + 明确的拒绝策略（快速失败并返回「系统繁忙」，
好过 OOM 拖垮整个进程）。

### 规则

> **凡是阻塞 IO，一律显式传入专用线程池。**
> 永远不要用 `CompletableFuture.runAsync(task)` 的无参重载。

---

## 3. 超时分级

超时值必须**按调用性质分级**，一刀切必然一头过松一头过紧。

| 场景 | 变量 | 默认 | 理由 |
| --- | --- | --- | --- |
| 非流式 LLM | `LLM_REQUEST_TIMEOUT_SECONDS` | 60s | 小请求，且卡在 SSE 事件之间 |
| 流式 LLM | `LLM_STREAM_TIMEOUT_SECONDS` | 300s | 允许长，但不能形同虚设 |
| RAG SSE 连接 | 代码常量 | 10min | 兜底 |
| Agent SSE 连接 | `CONNECTION_TIMEOUT` | 10min | 兜底 |
| nginx 回源 | `proxy_read_timeout` | 3600s | 不能早于应用层切断 |

### 历史教训

原代码四处写死 `Duration.ofHours(1)`。**1 小时等同于没有超时**——
上游挂起时请求就挂满一小时，不报错、不降级，用户只看到页面一直转圈。

> **上线后日志里开始出现 LLM 超时异常是好事**，
> 说明上游确实会挂，只是以前被掩盖成了「卡死」。

---

## 4. 首字延迟

用户从提问到看见第一个字，中间的阻塞步骤：

```
用户提问
   ↓
选路（高可用网关）              一次外部 HTTP
   ↓
意图识别 classifyIntent          一次 LLM 调用  ← 阻塞
   ↓
相关性判断                       向量检索
   ↓
语义改写 rewriteQuestion         一次 LLM 调用  ← 阻塞
   ↓
查询扩展 expandQueries           一次 LLM 调用  ← 阻塞
   ↓
向量检索 + rerank                外部 rerank API
   ↓
流式回答开始                     ← 用户终于看到第一个字
```

**最多 4 次串行的外部调用发生在首字之前。**

### 已做的改进

在每步之间补发 SSE 进度事件（「正在理解问题意图…」「正在改写检索查询…」），
用户至少知道进行到哪一步了。

### 可继续优化的方向

| 优化 | 收益 | 代价 |
| --- | --- | --- |
| `expandQueries` 改为可开关 | 省一次 LLM 调用 | 召回率可能下降 |
| 意图识别与相关性判断并行 | 省一次串行等待 | 复杂度上升 |
| 意图识别换更小更快的模型 | 显著 | 需要额外模型配置 |
| 缓存高频问题的改写结果 | 显著 | 需要缓存层 |

> 这几步本身都有 try/catch 降级到原问题，**失败是安全的**。
> 所以「超时后跳过」是可接受的策略——这也是把非流式超时设成 60s 的底气。

---

## 5. 数据增长

| 数据 | 增长模式 | 现状 |
| --- | --- | --- |
| 执行追踪明细 | 一次执行 N 条 | ⚠️ **未见清理机制** |
| 消息记录 | 一次对话 N 条 | 只增不删 |
| 向量数据 | 随知识库线性增长 | PGVector |
| 容器 | 有清理 | ✅ `ContainerCleanupService` |
| 镜像 | CI 每次 `docker image prune -f` | ✅ |

**执行追踪明细表**会成为增长最快的表之一。上线一段时间后需要考虑
分区、归档或 TTL 清理。可参照 `ContainerCleanupService` 的做法补定时任务。

---

## 6. 水平扩容的阻塞点

当前**只能单实例部署**，有两个硬阻塞：

| 阻塞点 | 位置 | 多实例后果 |
| --- | --- | --- |
| 验证码内存存储 | `MemoryCodeStorage` | A 实例发的码，B 实例校验失败 |
| 定时任务内存队列 | `DelayedTaskQueueManager` | 每个实例都装载全部任务，**重复执行 N 次** |

两处都已有抽象接口，改造路径清晰：

- 验证码 → 补一个 Redis 版 `CodeStorage` 实现
- 定时任务 → 引入分布式锁，或换 XXL-JOB / Quartz 集群模式

---

## 7. 排查手册

### 「页面一直转圈」

1. 看后端日志有无该请求的 LLM 超时异常
2. 看卡在哪个 SSE 事件——最后一条事件之后的那个步骤就是嫌疑
3. 确认 nginx `/api/` 段有 `proxy_http_version 1.1`（缺失会导致 SSE 传不动）

### 「有时候快有时候慢」

优先怀疑**并发排队**，而非模型本身慢：

```bash
# 看线程状态，找大量 WAITING 在同一个池上的线程
docker compose exec backend jstack 1 | grep -A5 "rag-stream-chat"
```

### 「延迟是个整数」

10 分钟、60 秒这种整数级延迟**几乎必然是某个超时或重试到点了**，
不是模型慢。直接去查超时配置。

### 常用命令

```bash
# 容器资源占用
docker stats --no-stream

# 后端堆内存
docker compose exec backend jcmd 1 GC.heap_info

# 慢请求日志
docker compose logs backend | grep -E "耗时|timeout|TimeoutException"
```

---

## 相关文档

- [排查记录](troubleshooting-log.md) —— 完整的问题现场与推理过程
- [部署指南](deployment.md) —— 资源配额与环境变量
- [对话模块](../modules/conversation.md) —— 主链路
- [RAG 模块](../modules/rag.md) —— 检索链路
- [LLM 模块](../modules/llm.md) —— 超时与降级
- [执行追踪模块](../modules/trace.md) —— 数据增长与同步事件开销
