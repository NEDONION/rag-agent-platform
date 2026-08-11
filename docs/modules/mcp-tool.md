# MCP 工具模块

> 💬 **一句话人话**：这个模块让用户把一个 GitHub 仓库变成 Agent 能调用的工具。
> 用户提交仓库地址，平台自动拉代码、丢进一个隔离容器里跑起来、问它「你能提供哪些工具」，
> 人工看一眼没问题就上架。之后 Agent 对话时就能调用这些工具了。

本模块覆盖 `tool`（39 个类）与 `container`（25 个类）两个领域，是平台的工具生态基础。

---

## 目录

- [1. 模块职责](#1-模块职责)
- [2. 核心概念](#2-核心概念)
- [3. 分层结构](#3-分层结构)
- [4. 工具上架状态机](#4-工具上架状态机)
- [5. 容器隔离](#5-容器隔离)
- [6. MCP Gateway](#6-mcp-gateway)
- [7. 工具定义与参数转换](#7-工具定义与参数转换)
- [8. 工具市场与用户安装](#8-工具市场与用户安装)
- [9. 已知坑与注意事项](#9-已知坑与注意事项)

---

## 1. 模块职责

| 职责 | 说明 |
| --- | --- |
| **工具接入** | 接收 GitHub 仓库或 ZIP 包，验证、部署、抽取工具定义 |
| **审核流转** | 以状态机驱动从提交到上架的全流程，含人工审核关卡 |
| **容器隔离** | 为审核和用户运行分别提供独立容器，互不影响 |
| **协议网关** | 通过 MCP Gateway 与容器内的 MCP Server 通信 |
| **市场分发** | 已通过审核的工具进入市场，用户可安装到自己的工作区 |

**不负责**：工具在对话中的实际调用编排（见 [Agent 模块](agent.md)）、
模型侧的 function calling 协议（见 [LLM 模块](llm.md)）。

---

## 2. 核心概念

### ToolType — 工具类型

```java
public enum ToolType {
    MCP;   // 目前只支持 MCP 协议工具
}
```

> 枚举里只有一个值，说明当前平台的工具生态**完全押注在 MCP 协议**上。
> 未来若要支持 OpenAPI / 自定义 HTTP 工具，这里是扩展点。

### UploadType — 上传方式

```java
public enum UploadType {
    GITHUB,   // 提交仓库地址，平台去 clone
    ZIP;      // 直接上传压缩包
}
```

### ToolStatus — 审核状态

```java
public enum ToolStatus {
    WAITING_REVIEW,        // 等待审核（入口状态）
    GITHUB_URL_VALIDATE,   // GitHub URL 验证中
    DEPLOYING,             // 部署中
    FETCHING_TOOLS,        // 抽取工具定义中
    MANUAL_REVIEW,         // 人工审核
    APPROVED,              // 已通过（终态）
    FAILED;                // 通用失败（终态）
}
```

### ContainerType 与 ContainerStatus

```java
public enum ContainerType {
    USER,     // 用户容器：承载该用户已安装的工具
    REVIEW;   // 审核容器：临时跑待审工具，用完即弃
}

public enum ContainerStatus {
    CREATING(1), RUNNING(2), STOPPED(3), ERROR(4),
    DELETING(5), DELETED(6), SUSPENDED(7);
}
```

> **为什么要分两种容器**：待审工具是**不可信代码**，不能和用户已信任的工具跑在一起。
> 审核容器是一次性的沙箱，审完就销毁。

---

## 3. 分层结构

```
interfaces/dto/tool/            请求响应 DTO
interfaces/dto/container/
        ↓
application/tool/
  ├── service/ToolAppService                     工具增删改查、市场操作
  ├── service/ToolStateStateMachineAppService    状态机驱动器
  └── service/state/                             六个状态处理器
application/container/
  ├── service/ContainerAppService                容器生命周期
  ├── service/ReviewContainerService             审核容器专用
  ├── service/ContainerMonitorService            健康监控
  └── service/ContainerCleanupService            过期清理
        ↓
domain/tool/                    ToolEntity、ToolVersionEntity、UserToolEntity
domain/container/               ContainerEntity、ContainerTemplateEntity
        ↓
infrastructure/mcp_gateway/     MCPGatewayService
infrastructure/docker/          Docker 操作
infrastructure/github/          GitHubService
```

---

## 4. 工具上架状态机

这是本模块最核心的机制。**每个状态对应一个处理器，处理器声明「我处理哪个状态」和
「成功后进入哪个状态」，驱动器负责串起来。**

### 状态流转

```
   提交工具
      ↓
WAITING_REVIEW          AppWaitingReviewProcessor
      ↓                 （入口，校验基本信息）
GITHUB_URL_VALIDATE     AppGithubUrlValidateProcessor
      ↓                 （验证仓库可达、拉取仓库信息）
   DEPLOYING            AppDeployingProcessor
      ↓                 （创建审核容器，执行安装命令）
FETCHING_TOOLS          AppFetchingToolsProcessor
      ↓                 （连上 MCP Server，listTools 抽取定义）
MANUAL_REVIEW           AppManualReviewProcessor
      ↓                 （人工把关，此处无自动下一状态）
   APPROVED             AppPublishingProcessor
                        （发布到市场）

  任一步失败 → FAILED
```

### 处理器契约

```java
public interface AppToolStateProcessor {
    ToolStatus getStatus();       // 我负责哪个状态
    void process(ToolEntity tool); // 干活，失败抛 BusinessException
    ToolStatus getNextStatus();    // 成功后进入哪个状态，null 表示需外部触发
}
```

`AppManualReviewProcessor` 的 `getNextStatus()` 返回 `null` —— **这是人工审核关卡的实现方式**：
状态机跑到这里就停住，等管理员在后台点「通过」才继续。

### 驱动器

`ToolStateStateMachineAppService` 在 `@PostConstruct` 里把所有处理器注册进
`Map<ToolStatus, AppToolStateProcessor>`，注册时若发现同一状态被重复注册会打 WARN 日志。

处理是**异步**的：

```java
private final ExecutorService executorService;  // 专用线程池

public void submitToolForProcessing(ToolEntity toolEntity) {
    executorService.submit(() -> processToolState(toolEntity));
}
```

线程命名为 `app-tool-state-processor-thread`，便于在线程 dump 里定位。

> ✅ **这里用了专用线程池而非 `ForkJoinPool.commonPool()`**，是正确做法。
> 对比 RAG 流式问答曾经踩过的坑，见
> [排查记录 1.4](../operations/troubleshooting-log.md#14-根因三并发被串行化)。

---

## 5. 容器隔离

### 两类容器的职责

| | 审核容器（REVIEW） | 用户容器（USER） |
| --- | --- | --- |
| 何时创建 | 工具进入 DEPLOYING 时 | 用户首次安装工具时 |
| 生命周期 | 审核结束即销毁 | 长期存在 |
| 跑什么 | **不可信**的待审工具 | 用户已安装的工具 |
| 隔离动机 | 防止恶意代码影响平台 | 租户之间互不干扰 |

### 配套服务

- **`ContainerMonitorService`** —— 定期检查容器健康状态，异常置为 `ERROR`
- **`ContainerCleanupService`** —— 清理已停止/过期容器，回收磁盘
- **`ContainerTemplateEntity`** —— 容器模板，定义镜像、资源限制等创建参数

### 宿主机 Docker 依赖

后端容器挂载了宿主机的 Docker Socket：

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

> ⚠️ **安全影响**：挂载 docker.sock 等同于把宿主机 root 权限交给后端进程。
> 这是容器管理功能的必要代价，但意味着**后端一旦被攻破，宿主机即失守**。
> 生产环境应考虑改用 Docker API over TLS 或 rootless 方案。详见
> [安全实践](../operations/security.md)。

---

## 6. MCP Gateway

`MCPGatewayService` 是平台与容器内 MCP Server 通信的唯一出口。

### 关键方法

| 方法 | 用途 |
| --- | --- |
| `buildUserContainerUrl(name, ip, port)` | 拼接用户容器内 MCP Server 的地址 |
| `buildGlobalSSEUrl(name)` | 拼接全局 SSE 地址 |
| `deployTool(installCommand)` | 在默认容器执行安装命令 |
| `deployTool(cmd, ip, port)` | 在**指定容器**执行安装（审核流程用） |
| `listTools(toolName)` | 向 MCP Server 查询它提供哪些工具 |
| `listToolsFromReviewContainer(name, ip, port)` | 从审核容器查询（隔离路径） |

注意 `deployTool` 和 `listTools` 都有**两个重载**：不带 IP/端口的走默认容器，
带 IP/端口的走指定容器。审核流程必须用后者，否则待审的不可信代码会跑进公共容器。

---

## 7. 工具定义与参数转换

MCP Server 返回的工具定义需要转换成 LangChain4j 能理解的格式，才能交给模型做 function calling。

```
MCP Server
   ↓ listTools()
ToolDefinition          （平台自己的模型）
   ├── ToolParameter
   └── ParameterProperty
   ↓ ToolSpecificationConverter
LangChain4j ToolSpecification
   ↓
交给模型做 function calling
```

`ToolSpecificationConverter` 是这条链路的关键 —— 它把平台的工具描述翻译成模型侧的
函数签名。RAG 检索也走同一套机制，见
`application/conversation/service/message/agent/tool/RagToolSpecification`。

> 💡 **值得注意的设计**：RAG 检索本身被包装成了一个「工具」（`RagToolExecutor` /
> `RagToolManager` / `RagToolSpecification`），和 MCP 工具走同一条调用链。
> 这样 Agent 不需要区分「这是检索」还是「这是外部工具」，统一按 function calling 处理。

---

## 8. 工具市场与用户安装

```
ToolEntity          工具本体（作者提交的那个）
ToolVersionEntity   工具的某个版本（市场里陈列的是版本）
UserToolEntity      某用户安装了某工具的某版本
```

三者关系决定了：**用户安装的是「版本」而非「工具」**，作者发新版不会自动改变已安装用户的行为，
需要用户主动升级。这与 [RAG 知识库的版本快照机制](rag.md) 是同一个设计思路。

---

## 9. 已知坑与注意事项

### 9.1 ToolStatus 里有两个「历史遗留」状态

源码注释明确写着：

```java
DEPLOYING,       // （原）部署中 - 根据新流程，此状态可能调整或移除，暂时保留
FETCHING_TOOLS,  // （原）获取工具中 - 根据新流程，此状态可能调整或移除，暂时保留
```

改动状态机时要留意这两个状态的去留，别当成稳定契约。

### 9.2 `ToolStatus.fromCode()` 找不到时返回 null

```java
public static ToolStatus fromCode(String name) {
    for (ToolStatus status : values()) { ... }
    return null;    // ← 与其他枚举不一致
}
```

同项目里 `ToolType.fromCode()` / `UploadType.fromCode()` **抛 BusinessException**，
只有 `ToolStatus` 返回 `null`。调用方必须判空，否则会在下游变成 NPE，
且报错位置离真实原因很远。

### 9.3 审核容器必须用带 IP/端口的重载

`deployTool(installCommand)` 和 `deployTool(cmd, ip, port)` 长得很像，
**审核流程用错重载会让不可信代码跑进公共容器**。改这块代码时务必确认调用的是哪个。

### 9.4 docker.sock 挂载是权限天花板

见 [第 5 节](#5-容器隔离)。任何关于「工具沙箱有多安全」的讨论，
上限都是「后端进程有宿主机 root」。

---

## 相关文档

- [系统架构](../architecture/overview.md) —— 整体分层与模块边界
- [Agent 模块](agent.md) —— 工具在对话中如何被调用
- [LLM 模块](llm.md) —— function calling 的模型侧
- [RAG 模块](rag.md) —— 检索被包装成工具的实现
- [安全实践](../operations/security.md) —— 容器隔离与权限边界
- [数据库设计](../reference/database.md) —— 工具与容器相关表结构
