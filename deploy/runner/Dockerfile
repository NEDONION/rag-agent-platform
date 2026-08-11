# ================================
# GitHub Actions 自托管 Runner
# ================================
# 跑在部署目标机器上，主动向 GitHub 轮询任务（纯出站连接）。
# 这样服务器不需要开放任何入站端口，CI 里也不需要保存服务器密钥。

# docker CLI 与 compose 插件直接从官方镜像拷贝，不走 download.docker.com 的 apt 源——
# 国内服务器访问该域名会被重置（curl: (35) Recv failure: Connection reset by peer），
# 而 Docker Hub 是通的。
FROM docker:28-cli AS dockercli

FROM ubuntu:24.04

ARG RUNNER_VERSION=2.336.0
ARG DEBIAN_FRONTEND=noninteractive
# apt 镜像源。构建机在国内时走阿里云镜像，官方源慢到几百 KB/s。
# 传空字符串即可保留官方源：--build-arg APT_MIRROR=
ARG APT_MIRROR=http://mirrors.aliyun.com

# 换源。注意用 http 而非 https——基础镜像里还没有 ca-certificates，
# https 源会因无法校验证书而失败。apt 包自带 GPG 签名，完整性不依赖 TLS。
# amd64 用 archive/security.ubuntu.com，arm64 用 ports.ubuntu.com，两种都覆盖。
RUN if [ -n "$APT_MIRROR" ]; then \
      sed -i \
        -e "s|https\?://archive.ubuntu.com/ubuntu|${APT_MIRROR}/ubuntu|g" \
        -e "s|https\?://security.ubuntu.com/ubuntu|${APT_MIRROR}/ubuntu|g" \
        -e "s|https\?://ports.ubuntu.com/ubuntu-ports|${APT_MIRROR}/ubuntu-ports|g" \
        /etc/apt/sources.list.d/ubuntu.sources; \
    fi

# runner 自身依赖。libicu74 是 .NET 运行时必需的。
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git jq sudo tar unzip libicu74 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins/docker-compose \
                      /usr/local/libexec/docker/cli-plugins/docker-compose

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /actions-runner

RUN curl -fsSL --retry 5 --retry-delay 3 -o runner.tar.gz \
      "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
    && tar xzf runner.tar.gz \
    && rm runner.tar.gz

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 以 root 运行：容器需要访问挂载进来的 docker.sock，而 docker.sock 本身已等同 root 权限，
# 再套一层非 root 用户只是徒增复杂度，不带来实际隔离。
ENV RUNNER_ALLOW_RUNASROOT=1

ENTRYPOINT ["/entrypoint.sh"]
