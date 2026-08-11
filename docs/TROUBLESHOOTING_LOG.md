# 线上问题排查与 CI/CD 落地记录

> 本文档记录线上实际遇到的问题、排查过程、根因和修复，以及部署方式从「手动推镜像」演进到「自动化 CI/CD」的完整过程。
>
> **持续更新** —— 每遇到一个新问题就往后追加一节，保留错误原文，便于日后检索。

**最后更新**：2026-08-11

---

## 目录

- [第一部分：LLM 对话卡死](#第一部分llm-对话卡死)
  - [1.1 问题现象](#11-问题现象)
  - [1.2 根因一：LLM 客户端超时是 1 小时](#12-根因一llm-客户端超时是-1-小时)
  - [1.3 根因二：进度提示与实际执行不同步](#13-根因二进度提示与实际执行不同步)
  - [1.4 根因三：并发被串行化](#14-根因三并发被串行化)
  - [1.5 根因四：nginx 回源降级到 HTTP/1.0](#15-根因四nginx-回源降级到-http10)
  - [1.6 根因五：SSE 超时形同虚设](#16-根因五sse-超时形同虚设)
- [第二部分：CI/CD 落地](#第二部分cicd-落地)
  - [2.1 为什么不用 SSH](#21-为什么不用-ssh)
  - [2.2 最终架构](#22-最终架构)
  - [2.3 实现中的三个坑](#23-实现中的三个坑)
- [第三部分：部署过程踩坑实录](#第三部分部署过程踩坑实录)
- [附录：经验教训](#附录经验教训)

---

# 第一部分：LLM 对话卡死

## 1.1 问题现象

线上 `/explore` 页面的 LLM 对话出现两类现象，**且全程不报任何错误**：

**现象 A —— RAG 问答长时间停在「正在数据集中检索…」**

<!-- 截图占位：把 RAG 问答卡住的截图存为 docs/images/rag-stuck.png -->
![RAG 问答卡在检索阶段](./images/rag-stuck.png)

界面显示「文档检索 / 正在数据集中检索...」后再无任何更新，用户无法判断是还在处理还是已经挂掉。

**现象 B —— Agent 对话延迟十分钟才回复**

<!-- 截图占位：把 Agent 对话延迟的截图存为 docs/images/agent-delay.png -->
![Agent 对话延迟十分钟](./images/agent-delay.png)

用户 14:30 提问，助手 14:40 才给出回复。**整整 10 分钟**，且期间没有任何错误提示。

> 这种「整数级」的延迟通常不是模型慢，而是某处超时或重试到点了才放行。

**关键判断**：不报错比报错更糟。报错至少能定位，而「一直转圈」意味着调用链上**任何一层都没有设置有效的超时**，故障被无限期地隐藏了起来。

---

## 1.2 根因一：LLM 客户端超时是 1 小时

**位置**：`src/main/java/org/lucas/infrastructure/llm/factory/LLMProviderFactory.java`

四处模型构造全部写着：

```java
.timeout(Duration.ofHours(1))
```

一小时的超时**等同于没有超时**。上游（硅基流动等服务商）一旦挂起，请求就挂满一小时，既不报错也不降级。

### 修复

改为分级超时，并支持环境变量覆盖：

| 场景 | 环境变量 | 默认值 | 理由 |
|---|---|---|---|
| 非流式（意图识别 / 语义改写 / 查询扩展） | `LLM_REQUEST_TIMEOUT_SECONDS` | 60s | 都是同步小请求，且卡在 SSE 事件之间，超时必须短 |
| 流式对话 | `LLM_STREAM_TIMEOUT_SECONDS` | 300s | 允许长一些，但绝不能形同虚设 |

```java
private static final Duration BLOCKING_TIMEOUT  = timeoutFromEnv("LLM_REQUEST_TIMEOUT_SECONDS", 60);
private static final Duration STREAMING_TIMEOUT = timeoutFromEnv("LLM_STREAM_TIMEOUT_SECONDS", 300);
```

> **上线后如果日志里开始出现 LLM 超时异常，这是好事** —— 说明上游确实会挂，只是以前被 1 小时的超时掩盖成了「卡死」。

---

## 1.3 根因二：进度提示与实际执行不同步

**位置**：`src/main/java/org/lucas/application/rag/service/RagQaDatasetAppService.java`

这是「卡在检索」这个现象的直接来源。发完 `"正在数据集中检索..."` 这条 SSE 事件之后，代码**连着执行了 3～4 次同步 LLM 调用**才发下一条事件：

```
sendSseData("正在数据集中检索...")   ← 前端显示这句，然后就不动了
   ↓
classifyIntent()                    ← 同步 LLM 调用
   ↓
checkRelevanceForDatasets()         ← 向量检索
   ↓
rewriteQuestion()                   ← 同步 LLM 调用
   ↓
expandQueries()                     ← 同步 LLM 调用
   ↓
sendIntentRewriteToClient()         ← 直到这里才发下一条事件
```

所以用户看到的「检索卡住」**压根不是检索慢**，是卡在这几次 LLM 预处理上。配合根因一的 1 小时超时，就是永久转圈。

### 修复

在每一步之间补发进度事件，两个 `processRagStreamChat*` 方法的全部分支都已覆盖：

```java
sendSseData(emitter, AgentChatResponse.build("正在理解问题意图...", MessageType.RAG_RETRIEVAL_PROGRESS));
IntentResult intentResult = classifyIntent(request.getQuestion(), userId);
...
sendSseData(emitter, AgentChatResponse.build("正在改写检索查询...", MessageType.RAG_RETRIEVAL_PROGRESS));
effectiveQuestion = rewriteQuestion(...);
```

> `classifyIntent` / `rewriteQuestion` / `expandQueries` 本身已有 try/catch 降级到原问题，所以**失败是安全的**；真正致命的是**挂起**，由根因一解决。

---

## 1.4 根因三：并发被串行化

这是「一开始直接卡死，过一会儿又好了」的真正来源，也是最隐蔽的一个。

两处流式问答用的是**无参**的 `CompletableFuture.runAsync(...)`：

```java
CompletableFuture.runAsync(() -> {
    processRagStreamChat(request, userId, emitter);
});
```

不传 executor 就会落到 `ForkJoinPool.commonPool()`。而：

```
docker-compose.yml:  backend 限制 cpus: "1.2"
        ↓
JVM:  Runtime.availableProcessors() = 2
        ↓
commonPool 并行度 = availableProcessors - 1 = 1
```

同时，这条链路里跑的是**纯阻塞 IO**（HTTP 调 LLM），而 ForkJoinPool **不会为普通阻塞调用做线程补偿**（只有 `ManagedBlocker` 才会）。

**结果：全站同一时刻只能有一个 RAG 问答在跑**，第二个用户的请求必须排队等第一个彻底结束。

> 对比：Agent 链路在 `PortalAgentSessionController` 里用的是 `Executors.newCachedThreadPool()`，不受此问题影响。只有 RAG 这条路踩了坑。

### 修复

改用专用固定线程池：

```java
private final ExecutorService ragStreamExecutor = Executors.newFixedThreadPool(8, runnable -> {
    Thread thread = new Thread(runnable, "rag-stream-chat");
    thread.setDaemon(true);
    return thread;
});
```

两处 `runAsync` 都显式传入该线程池。

> **验证方式**：这个问题**单人测试复现不出来**。必须两个人同时发起 RAG 问答，观察是否互相排队。

---

## 1.5 根因四：nginx 回源降级到 HTTP/1.0

**位置**：`deploy/nginx.conf`

```nginx
location / {
    proxy_pass http://frontend:3000;
    proxy_http_version 1.1;      # ← 这里有
    ...
}

location /api/ {
    proxy_pass http://backend:8088;
    # ← 这里没有！
    proxy_buffering off;
}
```

`/` 段配了 `proxy_http_version 1.1`，`/api/` 段漏了。nginx 默认以 **HTTP/1.0** 回源，而 SSE 在 1.0 下无法可靠流式推送。

已确认线上前端确实走 `/api/` 经 nginx 转发（页面上能看到 `/api/auth/config` 请求）。

### 修复

```nginx
location /api/ {
    proxy_pass http://backend:8088;
    proxy_http_version 1.1;
    proxy_set_header Connection "";   # 清空以启用 upstream keepalive
    proxy_buffering off;
    ...
}
```

> ⚠️ `nginx.conf` 是挂载进容器的，改完必须 `docker compose restart nginx` 才生效，`up -d` 不会重载它。

---

## 1.6 根因五：SSE 超时形同虚设

| 位置 | 修改前 | 修改后 |
|---|---|---|
| `RagQaDatasetAppService`（两处） | `new SseEmitter(Long.MAX_VALUE)` | 10 分钟 |
| `AbstractMessageHandler.CONNECTION_TIMEOUT` | 3000000L（50 分钟） | 10 分钟 |

这两个值是**兜底**，不是主要防线 —— 主要防线是根因一的 LLM 客户端超时。收敛它们是为了保证任何漏网的挂起最终都会被切断，并通过 `onTimeout` 回调告知前端，而不是让页面无限转圈。

---

# 第二部分：CI/CD 落地

## 2.1 为什么不用 SSH

最初的方案是 GitHub Actions 通过 SSH 登录服务器执行部署。这是**推(push)模式**：CI 主动连进服务器，所以服务器必须开放入站端口，CI 里必须保存服务器私钥。

公司环境几乎不这么做，因为生产机器通常压根不对公网开放。常见的替代：

| 方式 | 谁发起连接 | 典型场景 |
|---|---|---|
| **GitOps**（ArgoCD / Flux） | 集群主动拉 Git | K8s 环境的主流做法 |
| **K8s API**（`kubectl set image`） | CI 调 API Server | 有集群但没上 GitOps |
| **自托管 runner** | runner 主动连 GitHub | 机器在内网、无公网 IP |
| **云厂商部署服务**（SAE / CodeDeploy） | 云平台 agent 拉 | 托管环境 |

共同点：**连接方向是从内往外**，或者由一个已持有凭据的控制面代劳。服务器永远不需要开入站端口。

本项目是单台阿里云轻量服务器 + docker compose，够不上 K8s 那套，**自托管 runner 是最贴合的方案**。

---

## 2.2 最终架构

```
┌──────────────────────── GitHub ────────────────────────┐
│                                                         │
│  push main                                              │
│      │                                                  │
│      ├─→ build (ubuntu-latest)  构建镜像 → 推 ACR       │
│      │        ↑ 云端 runner，不占用服务器资源            │
│      │                                                  │
│      └─→ deploy (self-hosted) ──────┐                   │
└─────────────────────────────────────┼───────────────────┘
                                      │ runner 主动轮询
                                      │ （纯出站连接）
┌─────────────────────────────────────┼───────────────────┐
│  阿里云轻量服务器                     ↓                   │
│                              ┌─────────────┐            │
│                              │   runner    │            │
│                              └──────┬──────┘            │
│                                     │ docker.sock       │
│                    ┌────────────────┼────────────────┐  │
│                    ↓                ↓                ↓  │
│                 backend         frontend          nginx │
│                                                         │
│  不开放任何入站端口                                       │
└─────────────────────────────────────────────────────────┘
```

**收益**：

- 服务器不需要开放 SSH 或任何入站端口
- GitHub Secrets 从 7 个减到 3 个，不再存放任何服务器凭据
- 构建仍在云端完成，轻量服务器只做「拉取 + 重启」，几秒钟

**runner 本身是 `docker-compose.yml` 里的一个服务**，跟其他容器一起起停，不需要单独安装或配置 systemd。用 PAT 换取一次性注册令牌，退出时自动注销，不留僵尸 runner。

> ⚠️ **安全约束**：`deploy.yml` 只允许 `push` 到 main 触发，**绝不能加 `pull_request`**。这是公开仓库 —— 一旦 fork 的 PR 能触发工作流，任何人都能在服务器上执行任意代码。

---

## 2.3 实现中的三个坑

### 坑 1：runner 会把自己重启掉

runner 自己也在 `docker-compose.yml` 里。如果部署命令写成裸的 `docker compose up -d`，它会**连同 runner 一起重建，把正在执行的部署任务当场杀掉**。

```yaml
# ❌ 错误
docker compose up -d

# ✅ 正确：显式限定服务名
docker compose pull backend frontend
docker compose up -d backend frontend
docker compose restart nginx
```

### 坑 2：路径必须容器内外完全一致

runner 在容器里通过挂载的 `docker.sock` 操作**宿主机**的 docker。compose 把 `./deploy/nginx.conf` 这类相对路径解析成绝对路径后交给宿主机守护进程，**由守护进程按宿主机文件系统去找**。

所以项目目录必须挂载到与宿主机**完全相同**的绝对路径，否则挂载的就是错误位置：

```yaml
volumes:
  - ${DEPLOY_PATH}:${DEPLOY_PATH}    # 源与目标必须一致
```

### 坑 3：健康检查不能用 localhost

健康检查脚本跑在 **runner 容器内**，`localhost` 指向的是 runner 自己，不是宿主机。runner 与后端同在 `agentx-network` 上，必须按**服务名**访问：

```bash
# ❌ curl http://localhost:8088/api/health
# ✅
curl -fsS http://backend:8088/api/health
curl -fsS http://frontend:3000/api/health
```

---

# 第三部分：部署过程踩坑实录

按实际遇到的顺序记录，含错误原文，便于日后按报错信息检索。

## 3.1 `build-and-push.sh` 与 compose 的仓库名对不上

```bash
# build-and-push.sh
REPO="acr"                    # → 推到 lucas_acr/acr:backend-latest

# docker-compose.yml
image: .../lucas_acr/rag-agent-platform:backend-latest   # ← 拉的是这个
```

推上去的镜像服务器根本拉不到。已以 compose 为准统一为 `rag-agent-platform`。

## 3.2 CI 的 nginx 校验失败

```
nginx: [emerg] host not found in upstream "backend" in /etc/nginx/conf.d/default.conf:6
nginx: configuration file /etc/nginx/nginx.conf test failed
```

**原因**：`nginx -t` 在配置检查阶段就要解析 `proxy_pass` 里的 upstream 主机名。CI 环境里没有 `backend` 容器，DNS 解析不到就直接 emerg 退出。

**修复**：造两条 hosts 记录让名字可解析。校验的是配置语法，解析到哪个地址无关紧要。

```yaml
docker run --rm \
  --add-host backend:127.0.0.1 \
  --add-host frontend:127.0.0.1 \
  -v "$PWD/deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.27-alpine nginx -t
```

> **教训**：这个问题本地验证时是「通过」的 —— 因为本地 DNS 对未知域名有应答，**根本没有复现 CI 的干净环境**。后来用 `--network none` 复现出同样的报错，才算真正验证。详见[附录](#附录经验教训)。

## 3.3 服务器上不是 git 仓库

```
fatal: not a git repository (or any of the parent directories): .git
```

**原因**：当初是按 `DEPLOY.md` 里的**下载 zip** 方案部署的，不是 `git clone`，所以没有 `.git` 目录。

**修复**：不能删掉重 clone（`.env` 在里面），要原地补上 git：

```bash
cd /home/admin/rag-agent-platform
git init -q
git remote add origin https://github.com/NEDONION/rag-agent-platform.git
git fetch -q origin feat/cicd
git checkout -f -B feat/cicd FETCH_HEAD
```

`git checkout -f` 会覆盖代码文件（本来就该更新），但**不碰 `.env`** —— 它在 `.gitignore` 里，git 不管它。

> 补上 git 之后，以后更新代码就是 `git pull`，不用再下载解压覆盖。

## 3.4 docker 权限不足

```
permission denied while trying to connect to the Docker daemon socket
at unix:///var/run/docker.sock: ... connect: permission denied
```

**原因**：`admin` 用户不在 `docker` 组里。

**两种解法**：

```bash
# 方案 A：每次加 sudo（DEPLOY.md 原本就是这么写的）
sudo docker compose up -d --build runner

# 方案 B：加入 docker 组，之后不用 sudo（需退出重新登录才生效）
sudo usermod -aG docker admin
```

> 加进 docker 组等于拿到 root 级权限，这是 docker 的固有设计。单人服务器上可接受。

## 3.5 令牌明文泄露

配置 PAT 时曾用 `echo "GITHUB_PAT=github_pat_xxx" >> .env`，导致**令牌明文进入 shell history**，也曾被贴进聊天记录。

**该令牌已作废重建。**

**正确做法** —— 不回显、不进 history：

```bash
read -s -p "粘贴令牌然后回车: " T && echo "GITHUB_PAT=$T" >> .env && unset T && echo " 已写入"
```

---

# 附录：经验教训

### 1. 不报错比报错更糟

「一直转圈」意味着调用链上没有任何一层设置了有效超时，故障被无限期隐藏。**给每一层都设上合理的超时**，让故障尽早暴露成一个明确的错误，是可运维性的基础。

### 2. 超时值要分级，不能一刀切

同步小请求（意图识别）和流式长对话的合理超时差一个数量级。用同一个值必然一头过松一头过紧，而过松的那头就等于没有超时。

### 3. 阻塞 IO 绝不能跑在 ForkJoinPool.commonPool 上

`CompletableFuture.runAsync` 不传 executor 是个容易忽略的默认行为。在 CPU 受限的容器里，commonPool 并行度可能只有 1，直接把并发变成串行。**凡是阻塞 IO，一律显式传专用线程池。**

### 4. 进度提示必须贴着实际执行走

发完「正在检索」就去做三次 LLM 调用，等于骗用户。**每个耗时步骤前都要有对应的进度事件**，否则出问题时无法判断卡在哪一步。

### 5. 验证必须复现故障条件

`nginx -t` 那次，本地「通过」是假阳性 —— 本地 DNS 对未知域名有应答，没有复现 CI 的干净环境。

> **一次没有复现故障条件的验证，等于没有验证。**
>
> 正确姿势：先想办法**复现出失败**（如 `--network none`），确认看到了和线上/CI 一样的报错，再验证修复。

### 6. 同理，单人测试证明不了并发问题

根因三（并发串行化）在单人测试下完全正常。**必须在能触发该问题的规模下测量**。

### 7. 凭据永远不要用 echo 写入

会进 shell history。用 `read -s`，或直接编辑器里粘贴。

---

## 相关链接

- [PR #1 修复 LLM 对话卡死与并发串行化](https://github.com/NEDONION/rag-agent-platform/pull/1)
- [PR #2 接入 GitHub Actions 自动构建与部署](https://github.com/NEDONION/rag-agent-platform/pull/2)
- [部署指南 DEPLOY.md](../DEPLOY.md)
