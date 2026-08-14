# 安全实践

> 💬 **一句话人话**：这篇如实记录当前系统的安全现状——包括**已知的严重问题**。
> 它不是「我们很安全」的宣传页，而是一份待办清单。

**最后审查**：2026-08-12

---

## 目录

- [1. 问题台账](#1-问题台账)
- [2. 认证与授权](#2-认证与授权)
- [3. 多租户隔离](#3-多租户隔离)
- [4. 不可信代码执行](#4-不可信代码执行)
- [5. 密钥管理](#5-密钥管理)
- [6. CI/CD 安全](#6-cicd-安全)
- [7. 安全检查清单](#7-安全检查清单)

---

## 1. 问题台账

> 已修复项保留在此处而非删除——安全问题的处置过程本身是需要留痕的，
> 且「已换算法」不等于「已消除影响」（见 P0 的遗留处置）。

| 级别 | 问题 | 状态 |
| --- | --- | --- |
| 🔴 P0 | 服务商 API Key 加密密钥硬编码 | ✅ 算法已修复；**存量密钥轮换未完成** |
| 🔴 P0 | 服务商 API Key 明文打印到 stdout | ✅ 已修复（2026-08-12），有回归测试 |
| 🟠 P1 | docker.sock 挂载等同宿主机 root | ❌ 未修复 |
| 🟡 P2 | 测试覆盖极低 | ⚠️ 仅加解密有测试（16 用例），其余无 |
| 🟡 P2 | 死代码中的第二套硬编码密钥 | ✅ 已删除 |

### ✅ 已修复（2026-08-12）：服务商 API Key 的加密密钥硬编码在公开仓库中

> **原 P0**。加密实现已重写，密钥改为环境变量注入。**但历史泄露不可撤销**——见下方遗留处置。

`ProviderConfigConverter` 把含 API Key 的 `ProviderConfig` 加密后落库，
原先调用的 `ValidationUtils.EncryptUtils` 存在三重问题：密钥硬编码在公开仓库、
使用 ECB 模式（相同明文产生相同密文）、无法轮换。

**当前实现**（`ValidationUtils.EncryptUtils`）：

| 项 | 现状 |
| --- | --- |
| 算法 | `AES/GCM/NoPadding`，128-bit tag，每次加密随机 12 字节 IV |
| 密钥来源 | 环境变量 `CONFIG_ENCRYPTION_KEY`（接受 Base64 或 16/24/32 字节原始串） |
| 缺失行为 | `EncryptionKeyValidator` 在 `@PostConstruct` 校验，**启动即失败**，无默认值回落 |
| 密文格式 | `v2:` + Base64(IV ‖ 密文 ‖ Tag) |
| 存量数据 | `decrypt()` 自动识别无前缀的 v1 密文并用旧密钥解开，**无需数据迁移**；任何一次写回自动升级为 v2 |

**验证**（手工，9/9 通过）：v2 往返、相同明文产生不同密文、v1 遗留密文可读、
null 边界、篡改密文被 GCM 拒绝、密钥缺失/长度非法时抛出明确异常。

**遗留处置（尚未完成）**：

- [ ] 旧密钥 `1234567890123456` 已随公开仓库泄露。**所有仍为 v1 格式的服务商密钥必须视为已泄露**，
      需通知用户轮换——重写加密算法并不能挽回已经泄露的明文。
- [ ] 可选：写一次性任务把存量 v1 记录批量重加密为 v2，以便最终移除 `decryptLegacy` 路径。

详见 [基础设施 9.1](../architecture/infrastructure.md#91--服务商-api-key-的加密密钥硬编码在公开仓库中)。

### ✅ 已修复（2026-08-12）：服务商 API Key 明文打印到 stdout

> **原 P0**，与上一条是同一条数据链上的两个洞：一个把密钥**加密存进库**，另一个把同一份密钥
> **明文写进日志**。只修前者等于没修。

`JsonUtils.toJsonString()` 里有一组无条件执行的调试语句：

```java
System.out.println("JsonUtils Debug - toJsonString input: " + obj + ...);
String result = objectMapper.writeValueAsString(obj);
System.out.println("JsonUtils Debug - toJsonString result: " + result);   // ← 完整 JSON
```

而 `ProviderConfigConverter.setNonNullParameter()` 正是用它序列化含 API Key 的
`ProviderConfig`。因此**每次保存服务商配置，明文密钥都会被打进 stdout**，
落到容器日志与 `logs/agent-x.log`。`parseMap()` 中另有 4 处同类语句。

**影响面比加密那条更广**：日志通常比数据库更容易被读到——运维、日志采集平台、
排查问题时随手贴出的片段，都不设防。

**实测确认**（修复前）：

```
JsonUtils Debug - toJsonString result: {"apiKey":"sk-SECRET-...","baseUrl":"https://api.example.com"}
```

**修复**：删除全部 6 处调试打印，并在方法上留注释说明为什么不能加回来。
错误分支原本就走 `log.error`，不受影响。

**回归保护**：`JsonUtilsTest.NoStdoutLeak` 断言这两个方法的 stdout/stderr **必须为空**
（而非「不含某几行」）。已验证该测试能抓住回归——把 `println` 加回去后测试变红。

> 📌 **同类风险的通用规则**：不要打印整个对象或序列化结果。
> 详见 [AGENTS.md](../../AGENTS.md) 的「代码风格」与「安全红线」。

### 🟠 P1：docker.sock 挂载等同于宿主机 root

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

后端需要它来管理 MCP 工具容器，但这意味着**后端进程一旦被攻破，宿主机即失守**。

任何关于「工具沙箱有多安全」的讨论，上限都是这一条。

**缓解方向**：Docker API over TLS（限制可用命令）、rootless 模式、
或把容器管理拆成独立的最小权限服务。

### 🟡 P2：测试覆盖极低（已开头，远未完成）

后端此前无 `src/test` 目录。目前有**两个测试类、23 个用例**，都围绕上面两条 P0：

| 测试类 | 用例 | 锁住的不变量 |
| --- | --- | --- |
| `EncryptUtilsTest` | 16 | v2 往返、随机 IV、**v1 遗留密文仍可解密**、密钥缺失即失败 |
| `JsonUtilsTest` | 7 | 序列化路径**不得向 stdout/stderr 输出任何内容** |

```bash
mvn test
```

**仍然缺失**：570 个 Java 文件中其余全部无测试；前端无 test 脚本；无 CI 执行入口
（`.github/` 不存在，`Dockerfile` 构建用 `-DskipTests`）。除加解密外的任何改动
**依旧没有回归保护**。

### ✅ 已修复（2026-08-12）：死代码中的第二套硬编码密钥

> **原 P2**。`ConfigEncryptor`（硬编码 `"AgentX-Config-Key"`）全仓库零调用，已删除，
> 消除了将来有人误以为它是「正确的那个」而启用的风险。

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
