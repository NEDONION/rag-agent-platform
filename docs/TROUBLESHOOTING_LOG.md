# 线上问题排查与 CI/CD 落地记录

> 本文档记录线上实际遇到的问题、排查过程、根因和修复，以及部署方式从「手动推镜像」演进到「自动化 CI/CD」的完整过程。
>
> **持续更新** —— 每遇到一个新问题就往后追加一节，保留错误原文，便于日后检索。

**最后更新**：2026-08-12

> 📖 **怎么读**：每一节开头都有一段 **「一句话人话」**，用大白话说清这节讲什么。
> 只想知道发生了什么，看那一句就够；要动手修或深究原理，再往下看细节。

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
  - 3.1 仓库名对不上 · 3.2 CI nginx 校验失败 · 3.3 不是 git 仓库
  - 3.4 docker 权限不足 · 3.5 令牌明文泄露 · 3.6 download.docker.com 不通
  - 3.7 apt 源太慢 · 3.8 no tracking information · 3.9 runner tarball 25 KB/s
  - 3.10 部署 job checkout 失败
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

> 💬 **一句话人话**：代码里写着「等模型回复最多等 1 小时」。1 小时约等于永远不超时——
> 对面挂了，我们这边还在傻等，页面就一直转圈，连个错误都不报。

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

> 💬 **一句话人话**：页面显示「正在检索文档」，但这时候程序其实已经去干别的了——
> 它要连着问大模型三四个问题（理解意图、改写问题…）才会更新提示。
> 所以你看到「卡在检索」，其实压根不是检索慢，是卡在这几次提问上。

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

> 💬 **一句话人话**：Java 有个默认的「公共任务池」，这台机器只分到 1.2 个 CPU，
> 算下来这个池子同时只能干 1 件事。而问答大部分时间是在干等模型返回（不占 CPU），
> Java 却看不出来这是在等，不会多派人手。结果就是**两个人同时提问，第二个必须排队**——
> 这就是「一开始卡死、过一会儿又好了」的真相。

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

> 💬 **一句话人话**：nginx 转发请求给后端时用了老版协议（HTTP/1.0），
> 而「一个字一个字往外吐」这种流式回复在老协议下传不可靠。
> 配置文件里前端那段写对了，后端那段漏了一行。

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

> 💬 **一句话人话**：浏览器和服务器之间那根「长连接」也设了个近乎无限的超时。
> 这是最后一道保险，保险设成永不触发，等于没装。

| 位置 | 修改前 | 修改后 |
|---|---|---|
| `RagQaDatasetAppService`（两处） | `new SseEmitter(Long.MAX_VALUE)` | 10 分钟 |
| `AbstractMessageHandler.CONNECTION_TIMEOUT` | 3000000L（50 分钟） | 10 分钟 |

这两个值是**兜底**，不是主要防线 —— 主要防线是根因一的 LLM 客户端超时。收敛它们是为了保证任何漏网的挂起最终都会被切断，并通过 `onTimeout` 回调告知前端，而不是让页面无限转圈。

---

# 第二部分：CI/CD 落地

## 2.1 为什么不用 SSH

> 💬 **一句话人话**：SSH 部署等于「让 GitHub 主动敲你服务器的门」，
> 那你就得把门（22 端口）对全世界开着，还得把钥匙（私钥）交给 GitHub 保管。
> 公司里都反过来做：**让服务器主动去问 GitHub「有活儿吗」**，
> 门一直关着，也不用把钥匙交出去。

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

> 💬 **一句话人话**：这三个坑都源于同一件事——干活的 runner 自己也是个容器，
> 它「站在容器里操作容器」，所以自杀、路径、网络三方面都容易出岔子。

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

## 3.6 构建 runner 镜像卡在 download.docker.com

> 💬 **一句话人话**：装 docker 命令行工具时要先从 docker 官网下个密钥，
> 但那个网址国内连不上。好在同一时刻 Docker Hub 是通的——
> 于是改成直接从官方镜像里把现成的程序拷过来，绕开那个网址。

```
curl: (35) Recv failure: Connection reset by peer
------
failed to solve: process "/bin/sh -c apt-get update && apt-get install ...
  && curl -fsSL https://download.docker.com/linux/ubuntu/gpg ..." 
  did not complete successfully: exit code: 35
```

