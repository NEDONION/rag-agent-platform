# 系统架构设计文档

## 目录

- [概述](#概述)
- [整体架构](#整体架构)
- [技术栈详解](#技术栈详解)
- [DDD 分层架构](#ddd-分层架构)
- [核心设计模式](#核心设计模式)
- [数据流转](#数据流转)
- [高可用设计](#高可用设计)
- [扩展性设计](#扩展性设计)

---

## 概述

RAG Agent Platform 采用**领域驱动设计（DDD）**的四层架构，结合**微服务**思想，实现了一个高内聚、低耦合的企业级 SaaS 平台。

### 核心设计理念

1. **领域驱动**: 业务逻辑集中在领域层，清晰的领域模型
2. **分层解耦**: 严格的分层架构，上层依赖下层，避免循环依赖
3. **策略模式**: 文档处理、模型调用均采用策略模式，易于扩展
4. **状态机驱动**: 文件处理、Agent 执行采用状态机模式
5. **事件驱动**: 异步消息队列实现模块解耦
6. **多租户隔离**: 完整的数据隔离和权限控制

---

## 整体架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            前端层 (Frontend)                              │
│                     Next.js 15 + React 19 + SSR                          │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Agent 市场   │  │ 知识库管理   │  │ 对话界面     │  │ 设置中心    │ │
│  │ & 工作区     │  │ & 文件上传   │  │ & 流式输出   │  │ & 模型配置  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                    ↓ HTTP / WebSocket / SSE
┌─────────────────────────────────────────────────────────────────────────┐
│                           网关层 (Gateway)                                │
│                       Nginx / Spring Cloud Gateway                       │
├─────────────────────────────────────────────────────────────────────────┤
│  - 路由转发    - 负载均衡    - 限流熔断    - 认证鉴权                     │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          接口层 (Interfaces)                              │
│                        REST API + WebSocket                              │
├─────────────────────────────────────────────────────────────────────────┤
│  @RestController  │  @WebSocketHandler  │  DTO Mapping  │  参数验证      │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          应用层 (Application)                             │
│                     应用服务 - 编排领域服务                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Agent        │  │ RAG          │  │ LLM          │  │ User        │ │
│  │ AppService   │  │ AppService   │  │ AppService   │  │ AppService  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│  - 事务管理    - 流程编排    - 数据转换    - 异常处理                     │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                           领域层 (Domain)                                 │
│                 领域服务 + 领域实体 + 业务规则                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ Agent Domain    │  │ RAG Domain      │  │ LLM Domain      │         │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤         │
│  │ - Service       │  │ - Service       │  │ - Service       │         │
│  │ - Entity        │  │ - Entity        │  │ - Entity        │         │
│  │ - Repository    │  │ - Strategy      │  │ - Repository    │         │
│  │ - Consumer      │  │ - Consumer      │  │                 │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
│  设计模式: 策略模式 + 状态机 + 工厂模式 + 观察者模式                        │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       基础设施层 (Infrastructure)                          │
│                    技术实现 + 外部服务集成                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ PostgreSQL   │  │ RabbitMQ     │  │ PGVector     │  │ S3/七牛云   │ │
│  │ (MyBatis-    │  │ (消息队列)   │  │ (向量数据库) │  │ (对象存储)  │ │
│  │  Plus)       │  │              │  │              │  │             │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ LangChain4j  │  │ Docker       │  │ Apache Tika  │  │ JWT Auth    │ │
│  │ (LLM 框架)   │  │ (容器管理)   │  │ (文档处理)   │  │ (认证鉴权)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 模块交互图

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Agent   │────→│ RAG     │────→│ LLM     │────→│ MCP     │
│ Module  │     │ Module  │     │ Module  │     │ Tool    │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │
     └───────────────┴───────────────┴───────────────┘
                          │
                     ┌────┴────┐
                     │ Message │
                     │  Queue  │
                     └─────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────┴────┐     ┌────┴────┐     ┌────┴────┐
    │ OCR     │     │ Vector  │     │ Agent   │
    │Consumer │     │Consumer │     │Consumer │
    └─────────┘     └─────────┘     └─────────┘
```

---

## 技术栈详解

### 后端技术栈

#### 核心框架

```
Spring Boot 3.2.3
├─ Spring Web MVC      # REST API
├─ Spring Data JPA     # 数据访问（未使用，使用 MyBatis-Plus）
├─ Spring AMQP         # RabbitMQ 集成
├─ Spring WebSocket    # WebSocket 支持
├─ Spring Security     # 安全框架（未启用）
└─ Spring Validation   # 参数验证
```

#### 数据访问

```
MyBatis-Plus 3.5.11
├─ Lambda 查询        # 类型安全的查询
├─ 分页插件           # 自动分页
├─ 多租户插件         # TenantLineHandler
├─ 乐观锁插件         # Version 字段
└─ 逻辑删除           # deleted_at 字段
```

#### AI 框架

```
LangChain4j 1.0.4.3-beta7
├─ ChatLanguageModel   # LLM 聊天模型
├─ EmbeddingModel      # 向量嵌入模型
├─ EmbeddingStore      # 向量存储（PGVector）
├─ AiServices          # AI 服务代理
└─ Tools               # Function Calling
```

#### 消息队列

```
RabbitMQ 5.21.0
├─ Direct Exchange     # 点对点消息
├─ Topic Exchange      # 主题订阅
├─ 消费者确认机制      # Manual Ack
├─ 重试机制            # 最多 3 次
└─ 死信队列            # DLX
```

### 前端技术栈

#### 核心框架

```
Next.js 15.1.0
├─ App Router          # 文件路由
├─ Server Components   # 服务端组件
├─ Server Actions      # 服务端操作
├─ SSR/SSG            # 服务端渲染/静态生成
└─ API Routes         # API 路由
```

#### UI 组件

```
Radix UI + Tailwind CSS
├─ Dialog              # 对话框
├─ Dropdown            # 下拉菜单
├─ Select              # 选择器
├─ Tabs                # 标签页
└─ Toast               # 提示消息
```

---

## DDD 分层架构

### 分层职责

#### 1. 接口层 (Interfaces)

**职责**:
- 接收 HTTP 请求
- 数据转换（Entity → DTO）
- 参数验证
- 异常处理

**代码示例**:

```java
@RestController
@RequestMapping("/api/agents")
public class AgentController {

    private final AgentAppService agentAppService;

    @PostMapping
    public Result<AgentDTO> createAgent(@RequestBody @Valid CreateAgentRequest request) {
        // 1. 参数验证（@Valid）
        // 2. 调用应用服务
        AgentDTO agentDTO = agentAppService.createAgent(request);
        // 3. 返回响应
        return Result.success(agentDTO);
    }
}
```

#### 2. 应用层 (Application)

**职责**:
- 编排领域服务
- 事务管理
- 应用逻辑
- 数据转换（DTO → Entity）

**代码示例**:

```java
@Service
public class AgentAppService {

    private final AgentDomainService agentDomainService;
    private final ToolDomainService toolDomainService;

    @Transactional
    public AgentDTO createAgent(CreateAgentRequest request) {
        // 1. 创建 Agent 实体
        AgentEntity agent = agentDomainService.createAgent(
            request.getName(),
            request.getSystemPrompt()
        );

        // 2. 绑定工具（编排多个领域服务）
        if (request.getToolIds() != null) {
            toolDomainService.bindToolsToAgent(agent.getId(), request.getToolIds());
        }

        // 3. 转换为 DTO
        return AgentAssembler.toDTO(agent);
    }
}
```

#### 3. 领域层 (Domain)

**职责**:
- 核心业务逻辑
- 领域实体
- 领域服务
- 业务规则

**代码示例**:

```java
@Service
public class AgentDomainService {

    private final AgentRepository agentRepository;

    public AgentEntity createAgent(String name, String systemPrompt) {
        // 1. 业务规则校验
        if (!isValidAgentName(name)) {
            throw new BusinessException("Agent 名称不合法");
        }

        // 2. 创建领域实体
        AgentEntity agent = new AgentEntity();
        agent.setName(name);
        agent.setSystemPrompt(systemPrompt);
        agent.setEnabled(true);

        // 3. 保存
        agentRepository.insert(agent);

        return agent;
    }

    private boolean isValidAgentName(String name) {
        return name != null && name.length() >= 2 && name.length() <= 100;
    }
}
```

#### 4. 基础设施层 (Infrastructure)

**职责**:
- 数据访问实现
- 外部服务集成
- 技术实现

**代码示例**:

```java
@Repository
public class AgentRepositoryImpl implements AgentRepository {

    @Resource
    private AgentMapper agentMapper;

    @Override
    public void insert(AgentEntity agent) {
        agentMapper.insert(agent);
    }

    @Override
    public AgentEntity selectById(String id) {
        return agentMapper.selectById(id);
    }
}
```

### 依赖关系

```
Interfaces ──→ Application ──→ Domain ──→ Infrastructure
                                 ↑              │
                                 └──────────────┘
```

**规则**:
- 上层可以依赖下层
- 下层不能依赖上层
- 领域层通过接口（Repository）依赖基础设施层

---

## 核心设计模式

### 1. 策略模式 (Strategy Pattern)

**应用场景**: 文档处理（PDF/WORD/TXT 不同策略）

```java
// 策略接口
public interface RagDocSyncOcrStrategy {
    void handle(RagDocSyncOcrMessage message, String strategy);
    void pushPageSize(byte[] bytes, RagDocSyncOcrMessage message);
    byte[] getFileData(RagDocSyncOcrMessage message, String strategy);
    Map<Integer, String> processFile(byte[] fileBytes, int totalPages);
}

// PDF 策略
@Service("ragDocSyncOcr-PDF")
public class PDFRagDocSyncOcrStrategyImpl implements RagDocSyncOcrStrategy {
    @Override
    public Map<Integer, String> processFile(byte[] fileBytes, int totalPages) {
        // PDF 特定处理逻辑
    }
}

// WORD 策略
@Service("ragDocSyncOcr-WORD")
public class WORDRagDocSyncOcrStrategyImpl implements RagDocSyncOcrStrategy {
    @Override
    public Map<Integer, String> processFile(byte[] fileBytes, int totalPages) {
        // WORD 特定处理逻辑
    }
}

// 策略上下文
@Component
public class RagDocSyncOcrContext {
    @Resource
    private Map<String, RagDocSyncOcrStrategy> strategyMap;  // Spring 自动注入

    public RagDocSyncOcrStrategy getTaskExportStrategy(String fileType) {
        return strategyMap.get("ragDocSyncOcr-" + fileType);
    }
}
```

### 2. 状态机模式 (State Machine Pattern)

**应用场景**: 文件处理状态转换

```java
// 状态处理器接口
public interface FileProcessingStateProcessor {
    boolean canHandle(FileProcessingEventEnum event);
    FileProcessingStatusEnum handle(String fileId, String userId, FileProcessingEventEnum event);
    FileProcessingStatusEnum currentState();
}

// OCR 完成状态处理器
@Component
public class OcrCompletedStateProcessor implements FileProcessingStateProcessor {
    @Override
    public boolean canHandle(FileProcessingEventEnum event) {
        return event == FileProcessingEventEnum.START_EMBEDDING;
    }

    @Override
    public FileProcessingStatusEnum handle(String fileId, String userId, FileProcessingEventEnum event) {
        if (event == FileProcessingEventEnum.START_EMBEDDING) {
            return FileProcessingStatusEnum.EMBEDDING_PROCESSING;
        }
        throw new IllegalStateException("Cannot handle event: " + event);
    }

    @Override
    public FileProcessingStatusEnum currentState() {
        return FileProcessingStatusEnum.OCR_COMPLETED;
    }
}

// 状态机服务
@Service
public class FileProcessingStateMachineService {
    private final Map<FileProcessingStatusEnum, FileProcessingStateProcessor> stateProcessors;

    public boolean handleEvent(String fileId, String userId, FileProcessingEventEnum event) {
        // 1. 获取当前状态
        FileDetailEntity file = fileDetailRepository.selectById(fileId);
        FileProcessingStatusEnum currentStatus = FileProcessingStatusEnum.fromCode(file.getProcessingStatus());

        // 2. 获取状态处理器
        FileProcessingStateProcessor processor = stateProcessors.get(currentStatus);

        // 3. 检查是否可以处理
        if (!processor.canHandle(event)) {
            return false;
        }

        // 4. 执行状态转换
        FileProcessingStatusEnum nextStatus = processor.handle(fileId, userId, event);

        // 5. 更新数据库
        fileDetailRepository.update(fileId, nextStatus);

        return true;
    }
}
```

### 3. 工厂模式 (Factory Pattern)

**应用场景**: Embedding 模型创建

```java
@Component
public class EmbeddingModelFactory {

    public OpenAiEmbeddingModel createEmbeddingModel(EmbeddingConfig config) {
        return OpenAiEmbeddingModel.builder()
                .apiKey(config.getApiKey())
                .baseUrl(config.getBaseUrl())
                .modelName(config.getModelId())
                .build();
    }

    public static class EmbeddingConfig {
        private String apiKey;
        private String baseUrl;
        private String modelId;

        // getters and setters
    }
}
```

### 4. 观察者模式 (Observer Pattern)

**应用场景**: 事件驱动（Spring ApplicationEvent）

```java
// 事件定义
public class RagDocSyncStorageEvent<T> extends ApplicationEvent {
    private final T data;
    private final EventType eventType;

    public RagDocSyncStorageEvent(T data, EventType eventType) {
        super(data);
        this.data = data;
        this.eventType = eventType;
    }
}

// 事件发布
@Service
public class RagDocOcrConsumer {
    @Resource
    private ApplicationEventPublisher eventPublisher;

    public void autoStartVectorization(String fileId, FileDetailEntity file) {
        // 发布向量化事件
        RagDocSyncStorageMessage message = new RagDocSyncStorageMessage();
        message.setFileId(fileId);
        eventPublisher.publishEvent(new RagDocSyncStorageEvent<>(message, EventType.DOC_SYNC_RAG));
    }
}

// 事件监听
@Component
public class RagDocSyncStorageEventListener {
    @EventListener
    public void onStorageEvent(RagDocSyncStorageEvent<?> event) {
        // 处理向量化事件
        // 发送到 RabbitMQ
    }
}
```

---

## 数据流转

### 1. 文档上传到向量化流程

```
用户上传文件 (Frontend)
    ↓ HTTP POST /api/rag/upload
FileOperationAppService.uploadFile()
    ↓ 上传到对象存储
    ↓ 创建 file_detail 记录
    ↓ 发送 RagDocSyncOcrEvent
RabbitMQ
    ↓ 消费 OCR 消息
RagDocOcrConsumer.receiveMessage()
    ↓ 选择 OCR 策略
PDFRagDocSyncOcrStrategyImpl.processFile()
    ↓ Vision LLM 识别
    ↓ 保存 document_unit
    ↓ 发送 RagDocSyncStorageEvent
RabbitMQ
    ↓ 消费向量化消息
RagDocStorageConsumer.receiveMessage()
    ↓ 调用 Embedding 模型
    ↓ 存储到 PGVector
完成
```

### 2. Agent 对话流程

```
用户发送消息 (Frontend)
    ↓ WebSocket / SSE
AgentChatController.chat()
    ↓
AgentChatAppService.streamChat()
    ↓ 查询 Agent 配置
    ↓ 获取知识库 RAG
    ↓ 向量检索相关文档
    ↓ 构建提示词
    ↓ 调用 LLM (LangChain4j)
    ↓ 工具调用 (MCP)
    ↓ 流式返回结果
    ↓ 记录执行链路
完成
```

---

## 高可用设计

### 1. 模型高可用

```
主模型调用
    ↓ 失败
检查平替模型
    ↓ 存在
切换到平替模型
    ↓ 成功
记录降级日志
返回结果
```

### 2. 消息队列高可用

```
消费者处理消息
    ↓ 异常
手动 NACK
    ↓
消息重新入队
    ↓ 重试 (最多 3 次)
进入死信队列
人工处理
```

### 3. 数据库高可用

```
- 主从复制
- 读写分离
- 连接池配置
- 慢查询监控
```

---

## 扩展性设计

### 1. 水平扩展

- **无状态服务**: 应用服务无状态，可水平扩展
- **负载均衡**: Nginx / Spring Cloud Gateway
- **会话共享**: Redis Session

### 2. 垂直扩展

- **模块化设计**: 各模块独立，可拆分为微服务
- **数据库分库分表**: 按用户 ID 分片
- **消息队列集群**: RabbitMQ 集群

---

## 总结

RAG Agent Platform 通过 DDD 分层架构、设计模式和事件驱动，实现了一个高内聚、低耦合、易扩展的企业级 SaaS 平台。

**核心优势**:

1. **清晰的分层**: 业务逻辑集中在领域层
2. **灵活的策略**: 文档处理、模型调用均可扩展
3. **可靠的状态机**: 文件处理状态转换清晰
4. **异步解耦**: 消息队列实现模块解耦
5. **高可用**: 模型降级、消息重试、数据库主从

**后续演进方向**:

1. **微服务拆分**: 将各模块拆分为独立微服务
2. **服务治理**: 引入 Spring Cloud / Dubbo
3. **分布式追踪**: 引入 SkyWalking / Zipkin
4. **配置中心**: 引入 Nacos / Apollo
5. **缓存优化**: 引入 Redis 缓存热点数据
