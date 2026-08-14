# 本地开发指南

> 💬 **一句话人话**：怎么把项目在自己电脑上跑起来、改代码、提交。
> 不需要装真实的数据库和消息队列——用 Docker 起依赖，只在本地跑前后端就行。

---

## 目录

- [1. 环境要求](#1-环境要求)
- [2. 启动依赖服务](#2-启动依赖服务)
- [3. 运行后端](#3-运行后端)
- [4. 运行前端](#4-运行前端)
- [5. 代码风格](#5-代码风格)
- [6. 提交与 CI](#6-提交与-ci)
- [7. 项目结构导航](#7-项目结构导航)
- [8. 常见问题](#8-常见问题)

---

## 1. 环境要求

| 组件 | 版本 | 说明 |
| --- | --- | --- |
| **JDK** | 17 | `pom.xml` 中 `maven.compiler.source/target` 均为 17 |
| **Maven** | 3.9+ | |
| **Node.js** | 20 | 与 `frontend/Dockerfile` 一致 |
| **pnpm** | 9 | 仓库有 `pnpm-lock.yaml` |
| **Docker** | 任意近期版本 | 起依赖服务用 |

技术栈：Spring Boot 3.2.3 + LangChain4j / Next.js 15 / PostgreSQL + PGVector。

---

## 2. 启动依赖服务

数据库和消息队列用 Docker 起，不必装在本机。

```bash
# PostgreSQL + PGVector
docker run -d --name rag-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=agentx \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# RabbitMQ
docker run -d --name rag-mq \
  -p 5672:5672 -p 15672:15672 \
  rabbitmq:3.13-management-alpine
```

初始化表结构：

```bash
docker exec -i rag-pg psql -U postgres -d agentx < docs/sql/01_init.sql
```

> ⚠️ **别用错文件**。仓库里有两个初始化 SQL：
>
> | 文件 | 行数 | 内容 |
> | --- | --- | --- |
> | `docs/sql/01_init.sql` | 1129 | **完整表结构（35 张表）+ 扩展**，本地开发用这个 |
> | `deploy/init-db.sql/init.sql` | 73 | 仅创建 `vector` / `uuid-ossp` 扩展，建表语句是注释掉的 |
>
> 跑成后者的话扩展装上了但一张表也没有，启动时会报表不存在。

---

## 3. 运行后端

```bash
cp src/main/resources/application.yml.example src/main/resources/application.yml
# 编辑 application.yml，填数据库、MQ、模型服务商等配置

mvn spring-boot:run
```

默认端口 `8088`，健康检查 `http://localhost:8088/api/health`。

### 只编译不跑

```bash
mvn -B compile -DskipTests
```

跑测试（**CI 的后端 job 跑的就是这条**）：

```bash
mvn test
```

> ⚠️ **测试覆盖极低**：后端目前只有 `EncryptUtilsTest`（16 个用例，服务商密钥加解密）和
> `JsonUtilsTest`（7 个用例，防止序列化时把明文密钥打进日志）两个测试类，共 23 个用例；
> 其余 570 个 Java 文件均无测试，前端 `package.json` 也没有 test 脚本。
> CI 会执行 `mvn -B test`，所以这 23 个用例有回归保护，但**其余代码没有**。
> 新增功能时补测试是当前最值得做的改进之一。
>
> 其中 2 个用例验证「密钥缺失时启动失败」，只有在 shell 未导出 `CONFIG_ENCRYPTION_KEY`
> 时才会执行，否则自动跳过（输出 `Skipped: 2`）——这是预期行为，不是测试没跑。

---

## 4. 运行前端

```bash
cd frontend
pnpm install
pnpm dev        # next dev --turbopack
```

默认端口 `3000`。

### API 地址配置

`frontend/lib/api-config.ts` 的解析顺序：

```
NEXT_PUBLIC_API_URL 环境变量
      ↓ 未设置
浏览器环境 → 相对路径 "/api"
      ↓
服务端渲染 → "/api"
```

**本地开发**若前后端分离启动，需要设置：

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8088/api
```

**生产环境**不设置该变量，走相对路径 `/api` 由 nginx 转发——
这样镜像不必为不同域名重新构建。

---

## 5. 代码风格

后端用 **Spotless**（`pom.xml` 中 `spotless-maven-plugin` 2.37.0）：

```bash
mvn spotless:check    # 检查
mvn spotless:apply    # 自动格式化
```

前端：

```bash
cd frontend && pnpm lint
```

### 注释约定

参照现有代码，**业务逻辑注释用中文**，尤其是：

- 「为什么这么写」而非「这里做了什么」
- 踩过的坑、绕过的限制、不能改的原因

例如：

```java
/** 流式问答专用线程池。
 *
 * 这里不能用 CompletableFuture.runAsync 的默认 ForkJoinPool.commonPool()：
 * commonPool 的并行度是 availableProcessors() - 1，而后端容器限了 1.2 CPU，
 * 算下来并行度为 1；链路里跑的又是纯阻塞 IO，结果就是全站同一时刻只能有
 * 一个 RAG 问答在跑。 */
```

这种注释在半年后能省下大量重新排查的时间。

---

## 6. 提交与 CI

### 分支与 PR

日常改动走**分支 + PR**，不直接推 main：

```bash
git checkout -b fix/xxx
# 改动
git commit
git push -u origin fix/xxx
gh pr create
```

**push 到 main 会自动触发生产部署**，见[部署指南](../operations/deployment.md#5-cicd-自动部署)。

### PR 会跑什么

`.github/workflows/ci.yml` 三个并行 job：

| Job | 命令 |
| --- | --- |
| 后端编译与测试 | `mvn -B test` |
| 前端构建 | `pnpm build` |
| nginx 配置校验 | `nginx -t`（带 `--add-host`） |

> nginx 那个 job 需要 `--add-host backend:127.0.0.1`，
> 因为 `nginx -t` 会解析 upstream 主机名，CI 里没有那些容器。
> 见[排查记录 3.2](../operations/troubleshooting-log.md#32-ci-的-nginx-校验失败)。

---

## 7. 项目结构导航

```
src/main/java/org/lucas/
├── interfaces/       控制器与 DTO —— 从这里找接口
│   ├── api/portal/   面向用户的接口
│   └── dto/
├── application/      应用服务 —— 编排逻辑在这
├── domain/           领域模型与领域服务 —— 业务规则在这
└── infrastructure/   技术实现 —— 数据库、MQ、外部集成

frontend/
├── app/              Next.js App Router 页面
│   └── (main)/explore/   主功能页
├── components/
├── lib/              API 客户端、服务封装
└── types/
```

**按模块找代码**：每个业务模块在 `application` / `domain` / `infrastructure`
三层下都有同名目录。例如 RAG 相关代码分布在
`application/rag/`、`domain/rag/`、`infrastructure/rag/`。

各模块详细说明见 [文档索引](../README.md)。

---

## 8. 常见问题

### 8.1 改了 nginx.conf 不生效

`nginx.conf` 是挂载进容器的，必须重启容器：

```bash
docker compose restart nginx
```

`up -d` 不会重载它。

### 8.2 异步代码里取不到当前用户

`UserContext` 基于 ThreadLocal，**不跨线程传递**。必须在控制器线程取出
userId 再作为参数传入异步任务：

```java
// ✅
String userId = UserContext.getCurrentUserId();
CompletableFuture.runAsync(() -> doWork(userId), executor);

// ❌ 必得 null
CompletableFuture.runAsync(() -> {
    String userId = UserContext.getCurrentUserId();
});
```

详见[用户认证模块 8.1](../modules/user-auth.md#81-️-threadlocal-不跨线程传递)。

### 8.3 新增异步逻辑该用哪个线程池

**不要用 `CompletableFuture.runAsync(task)` 的无参重载**——
它跑在 `ForkJoinPool.commonPool()` 上，在 CPU 受限的容器里并行度可能只有 1，
且不会为阻塞 IO 做线程补偿。

一律显式传入专用线程池。参考 `RagQaDatasetAppService.ragStreamExecutor`
或 `ToolStateStateMachineAppService` 的做法。

### 8.4 import 时选错了同名类

`conversation` 模块里有**三个 `Agent`、两个 `ChatContext`、两个 `AgentPromptTemplates`**。
IDE 自动 import 容易选错，且编译能过、运行才出错。

详见[对话模块 9.2](../modules/conversation.md#92-存在多个同名类容易-import-错)。

### 8.5 本地起不来但线上正常

优先检查 `application.yml` 与线上 `.env` 的差异，特别是：

- 数据库连接（本地是 Docker，线上是阿里云 RDS）
- `SILICONFLOW_API_KEY` 是否配置
- `CONFIG_ENCRYPTION_KEY` 是否配置——**缺失会导致启动直接失败**，日志里是
  「缺少环境变量 CONFIG_ENCRYPTION_KEY」。用 `openssl rand -base64 32` 生成后写进 `.env`。
  注意本地与线上用各自的密钥即可，但**同一环境不要更换**，否则该环境已存的服务商配置读不出来。
- MQ 地址（本地 `localhost`，容器内是 `rabbitmq`）

---

## 相关文档

- [文档索引](../README.md) —— 全部文档入口
- [系统架构](../architecture/overview.md) —— 分层与依赖方向
- [部署指南](../operations/deployment.md) —— 生产部署
- [排查记录](../operations/troubleshooting-log.md) —— 已知问题与解法
- [API 参考](../reference/api.md) —— 接口定义
- [数据库设计](../reference/database.md) —— 表结构
