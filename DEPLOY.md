# 部署指南

## 本地构建推送

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
wget https://ghproxy.com/https://github.com/NEDONION/rag-agent-platform/archive/refs/heads/main.zip
  unzip main.zip && mv rag-agent-platform-main rag-agent-platform
  cd rag-agent-platform

# 3. 配置环境变量
cp .env.example .env
vim .env  # 填写必填项

# 4. 登录 ACR
docker login --username=jiachengned crpi-c6nc3ef4yktaqunc.cn-beijing.personal.cr.aliyuncs.com

# 5. 启动
sudo docker compose up -d
```

## 更新

本地：
```bash
./build-and-push.sh
```

服务器：
```bash
docker compose pull
docker compose up -d
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
