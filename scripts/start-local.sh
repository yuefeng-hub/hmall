#!/usr/bin/env bash
# 本地免依赖模式：H2 文件库 + 直连 http://localhost:port
# 不需要 MySQL / Nacos，5 个服务全起来即可跑通完整链路
# 数据在 $ROOT/data 下，关服务再重启不会丢；想重置就 bash scripts/reset-data.sh -y
#
# 端口被占用时可整体平移：BASE_PORT=18080 bash scripts/start-local.sh
# 则商品=18081、购物车=18082、订单=18083、支付=18084、用户=18085，
# 数据自动放在 data-18080/，和默认那套实例互不抢 H2 文件
set -e
# 本机若设了 HTTP_PROXY，curl 会把 localhost 也发给代理，就绪检查会一直失败（或误判成功）
export no_proxy="localhost,127.0.0.1,::1"
export NO_PROXY="$no_proxy"
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
OPTS=${JAVA_OPTS:-"-Xms96m -Xmx256m"}
# 需要临时覆盖某个 Spring 配置时透传给所有服务（未知属性会被其它服务忽略）：
#   EXTRA_ARGS="--hmall.order.timeout-minutes=0 --hmall.order.cancel-scan-ms=3000" bash scripts/start-local.sh
EXTRA_ARGS=${EXTRA_ARGS:-}
BASE=${BASE_PORT:-8080}
ITEM_PORT=$((BASE + 1))
CART_PORT=$((BASE + 2))
ORDER_PORT=$((BASE + 3))
PAY_PORT=$((BASE + 4))
USER_PORT=$((BASE + 5))
mkdir -p logs

# H2 文件库不允许两个进程同时打开同一个库文件，所以平移端口时自动换一个数据目录。
# 也可显式指定：HMALL_DATA_DIR=D:/temp/hmall-test bash scripts/start-local.sh
if [ -n "${HMALL_DATA_DIR:-}" ]; then
  DATA_DIR="$HMALL_DATA_DIR"
elif [ "$BASE" = "8080" ]; then
  DATA_DIR="$ROOT/data"
else
  DATA_DIR="$ROOT/data-$BASE"
fi
mkdir -p "$DATA_DIR"
DATA_DIR_WIN="$DATA_DIR"
if command -v cygpath >/dev/null 2>&1; then DATA_DIR_WIN=$(cygpath -m "$DATA_DIR"); fi
echo "数据目录：$DATA_DIR_WIN"

for m in item cart order pay user; do
  if [ ! -f "$ROOT/$m-service/target/$m-service.jar" ]; then
    echo "缺少 $m-service/target/$m-service.jar，请先执行 bash scripts/build.sh"; exit 1
  fi
done

start() {
  local name=$1; shift
  local jar="$ROOT/$name-service/target/$name-service.jar"
  # Windows 上的 java.exe 不认 /d/CUBE/... 这种 MSYS 路径，必须转成 D:/CUBE/...
  if command -v cygpath >/dev/null 2>&1; then jar=$(cygpath -m "$jar"); fi
  nohup java $OPTS -jar "$jar" "$@" --hmall.data.dir="$DATA_DIR_WIN" $EXTRA_ARGS > "logs/$name.log" 2>&1 &
  echo $! > "logs/$name.pid"
  echo "  $name-service 已启动 pid=$(cat logs/$name.pid)"
}

echo "启动中（每个服务约需 10~20 秒）..."
# 自动化测试（smoke-test.sh / e2e.js）是从 logs/user.log 里 grep 「code=######」取验证码的，
# 一旦配了真实 QQ SMTP，验证码只进邮件、不再落日志，这些用例就会全部失败。
# 所以跑测试时用 MAIL_DEGRADED=1 起服务：命令行传空用户名把配置覆盖成降级模式。
MAIL_ARG=""
if [ "${MAIL_DEGRADED:-}" = "1" ]; then
  MAIL_ARG="--spring.mail.username= --spring.mail.password="
  echo "  （MAIL_DEGRADED=1：user-service 强制降级，验证码只进日志，供自动化测试取码）"
fi
start item  --server.port=$ITEM_PORT --hmall.remote.order-url=http://localhost:$ORDER_PORT
start user  --server.port=$USER_PORT $MAIL_ARG
sleep 2
start cart  --server.port=$CART_PORT --hmall.remote.item-url=http://localhost:$ITEM_PORT
start order --server.port=$ORDER_PORT --hmall.remote.item-url=http://localhost:$ITEM_PORT --hmall.remote.cart-url=http://localhost:$CART_PORT
start pay   --server.port=$PAY_PORT --hmall.remote.order-url=http://localhost:$ORDER_PORT --hmall.remote.user-url=http://localhost:$USER_PORT

echo "等待端口就绪..."
for i in $(seq 1 60); do
  ok=0
  for p in $ITEM_PORT $CART_PORT $ORDER_PORT $PAY_PORT $USER_PORT; do
    code=$(curl -s -m 2 -o /dev/null -w "%{http_code}" "http://localhost:$p/v3/api-docs" || true)
    [ "$code" = "200" ] && ok=$((ok+1))
  done
  if [ "$ok" -ge 5 ]; then break; fi
  sleep 2
done

echo
echo "就绪检查完成，接口文档："
echo "  商品   http://localhost:$ITEM_PORT/swagger-ui.html"
echo "  购物车 http://localhost:$CART_PORT/swagger-ui.html"
echo "  订单   http://localhost:$ORDER_PORT/swagger-ui.html"
echo "  支付   http://localhost:$PAY_PORT/swagger-ui.html"
echo "  用户   http://localhost:$USER_PORT/swagger-ui.html"
echo
echo "跑一遍完整链路：bash scripts/smoke-test.sh $ITEM_PORT $CART_PORT $ORDER_PORT $PAY_PORT $USER_PORT"
