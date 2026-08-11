# ================================
# GitHub Actions 自托管 Runner
# ================================
# 跑在部署目标机器上，主动向 GitHub 轮询任务（纯出站连接）。
# 这样服务器不需要开放任何入站端口，CI 里也不需要保存服务器密钥。

FROM ubuntu:24.04

ARG RUNNER_VERSION=2.336.0
ARG DEBIAN_FRONTEND=noninteractive

# runner 自身依赖 + docker CLI（用于在部署 job 里操作宿主机 docker）
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg git jq sudo tar unzip \
      libicu74 \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
       -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
       https://download.docker.com/linux/ubuntu noble stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /actions-runner

RUN curl -fsSL -o runner.tar.gz \
      "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
    && tar xzf runner.tar.gz \
    && rm runner.tar.gz \
    && ./bin/installdependencies.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 以 root 运行：容器需要访问挂载进来的 docker.sock，而 docker.sock 本身已等同 root 权限，
# 再套一层非 root 用户只是徒增复杂度，不带来实际隔离。
ENV RUNNER_ALLOW_RUNASROOT=1

ENTRYPOINT ["/entrypoint.sh"]
