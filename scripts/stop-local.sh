#!/usr/bin/env bash
# 停止所有本脚本启动的服务
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
for f in logs/*.pid; do
  [ -e "$f" ] || continue
  pid=$(cat "$f")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" && echo "已停止 $(basename "$f" .pid) (pid $pid)"
  else
    echo "$(basename "$f" .pid) 已不在运行"
  fi
  rm -f "$f"
done
