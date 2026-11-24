// 秒杀并发压测：验证「不超卖 + 防重复 + 金额正确」。
// 不依赖任何第三方库，用 Node 22 自带 fetch + Promise.all 模拟并发。
//
// 场景：
//   A. N 个不同用户同时抢「库存 50」的场次，成功数应恰好 = 50，且秒杀库存归零
//   B. 同一个用户连发 20 个并发请求抢同一场，应只有 1 个成功
//   C. 抢到后查订单，金额应等于秒杀价（不是原价）
//
// 用法：node scripts/seckill-stress.js [item端口] [order端口] [活动id] [并发数]
const ITEM = process.argv[2] || '18081';
const ORDER = process.argv[3] || '18083';
const ACT = process.argv[4] || '101';       // Redmi K70 秒杀，库存 50
const CONCURRENCY = Number(process.argv[5] || 120);  // 并发用户数 > 库存，制造超卖压力

const BASE = `http://localhost:${ITEM}`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  [PASS] ' : '  [FAIL] ') + name + (detail !== undefined ? '  -> ' + detail : ''));
}

async function grab(userId, actId) {
  const r = await fetch(`${BASE}/seckill/${actId || ACT}/grab`, {
    method: 'POST',
    headers: { 'X-User-Id': String(userId), 'Content-Type': 'application/json' }
  });
  return { status: r.status, body: await r.json() };
}

async function listStock() {
  const r = await fetch(`${BASE}/seckill/list`);
  const list = await r.json();
  const act = list.find(a => String(a.id) === ACT);
  return act ? act.remain : null;
}

(async () => {
  console.log(`===== 秒杀并发压测：活动 ${ACT}，并发 ${CONCURRENCY} 个用户 =====`);

  // 先看初始库存
  let remain = await listStock();
  console.log(`初始剩余库存：${remain}`);
  const initStock = remain;
  if (remain == null || remain <= 0) {
    console.log('！活动无库存或无此活动，请先 bash scripts/reset-data.sh -y 重置');
    process.exit(2);
  }

  // ===== 场景 A：不同用户并发抢，验证不超卖 =====
  console.log(`\n----- 场景 A：${CONCURRENCY} 个不同用户同时抢（库存 ${remain}） -----`);
  const t0 = Date.now();
  // userId 基址用时间戳，避免和上次运行残留的 seckill_order 冲突
  const uidBase = 100000000 + (Date.now() % 900000000);
  const tasks = [];
  for (let i = 1; i <= CONCURRENCY; i++) tasks.push(grab(uidBase + i));
  const settled = await Promise.all(tasks);
  const elapsed = Date.now() - t0;

  const success = settled.filter(r => r.body && r.body.success === true);
  const reasons = {};
  settled.forEach(r => {
    if (r.body && !r.body.success) {
      const k = r.body.failReason || 'unknown';
      reasons[k] = (reasons[k] || 0) + 1;
    }
  });

  console.log(`并发完成，耗时 ${elapsed} ms`);
  console.log(`成功抢到：${success.length} 人`);
  console.log(`失败分布：${JSON.stringify(reasons)}`);

  const remainAfter = await listStock();
  console.log(`剩余库存：${remainAfter}`);

  check('不超卖：成功数 == 初始库存', success.length === initStock,
    `成功 ${success.length} vs 库存 ${initStock}`);
  check('库存恰好扣到 0', remainAfter === 0, `剩余 ${remainAfter}`);
  check('失败原因都是「已抢光」（或已抢过）',
    Object.keys(reasons).every(k => k.indexOf('抢光') >= 0 || k.indexOf('抢过') >= 0),
    JSON.stringify(reasons));
  check('抢到的人都拿到了订单号', success.every(s => s.body.orderId > 0),
    `${success.length} 单`);

  // ===== 场景 C：验证金额是秒杀价 =====
  console.log(`\n----- 场景 C：校验秒杀订单金额是秒杀价（不是原价） -----`);
  const sampleOrderId = success[0].body.orderId;
  const samplePrice = success[0].body.price;
  const or = await fetch(`http://localhost:${ORDER}/orders/${sampleOrderId}`);
  const order = await or.json();
  console.log(`秒杀返回 price=${samplePrice}，订单服务 totalFee=${order.totalFee}`);
  check('订单金额 == 秒杀价', Math.abs(Number(order.totalFee) - Number(samplePrice)) < 0.001,
    `${order.totalFee} vs ${samplePrice}`);
  check('订单是秒杀单（orderType=2）', order.orderType === 2, 'orderType=' + order.orderType);

  // ===== 场景 B：同一用户并发重复抢（换一个新活动） =====
  // 注意：活动 101 已被抢光。这里用另一个活动 102 验证「一人一单」。
  console.log(`\n----- 场景 B：同一用户并发 20 次抢活动 102（应只成功 1 次） -----`);
  const ACT2 = '102';
  // userId 用时间戳保证每次运行都是全新用户，避免上次运行残留 seckill_order 导致「已抢过」
  const dupUser = 900000000 + (Date.now() % 100000000);
  const dupTasks = [];
  for (let i = 0; i < 20; i++) dupTasks.push(grab(dupUser, ACT2));  // 同一个 userId 抢活动 102
  const dup = await Promise.all(dupTasks);
  const dupOk = dup.filter(r => r.body && r.body.success === true);
  const dupFailed = dup.filter(r => r.body && r.body.success === false && /抢过/.test(r.body.failReason || ''));
  console.log(`成功 ${dupOk.length} 次，其中「已抢过」${dupFailed.length} 次`);
  check('同一用户 20 并发只抢到 1 次', dupOk.length === 1, `成功 ${dupOk.length} 次`);
  check('其余都被「已抢过」拦下', dupOk.length + dupFailed.length === 20,
    `已抢过 ${dupFailed.length} / 20`);

  // ===== 汇总 =====
  const failed = results.filter(r => !r.ok);
  console.log(`\n===== 压测汇总: ${results.length - failed.length} / ${results.length} 通过 =====`);
  if (failed.length) {
    console.log('失败项：' + failed.map(f => f.name).join('、'));
    process.exit(1);
  }
  process.exit(0);
})().catch(e => {
  console.error('压测异常：' + e.message);
  process.exit(2);
});
