#!/usr/bin/env bash
# 冒烟测试：一条链路跑通 浏览商品 -> 加购物车 -> 下单 -> 支付 -> 登录/充值
# 用法：bash scripts/smoke-test.sh [item端口] [cart端口] [order端口] [pay端口] [user端口]
# 失败会以非 0 退出码结束，可直接接进 CI
set -e
# 本机若设了 HTTP_PROXY，curl 会把 localhost 也发给代理，结果全是 "upstream connect failed"。
# 这里统一排除本地地址，脚本在任何环境下都能直连服务。
export no_proxy="localhost,127.0.0.1,::1"
export NO_PROXY="$no_proxy"
ITEM=${1:-8081}
CART=${2:-8082}
ORDER=${3:-8083}
PAY=${4:-8084}
USER=${5:-8085}
UID_HEAD="X-User-Id: 1"

echo "===== 0. 预备：保证测试账号余额够支付（文件库持久化后重复跑也不会失败） ====="
BAL0=$(curl -s --noproxy '*' "http://localhost:${USER}/users/1" | python3 -c 'import sys,json;print(float(json.load(sys.stdin)["balance"]))')
if python3 -c "import sys; sys.exit(0 if ${BAL0} < 6000 else 1)"; then
  NEED=$(python3 -c "print(int(6000 - ${BAL0}))")
  echo "余额仅 ${BAL0}，先补 ${NEED} 元再跑链路"
  curl -s --noproxy '*' -X POST "http://localhost:${USER}/users/recharge" -H "$UID_HEAD" \
    -H "Content-Type: application/json" -d "{\"amount\":${NEED},\"channel\":\"alipay\"}" > /dev/null
else
  echo "余额 ${BAL0}，足够，直接开跑"
fi

echo "===== 1. 商品服务：批量查询商品 ====="
curl -s "http://localhost:${ITEM}/items?ids=1,2" | python3 -m json.tool

echo "===== 2. 购物车：加两件商品 ====="
curl -s -X POST "http://localhost:${CART}/carts" -H "$UID_HEAD" -H "Content-Type: application/json" \
  -d '{"itemId":1,"num":1}'
curl -s -X POST "http://localhost:${CART}/carts" -H "$UID_HEAD" -H "Content-Type: application/json" \
  -d '{"itemId":2,"num":2}'
echo

echo "===== 3. 购物车：查询（商品名/价格/库存应由 item-service 远程补齐） ====="
curl -s "http://localhost:${CART}/carts" -H "$UID_HEAD" | python3 -m json.tool