**原因**：国内服务器访问 `download.docker.com` 会被连接重置。原 Dockerfile 需要从那里拿 GPG key 才能添加 docker 的 apt 源。

**关键观察**：同一次构建里 `ubuntu:24.04` 拉取是**正常**的 —— 说明 Docker Hub 通，只有 `download.docker.com` 这一个域名不通。这个区分决定了修复方向。

**修复**：多阶段构建，直接从官方 `docker:28-cli` 镜像拷贝二进制，彻底不碰那个 apt 源。

```dockerfile
FROM docker:28-cli AS dockercli

FROM ubuntu:24.04
...
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins/docker-compose \
                      /usr/local/libexec/docker/cli-plugins/docker-compose
```

> 顺带去掉了只为导入 GPG key 而安装的 `gnupg`。

## 3.7 apt 官方源太慢 → 换阿里云镜像

> 💬 **一句话人话**：装系统软件时默认从国外服务器下载，只有 352 KB/s。
> 服务器本来就在阿里云上，改成从阿里云自己的镜像站下载，快到几乎不用等。

构建日志里：

```
Fetched 32.1 MB in 1min 31s (352 kB/s)
```

光拉软件包列表就花了 1 分半。服务器本身就在阿里云上，换成 `mirrors.aliyun.com` 后是秒级。

**两个容易踩的细节**：

**① Ubuntu 24.04 改用了 DEB822 格式**，源文件不再是 `/etc/apt/sources.list`，而是
`/etc/apt/sources.list.d/ubuntu.sources`。网上大量教程针对老格式，照抄无效。

**② 必须用 `http` 而不是 `https`。** 基础镜像里还没有 `ca-certificates`（它正是要装的包之一），
https 源会因无法校验证书而失败 —— 典型的先有鸡还是先有蛋。apt 包自带 GPG 签名，
完整性不依赖 TLS，用 http 是安全的。

```dockerfile
ARG APT_MIRROR=http://mirrors.aliyun.com

RUN if [ -n "$APT_MIRROR" ]; then \
      sed -i \
        -e "s|https\?://archive.ubuntu.com/ubuntu|${APT_MIRROR}/ubuntu|g" \
        -e "s|https\?://security.ubuntu.com/ubuntu|${APT_MIRROR}/ubuntu|g" \
        -e "s|https\?://ports.ubuntu.com/ubuntu-ports|${APT_MIRROR}/ubuntu-ports|g" \
        /etc/apt/sources.list.d/ubuntu.sources; \
    fi
```

> amd64 用 `archive`/`security.ubuntu.com`，arm64 用 `ports.ubuntu.com`，路径也不同
> （`/ubuntu` vs `/ubuntu-ports`），三条规则都要写。
>
> 做成 `APT_MIRROR` 构建参数，传空字符串即可退回官方源。

**关于 runner 二进制**：见 3.9 —— 它确实慢到不可用，但解法不是简单地换镜像。

## 3.8 `git pull` 报 no tracking information

```
There is no tracking information for the current branch.
Please specify which branch you want to merge with.
```

**原因**：3.3 里用 `git checkout -f -B feat/cicd FETCH_HEAD` 建的分支，
**指向的是一个 commit 而非远程分支**，因此没有建立上游关联。

**修复**（一次性）：

```bash
git branch --set-upstream-to=origin/feat/cicd feat/cicd
```

> 注意 `git pull` 其实已经 fetch 成功了（日志里能看到 `13e917c..6a93706`），
> 只是不知道该合并哪个分支。不是网络问题。

## 3.9 runner tarball 下载 25 KB/s —— 用镜像站 + 校验和

> 💬 **一句话人话**：要下一个 215MB 的程序包，直连 GitHub 只有 25 KB/s，
> 得下 2 个半小时。换成加速站 3 分钟搞定。
> **但加速站是别人的服务器，怎么保证他没在包里塞东西？**
> 办法是拿 GitHub 官方公布的「指纹」（SHA256）比对——
> 文件哪怕改了一个字，指纹就对不上，构建当场失败。

actions-runner 的 tarball 有 **215.5 MB**，从国内直连 github.com 实测：

```
实测速度: 24734.000 B/s
curl: (28) Operation timed out after 14640 milliseconds
      with 371016 out of 226035903 bytes received
```

