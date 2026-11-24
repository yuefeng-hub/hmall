#!/usr/bin/env bash
# 课程原版模式：MySQL + Nacos 服务治理
# 前置：docker compose up -d 已成功，且 MySQL 初始化完成
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
export MYSQL_HOST=${MYSQL_HOST:-localhost}
export MYSQL_USER=${MYSQL_USER:-root}
export MYSQL_PWD=${MYSQL_PWD:-123}
export NACOS_ADDR=${NACOS_ADDR:-localhost:8848}
OPTS=${JAVA_OPTS:-"-Xms96m -Xmx256m"}
PROFILE="--spring.profiles.active=nacos"
mkdir -p logs

echo "使用 nacos profile，Nacos=$NACOS_ADDR MySQL=$MYSQL_HOST"

start() {
  local name=$1; shift
  nohup java $OPTS -jar "$ROOT/$name-service/target/$name-service.jar" $PROFILE "$@" > "logs/$name.log" 2>&1 &
  echo $! > "logs/$name.pid"
  echo "  $name-service 已启动 pid=$(cat logs/$name.pid)"
}

start item  --server.port=8081
sleep 20
start user  --server.port=8085
start cart  --server.port=8082
start order --server.port=8083
start pay   --server.port=8084

echo
echo "打开 Nacos 控制台 http://localhost:8848/nacos 可以看到 5 个服务实例"
echo "再执行 bash scripts/smoke-test.sh 验证链路"
