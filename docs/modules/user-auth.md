# 用户与认证模块

> 💬 **一句话人话**：管「你是谁」和「你能干什么」。包括注册登录、GitHub 一键登录、
> 邮箱验证码、给第三方程序用的 API Key，以及每个用户自己的模型偏好设置和额度。

本模块覆盖 `user`（33 类）、`auth`（16 类）、`apikey`（7 类）、`account`（7 类），
以及 `infrastructure/verification` 验证码组件。

---

## 目录

- [1. 模块职责](#1-模块职责)
- [2. 核心实体](#2-核心实体)
- [3. 两条认证链路](#3-两条认证链路)
- [4. 登录方式与开关](#4-登录方式与开关)
- [5. 验证码机制](#5-验证码机制)
- [6. 用户设置与降级链](#6-用户设置与降级链)
- [7. 账户与额度](#7-账户与额度)
- [8. 已知坑与注意事项](#8-已知坑与注意事项)

---

## 1. 模块职责

| 职责 | 说明 |
| --- | --- |
| **身份认证** | 账号密码登录、GitHub OAuth、JWT 签发校验 |
| **注册与验证** | 注册流程、图形验证码、邮箱验证码 |
| **外部鉴权** | API Key 让第三方程序以某个 Agent 的身份调用 |
| **用户设置** | 默认模型、降级链等每用户偏好 |
| **账户额度** | 余额、充值、支付方式 |
| **功能开关** | 管理员可关闭注册、关闭某种登录方式 |

---

## 2. 核心实体

```
UserEntity          用户主体：账号、密码哈希、昵称、邮箱
AccountEntity       账户：余额、额度（与 UserEntity 分离）
UserSettingsEntity  用户设置：默认模型、降级链
ApiKeyEntity        API Key：绑定到某个用户的某个 Agent
AuthSettingEntity   平台级认证开关
```

> **为什么 User 和 Account 分开**：身份信息与计费信息生命周期不同。
> 账户余额变动频繁，用户资料几乎不变，分表可以避免热点行拖累。

---

## 3. 两条认证链路

平台有**两套完全独立**的鉴权入口，各自有拦截器和上下文。

### 链路一：网页用户（JWT）

```
浏览器请求（Header: Authorization Bearer <JWT>）
        ↓
UserAuthInterceptor.preHandle()
        ↓ 校验 JWT，解出 userId
UserContext.setCurrentUserId(userId)      ← ThreadLocal
        ↓
Controller / Service 里 UserContext.getCurrentUserId()
        ↓ 请求结束
UserAuthInterceptor.afterCompletion()
        ↓
UserContext.clear()                        ← 必须清理
```

### 链路二：外部程序（API Key）

```
第三方请求（Header: API Key）
        ↓
ExternalApiKeyInterceptor.preHandle()
        ↓ 查 ApiKeyEntity，校验状态
ExternalApiContext.setUserId(...)
ExternalApiContext.setAgentId(...)         ← 同时带出 Agent
        ↓ 请求结束
ExternalApiContext.clear()
```

**关键差异**：API Key 天然绑定一个 Agent，所以外部调用不需要（也不能）指定用哪个 Agent。
这是「把某个 Agent 作为 API 对外提供」的实现方式。

### 上下文实现

```java
public class UserContext {
    private static final ThreadLocal<String> CURRENT_USER_ID = new ThreadLocal<>();

    public static void setCurrentUserId(String userId) { CURRENT_USER_ID.set(userId); }
    public static String getCurrentUserId()            { return CURRENT_USER_ID.get(); }
    public static void clear()                         { CURRENT_USER_ID.remove(); }
}
```

两个拦截器都在 `afterCompletion` 中调用了 `clear()`，
**这在使用线程池的 Web 容器里是必须的**——不清理会造成两个后果：
线程复用时读到上一个请求的用户身份（**越权**），以及 ThreadLocal 引用无法回收（**内存泄漏**）。

---

## 4. 登录方式与开关

```java
public enum AuthFeatureKey {
    NORMAL_LOGIN("NORMAL_LOGIN", "普通登录"),
    GITHUB_LOGIN("GITHUB_LOGIN", "GitHub登录"),
    COMMUNITY_LOGIN("COMMUNITY_LOGIN", "敲鸭登录"),
    USER_REGISTER("USER_REGISTER", "用户注册");
}
```

`AuthSettingEntity` 存每个开关的启用状态，`AuthConfigController` 把结果暴露给前端——
前端据此决定登录页显示哪些按钮。

> 前端启动时会请求 `/api/auth/config`。这个接口是**未登录可访问**的，
> 否则会陷入「要登录才能知道怎么登录」的死循环。

---

## 5. 验证码机制

```
infrastructure/verification/
├── CaptchaUtils              图形验证码生成
├── VerificationCodeService   邮箱验证码收发
├── config/VerificationCodeConfig
└── storage/
    ├── CodeStorage           存储抽象
    └── MemoryCodeStorage     内存实现  ← 注意
```

`CodeStorage` 被抽象成接口，但当前**只有内存实现**。

> ⚠️ **单机限制**：验证码存在 JVM 内存里。这意味着
> ① 服务重启后所有未使用的验证码失效；
> ② **无法水平扩容**——两个后端实例各存各的，用户在 A 实例拿的码到 B 实例校验必然失败。
>
> 要多实例部署必须先补一个 Redis 实现。接口已经抽象好了，这是预留的扩展点。

---

## 6. 用户设置与降级链

```java
UserSettingsEntity
└── UserSettingsConfig
    └── FallbackConfig        降级链配置
```

`UserSettingsDomainService` 提供两个关键方法，在对话链路里被高频调用：

- `getUserDefaultModelId(userId)` —— 该用户的默认模型
- `getUserFallbackChain(userId)` —— 主模型不可用时依次尝试的备选模型

降级链会被传给高可用选路，详见
[LLM 模块第 6 节](llm.md#6-高可用与降级链)。

> RAG 的意图识别、语义改写、查询扩展都会调 `getUserDefaultModelId()`。
> 用户没设默认模型时这些方法返回 `null`，对应功能**静默降级**（不报错，跳过该步骤）。

---

## 7. 账户与额度

```
AccountEntity            余额、额度
AccountAppService        充值、查询
AddCreditRequest         充值请求
PaymentMethodDTO         支付方式
PaymentResponseDTO       支付结果
```

Token 消耗统计由 [LLM 模块的 token 部分](llm.md#7-token-溢出处理)产生，
计费口径与扣减时机需结合 `AccountDomainService` 一起看。

---

## 8. 已知坑与注意事项

### 8.1 ⚠️ ThreadLocal 不跨线程传递

这是本模块**最容易踩的坑**。`UserContext` 基于 ThreadLocal，
意味着**任何异步执行的代码里 `UserContext.getCurrentUserId()` 都会返回 `null`**。

平台里有多处异步执行：

| 位置 | 线程池 |
| --- | --- |
| `RagQaDatasetAppService` | `ragStreamExecutor` |
| `PortalAgentSessionController` | `newCachedThreadPool()` |
| `ToolStateStateMachineAppService` | `app-tool-state-processor-thread` |

**现有代码的正确做法**是在控制器线程里先取出 userId，再作为参数传进异步任务：

```java
// ✅ 正确：在控制器线程取值
String userId = UserContext.getCurrentUserId();
return ragQaDatasetAppService.ragStreamChat(request, userId);

// ❌ 错误：在异步任务内部取值，必得 null
CompletableFuture.runAsync(() -> {
    String userId = UserContext.getCurrentUserId();   // null！
});
```

新增异步逻辑时务必遵守这个约定。这类 bug 的症状是「查不到数据」或
「越权访问到别人数据」，而不是抛异常，很难发现。

### 8.2 验证码无法多实例部署

见[第 5 节](#5-验证码机制)。这是当前架构**水平扩容的硬阻塞点之一**。

### 8.3 API Key 与 Agent 强绑定

`ApiKeyEntity` 同时持有 `userId` 和 `agentId`。想让一个 Key 调用多个 Agent，
当前模型不支持，需要建多个 Key。

### 8.4 敏感信息脱敏依赖 Assembler

`ProviderAssembler` 里有 `dto.maskSensitiveInfo()`。
**脱敏发生在 DTO 转换层而非实体层**，意味着任何绕过 Assembler 直接序列化实体的路径
都会泄露明文密钥。新增接口时注意走 Assembler。

---

## 相关文档

- [系统架构](../architecture/overview.md) —— 整体分层
- [LLM 模块](llm.md) —— 默认模型与降级链的消费方
- [对话模块](conversation.md) —— userId 在对话链路中的传递
- [安全实践](../operations/security.md) —— 认证、越权与多租户隔离
- [API 参考](../reference/api.md) —— 登录与 API Key 接口
- [数据库设计](../reference/database.md) —— 用户相关表结构
