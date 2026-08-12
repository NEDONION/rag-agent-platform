# RAG Agent Platform 文档中心

项目简介与快速上手先看[仓库根目录 README](../README.md)。这里是完整的技术文档。

> 📖 **怎么读**：每篇文档开头都有一段 **💬 一句话人话**，用大白话说清这篇讲什么。
> 只想知道大概，看那一句就够；要动手改代码或排查问题，再往下看细节。

**最后更新**：2026-08-12

---

## 目录约定

```
docs/
├── architecture/   系统架构与技术底座
├── modules/        各业务模块（按领域划分）
├── reference/      API 与数据库参考
├── operations/     部署、性能、安全、排查记录
├── development/    本地开发
└── assets/         配图
```

文件名用小写英文，**目录层级已表达分类，文件名不再重复**
（`modules/rag.md` 而非 `modules/RAG_MODULE.md`）。

---

## 推荐阅读顺序

### 我是新来的，想先搞懂这是什么

1. [根目录 README](../README.md) —— 项目能做什么，5 分钟
2. [系统架构](architecture/overview.md) —— DDD 分层、技术栈、模块边界
3. [RAG 模块](modules/rag.md) —— 平台的核心能力
4. [对话模块](modules/conversation.md) —— 用户每句话经过的完整链路

### 我要上手改代码

5. [本地开发指南](development/local-setup.md) —— 环境搭建、代码风格、提交流程
6. 对应模块的文档（见下方模块列表）
7. [API 参考](reference/api.md) 与[数据库设计](reference/database.md)
8. [排查记录](operations/troubleshooting-log.md) 的**附录：经验教训** ——
   12 条来自真实故障的约束，能避开不少坑

### 我要部署或运维

9. [部署指南](operations/deployment.md) —— 拓扑、环境变量、CI/CD、回滚
10. [排查记录](operations/troubleshooting-log.md) —— 部署踩过的全部坑，含错误原文
11. [性能优化](operations/performance.md) —— 排查手册
12. [安全实践](operations/security.md) —— **含待修复的高危问题**

---

## 全部文档

### 架构

| 文档 | 内容 |
| --- | --- |
| [系统架构](architecture/overview.md) | 整体设计、DDD 分层、技术栈 |
| [基础设施](architecture/infrastructure.md) | MQ、存储、传输、加密、拦截器等 19 个技术子包 |

### 业务模块

| 文档 | 覆盖范围 | 类数量 |
| --- | --- | --- |
| [RAG 模块](modules/rag.md) | 文档处理、向量检索、版本快照 | 124 |
| [Agent 模块](modules/agent.md) | Agent 生命周期、发布、工具集成 | 75 |
| [对话模块](modules/conversation.md) | 会话、消息、SSE、上下文、工作流 | 61 |
| [MCP 工具模块](modules/mcp-tool.md) | 工具上架状态机、容器隔离、网关 | 64 |
| [LLM 模块](modules/llm.md) | 服务商、协议适配、高可用、Token | 61 |
| [用户与认证](modules/user-auth.md) | 登录、JWT、API Key、设置、额度 | 63 |
| [执行追踪](modules/trace.md) | 可观测性、执行链路记录 | 29 |
| [任务与调度](modules/task.md) | 工作流任务、定时任务 | 21 |

### 参考

| 文档 | 内容 |
| --- | --- |
| [API 参考](reference/api.md) | RESTful、SSE 接口定义 |
| [数据库设计](reference/database.md) | 表结构、ER 图、索引 |

### 运维

| 文档 | 内容 |
| --- | --- |
| [部署指南](operations/deployment.md) | 拓扑、配额、环境变量、CI/CD、回滚 |
| [排查记录](operations/troubleshooting-log.md) | 线上问题实录，持续更新 |
| [性能优化](operations/performance.md) | 线程池、超时、首字延迟、扩容阻塞点 |
| [安全实践](operations/security.md) | 认证、隔离、密钥、CI/CD 安全 |

### 开发

| 文档 | 内容 |
| --- | --- |
| [本地开发指南](development/local-setup.md) | 环境、运行、风格、提交、常见问题 |

---

## 需要立刻知道的几件事

如果你只有三分钟，读这些：

**⚠️ 部署必须设置 `CONFIG_ENCRYPTION_KEY`** ——
用于加密服务商 API Key，缺失时后端**启动即失败**（有意为之，无默认值）。
此前该密钥硬编码在公开源码中，**存量 API Key 应视为已泄露，需通知用户轮换**。
见[安全实践](operations/security.md#-已修复p0服务商-api-key-的加密密钥硬编码在公开仓库中)。

**⚠️ 异步代码里取不到当前用户** ——
`UserContext` 基于 ThreadLocal，不跨线程。必须从控制器线程传参。
见[用户认证 8.1](modules/user-auth.md#81-️-threadlocal-不跨线程传递)。

**⚠️ 不要用无参的 `CompletableFuture.runAsync`** ——
容器只有 1.2 CPU，`commonPool` 并行度为 1，阻塞 IO 会被串行化。
见[性能优化第 2 节](operations/performance.md#2-线程池)。

**⚠️ `deploy.yml` 绝不能加 `pull_request` 触发** ——
公开仓库 + 自托管 runner，等于把服务器交给任何人。
见[安全实践第 6 节](operations/security.md#6-cicd-安全)。

**⚠️ 当前只能单实例部署** ——
验证码和定时任务都用内存存储，多实例会出错。
见[性能优化第 6 节](operations/performance.md#6-水平扩容的阻塞点)。

**⚠️ 测试覆盖极低** ——
目前只有 `ConfigCryptoTest`（9 个用例，守加密相关的安全属性），
前端仍无 test 脚本。CI 会跑 `mvn test`。

---

## 文档维护约定

- **每篇开头写「一句话人话」**，让不熟悉该模块的人也能快速判断要不要往下读
- **记录「为什么」而非「是什么」** —— 代码能自述做了什么，文档要解释为什么这么做
- **保留错误原文** —— 排查记录里的报错要原样保留，便于日后按报错检索
- **踩坑要写进文档** —— 每个模块文档末尾都有「已知坑与注意事项」章节
- **改文档要跑链接校验**，不留失效链接
