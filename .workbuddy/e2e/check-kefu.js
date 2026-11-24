// 智能客服「小马」的端到端验证
// 覆盖：悬浮按钮 / 面板打开 / 真实数据回复（订单·商品·秒杀·余额·政策·兜底）/ 快捷问题 / 无 JS 异常
const CDP_BASE = 'http://127.0.0.1:9222';
const APP = 'http://127.0.0.1:8090';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '_shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function rpc(ws, id, method, params) {
  ws.send(JSON.stringify({ id, method, params: params || {} }));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout ' + method)), 60000);
    const onMsg = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id === id) { clearTimeout(t); ws.removeEventListener('message', onMsg); resolve(m.result); }
    };
    ws.addEventListener('message', onMsg);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // ---- 1. 服务端登录，拿真实会话 ----
  const lr = await fetch('http://localhost:8085/users/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zhangsan', password: '123456' })
  });
  const session = await lr.json();
  if (!session.token) throw new Error('登录失败：' + JSON.stringify(session));

  // ---- 2. 连 CDP ----
  const list = await (await fetch(CDP_BASE + '/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  let id = 1;
  const errors = [];
  ws.addEventListener('message', ev => {
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push((d.exception && d.exception.description) || d.text);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('console.error: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
    }
  });

  await rpc(ws, id++, 'Page.enable');
  await rpc(ws, id++, 'Runtime.enable');
  await rpc(ws, id++, 'Network.enable');
  await rpc(ws, id++, 'Network.setCacheDisabled', { cacheDisabled: true });

  const evaluate = async (expression) => {
    const r = await rpc(ws, id++, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.result));
    return r && r.result ? r.result.value : undefined;
  };

  // ---- 3. 注入会话：先停在 login.html 再写 localStorage，然后在页面内跳转 ----
  await rpc(ws, id++, 'Page.navigate', { url: APP + '/login.html' });
  await sleep(1200);
  await evaluate(`localStorage.clear();
    localStorage.setItem('hmall_session', ${JSON.stringify(JSON.stringify(session))}); 'ok'`);
  await evaluate(`location.href = ${JSON.stringify(APP + '/index.html')}; 'go'`);
  await sleep(3500);

  const report = [];
  const check = (name, ok, extra) => {
    report.push({ name, ok: !!ok, extra: extra == null ? '' : String(extra) });
    console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (extra ? '   → ' + extra : ''));
  };

  // ---- 4. 悬浮按钮存在，面板初始隐藏 ----
  const fab = await evaluate(`!!document.getElementById('kefuFab')`);
  const panelHidden = await evaluate(`document.getElementById('kefuPanel').classList.contains('hidden')`);
  check('悬浮客服按钮已注入', fab);
  check('面板初始收起', panelHidden);

  // ---- 5. 点按钮打开 + 首屏问候 ----
  await evaluate(`document.getElementById('kefuFab').click(); 'ok'`);
  await sleep(500);
  const opened = await evaluate(`!document.getElementById('kefuPanel').classList.contains('hidden')`);
  const greet = await evaluate(`document.querySelector('.kf-msg.bot .kf-bubble').innerText.slice(0,40)`);
  const chipCount = await evaluate(`document.querySelectorAll('.kf-chip').length`);
  check('点击后展开面板', opened);
  check('自动打招呼', /黑马小助手/.test(greet), greet.replace(/\n/g, ' '));
  check('有快捷问题气泡', chipCount >= 3, chipCount + ' 个');

  const shot = async (name) => {
    const r = await rpc(ws, id++, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
  };

  await shot('01-open');

  // ---- 6. 走真实输入路径发消息（设值 + 提交表单）----
  const ask = async (text, waitMs) => {
    await evaluate(`(() => {
      const i = document.getElementById('kefuText');
      i.value = ${JSON.stringify(text)};
      document.getElementById('kefuForm').dispatchEvent(new Event('submit', { cancelable: true }));
      return 'ok';
    })()`);
    await sleep(waitMs || 2000);
    return evaluate(`(() => {
      const all = document.querySelectorAll('.kf-msg.bot .kf-bubble');
      const last = all[all.length - 1];
      return last ? last.innerText.replace(/\\s+/g, ' ').slice(0, 220) : '';
    })()`);
  };

  const orderReply = await ask('我的订单', 2600);
  check('「我的订单」返回真实订单', /订单|待支付|还没下过单/.test(orderReply), orderReply.slice(0, 90));
  const orderCards = await evaluate(`document.querySelectorAll('.kf-card').length`);
  check('订单以卡片渲染', orderCards > 0, orderCards + ' 张卡片');
  await shot('02-orders');

  const itemReply = await ask('推荐个手机', 2600);
  check('「推荐个手机」返回商品', /¥|库存|相关/.test(itemReply), itemReply.slice(0, 90));
  const itemCards = await evaluate(`document.querySelectorAll('.kf-item').length`);
  check('商品以带图卡片渲染', itemCards > 0, itemCards + ' 件');

  const imgOk = await evaluate(`(() => {
    const imgs = [...document.querySelectorAll('.kf-item > img')];
    return imgs.length ? imgs.every(i => i.complete && i.naturalWidth > 0) : false;
  })()`);
  check('商品图正常加载', imgOk);
  await shot('03-items');

  const skReply = await ask('看看秒杀', 2400);
  check('「看看秒杀」报当前场次', /第 \d+ 场/.test(skReply), skReply.slice(0, 90));

  const balReply = await ask('我余额还有多少', 2400);
  check('「余额」查到账户余额', /余额是\s*¥[\d.]+/.test(balReply), balReply.slice(0, 90));

  const kbReply = await ask('退货怎么退', 2000);
  check('「退货」命中政策知识库', /退换货|7 天|无理由/.test(kbReply), kbReply.slice(0, 90));

  const fallback = await ask('qwertyuiop 这是一句听不懂的话', 2000);
  check('无法识别时给出兜底引导', /没学会|能帮你/.test(fallback), fallback.slice(0, 90));
  await shot('04-mixed');

  // ---- 7. 快捷问题按钮可用 ----
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('.kf-chip')].find(x => /订单|秒杀|手机/.test(x.textContent));
    if (b) b.click();
    return 'ok';
  })()`);
  await sleep(2200);
  const msgsAfterChip = await evaluate(`document.querySelectorAll('.kf-msg').length`);
  check('点击快捷问题能继续对话', msgsAfterChip > 8, msgsAfterChip + ' 条消息');

  // ---- 7.5 直接发订单号能查到明细 ----
  const cartApi = async () => (await fetch('http://localhost:8082/carts', {
    headers: { 'X-User-Id': String(session.userId) }
  })).json();
  const orders = await (await fetch('http://localhost:8083/orders?limit=5', {
    headers: { 'X-User-Id': String(session.userId) }
  })).json();
  const anyId = orders[0] && orders[0].id;
  const byNo = await ask(String(anyId), 2400);
  check('直接发订单号能查到明细', byNo.indexOf('#' + anyId) >= 0 && /合计/.test(byNo), byNo.slice(0, 80));

  // ---- 7.6 对话里的「加购物车」是真写库（测完还原，不留脏数据）----
  const cartBefore = await cartApi();
  await ask('推荐个耳机', 2600);
  const addItemId = await evaluate(`(() => {
    const b = document.querySelector('[data-kfadd]');
    if (!b) return null;
    b.click();
    return Number(b.dataset.kfadd);
  })()`);
  await sleep(1600);
  const cartAfter = await cartApi();
  const rowsBefore = cartBefore.filter(c => c.itemId === addItemId);
  const rowsAfter = cartAfter.filter(c => c.itemId === addItemId);
  const numBefore = rowsBefore.reduce((s, c) => s + c.num, 0);
  const numAfter = rowsAfter.reduce((s, c) => s + c.num, 0);
  check('对话里「加购物车」真的写进购物车', addItemId != null && numAfter === numBefore + 1,
    'itemId=' + addItemId + ' ' + numBefore + '→' + numAfter);

  // 还原：原来有就改回原数量，原来没有就删掉这一行
  if (rowsBefore.length) {
    await fetch('http://localhost:8082/carts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': String(session.userId) },
      body: JSON.stringify({ id: rowsBefore[0].id, num: numBefore })
    });
  } else if (rowsAfter.length) {
    await fetch('http://localhost:8082/carts?ids=' + rowsAfter.map(c => c.id).join(','), {
      method: 'DELETE', headers: { 'X-User-Id': String(session.userId) }
    });
  }

  // ---- 8. 关闭面板 ----
  await evaluate(`document.getElementById('kefuClose').click(); 'ok'`);
  await sleep(300);
  const closed = await evaluate(`document.getElementById('kefuPanel').classList.contains('hidden')`);
  check('点 × 收起面板', closed);

  // ---- 9. 详情页也挂了客服 ----
  await rpc(ws, id++, 'Page.navigate', { url: APP + '/detail.html?id=1' });
  await sleep(2500);
  const onDetail = await evaluate(`!!document.getElementById('kefuFab')`);
  check('详情页也有客服入口', onDetail);

  // ---- 10. 移动端不溢出 ----
  await rpc(ws, id++, 'Emulation.setDeviceMetricsOverride', {
    width: 375, height: 780, deviceScaleFactor: 2, mobile: true
  });
  await rpc(ws, id++, 'Page.navigate', { url: APP + '/index.html' });
  await sleep(3000);
  await evaluate(`document.getElementById('kefuFab').click(); 'ok'`);
  await sleep(600);
  const overflow = await evaluate(`document.documentElement.scrollWidth > 375`);
  const panelW = await evaluate(`Math.round(document.getElementById('kefuPanel').getBoundingClientRect().width)`);
  check('375 宽下客服面板不溢出', !overflow && panelW <= 375, 'panelW=' + panelW);
  await shot('05-mobile');
  await rpc(ws, id++, 'Emulation.clearDeviceMetricsOverride');

  // ---- 汇总 ----
  const fail = report.filter(r => !r.ok);
  console.log('\n================ 结果 ================');
  console.log('断言 ' + report.length + ' 条，通过 ' + (report.length - fail.length) + '，失败 ' + fail.length);
  if (errors.length) {
    console.log('\nJS 异常 ' + errors.length + ' 条：');
    errors.slice(0, 8).forEach(e => console.log('  - ' + String(e).split('\n')[0]));
  } else {
    console.log('无 JS 异常');
  }
  console.log('截图目录：' + OUT);
  process.exit(fail.length || errors.length ? 1 : 0);
})().catch(e => {
  console.error('脚本出错：', e && e.message);
  process.exit(2);
});
