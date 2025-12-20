#!/bin/bash
set -e

# 配置
REGISTRY="crpi-c6nc3ef4yktaqunc.cn-beijing.personal.cr.aliyuncs.com"
NAMESPACE="lucas_acr"
REPO="acr"
VERSION=${1:-latest}

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
