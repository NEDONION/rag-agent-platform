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
是唯一涉及加密的转换器。**但其加密实现有严重问题，见[第 9 节](#9-已知坑与注意事项)。**

---

## 6. 加密与工具类

```
utils/
├── ConfigEncryptor           AES 加密（★ 死代码，全仓库零调用）
├── JwtUtils                  JWT 签发与校验
├── JsonUtils                 JSON 序列化
├── PasswordUtils             密码哈希
├── ValidationUtils           校验 + 内嵌 EncryptUtils（★ 实际在用）
└── ModelResponseToJsonUtils  模型响应解析
```

> ⚠️ 仓库里存在**两套 AES 实现**：`ConfigEncryptor` 和 `ValidationUtils.EncryptUtils`。
> 前者无人调用，后者才是真正用于服务商密钥落库的那个。
> 两者都**硬编码了密钥**，详见[第 9 节](#9-已知坑与注意事项)。

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

### 9.1 🔴 服务商 API Key 的加密密钥硬编码在公开仓库中

**这是当前代码库最严重的安全问题。**

`ProviderConfigConverter` 负责把 `ProviderConfig`（**内含用户填写的 LLM 服务商 API Key**）
加密后落库：

```java
public void setNonNullParameter(PreparedStatement ps, int i, ProviderConfig parameter, ...) {
    String jsonStr = JsonUtils.toJsonString(parameter);
    String encryptedStr = ValidationUtils.EncryptUtils.encrypt(jsonStr);   // ← 加密
    ps.setString(i, encryptedStr);
}
```

而 `ValidationUtils.EncryptUtils` 的密钥是：

```java
private static final String ALGORITHM = "AES";
private static final String SECRET_KEY = "1234567890123456";   // 16位密钥
...
Cipher cipher = Cipher.getInstance(ALGORITHM);   // 无模式 → 默认 AES/ECB/PKCS5Padding
```

三个问题叠加：

| 问题 | 说明 |
| --- | --- |
| **密钥硬编码** | 写死在源码里，无法轮换 |
| **仓库公开** | 密钥等同于公开信息，加密形同虚设 |
| **ECB 模式** | `Cipher.getInstance("AES")` 默认 ECB，相同明文产生相同密文，可做模式分析 |

**影响**：任何拿到数据库内容的人（备份泄露、SQL 注入、运维越权、云厂商快照）
都能直接解出**全部用户的模型服务商 API Key**。

**建议修复方向**：

1. 密钥改从环境变量注入（如 `CONFIG_ENCRYPTION_KEY`），随部署配置提供
2. 改用 `AES/GCM/NoPadding`，每条记录随机 IV，密文与 IV 一同存储
3. 提供一次性迁移任务，用旧密钥解密、新密钥重新加密存量数据
4. 修复后**所有已存的服务商密钥应视为已泄露**，通知用户轮换

### 9.2 存在两套 AES 实现，其一为死代码

`ConfigEncryptor` 全仓库零调用，但同样硬编码密钥（`"AgentX-Config-Key"`）。

死代码本身无害，风险在于**将来有人误以为它是"正确的那个"而开始使用**。
建议直接删除，只保留一套经过修复的加密工具。

### 9.3 `getNullableResult(ResultSet, int)` 直接返回 null

```java
@Override
public ProviderConfig getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
    return null;    // ← 未实现
}
```

三个重载中，按**列索引**取值的那个没有实现，另外两个（按列名、按
CallableStatement）都正常解密。

如果某条查询走到按索引取值的路径，会静默拿到 `null` 而非配置，
表现为「服务商配置突然为空」，且不报错。改动查询写法时需留意。

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
