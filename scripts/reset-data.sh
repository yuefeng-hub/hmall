#!/usr/bin/env bash
# 重置演示数据：删掉 H2 文件库，下次启动会重建表并灌入初始商品/用户/余额。
#
#   bash scripts/reset-data.sh                  预览将删除哪些文件（不动手）
#   bash scripts/reset-data.sh -y               确认重置默认实例（data/）
#   bash scripts/reset-data.sh -y data-18080     重置端口平移的那套实例
#
# ⚠️ 执行前请先停掉对应的 5 个服务，否则 H2 文件被占用，删不干净。
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
REL=${2:-data}
case "$REL" in
  data|data-*) ;;
  *) echo "只允许操作项目内的 data 或 data-* 目录，收到：$REL" >&2; exit 1 ;;
esac
TARGET="$ROOT/$REL"
if [ ! -d "$TARGET" ]; then
  echo "目录不存在，无需重置：$TARGET"
  exit 0
fi

echo "数据目录：$TARGET"
echo "将删除这些文件（订单、支付单、充值流水、余额、库存全部回到初始值）："
ls -1 "$TARGET"

if [ "${1:-}" != "-y" ]; then
  echo
  echo "这是预览，没有删除任何东西。确认请执行：bash scripts/reset-data.sh -y $REL"
  exit 0
fi

echo "⚠️ 此操作非常危险，可能导致不可逆的数据丢失！"
rm -rf -- "$TARGET"
echo "已删除 $TARGET；下次启动 5 个服务会自动重建初始数据。"
