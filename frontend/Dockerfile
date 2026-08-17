# ================================
# 多阶段构建 - 前端 Next.js
# ================================

# 阶段 1: 依赖安装
FROM node:20-alpine AS deps

WORKDIR /app

# 安装 pnpm —— **必须锁版本**。
# 原先是 `npm install -g pnpm`，装的是构建当天的 latest。pnpm 大版本会改变
# lockfile 格式与依赖解析行为：仓库 lockfile 是 v6.0（pnpm 8 时代），
# 而 latest 已到 11.x，配合下面的 --no-frozen-lockfile，等于每次构建都可能
# 重新解析出不同的依赖版本，生产镜像因此无法复现。
# 版本需与 package.json 的 packageManager 字段保持一致。
RUN npm install -g pnpm@8.15.9

# 复制依赖配置文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
# TODO 待验证后改为 --frozen-lockfile：那才能真正保证构建可复现。
# 目前保持 --no-frozen-lockfile，因为尚未确认 lockfile 与 package.json 完全同步，
# 贸然改成严格模式可能让构建直接失败。锁定 pnpm 版本已消除最主要的漂移来源。
RUN pnpm install --no-frozen-lockfile

# ================================
# 阶段 2: 构建
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置生产环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 构建应用
RUN npm run build

# ================================
# 阶段 3: 运行时镜像
# ================================
FROM node:20-alpine AS runner

WORKDIR /app

# 安装必要的工具
RUN apk add --no-cache \
    curl \
    bash \
    tzdata

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 创建应用用户
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 复制必要的文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 更改所有权
RUN chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 启动应用
CMD ["node", "server.js"]
