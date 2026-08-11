#!/bin/bash
# GitHub Actions runner 启动脚本。
#
# 用 PAT 换取一次性注册令牌（注册令牌只有 1 小时有效期，不能直接写进配置），
# 注册 → 运行 → 退出时注销。容器重启会重新走一遍，不会在 GitHub 上留下僵尸 runner。
set -euo pipefail

: "${GITHUB_REPO:?需要设置 GITHUB_REPO，格式 owner/repo}"
: "${GITHUB_PAT:?需要设置 GITHUB_PAT（细粒度 PAT，仓库 Administration: Read and write 权限）}"

RUNNER_NAME="${RUNNER_NAME:-$(hostname)}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,x64,deploy}"

# 返回令牌到 stdout；失败时返回空串而非直接退出，以便调用方给出可读的错误提示。
# （注意不能用 curl -f：那样会吞掉响应体，而 GitHub 的错误原因就在响应体里。）
get_token() {
  local endpoint="$1" response http_code body
  response="$(curl -sS -w $'\n%{http_code}' -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_PAT}" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${GITHUB_REPO}/actions/runners/${endpoint}" 2>&1)" || true

  http_code="$(printf '%s' "$response" | tail -n1)"
  body="$(printf '%s' "$response" | sed '$d')"

  if [ "$http_code" != "201" ]; then
    echo "❌ GitHub API 返回 HTTP ${http_code}（${endpoint}）" >&2
    echo "   响应：$(printf '%s' "$body" | jq -r '.message // .' 2>/dev/null || printf '%s' "$body")" >&2
    case "$http_code" in
      401) echo "   → GITHUB_PAT 无效或已过期" >&2 ;;
      403) echo "   → PAT 缺少权限，需要该仓库的 Administration: Read and write" >&2 ;;
      404) echo "   → 仓库 ${GITHUB_REPO} 不存在，或 PAT 无权访问" >&2 ;;
    esac
    return 1
  fi

  printf '%s' "$body" | jq -r .token
}

cleanup() {
  echo "==> 正在从 GitHub 注销 runner..."
  local remove_token=""
  remove_token="$(get_token remove-token)" || true
  if [ -n "$remove_token" ] && [ "$remove_token" != "null" ]; then
    ./config.sh remove --token "$remove_token" || echo "注销失败，可能需要在 GitHub 页面手动清理"
  fi
  exit 0
}

# 收到停止信号时先注销再退出，避免 GitHub 上堆积离线 runner
trap cleanup SIGTERM SIGINT SIGQUIT

echo "==> 向 GitHub 申请注册令牌..."
# 不能直接写成 REG_TOKEN="$(get_token ...)"：赋值语句里的命令替换失败会被 set -e
# 立即终止，上面那些提示信息就永远打不出来。
REG_TOKEN=""
REG_TOKEN="$(get_token registration-token)" || true
if [ -z "$REG_TOKEN" ] || [ "$REG_TOKEN" = "null" ]; then
  echo "❌ 获取注册令牌失败，runner 无法启动。原因见上方。"
  exit 1
fi

echo "==> 注册 runner: ${RUNNER_NAME} [${RUNNER_LABELS}]"
./config.sh \
  --unattended \
  --replace \
  --url "https://github.com/${GITHUB_REPO}" \
  --token "$REG_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --work /actions-runner/_work

echo "==> runner 已就绪，开始监听任务"
# 放到后台并 wait，否则 trap 要等 run.sh 执行完才会响应信号
./run.sh &
wait $!
