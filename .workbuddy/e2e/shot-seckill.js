// 秒杀楼层 + 压测面板视觉验证
// 用法：node .workbuddy/e2e/shot-seckill.js（需 8090 静态服务 + 9222 headless chrome + 8081 商品服务）
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'preview');
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
  const list = await (await fetch(CDP + '/json/list')).json();
  const target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 1;
  const evalJs = async (expr) => {
    const r = await rpc(ws, id++, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };

  await rpc(ws, id++, 'Page.enable', {});
  await rpc(ws, id++, 'Network.enable', {});
  // 静态服务会给强缓存，改完 HTML 不刷缓存会截到旧页面
  await rpc(ws, id++, 'Network.setCacheDisabled', { cacheDisabled: true });
  await rpc(ws, id++, 'Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false
  });

  // 必须先真登录拿 token：伪造的 token 会让用户服务的 /users/me 返回 401，
  // 前端 401 自动清会话并跳登录页，页面根本进不去
  const login = await (await fetch('http://127.0.0.1:8085/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zhangsan', password: '123456' })
  })).json();
  if (!login.token) throw new Error('登录失败: ' + JSON.stringify(login));
  const session = {
    token: login.token, userId: login.userId, username: login.username,
    email: login.email, balance: login.balance
  };

  await rpc(ws, id++, 'Page.navigate', { url: 'http://127.0.0.1:8090/login.html' });
  await wait(1200);
  await evalJs(`(() => {
    localStorage.removeItem('hmall_api_base');
    localStorage.setItem('hmall_session', ${JSON.stringify(JSON.stringify(session))});
    return localStorage.getItem('hmall_session');
  })()`);
  await evalJs(`location.href = 'index.html'; 'go'`);
  await wait(3200);

  console.log('[diag]', await evalJs(`JSON.stringify({
    href: location.href,
    hasRound: !!document.getElementById('skRoundNo'),
    session: !!localStorage.getItem('hmall_session'),
    role: document.querySelector('.auth-card') ? 'login-page' : 'index-page'
  })`));

  const info = await evalJs(`(() => {
    const r = document.getElementById('skRoundNo').textContent;
    const t = document.getElementById('skRoundTime').textContent;
    const cd = document.getElementById('skCd').textContent;
    const cards = document.querySelectorAll('.sk-card').length;
    return JSON.stringify({ round: r, time: t, countdown: cd, cards });
  })()`);
  console.log('[seckill]', info);

  // 滚动到目标区块顶部再截视口：用 clip 截超出视口的部分会被裁掉
  async function shotOf(selector, file) {
    await evalJs(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return 'missing';
      el.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -70);
      return 'ok';
    })()`);
    await wait(500);
    const res = await rpc(ws, id++, 'Page.captureScreenshot', { format: 'png' });
    const p = path.join(OUT, file);
    fs.writeFileSync(p, Buffer.from(res.data, 'base64'));
    console.log('  ' + file + ' -> ' + (fs.statSync(p).size / 1024).toFixed(0) + ' KB');
  }

  await shotOf('.seckill-floor', '秒杀-场次.png');

  // 点压测
  await evalJs(`document.querySelector('#benchTarget').value = document.querySelector('#benchTarget option').value; 'ok'`);
  await evalJs(`document.querySelector('#benchRun').click(); 'clicked'`);
  for (let i = 0; i < 40; i++) {
    await wait(500);
    const done = await evalJs(`document.getElementById('benchRun').textContent.trim() === '开始压测'`);
    if (done) break;
  }
  await wait(600);
  const metrics = await evalJs(`(() => {
    const g = id => document.getElementById(id).textContent;
    return JSON.stringify({
      ok: g('bmSuccess'), out: g('bmSoldOut'), dup: g('bmDup'),
      qps: g('bmQps'), ms: g('bmElapsed'), p95: g('bmP95'), msg: g('bmMsg')
    });
  })()`);
  console.log('[bench]', metrics);
  await shotOf('.bench-floor', '秒杀-压测结果.png');

  // 整屏
  await evalJs(`window.scrollTo(0, 0); 'ok'`);
  await wait(500);
  const full = await rpc(ws, id++, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, '首页-秒杀区块.png'), Buffer.from(full.data, 'base64'));

  ws.close();
  process.exit(0);
})();
