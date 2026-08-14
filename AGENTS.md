# RAG Agent Platform Agent 工程规范

## 适用范围与优先级

- 本文件适用于整个仓库。
- 优先遵循系统、开发者和用户的直接指令；子目录中更具体的 `AGENTS.md` 只覆盖对应目录。
- 只修改当前任务需要的文件，交付范围最小、行为正确且**经过验证**的变更。
- **不把设计、计划或建议描述成已实现的功能。** 文档里写「支持 X」必须对应仓库里真实存在
  且能跑通的代码；只是想做的，写在「待办」或「优化方向」里，并明确标注未实现。

---

## 一、文档记录要求（强制）

**任何功能新增、行为修改、缺陷修复、配置变更、依赖升级，都必须同步更新文档。
没有文档记录的改动视为未完成，不允许提交。**

这条不是形式主义。这个项目已经出现过两次文档与代码脱节：README 宣称有「Guava
RateLimiter 限流」但全仓库搜不到任何 `RateLimiter` 用法；`docs/INDEX.md` 索引了 12 篇
文档而实际只有 5 篇存在。文档一旦失信，读者就得回去读代码，那文档就白写了。

### 改了什么 → 更新哪里

| 改动类型 | 必须更新 |
| --- | --- |
| 业务模块的行为、流程、数据流 | `docs/modules/<模块>.md` |
| 分层结构、技术选型、基础设施组件 | `docs/architecture/overview.md` 或 `infrastructure.md` |
| 新增/修改 HTTP 接口、请求响应结构 | `docs/reference/api.md` |
| 建表、加字段、改索引、改约束 | `docs/reference/database.md` + `docs/sql/` |
| **新增或修改环境变量** | `.env.example` + `docker-compose.yml` + `docs/operations/deployment.md` |
| 部署拓扑、CI/CD、回滚方式 | `docs/operations/deployment.md` |
| 认证、授权、加密、多租户隔离 | `docs/operations/security.md` |
| 性能相关的调优或退化 | `docs/operations/performance.md` |
| 线上故障的排查过程与结论 | `docs/operations/troubleshooting-log.md` |
| 本地开发流程、构建命令、测试方式 | `docs/development/local-setup.md` |

一次改动命中多行就都要改。新增文档时同步在 `docs/README.md` 的导航中登记，
**不允许留下指向不存在文件的链接**。

### 安全与遗留问题的记录方式

- `docs/operations/security.md` 的**问题台账**必须反映真实状态。修复后不要删除条目，
  改成 `✅ 已修复（日期）` 并保留问题描述——安全问题的处置过程需要留痕。
- 区分「**已消除**」和「**已缓解**」。例如换掉泄露的加密算法 ≠ 已泄露的明文被挽回；
  后者要单独列为未完成项，不能因为代码改好了就整条划掉。
- 已知未修复的问题**必须写进文档**并标注级别（P0/P1/P2），不允许因为「以后再说」而略过。

### 状态标记

描述能力时使用明确的状态词，不要让读者猜：

| 标记 | 含义 |
| --- | --- |
| `已实现` | 当前 `main` 上的真实行为，有代码可查 |
| `已实现 / 无测试覆盖` | 代码存在但没有回归保护，改动风险高 |
| `已验证` | 有测试或有脱敏的真实运行证据 |
| `计划中 / 未实现` | 只有设计，**不得在特性列表中宣传** |

### 写文档时

- 先读同目录已有文档，沿用其结构与语气（每篇开头有「💬 一句话人话」）。
- 文件名用小写英文，目录层级已表达分类，文件名不再重复（`modules/rag.md`，不是 `RAG_MODULE.md`）。
- 引用代码时给出真实路径与类名，不要贴不存在的示例代码。
- 改完检查仓库内是否还有指向旧内容的链接或锚点。

---

## 二、项目事实

- 后端 Java 17 + Spring Boot 3.2.3，包根 `org.lucas`，DDD 四层：
  `interfaces` → `application` → `domain` → `infrastructure`。
- 前端 Next.js 15 App Router + React 19，包管理用 **pnpm**（`pnpm-lock.yaml` 为
  lockfileVersion 6.0，对应 pnpm 8），位于 `frontend/`。
- 数据库 PostgreSQL + PGVector；消息队列 RabbitMQ；对象存储走 S3 协议（七牛 KODO）。
- 持久化用 MyBatis-Plus，逻辑删除字段 `deleted_at`。
- 文档以 `docs/README.md` 为总入口，目录约定见该文件。
- 部署与 CI/CD 的权威说明是根目录 `DEPLOY.md` 与 `docs/operations/deployment.md`。

