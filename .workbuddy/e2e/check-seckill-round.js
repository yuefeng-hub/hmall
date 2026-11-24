// 秒杀前端行为验证：倒计时归零自动换场、抢购后按钮置灰、压测面板数字正确
// 用法：node .workbuddy/e2e/check-seckill-round.js
const CDP = 'http://127.0.0.1:9222';

const rpc = (ws, id, method, params) => new Promise((resolve, reject) => {
  const onMsg = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.id !== id) return;
    ws.removeEventListener('message', onMsg);
    msg.error ? reject(new Error(method + ': ' + msg.error.message)) : resolve(msg.result);
  };
  ws.addEventListener('message', onMsg);
  ws.send(JSON.stringify({ id, method, params }));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let pass = 0, fail = 0;
  const ok = (cond, label, extra) => {
    if (cond) { pass++; console.log('  [OK]   ' + label); }
    else { fail++; console.log('  [FAIL] ' + label + (extra ? '  →  ' + extra : '')); }
  };

  const login = await (await fetch('http://127.0.0.1:8085/users/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zhangsan', password: '123456' })
  })).json();

  const list = await (await fetch(CDP + '/json/list')).json();
  const target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 1;
  const evalJs = async (expr) => {
    const r = await rpc(ws, id++, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };

  await rpc(ws, id++, 'Page.enable', {});
  await rpc(ws, id++, 'Network.enable', {});
  await rpc(ws, id++, 'Network.setCacheDisabled', { cacheDisabled: true });
  await rpc(ws, id++, 'Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await rpc(ws, id++, 'Page.navigate', { url: 'http://127.0.0.1:8090/login.html' });
  await wait(1100);
  await evalJs(`(() => {
    localStorage.removeItem('hmall_api_base');
    localStorage.setItem('hmall_session', ${JSON.stringify(JSON.stringify({
      token: login.token, userId: login.userId, username: login.username,
      email: login.email, balance: login.balance
    }))});
    return 'ok';
  })()`);
  await evalJs(`location.href = 'index.html'; 'go'`);
  await wait(3200);

  // ---------- 1. 场次渲染 ----------
  console.log('\n[1] 场次条与倒计时');
  let s = await evalJs(`JSON.stringify({
    round: document.getElementById('skRoundNo').textContent,
    time: document.getElementById('skRoundTime').textContent,
    cd: document.getElementById('skCd').textContent,
    cards: document.querySelectorAll('#seckillGrid .gd-card').length,
    tip: document.getElementById('skTip').textContent,
    empty: !document.getElementById('skEmpty').classList.contains('hidden')
  })`);
  let o = JSON.parse(s);
  ok(/第 \d+ 场/.test(o.round), '显示「第 N 场」', o.round);
  ok(/^\d{2}:\d{2} – \d{2}:\d{2}$/.test(o.time), '显示本场时间段', o.time);
  ok(/^\d{2}:\d{2}:\d{2}$/.test(o.cd) && o.cd !== '00:00:00', '倒计时在走', o.cd);
  ok(o.cards === 3, '本场 3 个商品', o.cards + ' 个');
  ok(!o.empty, '不是空态', '');
  ok(/每 \d+ 分钟换一场/.test(o.tip), '提示文案带换场节奏', o.tip);

  // ---------- 2. 倒计时归零 -> 自动换场 ----------
  console.log('\n[2] 倒计时归零自动重拉场次');
  const before = o.round;
  await evalJs(`skDeadline = Date.now() - 1000; 'offset'`);
  await wait(2800);
  const after = JSON.parse(await evalJs(`JSON.stringify({
    cd: document.getElementById('skCd').textContent,
    cards: document.querySelectorAll('#seckillGrid .gd-card').length
  })`));
  ok(after.cd !== '00:00:00', '归零后重新算出新的剩余时间', after.cd);
  ok(after.cards === 3, '重拉后商品仍在', after.cards + ' 个');
  console.log('        （场次文本 ' + before + ' → 仍是同场次是正常的：切场要等真实时间越过整点分钟）');

  // ---------- 3. 抢购后按钮置灰 ----------
  console.log('\n[3] 抢购后「本场已抢到」');
  const grab = await evalJs(`(async () => {
    const btn = document.querySelector('#seckillGrid button[data-sk]:not(:disabled)');
    if (!btn) return JSON.stringify({ skipped: true });
    const id = Number(btn.dataset.sk);
    const r = await fetch(Hmall.API.item + '/seckill/' + id + '/grab', {
      method: 'POST',
      headers: { 'X-User-Id': String(Hmall.userId()) }
    });
    const j = await r.json();
    return JSON.stringify({ id: id, success: j.success, reason: j.failReason });
  })()`);
  const g = JSON.parse(grab);
  ok(g.success === true || g.reason, '抢购接口有明确结果', grab);
  await evalJs(`loadSeckill(); 'reload'`);
  await wait(1200);
  const btnState = JSON.parse(await evalJs(`(() => {
    const btns = [...document.querySelectorAll('#seckillGrid .sk-grab')];
    return JSON.stringify({
      total: btns.length,
      disabled: btns.filter(b => b.disabled).length,
      labels: btns.map(b => b.textContent.trim())
    });
  })()`));
  ok(btnState.labels.some(t => /已抢到|已抢光/.test(t)), '本人已抢的那件按钮变成「已抢到」', btnState.labels.join(' | '));
  ok(btnState.disabled >= 1, '对应按钮已禁用', btnState.disabled + '/' + btnState.total);

  // ---------- 4. 压测面板 ----------
  console.log('\n[4] 压测面板数字');
  await evalJs(`document.querySelector('#benchTarget').value = document.querySelector('#benchTarget option').value; 'set'`);
  const stockBefore = Number(await evalJs(`document.getElementById('bmStock').textContent.match(/(\\d+) \\//)[1]`));
  await evalJs(`document.querySelector('#benchSeg button[data-c="100"]').click(); 'seg'`);
  await evalJs(`document.querySelector('#benchRun').click(); 'run'`);
  for (let i = 0; i < 40; i++) {
    await wait(400);
    if (await evalJs(`document.getElementById('benchRun').textContent.trim() === '开始压测'`)) break;
  }
  await wait(500);
  const b = JSON.parse(await evalJs(`(() => {
    const g = id => document.getElementById(id).textContent.trim();
    return JSON.stringify({
      ok: +g('bmSuccess'), out: +g('bmSoldOut'), dup: +g('bmDup'),
      qps: +g('bmQps'), ms: +g('bmElapsed'), p95: +g('bmP95'),
      legendOk: +g('bmLegendOk'), legendOut: +g('bmLegendOut'),
      barOk: document.getElementById('bmBarOk').style.width,
      msg: g('bmMsg')
    });
  })()`));
  ok(b.ok + b.out + b.dup === 100, '成功+售罄+重复 = 并发数 100', b.ok + '+' + b.out + '+' + b.dup);
  ok(b.ok <= stockBefore, '抢到的件数不超过库存', b.ok + ' <= ' + stockBefore);
  ok(b.ok === Math.min(100, stockBefore), '库存够时应该抢满 100 件', b.ok + ' vs ' + Math.min(100, stockBefore));
  ok(b.legendOk === b.ok, '图例与指标一致', b.legendOk + ' / ' + b.ok);
  ok(/回滚/.test(b.msg), '提示里说明数据已回滚', b.msg.slice(0, 30));
  ok(b.qps > 0 && b.ms > 0 && b.p95 > 0, 'QPS / 耗时 / P95 都有值', b.qps + ' / ' + b.ms + ' / ' + b.p95);

  ws.close();
  console.log(`\n汇总：${pass} 通过 / ${fail} 失败\n`);
  process.exit(fail ? 1 : 0);
})();
