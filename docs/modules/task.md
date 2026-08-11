# 任务与调度模块

> 💬 **一句话人话**：两件事。一是 Agent 干活时把大任务拆成小任务、逐个跟踪进度；
> 二是定时任务——让 Agent 每天早上九点、或者每周一自动跑一次。

本模块覆盖 `task`（9 类，工作流任务）与 `scheduledtask`（12 类，定时调度）。
两者名字相近但**职责完全不同**，别搞混。

---

## 目录

- [1. 两个 task 的区别](#1-两个-task-的区别)
- [2. 工作流任务](#2-工作流任务)
- [3. 定时任务](#3-定时任务)
- [4. 重复规则](#4-重复规则)
- [5. 延迟队列实现](#5-延迟队列实现)
- [6. 已知坑与注意事项](#6-已知坑与注意事项)

---

## 1. 两个 task 的区别

| | `domain/task` | `domain/scheduledtask` |
| --- | --- | --- |
| **中文名** | 工作流任务 | 定时任务 |
| **来源** | Agent 把用户请求拆分出来的子任务 | 用户配置的周期性计划 |
| **生命周期** | 一次对话内 | 跨越多次执行，长期存在 |
| **状态** | `WAITING / IN_PROGRESS / COMPLETED` | `ACTIVE / PAUSED / COMPLETED` |
| **触发方式** | 由工作流推进 | 由延迟队列到点触发 |

---

## 2. 工作流任务

```
TaskEntity        单个子任务
TaskAggregate     任务聚合根
TaskStatus        WAITING → IN_PROGRESS → COMPLETED
```

由[对话模块的 Agent 工作流](conversation.md#7-agent-工作流)驱动：

```
TaskSplitHandler        拆分 → 创建多个 TaskEntity
        ↓
TaskManager             管理任务集合
        ↓
TaskExecutionHandler    逐个执行，更新状态
        ↓
SummarizeHandler        汇总所有结果
```

每个任务状态变化都会通过 SSE 推给前端
（`TASK_STATUS_TO_LOADING` / `TASK_STATUS_TO_FINISH`），前端渲染成任务清单。

---

## 3. 定时任务

```
ScheduledTaskEntity          定时任务定义
├── RepeatConfig             重复规则
└── ScheduleTaskStatus       ACTIVE / PAUSED / COMPLETED

ScheduledTaskExecutionService   对外的管理接口
├── scheduleTask()              新建
├── cancelTask() / cancelTasks()
├── rescheduleTask()            重排
├── pauseTask() / resumeTask()
├── deleteTask()
├── deleteTasksBySessionId()    会话删除时级联
└── deleteTasksByAgentId()      Agent 删除时级联

TaskScheduleService             时间计算
├── calculateNextExecuteTime()
└── shouldExecuteAt()

ScheduleTaskExecutor            实际执行
├── canExecute()
└── executeTask()               发布 ScheduledTaskExecuteEvent
```

`deleteTasksBySessionId` / `deleteTasksByAgentId` 的存在说明
**定时任务与会话、Agent 是级联关系**——删除会话或 Agent 时必须清理其定时任务，
否则会留下指向不存在对象的僵尸任务。

---

## 4. 重复规则

```java
public enum RepeatType {
    NONE,        // 单次
    DAILY,       // 每天
    WEEKLY,      // 每周
    MONTHLY,     // 每月
    WORKDAYS,    // 工作日
    CUSTOM       // 自定义间隔
}
```

`RepeatConfig` 的字段按类型各取所需：

| 字段 | 用于 |
| --- | --- |
| `executeDateTime` | `NONE` 单次执行时间 |
| `weekdays` | `WEEKLY` 一周中的哪几天 |
| `monthDay` | `MONTHLY` 每月几号 |
| `interval` + `timeUnit` | `CUSTOM` 自定义间隔 |
| `executeTime` | 每天的具体时刻 |
| `endDateTime` | 重复截止时间 |

> **`WORKDAYS` 的隐患**：工作日判定通常只按周一至周五，
> **不含法定节假日和调休**。国内场景下这可能不符合用户预期。

---

## 5. 延迟队列实现

`DelayedTaskQueueManager` 用 JDK 的 `DelayQueue` 实现到点触发。

```java
private final DelayQueue<DelayedTaskItem> delayQueue = new DelayQueue<>();
private Thread consumerThread;      // 单线程消费
private ExecutorService executorService;   // 5 线程执行

@PostConstruct
public void init() {
    this.executorService = Executors.newFixedThreadPool(5, r -> {
        Thread t = new Thread(r, "scheduled-task-executor-");
        ...
    });
    // 启动 consumerThread（daemon）
}

@PreDestroy
public void destroy() {
    consumerThread.interrupt();
    ...
}
```

### 工作方式

```
ScheduledTaskExecutionService.scheduleTask()
        ↓ 算出下次执行时间
queueManager.addTask(task, nextExecuteTime)
        ↓
DelayQueue（按到期时间排序）
        ↓ 到点，consumerThread 取出
executorService（5 线程）
        ↓
ScheduleTaskExecutor.executeTask()
        ↓ 发布事件
ScheduledTaskExecuteEvent → 触发 Agent 执行
```

### 重启恢复

```java
@PostConstruct
public void init() {
    loadActiveTasksToQueue();
}
```

`ScheduledTaskExecutionService` 启动时会把库里所有 `ACTIVE` 任务重新装载进队列，
**所以重启不会丢任务**。这一点比[验证码模块](user-auth.md#5-验证码机制)做得好。

---

## 6. 已知坑与注意事项

### 6.1 ⚠️ 多实例部署会重复执行

`DelayQueue` 是**进程内**的。每个后端实例启动时都会
`loadActiveTasksToQueue()` 装载**全部** ACTIVE 任务。

**部署 N 个实例，每个定时任务就会被执行 N 次。**

当前单实例部署没问题，但这是水平扩容的**硬阻塞点**——
与[验证码的内存存储](user-auth.md#82-验证码无法多实例部署)并列。

要多实例必须先引入分布式锁或专门的调度中间件
（数据库悲观锁、Redis 锁、或 XXL-JOB / Quartz 集群模式）。

### 6.2 执行线程池固定 5 个

```java
Executors.newFixedThreadPool(5, ...)
```

同一时刻最多 5 个定时任务并行。而定时任务往往会触发 Agent 执行
（内含 LLM 调用，可能耗时数十秒）。

**如果同一时刻有大量任务到期，会排队**。在 1.2 CPU 的容器里，
5 个并发的 LLM 等待是合理的（都在等 IO 不占 CPU），但任务量增长后需要重新评估。

### 6.3 消费线程是 daemon

```java
consumerThread.setDaemon(true);
```

daemon 线程不阻止 JVM 退出。配合 `@PreDestroy` 里的 `interrupt()`，
**关停时正在执行的任务可能被中断**。

任务本身需要保证幂等——被中断的任务重启后会重新装载执行。

### 6.4 两个 Task 同名易混淆

`domain/task` 与 `domain/scheduledtask` 下都有 "Task" 概念，
`TaskEntity` 与 `ScheduledTaskEntity`、`TaskDomainService` 与
`ScheduledTaskDomainService` 长得很像。

阅读代码时先确认包名，别把工作流任务和定时任务搞混。

---

## 相关文档

- [系统架构](../architecture/overview.md) —— 整体分层
- [对话模块](conversation.md) —— 工作流任务的驱动方
- [Agent 模块](agent.md) —— 定时任务触发的执行主体
- [用户认证模块](user-auth.md) —— 另一处内存存储的扩容限制
- [性能优化](../operations/performance.md) —— 线程池配置
- [数据库设计](../reference/database.md) —— 任务表结构
