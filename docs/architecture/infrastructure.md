# 基础设施层

> 💬 **一句话人话**：这一层是「脏活累活」的集合——连数据库、发消息队列、传文件到对象存储、
> 发邮件、调 GitHub、加解密、拦截请求。业务代码不该关心这些细节，都封装在这里。

对应 `src/main/java/org/lucas/infrastructure/`，共 19 个子包。

---

## 目录

- [1. 组件全景](#1-组件全景)
- [2. 消息队列](#2-消息队列)
- [3. 对象存储与文件](#3-对象存储与文件)
- [4. 传输层抽象](#4-传输层抽象)
- [5. 类型转换器](#5-类型转换器)
- [6. 加密与工具类](#6-加密与工具类)
- [7. 拦截器与异常](#7-拦截器与异常)
- [8. 外部集成](#8-外部集成)
- [9. 已知坑与注意事项](#9-已知坑与注意事项)

---

## 1. 组件全景

| 子包 | 职责 | 关键类 |
| --- | --- | --- |
| `mq` | RabbitMQ 收发 | `MyRabbitmqConfig`、`MQPushListener` |
| `storage` | 对象存储上传 | `OssUploadService` |
| `email` | 邮件发送 | `EmailService` |
| `github` | GitHub 集成 | `GitHubService`、`GitHubUrlParser` |
| `docker` | 容器操作 | `DockerService` |
| `mcp_gateway` | MCP 协议网关 | `MCPGatewayService` |
| `transport` | 对话传输抽象 | `SseMessageTransport`、`SyncMessageTransport` |
| `llm` | 模型客户端工厂 | `LLMProviderFactory`、`LLMServiceFactory` |
| `rag` | 向量与嵌入 | 嵌入模型工厂、配置 |
| `highavailability` | 高可用网关客户端 | `HighAvailabilityGatewayImpl` |
| `auth` | 鉴权上下文与拦截器 | `UserContext`、`UserAuthInterceptor` |
| `interceptor` | 管理端鉴权 | `AdminAuthInterceptor` |
| `verification` | 验证码 | `CaptchaUtils`、`VerificationCodeService` |
| `converter` | MyBatis 类型转换 | 12 个 Converter |
| `entity` | 持久化实体基类 | — |
| `repository` | 仓储实现 | — |
| `config` | Spring 配置 | `WebConfig`、`MybatisPlusConfig` 等 |
| `exception` | 业务异常 | `BusinessException` 等 5 个 |
| `utils` | 通用工具 | `JwtUtils`、`JsonUtils` 等 |

---

## 2. 消息队列

```
infrastructure/mq/
├── configure/MyRabbitmqConfig        队列、交换机、绑定声明
├── configure/MyRabbitmqProperties    连接配置
├── enums/EventType                   事件类型
├── events/RagDocSyncOcrEvent         文档 OCR 事件
├── events/RagDocSyncStorageEvent     文档存储事件
├── listener/MQPushListener           消费者
├── model/MQSendEventModel            单播消息模型
├── model/MQFanoutSendEventModel      广播消息模型
├── model/MqMessage
└── utils/RabbitMQUtils
```

当前 MQ **主要服务于 RAG 文档处理链路**：文档上传后异步做 OCR 和向量化，
避免阻塞用户请求。详见 [RAG 模块](../modules/rag.md)。

`docker-compose.yml` 里 RabbitMQ 限制 512MB 内存 / 0.3 CPU，
后端的健康检查依赖它 `service_healthy` 后才启动。

---

## 3. 对象存储与文件

`OssUploadService` 对接 S3 兼容存储（配置指向七牛云）。相关环境变量：

```
S3_SECRET_ID / S3_SECRET_KEY / S3_REGION
S3_ENDPOINT / S3_BUCKET_NAME / S3_DOMAIN
```

用户上传的知识库原始文档存在这里，数据库只存元数据和向量。

---

## 4. 传输层抽象

```java
public interface MessageTransport<T> {
    T createConnection(long timeout);
    void sendMessage(T connection, AgentChatResponse response);
    void completeConnection(T connection);
}
```

| 实现 | 连接类型 | 用途 |
| --- | --- | --- |
| `SseMessageTransport` | `SseEmitter` | 流式对话 |
| `SyncMessageTransport` | `ChatResponse` | 同步返回 |

这个抽象让[对话模块](../modules/conversation.md#4-消息处理器体系)的主流程
不必区分流式与同步。

---

## 5. 类型转换器

12 个 MyBatis `TypeHandler`，负责实体字段与数据库列之间的转换：

| 转换器 | 用途 |
| --- | --- |
| `JsonConverter` / `JsonToStringConverter` | 对象 ↔ JSON 列 |
| `ListConverter` / `ListStringConverter` | 集合 ↔ 列 |
| `ContainerStatusConverter` / `ContainerTypeConverter` | 容器枚举 ↔ 码值 |
| `InstallTypeConverter` | 安装类型枚举 |
| `LLMModelConfigConverter` | 模型配置 JSON |
| **`ProviderConfigConverter`** | **服务商配置——加密存储** |

`ProviderConfigConverter` 与众不同：它在写库前加密、读库后解密，
是唯一涉及加密的转换器，实现见 `ConfigCrypto`。

---

## 6. 加密与工具类

```
utils/
├── ConfigCrypto              敏感配置加解密（AES/GCM，密钥来自环境变量）
├── JwtUtils                  JWT 签发与校验
├── JsonUtils                 JSON 序列化
├── PasswordUtils             密码哈希
├── ValidationUtils           参数校验
└── ModelResponseToJsonUtils  模型响应解析
```

---

## 7. 拦截器与异常

### 拦截器

| 拦截器 | 作用范围 |
| --- | --- |
| `UserAuthInterceptor` | 网页用户 JWT 校验 |
| `ExternalApiKeyInterceptor` | 外部 API Key 校验 |
| `AdminAuthInterceptor` | 管理端接口 |

三者均在 `WebConfig` / `WebMvcConfig` 中注册路径规则。

### 业务异常

```
BusinessException              通用业务异常
├── EntityNotFoundException    实体不存在
├── InsufficientBalanceException  余额不足
├── ParamValidationException   参数校验失败
└── RateLimitException         限流
```

---

## 8. 外部集成

| 组件 | 用途 |
| --- | --- |
| `GitHubService` | 拉取仓库信息，供 MCP 工具上架流程使用 |
| `GitHubUrlParser` | 解析 GitHub URL |
| `DockerService` | 创建/启动/停止容器 |
| `EmailService` | 发送验证码邮件，配置走 `MAIL_SMTP_*` |
| `HighAvailabilityGatewayImpl` | 调用外部高可用网关选路 |

---

## 9. 已知坑与注意事项

### 9.1 ✅ 服务商 API Key 的加密（已重写）

历史上这里有一个严重问题：`ValidationUtils.EncryptUtils` 用硬编码密钥
`"1234567890123456"` 加 ECB 模式加密服务商配置，而仓库是公开的——加密形同虚设。

现已替换为 `ConfigCrypto`：

```java
public static final String KEY_ENV = "CONFIG_ENCRYPTION_KEY";   // 环境变量注入，无默认值
private static final String TRANSFORMATION = "AES/GCM/NoPadding";
private static final int IV_LENGTH = 12;          // 每条记录随机 IV
private static final int TAG_LENGTH_BITS = 128;   // 认证标签
```

密文格式为 `v2:` + Base64(IV ‖ 密文+标签)。不带前缀的旧密文仍可解密，
写入时一律转为新格式，因此存量数据会随使用逐步迁移；
也可用 `CONFIG_CRYPTO_MIGRATE=true` 一次性迁移。

`ValidationUtils.EncryptUtils` 与 `ConfigEncryptor` 均已删除。

> ⚠️ **加密方式修好了，不等于旧密钥安全了**。存量 API Key 应视为已泄露，
> 需通知用户轮换。详见[安全实践](../operations/security.md#-已修复p0服务商-api-key-的加密密钥硬编码在公开仓库中)。

### 9.2 ✅ 两套 AES 实现已清理

`ConfigEncryptor`（零调用死代码，硬编码 `"AgentX-Config-Key"`）与
`ValidationUtils.EncryptUtils` 都已删除，现在只保留 `ConfigCrypto` 一套实现。

### 9.3 ✅ `getNullableResult(ResultSet, int)` 已实现

此前三个重载中按**列索引**取值的那个直接 `return null`，
导致该路径静默拿到空配置而非报错，表现为「服务商配置突然为空」且无异常。
现已与按列名取值行为保持一致。

### 9.4 验证码仅内存实现，阻塞水平扩容

见 [用户认证模块第 5 节](../modules/user-auth.md#5-验证码机制)。
与[定时任务的内存队列](../modules/task.md#61-️-多实例部署会重复执行)并列，
是当前架构无法多实例部署的两个原因。

---

## 相关文档

- [系统架构](overview.md) —— 整体分层与依赖方向
- [安全实践](../operations/security.md) —— 完整的安全清单
- [LLM 模块](../modules/llm.md) —— 服务商配置的业务侧
- [RAG 模块](../modules/rag.md) —— MQ 与对象存储的主要使用方
- [对话模块](../modules/conversation.md) —— 传输层抽象的消费方
- [用户认证模块](../modules/user-auth.md) —— 拦截器与上下文