curl 自己算出的预计耗时：**2 小时 32 分**。不可用。

### 先测速再决定

用 `--max-time 8` 对几个候选源打分，不必下完整个文件：

```bash
for M in "https://ghfast.top/https://github.com" \
         "https://gh-proxy.com/https://github.com" \
         "https://ghproxy.net/https://github.com" \
         "https://github.com"; do
  printf '%-45s' "$M"
  curl -o /dev/null -sL --max-time 8 -w '%{speed_download} B/s\n' \
    "$M/actions/runner/releases/download/v2.336.0/actions-runner-linux-x64-2.336.0.tar.gz"
done
```

实测结果（2026-08，阿里云北京轻量）：

| 源 | 速度 | 215MB 预计耗时 |
|---|---|---|
| **ghfast.top** | **1.2 MB/s** | **~3 分钟** ✅ |
| gh-proxy.com | 138 KB/s | ~26 分钟 |
| github.com 直连 | 32 KB/s | ~1.9 小时 |
| ghproxy.net | 22 KB/s | ~2.7 小时 |

> 差异高达 55 倍，**不测就选等于抓阄**。镜像站的速度会随时间变化，
> 下次遇到慢的时候重新测一遍，别照抄这张表。

### 关键：换镜像的同时必须校验

这个二进制在服务器上拥有 root 级权限。**单纯换用第三方镜像是不可接受的** ——
但配合官方 SHA256 校验就是安全的：镜像站若返回被篡改的文件，校验失败、构建中止。

```dockerfile
ARG RUNNER_DOWNLOAD_BASE=https://github.com/actions/runner/releases/download
ARG RUNNER_SHA256=04cf0be1aff4c3ec3554466c39124ca250e3effd8873bb7e8d68535aa9505d5d

RUN curl -fL --retry 5 --retry-delay 3 -o runner.tar.gz \
      "${RUNNER_DOWNLOAD_BASE}/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
    && echo "${RUNNER_SHA256}  runner.tar.gz" | sha256sum -c - \
    && tar xzf runner.tar.gz
```

哈希从官方 release 页面获取：

```bash
curl -s https://api.github.com/repos/actions/runner/releases/tags/v2.336.0 \
  | grep -o 'BEGIN SHA linux-x64 -->[0-9a-f]*'
```

构建时看到这行即为通过，说明拿到的文件与官方发布逐字节一致：

```
04cf0be1...05d5d  runner.tar.gz: OK
```

> **升级 runner 版本时，`RUNNER_SHA256` 必须同步更新**，否则校验必然失败。

### 配置方式

`APT_MIRROR` 和 `RUNNER_DOWNLOAD_BASE` 都提到了 `docker-compose.yml` 的
`build.args`，直接写 `.env` 即可，不必每次记 `--build-arg`：

```bash
echo 'RUNNER_DOWNLOAD_BASE=https://ghfast.top/https://github.com/actions/runner/releases/download' >> .env
```

### 更彻底的方案（备选）

把 runner 镜像也放进 CI 构建、推到自己的 ACR，服务器直接从 ACR 拉取（同区域，
带宽充足），彻底不依赖服务器能否访问 github.com。

代价是有先后顺序问题：需要 workflow 先合入 main 才能手动触发，而合并本身会触发
部署、此时 runner 尚不存在。绕得开，但比镜像站这条路复杂。当前规模下镜像站够用。

## 3.10 部署 job 在服务器上 checkout 失败

> 💬 **一句话人话**：自动部署的最后一步要先把代码拉到服务器上，
> 但服务器连 GitHub 拉代码就是不通（还是那个网速问题），重试三次全超时。
> 解法是——**这一步根本不需要整个代码仓库**，只要两个配置文件。
> 于是让云端先把这两个文件打包好，服务器直接取包，完全不碰 GitHub 的代码服务。

首次自动部署时，两个镜像都构建推送成功，但部署这一步失败：

```
fatal: unable to access 'https://github.com/NEDONION/rag-agent-platform/':
  GnuTLS recv error (-110): The TLS connection was non-properly terminated.
...
fatal: unable to access 'https://github.com/NEDONION/rag-agent-platform/':
  Failed to connect to github.com port 443 after 130394 ms: Couldn't connect to server
The process '/usr/bin/git' failed with exit code 128
```

