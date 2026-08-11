#!/bin/bash
set -e

# 配置
# 注意：REPO 必须与 docker-compose.yml 里 image 字段的仓库名一致，
# 否则推上去的镜像服务器根本拉不到（此前是 "acr"，与 compose 对不上）。
REGISTRY="crpi-c6nc3ef4yktaqunc.cn-beijing.personal.cr.aliyuncs.com"
NAMESPACE="lucas_acr"
REPO="rag-agent-platform"
VERSION=${1:-latest}

# 日常发布走 CI（push 到 main 自动构建部署，见 .github/workflows/deploy.yml）。
# 这个脚本保留给应急发布和本地调试。

echo "🏗️  构建镜像..."
docker build -t rag-backend:${VERSION} .
cd frontend && docker build -t rag-frontend:${VERSION} . && cd ..

echo "🏷️  打标签..."
docker tag rag-backend:${VERSION} ${REGISTRY}/${NAMESPACE}/${REPO}:backend-${VERSION}
docker tag rag-frontend:${VERSION} ${REGISTRY}/${NAMESPACE}/${REPO}:frontend-${VERSION}

echo "📤 推送镜像..."
docker push ${REGISTRY}/${NAMESPACE}/${REPO}:backend-${VERSION}
docker push ${REGISTRY}/${NAMESPACE}/${REPO}:frontend-${VERSION}

echo "✅ 完成！"
echo "后端: ${REGISTRY}/${NAMESPACE}/${REPO}:backend-${VERSION}"
echo "前端: ${REGISTRY}/${NAMESPACE}/${REPO}:frontend-${VERSION}"
