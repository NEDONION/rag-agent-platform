# 安全实践

> 💬 **一句话人话**：这篇如实记录当前系统的安全现状——包括**已知的严重问题**。
> 它不是「我们很安全」的宣传页，而是一份待办清单。

**最后审查**：2026-08-12

---

## 目录

- [1. 待修复问题](#1-待修复问题)
- [2. 认证与授权](#2-认证与授权)
- [3. 多租户隔离](#3-多租户隔离)
- [4. 不可信代码执行](#4-不可信代码执行)
- [5. 密钥管理](#5-密钥管理)
- [6. CI/CD 安全](#6-cicd-安全)
- [7. 安全检查清单](#7-安全检查清单)

---

## 1. 待修复问题

### 🔴 P0：服务商 API Key 的加密密钥硬编码在公开仓库中

**影响**：任何拿到数据库内容的人都能解出**全部用户的模型服务商 API Key**。

`ProviderConfigConverter` 把含 API Key 的 `ProviderConfig` 加密后落库，
调用的是 `ValidationUtils.EncryptUtils`：

```java
private static final String ALGORITHM = "AES";
private static final String SECRET_KEY = "1234567890123456";   // ← 硬编码
...
Cipher cipher = Cipher.getInstance(ALGORITHM);   // ← 默认 AES/ECB/PKCS5Padding
```

三重问题：

| 问题 | 后果 |
| --- | --- |
| 密钥硬编码 | 无法轮换 |
| **仓库公开** | 密钥等同公开信息，**加密形同虚设** |
| ECB 模式 | 相同明文产生相同密文，可做模式分析 |

**泄露途径**：数据库备份、SQL 注入、云厂商快照、运维越权——任一发生即全量泄露。

**修复方向**：

1. 密钥从环境变量注入（如 `CONFIG_ENCRYPTION_KEY`），缺失时**启动失败**而非回落默认值
2. 改用 `AES/GCM/NoPadding`，每条记录随机 IV，IV 与密文一同存储
3. 提供一次性迁移：旧密钥解密 → 新密钥重新加密
4. 修复后**所有存量服务商密钥应视为已泄露，需通知用户轮换**

详见 [基础设施 9.1](../architecture/infrastructure.md#91--服务商-api-key-的加密密钥硬编码在公开仓库中)。

### 🟠 P1：docker.sock 挂载等同于宿主机 root

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

后端需要它来管理 MCP 工具容器，但这意味着**后端进程一旦被攻破，宿主机即失守**。

任何关于「工具沙箱有多安全」的讨论，上限都是这一条。

**缓解方向**：Docker API over TLS（限制可用命令）、rootless 模式、
或把容器管理拆成独立的最小权限服务。

### 🟡 P2：无自动化测试

无 `src/test` 目录，前端无 test 脚本。**任何安全修复都缺乏回归保护**。

### 🟡 P2：死代码中的第二套硬编码密钥

`ConfigEncryptor` 全仓库零调用，但硬编码了 `"AgentX-Config-Key"`。
风险在于将来有人误以为它是「正确的那个」而启用。建议直接删除。

---

## 2. 认证与授权

### 两条独立链路

| 链路 | 凭据 | 拦截器 | 上下文 |
| --- | --- | --- | --- |
| 网页用户 | JWT | `UserAuthInterceptor` | `UserContext` |
| 外部程序 | API Key | `ExternalApiKeyInterceptor` | `ExternalApiContext` |
| 管理端 | — | `AdminAuthInterceptor` | — |

### ✅ ThreadLocal 清理正确

两个拦截器都在 `afterCompletion` 中调用 `clear()`：

```java
@Override
public void afterCompletion(...) {
    UserContext.clear();
}
```

**这在使用线程池的 Web 容器里是必须的**。不清理会导致两个后果：

- 线程复用时读到上一个请求的用户身份 → **越权**
- ThreadLocal 引用无法回收 → **内存泄漏**

### ⚠️ 异步代码中的越权风险

`UserContext` 基于 ThreadLocal，**不跨线程传递**。
异步任务里调 `getCurrentUserId()` 得到 `null`。

如果某处代码把 `null` 当成「不过滤」处理，就会变成**越权读取全部数据**。

**约定**：在控制器线程取出 userId，作为参数显式传入异步任务。
新增异步逻辑时务必遵守。详见
[用户认证模块 8.1](../modules/user-auth.md#81-️-threadlocal-不跨线程传递)。

---

## 3. 多租户隔离

| 资源 | 隔离方式 |
| --- | --- |
| 知识库 / 数据集 | 查询带 `userId` 过滤 |
| Agent / 会话 | 同上 |
| 工具容器 | 每用户独立容器（`ContainerType.USER`） |
| 服务商配置 | 每用户独立 |

隔离依赖**每个查询都正确带上 userId**，没有数据库级的行级安全（RLS）兜底。
这意味着**任何一处遗漏都是越权漏洞**，且不会报错。

> 建议：新增查询时优先复用已有的带 userId 的仓储方法，
> 不要直接写裸 SQL 或 `selectById`。

---

## 4. 不可信代码执行

平台允许用户提交 GitHub 仓库作为 MCP 工具——**这是在执行不可信代码**。

### 现有防护

```
用户提交仓库
    ↓
GITHUB_URL_VALIDATE    验证 URL
    ↓
DEPLOYING              在**审核容器**中部署（隔离于用户容器）
    ↓
FETCHING_TOOLS         抽取工具定义
    ↓
MANUAL_REVIEW          ★ 人工审核关卡
    ↓
APPROVED               上架
```

**人工审核是最后一道也是最关键的一道防线**。审核容器提供了运行时隔离，
但如[第 1 节 P1](#-p1docker-sock-挂载等同于宿主机-root) 所述，
隔离的上限受 docker.sock 挂载制约。

### 审核时应重点看什么

- 是否有外连行为（数据外传）
- 是否读取环境变量或文件系统敏感路径
- 安装脚本是否有可疑操作
- 依赖是否来自可信源

---

## 5. 密钥管理

| 密钥 | 存放 | 状态 |
| --- | --- | --- |
| 数据库密码 | 服务器 `.env` | ✅ 不入库、不入仓库 |
| S3 密钥 | 服务器 `.env` | ✅ |
| 邮件密码 | 服务器 `.env` | ✅ |
| GitHub PAT | 服务器 `.env` | ✅ |
| ACR 凭据 | GitHub Secrets | ✅ |
| **用户的模型服务商 API Key** | **数据库（弱加密）** | 🔴 见 P0 |

### 前端脱敏

`ProviderAssembler` 中有 `dto.maskSensitiveInfo()`。

> ⚠️ **脱敏发生在 DTO 转换层而非实体层**。任何绕过 Assembler 直接序列化实体的路径
> 都会泄露明文密钥。新增接口时必须走 Assembler。

### 操作规范

写入密钥**不要用 `echo`**（会进 shell history）：

```bash
# ✅ 不回显、不留痕
read -s -p "粘贴令牌: " T && echo "GITHUB_PAT=$T" >> .env && unset T
```

本项目在配置过程中曾发生过令牌明文进入 shell history 的情况，
该令牌已作废重建。见[排查记录 3.5](troubleshooting-log.md#35-令牌明文泄露)。

---

## 6. CI/CD 安全

### ✅ 已落实的边界

| 措施 | 说明 |
| --- | --- |
| 无入站端口 | 自托管 runner 主动出站轮询，服务器不开 SSH |
| Secrets 最小化 | 只有 3 个，均不含服务器凭据 |
| `.env` 不覆盖 | CI 只做 `IMAGE_TAG` 一行的原地替换 |
| 二进制校验 | runner tarball 强制校验官方 SHA256 |
| 版本可追溯 | 每次部署记录 commit SHA |

### 🔴 绝对不能做的事

**`deploy.yml` 绝不能添加 `pull_request` 触发。**

这是**公开仓库** + **自托管 runner**。一旦 fork 的 PR 能触发工作流，
任何人都能在你的服务器上执行任意代码。

当前配置只允许 `push` 到 main 与 `workflow_dispatch`，已在工作流注释中标注。

### 换源的安全边界

| 类型 | 可否换镜像站 | 理由 |
| --- | --- | --- |
| 系统包（apt/yum） | ✅ | GPG 签名保护 |
| 语言包（npm/pip/maven） | ✅ | 校验和保护 |
| **可执行二进制** | ⚠️ **仅在强制校验官方哈希时** | 拿到 root 级权限 |

> 反对的从来不是「用镜像站」，而是「**无校验地**信任镜像站」。

---

## 7. 安全检查清单

### 新增接口时

- [ ] 查询是否带 `userId` 过滤
- [ ] 返回是否经过 Assembler（脱敏）
- [ ] 是否需要鉴权拦截器覆盖

### 新增异步逻辑时

- [ ] userId 是否从控制器线程显式传入（而非 ThreadLocal 取）
- [ ] 是否使用了专用线程池

### 修改 CI 时

- [ ] `deploy.yml` 是否仍**只有** `push: main` 与 `workflow_dispatch`
- [ ] 新增的下载是否有校验和

### 定期

- [ ] 轮换 GitHub PAT
- [ ] 检查 ACR 凭据有效期
- [ ] 审查已上架 MCP 工具的行为变化

---

## 相关文档

- [基础设施](../architecture/infrastructure.md) —— 加密实现细节
- [用户认证模块](../modules/user-auth.md) —— 鉴权链路
- [MCP 工具模块](../modules/mcp-tool.md) —— 不可信代码执行流程
- [部署指南](deployment.md) —— 环境变量与凭据分布
- [排查记录](troubleshooting-log.md) —— 令牌泄露事件
