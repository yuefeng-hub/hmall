// 窄屏响应式验证：375（手机）/ 768（平板）/ 1024（小笔记本）
const CDP_BASE = 'http://127.0.0.1:9222';
const APP = 'http://127.0.0.1:8090';
const fs = require('fs');

async function rpc(ws, id, method, params) {
  ws.send(JSON.stringify({ id, method, params: params || {} }));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout ' + method)), 90000);
    const onMsg = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id === id) { clearTimeout(t); ws.removeEventListener('message', onMsg); resolve(m.result); }
    };
    ws.addEventListener('message', onMsg);
  });
}

(async () => {
  const lr = await fetch('http://localhost:8085/users/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zhangsan', password: '123456' })
  });
  const session = await lr.json();

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
  await rpc(ws, id++, 'Runtime.evaluate', {
    expression: `localStorage.clear();localStorage.setItem('hmall_session',${JSON.stringify(JSON.stringify(session))});'ok'`,
    returnByValue: true
  });

  for (const [w, h, tag] of [[375, 812, 'phone'], [768, 1024, 'tablet'], [1024, 900, 'laptop']]) {
    await rpc(ws, id++, 'Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 1, mobile: w < 500
    });
    await rpc(ws, id++, 'Page.navigate', { url: APP + '/index.html' });
    await new Promise(r => setTimeout(r, 3000));
    await rpc(ws, id++, 'Runtime.evaluate', {
      expression: `Promise.race([Promise.all([...document.images].map(i=>i.decode().catch(()=>null))),new Promise(r=>setTimeout(r,4000))]).then(()=>'d')`,
      awaitPromise: true
    });
    await new Promise(r => setTimeout(r, 800));

    const m = await rpc(ws, id++, 'Runtime.evaluate', {
      expression: `(() => {
        const de = document.documentElement;
        const imgs = [...document.images];
        // 只算「当前视口内」的图：headless 对视口外的懒加载图不解码，
        // 全量统计会得到 40+ 张假破图。视口内的图破了才是真问题。
        const vis = imgs.filter(i => {
          if (!i.offsetParent && !i.getClientRects().length) return false;
          const r = i.getBoundingClientRect();
          return r.bottom > 0 && r.top < innerHeight && r.width > 0;
        });
        const bad = vis.filter(i => !i.complete || i.naturalWidth === 0);
        // 横向溢出检测要放过「横向滚动容器里的元素」（秒杀轨道本来就比屏宽）
        const inScrollTrack = el => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
          }
          return false;
        };
        const over = [...document.querySelectorAll('body *')]
          .filter(el => el.getBoundingClientRect().right > de.clientWidth + 2 && !inScrollTrack(el))
          .slice(0, 5).map(el => el.className || el.tagName);
        return JSON.stringify({
          vw: de.clientWidth, scrollW: de.scrollWidth,
          overflowX: de.scrollWidth > de.clientWidth + 2,
          imgs: vis.length, broken: bad.length, over: over,
          gridCols: getComputedStyle(document.querySelector('.goods-grid')).gridTemplateColumns.split(' ').length
        });
      })()`, returnByValue: true
    });
    console.log(tag, w + 'x' + h, m.result.value);

    const res = await rpc(ws, id++, 'Page.captureScreenshot', {
      format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 }
    });
    fs.writeFileSync('D:/CUBE/hmall/.workbuddy/preview/_rwd-' + tag + '.png', Buffer.from(res.data, 'base64'));
  }
  ws.close();
})();