**原因**：`actions/checkout` 会在 runner 所在机器上执行 `git clone github.com`，
而服务器到 `github.com:443` 的连接正是 3.9 里那个 25 KB/s 的问题，三次重试全部超时。

**关键观察**：runner 与 GitHub 的通信**完全正常**——它成功领到了这个任务。
那条链路走的是 `*.actions.githubusercontent.com`，是通的；
**不通的只有 `github.com:443` 这一个入口**。

> 又一次印证了 3.6 的教训：把「网络不行」精确到「哪个域名不行」，解法就出来了。

**修复**：部署这一步其实只需要 `docker-compose.yml` 和 `deploy/nginx.conf` 两个文件，
根本不需要整个仓库。让云端 runner 打包成 artifact，自托管 runner 下载即可——
artifact 走的正是那条已被证明可用的链路。

```yaml
  config:
    runs-on: ubuntu-latest          # 云端，github.com 畅通
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-artifact@v4
        with:
          name: deploy-config
          path: |
            docker-compose.yml
            deploy/nginx.conf

  deploy:
    needs: [build, config]
    runs-on: [self-hosted, deploy]   # 服务器，github.com 不通
    steps:
      - uses: actions/download-artifact@v4   # ← 不用 checkout
        with:
          name: deploy-config
          path: deploy-config
```

> **一般化的经验**：自托管 runner 在受限网络里，要尽量把「需要访问外网」的活
> 留在云端 job，只把「必须在本机执行」的活放到自托管 job。
> 两者之间用 artifact 传递产物。

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

### 8. 网络故障要先缩小到具体域名

`download.docker.com` 不通时，同一次构建里 Docker Hub 是通的。
**「网络不行」不是一个可操作的结论，「这一个域名不通」才是** —— 前者让人想到挂代理，
后者直接指向「绕开这个域名」这个更简单也更稳的解法。

排查时先问：同一环境下，哪些能通、哪些不能通？

### 9. 国内环境优先考虑换源，但要分清哪些能换

| 类型 | 能否换源 | 理由 |
|---|---|---|
| 系统包（apt / yum） | ✅ 能 | 有 GPG 签名，镜像站不影响完整性 |
| 语言包（npm / pip / maven） | ✅ 能 | 同上，有校验和 |
| **可执行二进制**（如 actions-runner） | ⚠️ **仅在校验哈希的前提下** | 拿到 root 级权限，无校验时来源可信度不能牺牲 |

关键区分：**反对的不是「用镜像站」，而是「无校验地信任镜像站」。**
拿到官方发布的 SHA256 并强制校验后，镜像站给的文件只要有一个字节不对就会构建失败，
此时用镜像站是安全的。见 [3.9](#39-runner-tarball-下载-25-kbs--用镜像站--校验和)。

没有官方哈希可对照时，才回到「宁可慢也不换源」。

### 10. 抄教程前先确认版本

Ubuntu 24.04 的 apt 源改成了 DEB822 格式，路径从 `/etc/apt/sources.list` 变成
`/etc/apt/sources.list.d/ubuntu.sources`。网上绝大多数换源教程针对老格式，
照抄会「执行成功但没有任何效果」—— 这比报错更难发现。

**改完一定要验证结果**，而不是看命令有没有报错。

### 12. 受限网络里，让云端干需要外网的活

自托管 runner 所在的机器往往网络受限。把「要访问外网」的步骤留在云端 job，
只把「必须在本机执行」的步骤放到自托管 job，中间用 artifact 传递产物。

`actions/checkout` 是最容易忽略的一个——它看起来只是「取代码」，
实际会在**执行它的那台机器上**发起 git 网络请求。

### 11. 引导时先看是不是自己埋的坑

`no tracking information` 这个报错，根源是前一步用 `git checkout -B <branch> FETCH_HEAD`
建分支时没有建立上游关联。**排查一个报错时，先回顾前几步自己做了什么**，
往往比搜索报错信息更快。

---

## 相关链接

- [PR #1 修复 LLM 对话卡死与并发串行化](https://github.com/NEDONION/rag-agent-platform/pull/1)
- [PR #2 接入 GitHub Actions 自动构建与部署](https://github.com/NEDONION/rag-agent-platform/pull/2)
- [部署指南 DEPLOY.md](../DEPLOY.md)
