# 部署指南

## CI/CD（推荐）

push 到 `main` 后自动完成：构建前后端镜像 → 推送到阿里云 ACR → SSH 登录服务器拉取重启 → 健康检查。
只改 `.md` / `docs/` 不会触发部署。也可以在 Actions 页面手动运行 `Deploy`。

PR 会跑 `CI` 工作流做校验（后端 `mvn compile`、前端 `pnpm build`、`nginx -t`），不碰服务器。

### 架构：为什么不用 SSH

构建跑在 GitHub 云端 runner，部署跑在**服务器上的自托管 runner**：

```
build  (ubuntu-latest) → 构建镜像、推 ACR      ← 不占用服务器资源
deploy (self-hosted)   → docker compose pull   ← 只做拉取重启，几秒钟
```

自托管 runner 主动向 GitHub 轮询任务，**纯出站连接**。所以：

- 服务器不需要开放 SSH 或任何入站端口
- GitHub Secrets 里不存放任何服务器凭据

runner 本身就是 `docker-compose.yml` 里的一个服务，跟其他容器一起起停，无需单独安装或配置 systemd。

> ⚠️ **安全约束**：`deploy.yml` 只允许 `push` 到 main 触发，**绝不能加 `pull_request`**。
> 这是公开仓库——一旦 fork 的 PR 能触发工作流，任何人都能在你的服务器上执行任意代码。

### 需要配置的 Secrets

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加：

| Secret | 说明 |
|---|---|
| `ACR_USERNAME` | ACR 用户名（如 `jiachengned`） |
| `ACR_PASSWORD` | ACR **访问凭证密码**，在容器镜像服务控制台设置，不是阿里云账号密码 |
| `DEPLOY_PATH` | 服务器上项目目录绝对路径，如 `/root/rag-agent-platform` |

就这三个，不再需要任何 SSH 相关的密钥。

### 在服务器上启动 runner（一次性）

**1. 生成 PAT**

GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → 新建，
仅授权本仓库，权限勾选 **Administration: Read and write**（用于注册 runner）。

**2. 填进服务器的 `.env`**

```bash
cd ~/rag-agent-platform
cat >> .env <<'EOF'
DEPLOY_PATH=/root/rag-agent-platform
GITHUB_PAT=github_pat_你刚才生成的令牌
GITHUB_REPO=NEDONION/rag-agent-platform
RUNNER_NAME=aliyun-lightweight
EOF
```

`DEPLOY_PATH` 必须与项目实际所在路径一致，写错会导致挂载指向错误位置。

**3. 起 runner**

```bash
docker compose up -d --build runner
```

**4. 确认注册成功**

```bash
docker compose logs -f runner
```

看到 `runner 已就绪，开始监听任务` 即可。同时 GitHub 仓库
**Settings → Actions → Runners** 里会出现一个 Idle 状态的 runner。

启动失败时日志会直接给出原因（PAT 无效 / 权限不足 / 仓库名写错），按提示改即可。

### 前置条件

- `DEPLOY_PATH` 目录已存在，其中的 `.env` 已配好（CI **不会**覆盖 `.env`，密钥只存在于服务器上）
- 服务器已 `docker login` 过 ACR，或凭证仍有效
- 服务器能出站访问 github.com（不需要任何入站端口）

### 注意：不要在部署脚本里用裸的 `up -d`

runner 自己也是 compose 的一个服务。如果部署命令写成 `docker compose up -d`，
它会连同 runner 一起重建，**把正在执行的部署任务当场杀掉**。
`deploy.yml` 里的命令因此都显式限定到 `backend frontend`。手动操作时同理。

### 版本与回滚

每次部署会把 commit SHA 写进服务器 `.env` 的 `IMAGE_TAG`，compose 据此拉取精确版本。
回滚到任意历史版本：

```bash
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=<目标commit-sha>|' .env
docker compose up -d
```

## 本地构建推送（应急）

```bash
# 登录 ACR
docker login --username=jiachengned crpi-c6nc3ef4yktaqunc.cn-beijing.personal.cr.aliyuncs.com

# 构建并推送
./build-and-push.sh
```

## 服务器部署

```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com | sh

# 2. 克隆项目
git clone https://github.com/NEDONION/rag-agent-platform
cd rag-agent-platform

# 2-替代
cd ~
rm -rf rag-agent-platform
curl -L --retry 5 --retry-delay 2 --connect-timeout 10 \
  -o main.zip https://codeload.github.com/NEDONION/rag-agent-platform/zip/refs/heads/main

unzip -q main.zip
mv rag-agent-platform-main rag-agent-platform
rm -f main.zip

# 3. 配置环境变量
cd rag-agent-platform/
vim .env  # 填写必填项

# 4. 登录 ACR
docker login --username=jiachengned crpi-c6nc3ef4yktaqunc.cn-beijing.personal.cr.aliyuncs.com

# 5. 启动
sudo docker compose up -d

# 6. 查看 backend 容器启动日志
sudo docker logs -f agentx-backend

# 7. 启动后验证 - 云端服务器
curl -i http://localhost:8088/api/health
curl -i http://localhost:3000/api/health
```

## 更新

本地：
```bash
./build-and-push.sh
```

服务器：
```bash
sudo docker compose pull
sudo docker compose up -d
```

## 环境变量必填项

```bash
# 数据库配置（已配置阿里云 RDS）
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=

# 消息队列
RABBITMQ_PASSWORD=强密码

# 对象存储
S3_SECRET_ID=七牛云AccessKey
S3_SECRET_KEY=七牛云SecretKey
S3_BUCKET_NAME=存储桶名
S3_DOMAIN=https://你的域名/

# AI 模型
SILICONFLOW_API_KEY=sk-xxx

# 前端配置
NEXT_PUBLIC_API_URL=http://你的服务器IP/api
NEXT_PUBLIC_WS_URL=ws://你的服务器IP/api
```

## 常用命令

```bash
docker compose ps              # 状态
docker compose logs -f         # 日志
docker compose restart         # 重启
docker compose down            # 停止
```
