#!/usr/bin/env bash
# 编译打包（跳过测试）
#
# 用法：
#   bash scripts/build.sh           增量打包（默认，不动 target 里已有产物）
#   bash scripts/build.sh --clean   先 clean 再打包（注意：正在运行的服务持有的 jar 会被占用而失败）
#
# 自动寻找可用的 Maven：全局 mvn → 项目内 mvnw → IDEA 自带的 Maven。
# （本机没有装独立 mvn 时，会走 IDEA 自带的那份，无需额外配置）
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

CLEAN=""
[ "${1:-}" = "--clean" ] && CLEAN="clean"

# 把 MSYS 路径(/d/CUBE/x) 转成 Windows 风格(D:/CUBE/x)，java.exe 只认后者
winpath() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi
}

find_idea_maven() {
  local cand
  for cand in \
    "/d/java/IntelliJ IDEA 2025.3.4/plugins/maven/lib/maven3" \
    /d/java/IntelliJ\ IDEA*/plugins/maven/lib/maven3 \
    /c/Program\ Files/JetBrains/*/plugins/maven/lib/maven3 \
    "$LOCALAPPDATA"/JetBrains/*/plugins/maven/lib/maven3 ; do
    if [ -d "$cand/boot" ]; then printf '%s' "$cand"; return 0; fi
  done
  return 1
}

echo "开始打包（$ROOT）..."
if command -v mvn >/dev/null 2>&1; then
  mvn -DskipTests $CLEAN package
elif [ -x ./mvnw ]; then
  ./mvnw -DskipTests $CLEAN package
elif M2H=$(find_idea_maven); then
  echo "  未找到独立 mvn，使用 IDEA 自带 Maven：$M2H"
  CW=$(ls "$M2H"/boot/plexus-classworlds-*.jar 2>/dev/null | head -1)
  # classpath 也必须转成 Windows 路径：java.exe 不认 /d/xxx，
  # 带空格的路径（IntelliJ IDEA 2025.x）MSYS 也不会自动转换，会直接报"找不到主类"
  java -classpath "$(winpath "$CW")" \
    "-Dclassworlds.conf=$(winpath "$M2H/bin/m2.conf")" \
    "-Dmaven.home=$(winpath "$M2H")" \
    "-Dmaven.multiModuleProjectDirectory=$(winpath "$(pwd)")" \
    org.codehaus.plexus.classworlds.launcher.Launcher -DskipTests $CLEAN package
else
  echo "找不到可用的 Maven。" >&2
  echo "请二选一：① 安装 Maven 并加入 PATH；② 在 IDEA 的 Maven 面板里执行 package。" >&2
  exit 1
fi

echo "打包完成：各模块 target/ 下已生成可执行 jar"