### 测试现状（如实）

仓库**长期没有测试**，目前只有 `src/test/java/org/lucas/infrastructure/utils/EncryptUtilsTest.java`
一个测试类（16 个用例）。其余 570 个 Java 文件、以及整个前端，**都没有回归保护**。

因此：**修复缺陷时先写能复现的测试**；新增关键路径逻辑时补测试。这是当前性价比最高的改进。

---

## 三、常用命令

```bash
# 后端编译
mvn -B compile -DskipTests

# 后端测试
mvn test

# 只跑加解密测试
mvn test -Dtest=EncryptUtilsTest

# 前端依赖与构建
cd frontend && pnpm install --frozen-lockfile && pnpm build

# Nginx 配置校验（server 块需挂进 conf.d/）
docker run --rm -v "$PWD/deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:alpine nginx -t
```

CI（`.github/workflows/ci.yml`，PR 触发）跑的就是上面这三组：`mvn test`、`pnpm build`、
`nginx -t`。**提交前在本地跑一遍**，不要用 CI 当编译器。

部署由 `.github/workflows/deploy.yml` 负责（仅 push main 触发），两者职责严格分离。

---

## 四、修改前要求

- 先运行 `git status --short`，识别并**保护用户已有的未提交修改**——不要用
  `git checkout`、`git restore` 或覆盖写入丢弃你没有确认过的改动。
- 阅读相关实现、同模块文档和 `pom.xml` / `package.json`，沿用现有模式。
- 明确预期行为、边界条件和验证方式。
- 涉及数据格式变更时，**优先设计成不需要停机迁移**（例如新旧格式并存、读时兼容），
  并在文档里写清兼容边界与最终清理条件。

## 五、验证要求

- 声称「修好了」之前必须有证据：跑通的测试、编译输出、或可复现的手工验证步骤。
- **验证要覆盖失败路径**，不只是 happy path。例如给配置加校验，就要实际制造一次
  「配置缺失」确认它真的失败；给 CI 加一个检查步骤，就要确认坏输入能让它以非 0 退出码红掉。
  永远绿灯的门禁比没有门禁更危险。
- 测试不得依赖开发者本机的环境变量、网络或真实外部服务。环境相关的用例用
  `Assumptions` 条件跳过，而不是让它在别人机器上变红。
- 报告结果要如实：跳过了什么、没覆盖什么、哪部分只是编译通过没有实际运行，都要说明。

## 六、安全红线

- **绝不把真实密钥写进任何会被 git 追踪的文件**，包括 `application.yml` 的
  `${VAR:默认值}` 形式。本地真实值放 `.env` 或 `src/main/resources/application-local.yml`
  （两者均已在 `.gitignore` 中）。
- 生产配置**不要给凭据类变量设默认值**。漏配时应当启动失败，而不是静默连上错误的服务。
- 发现密钥已进入仓库或已在本地明文留存时，除了清理，还必须提示**轮换**——
  清理代码挽回不了已经泄露的凭证。
- 部署工作流（`deploy.yml`）**绝不能加 `pull_request` 触发**。这是公开仓库，
  fork 的 PR 一旦能触发部署，任何人都能在服务器上执行任意代码。详见 `DEPLOY.md`。
- `docker.sock` 挂载等同于宿主机 root 权限。任何关于工具沙箱安全性的判断，上限都是这一条。

## 七、代码风格

- 沿用所在文件既有的注释密度、命名与惯用法，不要引入与周围不一致的风格。
- 注释解释**为什么**，不复述代码在做什么。非显而易见的约束、坑和历史包袱值得写。
- 不要留下未被调用的死代码——它会让后来者误以为那是「正确的那一套」。
- 异常不要吞掉；日志用 SLF4J，不要用 `System.out.println` 或 `printStackTrace`。
- **不要打印整个对象或序列化结果**。`JsonUtils` 曾因此把用户的服务商 API Key 明文写进
  stdout 与 `logs/agent-x.log`，使落库加密失去意义。需要排查时打印标识字段，不打印内容。
- **不要引入第二个 SLF4J provider**。`spring-boot-starter-logging` 已提供 logback-classic；
  再加一个（如 tinylog）会让 SLF4J 告警并任选其一，另一套配置静默失效。
  只依赖 `slf4j-api` 的库不需要额外 provider。
