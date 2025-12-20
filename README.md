# RAG Agent Platform

RAG Agent Platform is a multi-tenant agent SaaS platform. Built on LLMs, RAG, and MCP, it lets you build knowledge bases and retrieval-augmented pipelines, quickly create and orchestrate agents/LLM bots, and plug in, switch, and configure model providers with one click.

面向多租户的智能体 SaaS平台。基于 LLM、RAG 与 MCP，您可搭建知识库与检索增强链路，快速创建和编排 Agent/LLM 机器人，并一键接入、切换与配置各类模型服务商。

![](https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20250820155212.png)

![](https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20250820155154.png)

![](https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20250820152009.png)

## Requisites
- Java 17, Spring Boot 3
- PostgreSQL
- PGVector
- RabbitMQ
- **Object Storage Service**
  - Amazon S3
  - ✅ Qiniu Cloud Object Storage (KODO)
  - Tencent Cloud Object Storage (COS)
- **Model Provider**
  - ✅ Silicon Flow 硅基流动 (https://www.siliconflow.com/)
  - SiliconFlow is an AI platform that gives developers a single API to run many models for text, embeddings, reranking, and multimodal tasks.
  - 硅基流动是面向开发者的 AI 模型与算力平台，聚合开源/商用大模型并提供统一 API 的文本、向量、重排与多模态推理服务。

## Deployment 部署

查看 **[部署指南](./DEPLOY.md)**

```bash
# 本地
./build-and-push.sh

# 服务器
docker compose up -d
```

默认账号: `admin@agentx.ai / admin123`

## Local Setup

### Testing Login Account

- Admin: `admin@agentx.ai / admin123`
- Test: `test@agentx.ai / test123`

### RabbitMQ

- Management UI: http://localhost:15672

```shell
# Check if it has been installed 检验是否已经安装过

command -v rabbitmqctl || echo "rabbitmqctl not found"
command -v rabbitmq-server || echo "rabbitmq-server not found"

brew list | grep rabbitmq || echo "brew 未安装 rabbitmq"
brew services list | grep rabbitmq

# install via homebrew
brew install rabbitmq
brew services start rabbitmq

# stops the locally running RabbitMQ node
brew services stop rabbitmq
```

### PostgreSQL

```shell
# 1. install via homebrew
brew install postgresql@14

# 2. added config paths
#   - zprofile 适用于登录/新开终端（macOS 默认）
#   - zshrc 适用于交互式 shell（如 VS Code 的内置终端）
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
echo 'export PATH="$(brew --prefix)/opt/postgresql@14/bin:$PATH"' >> ~/.zprofile
echo 'export PATH="$(brew --prefix)/opt/postgresql@14/bin:$PATH"' >> ~/.zshrc

source ~/.zprofile || true
source ~/.zshrc || true

# 3. start via homebrew
brew services start postgresql@14

# 4. Query the current user after startup - 尝试用你的 macOS 用户名登录
psql -h 127.0.0.1 -p 5432 -U "$(whoami)" -d postgres -c "\du"

# 5. create super user role
# username: postgres, password: postgres
psql -d postgres -c "CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';"
```
