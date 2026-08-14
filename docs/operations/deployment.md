# 部署指南

> 💬 **一句话人话**：这篇讲怎么把项目跑到一台服务器上，以及怎么让它以后自动更新。
> 想快速上手看[根目录 DEPLOY.md](../../DEPLOY.md)；想搞明白每个部件为什么这么配，看这篇。

---

## 目录

- [1. 部署拓扑](#1-部署拓扑)
- [2. 资源配额](#2-资源配额)
- [3. 环境变量](#3-环境变量)
- [4. 首次部署](#4-首次部署)
- [5. CI/CD 自动部署](#5-cicd-自动部署)
- [6. 版本追溯与回滚](#6-版本追溯与回滚)
- [7. 国内网络注意事项](#7-国内网络注意事项)
- [8. 运维检查清单](#8-运维检查清单)

---

## 1. 部署拓扑

```
                      公网
                        │
                     :80│
                ┌───────▼────────┐
                │  nginx         │  反向代理
                └───┬────────┬───┘
              /api/ │        │ /
          ┌─────────▼──┐  ┌──▼──────────┐
          │  backend   │  │  frontend   │
          │  :8088     │  │  :3000      │
          │ Spring Boot│  │  Next.js    │
          └──┬──────┬──┘  └─────────────┘
             │      │
      ┌──────▼──┐ ┌─▼──────────┐
      │RabbitMQ │ │ 阿里云 RDS  │  PostgreSQL + PGVector
      └─────────┘ └────────────┘        （外部托管）
             │
      ┌──────▼──────────┐
      │ /var/run/       │  用于 MCP 工具容器管理
      │ docker.sock     │
      └─────────────────┘

      ┌─────────────────┐
      │ runner          │  GitHub Actions 自托管 runner
      └─────────────────┘  （出站连接，不开入站端口）
```

**数据库不在 compose 里** —— 用的是外部阿里云 RDS，
`DB_HOST` / `VECTOR_DB_HOST` 指向同一个实例。

---

## 2. 资源配额

`docker-compose.yml` 中的限制：

| 服务 | 内存 | CPU | 说明 |
| --- | --- | --- | --- |
| backend | 1536M | 1.2 | JVM 堆 `-Xmx768m` |
| frontend | 768M | 0.6 | |
| rabbitmq | 512M | 0.3 | |
| runner | 512M | 0.3 | 只做拉取重启 |
| nginx | 未限制 | 未限制 | |

> ⚠️ **backend 的 1.2 CPU 是个有历史的数字**。JVM 在 CPU 配额 1.2 下
> `Runtime.availableProcessors()` 返回 2，导致 `ForkJoinPool.commonPool()`
> 并行度只有 1。RAG 流式问答曾因此被串行化，
> 见[排查记录 1.4](troubleshooting-log.md#14-根因三并发被串行化)。
>
> 现在业务代码已改用专用线程池，但**调整这个数字前请先理解它对线程池的影响**。

---

## 3. 环境变量

`.env` 位于服务器上的项目目录，**不在仓库中**，CI 也不会覆盖它。

### 必填

```bash
# 数据库（阿里云 RDS）
DB_HOST= DB_PORT= DB_USER= DB_PASSWORD= DB_NAME=

# 消息队列
RABBITMQ_PASSWORD=

# 对象存储
S3_SECRET_ID= S3_SECRET_KEY= S3_BUCKET_NAME= S3_ENDPOINT= S3_DOMAIN=

# 模型服务
SILICONFLOW_API_KEY=

# 服务商配置加密密钥，用 `openssl rand -base64 32` 生成
CONFIG_ENCRYPTION_KEY=

# 邮件
MAIL_SMTP_USERNAME= MAIL_SMTP_PASSWORD=
```

> ⚠️ `CONFIG_ENCRYPTION_KEY` 缺失或长度非法时**后端启动即失败**（`EncryptionKeyValidator`），
> 这是刻意设计——它用于加密用户填写的模型服务商 API Key，静默回落默认值比启动失败危险得多。
>
> **更换该密钥会使已存的服务商配置无法解密**，用户需重新填写 API Key。首次部署生成一次后
> 请妥善保存，勿随部署重新生成。

### 超时配置

```bash
LLM_REQUEST_TIMEOUT_SECONDS=60    # 非流式：意图识别/改写/扩展
LLM_STREAM_TIMEOUT_SECONDS=300    # 流式对话
```

> 这两项来自[线上卡死问题的修复](troubleshooting-log.md#12-根因一llm-客户端超时是-1-小时)。
> 原代码写死 1 小时，等同于没有超时。**调大之前先想清楚：
> 超时越长，故障暴露越晚。**

### CI/CD 相关（仅部署机需要）

```bash
DEPLOY_PATH=/home/admin/rag-agent-platform
GITHUB_PAT=              # 细粒度 PAT，仅需 Administration: Read and write
GITHUB_REPO=NEDONION/rag-agent-platform
RUNNER_NAME=aliyun-lightweight
IMAGE_TAG=               # 由 CI 自动写入，记录当前线上 commit
```

### 国内加速（可选）

```bash
APT_MIRROR=http://mirrors.aliyun.com
RUNNER_DOWNLOAD_BASE=https://ghfast.top/https://github.com/actions/runner/releases/download
```

---

## 4. 首次部署

```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com | sh

# 2. 获取代码
git clone https://github.com/NEDONION/rag-agent-platform
cd rag-agent-platform

# 3. 配置环境变量
cp .env.example .env && vim .env

# 4. 登录镜像仓库
docker login --username=<用户名> crpi-c6nc3ef4yktaqunc.cn-beijing.personal.cr.aliyuncs.com

# 5. 启动
sudo docker compose up -d

# 6. 验证
curl -i http://localhost:8088/api/health
curl -i http://localhost:3000/api/health
```

---

## 5. CI/CD 自动部署

工作流分两条，**职责与触发条件严格分离**：

| 工作流 | 文件 | 触发 | 是否接触服务器 |
| --- | --- | --- | --- |
| CI（校验） | `.github/workflows/ci.yml` | PR → main、手动 | ❌ 否 |
| Deploy（部署） | `.github/workflows/deploy.yml` | **仅** push main、手动 | ✅ 是 |

### 5.0 CI 校验（不碰服务器）

三个并行 job，不需要任何服务器凭据：

| Job | 命令 | 守住什么 |
| --- | --- | --- |
| 后端编译与测试 | `mvn -B test` | 编译通过；`EncryptUtilsTest` 锁住「v1 遗留密文仍可解密」——该不变量一旦回归，线上全部存量服务商配置立刻读不出来 |
| 前端构建 | `pnpm install` + `pnpm build` | Next.js 构建通过 |
| Nginx 配置校验 | 挂进 `conf.d/` 跑 `nginx -t` | 配置语法错误。用 `--add-host` 让 `proxy_pass` 里的 `backend`/`frontend` 可解析，否则 nginx 在配置检查阶段就会 emerg 退出 |

> CI 刻意**不设置** `CONFIG_ENCRYPTION_KEY`：测试自带密钥，而缺少该变量时
> 「密钥缺失应启动失败」的两个用例才会真正执行（配了则自动跳过）。

本地提交前跑一遍相同命令，见[本地开发指南](../development/local-setup.md)。

### 5.1 部署流程

push 到 `main` 后自动完成构建与部署。

```
GitHub                              阿里云服务器
──────                              ───────────
push main
   │
   ├─ build (ubuntu-latest)
   │    构建前后端镜像 → 推 ACR
   │
   ├─ config (ubuntu-latest)
   │    打包 docker-compose.yml
   │    与 deploy/nginx.conf 为 artifact
   │
   └─ deploy (self-hosted) ───────→ runner 主动轮询领取
                                      │
                                      ├─ 下载 artifact
                                      ├─ 写入 IMAGE_TAG 到 .env
                                      ├─ docker compose pull backend frontend
                                      ├─ docker compose up -d backend frontend
                                      ├─ docker compose restart nginx
                                      └─ 健康检查
```

### 为什么不用 SSH

自托管 runner 主动向 GitHub 轮询（纯出站），因此：

- 服务器**不需要开放 SSH 或任何入站端口**
- GitHub Secrets 里**不存放任何服务器凭据**（只需 3 个：`ACR_USERNAME`、`ACR_PASSWORD`、`DEPLOY_PATH`）

详细对比见[排查记录第二部分](troubleshooting-log.md#21-为什么不用-ssh)。

### 三个必须遵守的约束

**① 部署命令必须显式指定服务名**

```bash
# ❌ 会把 runner 自己也重建，杀掉正在执行的部署任务
docker compose up -d

# ✅
docker compose up -d backend frontend
docker compose restart nginx
```

**② `deploy.yml` 绝不能加 `pull_request` 触发**

这是公开仓库。一旦 fork 的 PR 能触发工作流，任何人都能在服务器上执行任意代码。

**③ 部署 job 不能用 `actions/checkout`**

它会在服务器上执行 `git clone github.com`，而国内服务器到 `github.com:443`
极不稳定。改用 artifact 传递配置文件，
见[排查记录 3.10](troubleshooting-log.md#310-部署-job-在服务器上-checkout-失败)。

---

## 6. 版本追溯与回滚

每次部署会把 commit SHA 写进服务器 `.env` 的 `IMAGE_TAG`：

```yaml
image: .../rag-agent-platform:backend-${IMAGE_TAG:-latest}
```

**查当前线上版本**：

```bash
grep IMAGE_TAG /home/admin/rag-agent-platform/.env
```

**回滚到任意历史版本**：

```bash
cd /home/admin/rag-agent-platform
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=<目标commit-sha>|' .env
docker compose up -d backend frontend
```

镜像同时打了 `<sha>` 和 `latest` 两个标签，所以任何历史 commit 都能回滚。

---

## 7. 国内网络注意事项

实测数据（2026-08，阿里云北京轻量）：

| 目标 | 状态 |
| --- | --- |
| Docker Hub | ✅ 通畅 |
| `download.docker.com` | ❌ 连接重置 |
| `github.com:443`（git） | ❌ 超时 |
| GitHub Release 直连 | ⚠️ 25 KB/s |
| `ghfast.top` 加速 | ✅ 1.2 MB/s |
| ubuntu 官方源 | ⚠️ 352 KB/s |
| `mirrors.aliyun.com` | ✅ 秒级 |
| `*.actions.githubusercontent.com` | ✅ 通畅（runner 靠它工作） |

**关键经验**：不要笼统地说「网络不行」，要精确到**哪个域名不行**——
Docker Hub 通而 download.docker.com 不通这个区分，直接决定了修复方向。

> ⚠️ **换源的边界**：系统包和语言包可以换镜像站（有 GPG 签名/校验和保护）。
> **可执行二进制**（如 actions-runner）只有在**强制校验官方 SHA256** 的前提下
> 才可以走镜像站，否则宁可慢也要走官方源。

---

## 8. 运维检查清单

### 日常

```bash
# 服务状态
sudo docker compose ps

# 后端日志
sudo docker compose logs -f --tail=100 backend

# runner 状态
sudo docker compose logs --tail=30 runner

# 磁盘
df -h && docker system df
```

### 部署后必查

- [ ] `curl http://<IP>/api/health` 返回 200（走 nginx，同时验证代理配置）
- [ ] `curl http://<IP>/` 返回 200
- [ ] `.env` 中 `IMAGE_TAG` 与预期 commit 一致
- [ ] 日志中无 LLM 超时异常激增

### 升级 runner 版本时

`deploy/runner/Dockerfile` 中的 `RUNNER_VERSION` 与 `RUNNER_SHA256`
**必须同步更新**，否则校验必然失败。哈希取法：

```bash
curl -s https://api.github.com/repos/actions/runner/releases/tags/v<版本> \
  | grep -o 'BEGIN SHA linux-x64 -->[0-9a-f]*'
```

---

## 相关文档

- [根目录 DEPLOY.md](../../DEPLOY.md) —— 快速上手版
- [排查记录](troubleshooting-log.md) —— 部署过程踩过的全部坑
- [性能优化](performance.md) —— 资源配额与线程池
- [安全实践](security.md) —— 部署相关的安全边界
- [本地开发](../development/local-setup.md) —— 开发环境搭建
- [系统架构](../architecture/overview.md) —— 各服务的职责
