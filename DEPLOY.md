# 部署指南

## CI/CD（推荐）

push 到 `main` 后自动完成：构建前后端镜像 → 推送到阿里云 ACR → SSH 登录服务器拉取重启 → 健康检查。
只改 `.md` / `docs/` 不会触发部署。也可以在 Actions 页面手动运行 `Deploy`。

PR 会跑 `CI` 工作流做校验（后端 `mvn compile`、前端 `pnpm build`、`nginx -t`），不碰服务器。

### 需要配置的 Secrets

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加：

| Secret | 说明 |
|---|---|
| `ACR_USERNAME` | ACR 用户名（如 `jiachengned`） |
| `ACR_PASSWORD` | ACR **访问凭证密码**，在容器镜像服务控制台设置，不是阿里云账号密码 |
| `SSH_HOST` | 轻量服务器公网 IP |
| `SSH_USER` | SSH 登录用户名 |
| `SSH_PORT` | SSH 端口，默认 22 则可不填 |
| `SSH_PRIVATE_KEY` | 部署专用私钥全文，含 `-----BEGIN...` 与 `-----END...` 行 |
| `DEPLOY_PATH` | 服务器上项目目录绝对路径，如 `/root/rag-agent-platform` |

建议为 CI 单独生成一把密钥，不要复用你本机的：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/rag_deploy -N ""
```

把 `~/.ssh/rag_deploy.pub` 追加到服务器的 `~/.ssh/authorized_keys`，`~/.ssh/rag_deploy`（私钥）填进 `SSH_PRIVATE_KEY`。

### 前置条件

- 服务器 SSH 端口对公网可达（GitHub Actions runner 在境外，IP 不固定，无法只放行固定网段）
- `DEPLOY_PATH` 目录已存在，且其中的 `.env` 已配好（CI **不会**覆盖 `.env`，密钥只存在于服务器上）
- 该目录下有 `deploy/` 子目录（CI 会往里面同步 `nginx.conf`）
- 服务器已 `docker login` 过 ACR，或凭证仍有效

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