echo "===== 4. 订单服务：下单（购物车 1 件手机 + 2 件耳机，数量必须原样生效） ====="
stock() { curl -s "http://localhost:${ITEM}/items/$1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["stock"])'; }
S1_BEFORE=$(stock 1)
S2_BEFORE=$(stock 2)
ORDER_JSON=$(curl -s -X POST "http://localhost:${ORDER}/orders" -H "$UID_HEAD" -H "Content-Type: application/json" \
  -d '{"address":"广东省深圳市南山区","items":[{"itemId":1,"num":1},{"itemId":2,"num":2}]}')
echo "$ORDER_JSON" | python3 -m json.tool
ORDER_ID=$(echo "$ORDER_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
TOTAL=$(echo "$ORDER_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["totalFee"])')
echo "订单号 = ${ORDER_ID}，金额 = ${TOTAL}（应为 3999 + 599*2 = 5197）"
python3 -c "import sys; sys.exit(0 if abs(float('${TOTAL}') - 5197) < 0.001 else 1)" \
  || { echo "！下单金额没有按购物车数量计算（数量被当成 1 了）"; exit 1; }
echo "$ORDER_JSON" | python3 -c "
import sys, json
m = {d['itemId']: d['num'] for d in json.load(sys.stdin)['details']}
print('明细数量 =', m)
assert m.get(1) == 1 and m.get(2) == 2, '订单明细里的数量不对'
"
S1_AFTER=$(stock 1)
S2_AFTER=$(stock 2)
echo "库存 商品1 ${S1_BEFORE} -> ${S1_AFTER}（应少 1），商品2 ${S2_BEFORE} -> ${S2_AFTER}（应少 2）"
[ $((S1_BEFORE - S1_AFTER)) -eq 1 ] || { echo "！商品1 库存扣减数量不对"; exit 1; }
[ $((S2_BEFORE - S2_AFTER)) -eq 2 ] || { echo "！商品2 库存扣减数量不对"; exit 1; }

echo "===== 5. 校验：库存已扣减、购物车已清空 ====="
curl -s "http://localhost:${ITEM}/items?ids=1,2" | python3 -m json.tool
curl -s "http://localhost:${CART}/carts" -H "$UID_HEAD" | python3 -m json.tool

echo "===== 6. 支付服务：创建支付单 ====="
PAY_JSON=$(curl -s -X POST "http://localhost:${PAY}/pay-orders" -H "$UID_HEAD" -H "Content-Type: application/json" \
  -d "{\"orderId\":${ORDER_ID}}")
echo "$PAY_JSON" | python3 -m json.tool
PAY_NO=$(echo "$PAY_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["payOrderNo"])')

echo "----- 重复创建支付单应复用同一张未支付单（否则会重复扣费） -----"
PAY_NO2=$(curl -s -X POST "http://localhost:${PAY}/pay-orders" -H "$UID_HEAD" -H "Content-Type: application/json" \
  -d "{\"orderId\":${ORDER_ID}}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["payOrderNo"])')
echo "第二次创建得到 ${PAY_NO2}"
[ "$PAY_NO2" = "$PAY_NO" ] || { echo "！重复创建生成了新支付单，存在重复扣费风险"; exit 1; }

echo "===== 7. 支付服务：输入密码确认支付 ====="
echo "----- 先用错误密码，应返回可读中文提示（不是裸 500） -----"
BADPW=$(curl -s -X PUT "http://localhost:${PAY}/pay-orders?payOrderNo=${PAY_NO}&pw=000000" -H "$UID_HEAD")
echo "$BADPW"
echo "$BADPW" | grep -q "支付密码错误" || { echo "！错误密码没有拿到可读提示，前端会只显示 HTTP 500"; exit 1; }
echo "----- 再用正确密码 -----"
curl -s -X PUT "http://localhost:${PAY}/pay-orders?payOrderNo=${PAY_NO}&pw=123456" -H "$UID_HEAD" | python3 -m json.tool

echo "===== 8. 校验：订单已支付、余额已扣减 ====="
curl -s "http://localhost:${ORDER}/orders/${ORDER_ID}" | python3 -m json.tool
curl -s "http://localhost:${USER}/users/1" | python3 -m json.tool

echo "===== 9. 幂等校验：重复提交同一支付单 ====="
curl -s -X PUT "http://localhost:${PAY}/pay-orders?payOrderNo=${PAY_NO}&pw=123456" -H "$UID_HEAD" | python3 -m json.tool
echo "（余额不应再次减少）"
curl -s "http://localhost:${USER}/users/1" | python3 -m json.tool

echo "===== 9.1 已支付订单不能再创建支付单（期望非 200） ====="
PAID_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:${PAY}/pay-orders" \
  -H "$UID_HEAD" -H "Content-Type: application/json" -d "{\"orderId\":${ORDER_ID}}")
echo "HTTP ${PAID_CODE}"
[ "$PAID_CODE" != "200" ] || { echo "！已支付订单又被创建了支付单"; exit 1; }

echo "===== 10. 用户服务：登录 ====="
LOGIN_JSON=$(curl -s -X POST "http://localhost:${USER}/users/login" -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"123456"}')
echo "$LOGIN_JSON" | python3 -m json.tool
TOKEN=$(echo "$LOGIN_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

echo "===== 11. 用户服务：用 token 查当前用户 ====="
ME_JSON=$(curl -s "http://localhost:${USER}/users/me" -H "X-Token: ${TOKEN}")
echo "$ME_JSON" | python3 -m json.tool
ME_NAME=$(echo "$ME_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["username"])')
[ "$ME_NAME" = "zhangsan" ] || { echo "！登录态校验失败：/users/me 返回 $ME_NAME"; exit 1; }

echo "===== 12. 用户服务：错误密码应被拒绝（期望 401） ====="
BAD_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:${USER}/users/login" \
  -H "Content-Type: application/json" -d '{"username":"zhangsan","password":"wrong-password"}')
echo "HTTP ${BAD_CODE}"
[ "$BAD_CODE" = "401" ] || { echo "！错误密码没有被拒绝"; exit 1; }

echo "===== 13. 用户服务：充值 200 元，余额应增加 200 ====="
BAL_BEFORE=$(curl -s "http://localhost:${USER}/users/1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["balance"])')
curl -s -X POST "http://localhost:${USER}/users/recharge" -H "$UID_HEAD" -H "Content-Type: application/json" \
  -d '{"amount":200,"channel":"alipay"}' | python3 -m json.tool
BAL_AFTER=$(curl -s "http://localhost:${USER}/users/1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["balance"])')
echo "余额 ${BAL_BEFORE} -> ${BAL_AFTER}"
python3 -c "import sys; sys.exit(0 if abs(float('${BAL_AFTER}') - float('${BAL_BEFORE}') - 200) < 0.001 else 1)" \
  || { echo "！充值没有正确到账"; exit 1; }

echo "===== 14. 用户服务：充值金额非法应被拒绝（期望 400） ====="
ZERO_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:${USER}/users/recharge" \
  -H "$UID_HEAD" -H "Content-Type: application/json" -d '{"amount":0}')
BIG_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:${USER}/users/recharge" \
  -H "$UID_HEAD" -H "Content-Type: application/json" -d '{"amount":99999}')
echo "充 0 元 -> HTTP ${ZERO_CODE}，充 99999 元 -> HTTP ${BIG_CODE}（都应为 400）"
[ "$ZERO_CODE" = "400" ] && [ "$BIG_CODE" = "400" ] || { echo "！非法充值金额没有被拦截"; exit 1; }

echo "===== 15. 用户服务：充值记录 ====="
curl -s "http://localhost:${USER}/users/recharges?limit=5" -H "$UID_HEAD" | python3 -m json.tool

echo "===== 16. 用户服务：退出登录后 token 失效（期望 401） ====="
curl -s -X POST "http://localhost:${USER}/users/logout" -H "X-Token: ${TOKEN}" > /dev/null
OUT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${USER}/users/me" -H "X-Token: ${TOKEN}")
echo "HTTP ${OUT_CODE}"
[ "$OUT_CODE" = "401" ] || { echo "！退出登录后 token 仍然可用"; exit 1; }

echo "===== 17. 订单服务：我的订单列表（应含刚下的单和明细） ====="
# 注意：数据走 stdin 传给 python，别落临时文件 —— git bash 的 /tmp 和 Windows 版 python 认的不是同一个路径
curl -s "http://localhost:${ORDER}/orders?limit=20" -H "$UID_HEAD" | python3 -c "
import sys, json
orders = json.load(sys.stdin)
print('订单数 =', len(orders))
assert orders, '我的订单列表为空'
first = orders[0]
details = first.get('details') or []
print('首单: id=%s 金额=%s 状态=%s 明细=%d 条' % (first['id'], first['totalFee'], first['status'], len(details)))
for d in details:
    print('   - %s x%s  单价 %s' % (d.get('name'), d.get('num'), d.get('price')))
assert details, '订单明细没有一并返回'
assert all(d.get('name') for d in details), '明细里缺商品名'
"

echo "===== 18. 订单服务：取消订单并回补库存 ====="
STOCK_BEFORE=$(curl -s "http://localhost:${ITEM}/items/3" | python3 -c 'import sys,json;print(json.load(sys.stdin)["stock"])')
CANCEL_ORDER=$(curl -s -X POST "http://localhost:${ORDER}/orders" -H "$UID_HEAD" -H "Content-Type: application/json" \
  -d '{"address":"广东省深圳市南山区","itemIds":[3]}')
CANCEL_ID=$(echo "$CANCEL_ORDER" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
STOCK_DEDUCTED=$(curl -s "http://localhost:${ITEM}/items/3" | python3 -c 'import sys,json;print(json.load(sys.stdin)["stock"])')
echo "新建订单 ${CANCEL_ID}，库存 ${STOCK_BEFORE} -> ${STOCK_DEDUCTED}（下单应已扣 1 件）"
[ "$STOCK_DEDUCTED" -lt "$STOCK_BEFORE" ] || { echo "！下单没有扣减库存"; exit 1; }

CANCEL_JSON=$(curl -s -X PUT "http://localhost:${ORDER}/orders/${CANCEL_ID}/cancel" -H "$UID_HEAD")
echo "$CANCEL_JSON" | python3 -m json.tool
CANCEL_STATUS=$(echo "$CANCEL_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')
STOCK_AFTER=$(curl -s "http://localhost:${ITEM}/items/3" | python3 -c 'import sys,json;print(json.load(sys.stdin)["stock"])')
echo "取消后：订单状态 = ${CANCEL_STATUS}（应为 3），库存 = ${STOCK_AFTER}（应回到 ${STOCK_BEFORE}）"
[ "$CANCEL_STATUS" = "3" ] || { echo "！取消后订单状态不是 3"; exit 1; }
[ "$STOCK_AFTER" = "$STOCK_BEFORE" ] || { echo "！取消订单后库存没有回补"; exit 1; }

echo "----- 重复取消应被拒绝，且库存不能被二次回补 -----"
DUP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "http://localhost:${ORDER}/orders/${CANCEL_ID}/cancel" -H "$UID_HEAD")
STOCK_DUP=$(curl -s "http://localhost:${ITEM}/items/3" | python3 -c 'import sys,json;print(json.load(sys.stdin)["stock"])')
echo "再次取消 -> HTTP ${DUP_CODE}（应为 4xx），库存 = ${STOCK_DUP}"
[ "$DUP_CODE" != "200" ] || { echo "！已取消的订单还能再取消一次"; exit 1; }
[ "$STOCK_DUP" = "$STOCK_BEFORE" ] || { echo "！重复取消把库存加了两次"; exit 1; }

echo "===== 19. 已取消订单不能再发起支付（期望非 200） ====="
CANCEL_PAY_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:${PAY}/pay-orders" \
  -H "$UID_HEAD" -H "Content-Type: application/json" -d "{\"orderId\":${CANCEL_ID}}")
echo "HTTP ${CANCEL_PAY_CODE}"
[ "$CANCEL_PAY_CODE" != "200" ] || { echo "！已取消的订单还能创建支付单"; exit 1; }

echo "===== 20. 越权取消他人订单应被拒绝（期望 403） ====="
OTHER_ID=$(curl -s -X POST "http://localhost:${ORDER}/orders" -H "$UID_HEAD" -H "Content-Type: application/json" \
  -d '{"address":"广东省深圳市南山区","itemIds":[4]}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
FORBID_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "http://localhost:${ORDER}/orders/${OTHER_ID}/cancel" \
  -H "X-User-Id: 2")
echo "用户 2 取消用户 1 的订单 ${OTHER_ID} -> HTTP ${FORBID_CODE}"
[ "$FORBID_CODE" = "403" ] || { echo "！越权取消没有被拦截"; exit 1; }
curl -s -X PUT "http://localhost:${ORDER}/orders/${OTHER_ID}/cancel" -H "$UID_HEAD" > /dev/null

echo "===== 21. 购物车非法参数应返回可读中文提示（不是裸 500） ====="
CART_BAD=$(curl -s -X POST "http://localhost:${CART}/carts" -H "$UID_HEAD" \
  -H "Content-Type: application/json" -d '{"itemId":1,"num":0}')
echo "$CART_BAD"
echo "$CART_BAD" | grep -q "数量必须大于 0" || { echo "！购物车错误没拿到 message 字段，前端只会显示 HTTP 500"; exit 1; }

echo "===== 22. 下单数量为 0 应被拒绝（期望 400 + 可读提示） ====="
BAD_QTY=$(curl -s -X POST "http://localhost:${ORDER}/orders" -H "$UID_HEAD" \
  -H "Content-Type: application/json" -d '{"address":"test","items":[{"itemId":1,"num":0}]}')
echo "$BAD_QTY"
echo "$BAD_QTY" | grep -q "商品数量必须大于 0" || { echo "！非法数量没被拦住"; exit 1; }

echo "===== 23. 旧版 itemIds 调用仍兼容（每件按 1 处理） ====="
# 第 18/20 段创建订单时用的就是 itemIds，这里再显式断言一次金额
LEGACY=$(curl -s -X POST "http://localhost:${ORDER}/orders" -H "$UID_HEAD" \
  -H "Content-Type: application/json" -d '{"address":"test","itemIds":[3]}')
echo "$LEGACY" | python3 -c "
import sys, json
o = json.load(sys.stdin)
print('兼容下单: id=%s 金额=%s 明细数量=%s' % (o['id'], o['totalFee'], [d['num'] for d in o['details']]))
assert abs(float(o['totalFee']) - 329) < 0.001, '旧格式金额不对'
assert o['details'][0]['num'] == 1, '旧格式数量应为 1'
"
LEGACY_ID=$(echo "$LEGACY" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -X PUT "http://localhost:${ORDER}/orders/${LEGACY_ID}/cancel" -H "$UID_HEAD" > /dev/null

echo "===== 24. 商品扩充：分类、关键词搜索、48 件商品 ====="
COUNT=$(curl -s --noproxy '*' "http://localhost:${ITEM}/items/search?limit=100" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
CATS=$(curl -s --noproxy '*' "http://localhost:${ITEM}/items/categories" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
HUAWEI=$(curl -s --noproxy '*' --get --data-urlencode "keyword=华为" \
  "http://localhost:${ITEM}/items/search" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
HOUSE=$(curl -s --noproxy '*' --get --data-urlencode "category=家用电器" \
  "http://localhost:${ITEM}/items/search" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
echo "商品总数=${COUNT} 一级分类=${CATS} 关键词「华为」=${HUAWEI} 分类「家用电器」=${HOUSE}"
[ "$COUNT" -ge 40 ] || { echo "！商品数量不对，种子数据没生效"; exit 1; }
[ "$CATS" -eq 6 ] || { echo "！一级分类应为 6 个"; exit 1; }
[ "$HUAWEI" -ge 3 ] || { echo "！关键词搜索没生效"; exit 1; }
[ "$HOUSE" -eq 8 ] || { echo "！分类筛选没生效"; exit 1; }

echo "===== 25. 邮箱验证码：发码限流、注册、一码一用、验证码登录 ====="
# 日志里取码的路径：脚本可能在项目根，也可能被别处调用
USER_LOG="${USER_LOG:-logs/user.log}"
[ -f "$USER_LOG" ] || USER_LOG="$(cd "$(dirname "$0")/.." && pwd)/logs/user.log"
[ -f "$USER_LOG" ] || { echo "！找不到 user-service 日志 $USER_LOG"; exit 1; }

STAMP=$(date +%s)$RANDOM
MAIL="smoke${STAMP}@qq.com"
MAIL_USER="smoke${STAMP}"

SEND=$(curl -s --noproxy '*' -X POST "http://localhost:${USER}/users/email/code" \
  -H "Content-Type: application/json" -d "{\"email\":\"${MAIL}\",\"purpose\":\"REGISTER\"}")
echo "$SEND"
echo "$SEND" | grep -q '"degraded"' || { echo "！发码接口返回结构不对"; exit 1; }

# 60 秒内对同一邮箱同一场景重发，应被限流
AGAIN=$(curl -s --noproxy '*' -o /dev/null -w "%{http_code}" -X POST "http://localhost:${USER}/users/email/code" \
  -H "Content-Type: application/json" -d "{\"email\":\"${MAIL}\",\"purpose\":\"REGISTER\"}")
echo "60 秒内重发 -> HTTP ${AGAIN}（应为 429）"
[ "$AGAIN" = "429" ] || { echo "！验证码重发没有被限流"; exit 1; }

sleep 1
CODE=$(grep "$MAIL" "$USER_LOG" | grep -oE "code=[0-9]{6}" | tail -1 | cut -d= -f2)
if [ -z "$CODE" ]; then
  echo "！日志里没取到验证码"
  if echo "$SEND" | grep -q '"degraded":false'; then
    echo "  原因：user-service 在【真发信】模式（degraded=false），验证码只进邮件、不写日志。"
    echo "  自动化测试必须用降级模式启动："
    echo "    bash scripts/stop-local.sh"
    echo "    MAIL_DEGRADED=1 bash scripts/start-local.sh"
  else
    echo "  邮箱=${MAIL}  日志=${USER_LOG}"
    echo "  可能原因：日志路径不对、user-service 刚重启（日志被截断）、或这一步发码其实没成功"
  fi
  exit 1
fi
echo "从日志取到验证码：${CODE}"

# 错误验证码应被拒绝，且不消耗真正的码
BAD_CODE=$(curl -s --noproxy '*' -o /dev/null -w "%{http_code}" -X POST "http://localhost:${USER}/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${MAIL_USER}x\",\"password\":\"abc123\",\"email\":\"${MAIL}\",\"code\":\"000000\"}")
echo "错误验证码注册 -> HTTP ${BAD_CODE}（应为 400）"
[ "$BAD_CODE" = "400" ] || { echo "！错误验证码没被拒绝"; exit 1; }

REG=$(curl -s --noproxy '*' -X POST "http://localhost:${USER}/users/register" -H "Content-Type: application/json" \
  -d "{\"username\":\"${MAIL_USER}\",\"password\":\"abc123\",\"email\":\"${MAIL}\",\"code\":\"${CODE}\"}")
echo "$REG"
echo "$REG" | python3 -c "
import sys, json
u = json.load(sys.stdin)
print('注册成功: %s(id=%s) 邮箱=%s 余额=%s' % (u['username'], u['userId'], u['email'], u['balance']))
assert u['token'], '注册没返回令牌'
assert abs(float(u['balance']) - 500) < 0.001, '新人礼金不是 500'
"

# 邮箱验证码登录：LOGIN 是独立的限流 key（email + purpose），可以立刻发
curl -s --noproxy '*' -X POST "http://localhost:${USER}/users/email/code" -H "Content-Type: application/json" \
  -d "{\"email\":\"${MAIL}\",\"purpose\":\"LOGIN\"}" > /dev/null
sleep 1
LOGIN_CODE=$(grep "$MAIL" "$USER_LOG" | grep -oE "code=[0-9]{6}" | tail -1 | cut -d= -f2)
LOGIN_RES=$(curl -s --noproxy '*' -X POST "http://localhost:${USER}/users/email/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${MAIL}\",\"code\":\"${LOGIN_CODE}\"}")
echo "$LOGIN_RES" | python3 -c "
import sys, json
u = json.load(sys.stdin)
print('邮箱验证码登录成功: %s' % u['username'])
assert u['username'], '登录没返回用户'
"

# 同一个登录码再用一次，应该提示已使用（一码一用）
DUP=$(curl -s --noproxy '*' -X POST "http://localhost:${USER}/users/email/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${MAIL}\",\"code\":\"${LOGIN_CODE}\"}")
echo "$DUP"
echo "$DUP" | grep -q "已使用" || { echo "！同一个验证码被重复使用了"; exit 1; }

# 未注册邮箱应明确报错
NOBODY=$(curl -s --noproxy '*' -o /dev/null -w "%{http_code}" -X POST "http://localhost:${USER}/users/email/login" \
  -H "Content-Type: application/json" -d '{"email":"nobody-not-exist@qq.com","code":"123456"}')
echo "未注册邮箱登录 -> HTTP ${NOBODY}（应为 404）"
[ "$NOBODY" = "404" ] || { echo "！未注册邮箱没有正确报错"; exit 1; }

echo "===== 26. 秒杀：活动列表、抢购、防重复、秒杀价下单 ====="
SK_LIST=$(curl -s --noproxy '*' "http://localhost:${ITEM}/seckill/list")
echo "$SK_LIST" | python3 -c "
import sys, json
acts = json.load(sys.stdin)
print('秒杀活动数 =', len(acts))
assert len(acts) >= 3, '秒杀活动数不足'
assert all(a['seckillPrice'] and a['stock'] is not None for a in acts), '活动字段缺失'
"
SK_ID=$(echo "$SK_LIST" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
SK_STOCK=$(echo "$SK_LIST" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["stock"])')
SK_PRICE=$(echo "$SK_LIST" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["seckillPrice"])')

# 用一个唯一 userId 抢购，避免和其它测试账号撞
SK_USER=$((900000 + RANDOM % 99999))
GRAB=$(curl -s --noproxy '*' -X POST "http://localhost:${ITEM}/seckill/${SK_ID}/grab" \
  -H "X-User-Id: ${SK_USER}" -H "Content-Type: application/json")
echo "$GRAB"
echo "$GRAB" | python3 -c "
import sys, json
r = json.load(sys.stdin)
print('抢购成功: success=%s orderId=%s price=%s' % (r['success'], r['orderId'], r['price']))
assert r['success'] is True, '首次抢购应成功'
assert r['orderId'], '应返回普通订单号'
assert abs(float(r['price']) - $SK_PRICE) < 0.001, '抢购价应等于秒杀价'
"

# 秒杀库存应减 1
SK_STOCK_AFTER=$(curl -s --noproxy '*' "http://localhost:${ITEM}/seckill/${SK_ID}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["stock"])')
echo "秒杀库存 ${SK_STOCK} -> ${SK_STOCK_AFTER}（应减 1）"
[ $((SK_STOCK - SK_STOCK_AFTER)) -eq 1 ] || { echo "！秒杀库存没有正确扣减"; exit 1; }

# 同一用户再抢一次，应被「已抢过」拦下
DUP_GRAB=$(curl -s --noproxy '*' -X POST "http://localhost:${ITEM}/seckill/${SK_ID}/grab" \
  -H "X-User-Id: ${SK_USER}" -H "Content-Type: application/json")
echo "$DUP_GRAB"
echo "$DUP_GRAB" | grep -q "抢过" || { echo "！同一用户重复抢购没被拦截"; exit 1; }

echo "===== 全部通过 ====="
