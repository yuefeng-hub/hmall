// 详情页 / 购物车 / 订单页 的图片渲染验证
const CDP_BASE = 'http://127.0.0.1:9222';
const APP = 'http://127.0.0.1:8090';
const fs = require('fs');

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

(async () => {
  // Node 端登录，避免页面内跨域
  const lr = await fetch('http://localhost:8085/users/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zhangsan', password: '123456' })
  });
  const session = await lr.json();

  // 确保购物车里有东西（拿详情页图片一起验）
  await fetch('http://localhost:8082/carts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': String(session.userId) },
    body: JSON.stringify({ itemId: 29, num: 1 })
  });

  const list = await (await fetch(CDP_BASE + '/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  let id = 1;
  await rpc(ws, id++, 'Page.enable');
  await rpc(ws, id++, 'Runtime.enable');
  await rpc(ws, id++, 'Network.enable');
  await rpc(ws, id++, 'Network.setCacheDisabled', { cacheDisabled: true });
  await rpc(ws, id++, 'Page.navigate', { url: APP + '/login.html' });
  await new Promise(r => setTimeout(r, 1200));

  const inject = await rpc(ws, id++, 'Runtime.evaluate', {
    expression: `localStorage.clear();
      localStorage.setItem('hmall_session', ${JSON.stringify(JSON.stringify(session))});
      'ok'`,
    returnByValue: true
  });
  console.log('INJECT', inject && inject.result && inject.result.value);

  const shoot = async (url, name, waitMs) => {
    await rpc(ws, id++, 'Page.navigate', { url });
    await new Promise(r => setTimeout(r, waitMs || 2500));
    // 撑高视口 + 强制 decode，避免视口外图片判成破图
    const lm = await rpc(ws, id++, 'Page.getLayoutMetrics');
    const h = Math.min(Math.ceil(lm.contentSize.height) + 20, 2400);
    await rpc(ws, id++, 'Emulation.setDeviceMetricsOverride', {
      width: 1440, height: h, deviceScaleFactor: 1, mobile: false
    });
    await rpc(ws, id++, 'Runtime.evaluate', {
      // 个别图片 decode 可能一直挂起，用 race 保底，最多等 4 秒
      expression: `Promise.race([
        Promise.all([...document.images].map(i => i.decode().catch(() => null))),
        new Promise(r => setTimeout(r, 4000))
      ]).then(() => 'done')`,
      awaitPromise: true
    });
    await new Promise(r => setTimeout(r, 700));

    const st = await rpc(ws, id++, 'Runtime.evaluate', {
      // 只统计可见的图：首页/购物车/订单是同一个 index.html 里的多个视图，
      // 当前没显示的那个视图（display:none）里的 <img> 不会解码，
      // 全量统计会把它们误报成破图
      expression: `(() => {
        const all = [...document.images];
        const a = all.filter(i => i.offsetParent !== null || i.getClientRects().length);
        const bad = a.filter(i => !i.complete || i.naturalWidth === 0);
        return JSON.stringify({ visible: a.length, hidden: all.length - a.length,
          broken: bad.length, badSrc: bad.slice(0,5).map(i => i.getAttribute('src')) });
      })()`, returnByValue: true
    });
    console.log(name, st.result.value);

    const res = await rpc(ws, id++, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/CUBE/hmall/.workbuddy/preview/' + name, Buffer.from(res.data, 'base64'));

    await rpc(ws, id++, 'Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false
    });
  };

  await shoot(APP + '/detail.html?id=29', '详情页-新图.png', 3000);
  await shoot(APP + '/index.html#cart', '购物车-新图.png', 3000);
  await shoot(APP + '/index.html#orders', '订单页-新图.png', 3000);

  ws.close();
})();
