// 首页视觉验证截图：登录 → 首页全屏 → 首屏 → 秒杀楼层
const CDP_BASE = 'http://127.0.0.1:9222';
const APP = 'http://127.0.0.1:8090';

async function rpc(ws, id, method, params) {
  ws.send(JSON.stringify({ id, method, params: params || {} }));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout ' + method)), 120000);
    const onMsg = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id === id) { clearTimeout(t); ws.removeEventListener('message', onMsg); resolve(m.result); }
    };
    ws.addEventListener('message', onMsg);
  });
}

(async () => {
  const list = await (await fetch(CDP_BASE + '/json/list')).json();
  let page = list.find(t => t.type === 'page');
  if (!page) {
    await fetch(CDP_BASE + '/json/new?about:blank');
    const l2 = await (await fetch(CDP_BASE + '/json/list')).json();
    page = l2.find(t => t.type === 'page');
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  let id = 1;
  await rpc(ws, id++, 'Page.enable');
  await rpc(ws, id++, 'Runtime.enable');
  // 图片同名覆盖后必须禁缓存，否则截到的还是旧的
  await rpc(ws, id++, 'Network.enable');
  await rpc(ws, id++, 'Network.setCacheDisabled', { cacheDisabled: true });

  // 关掉代理影响，直接打 8081
  await rpc(ws, id++, 'Page.navigate', { url: APP + '/login.html' });
  await new Promise(r => setTimeout(r, 1500));

  // Node 端直接登录，避免页面内跨域 fetch 的不确定性
  const loginRes = await fetch('http://localhost:8085/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zhangsan', password: '123456' })
  });
  const session = await loginRes.json();
  console.log('LOGIN', JSON.stringify({ token: !!session.token, userId: session.userId, balance: session.balance }));

  await rpc(ws, id++, 'Runtime.evaluate', {
    expression: `
      localStorage.clear();
      localStorage.setItem('hmall_session', ${JSON.stringify(JSON.stringify(session))});
      'stored:' + !!localStorage.getItem('hmall_session')
    `, returnByValue: true
  }).then(r => console.log('INJECT', r && r.result && r.result.value));

  await rpc(ws, id++, 'Page.navigate', { url: APP + '/index.html' });
  // Python 的 http.server 是单线程的，一次拉 48 张图会排队，
  // 所以这里轮询等所有 img 都 decode 完，而不是死等固定秒数
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    const st = await rpc(ws, id++, 'Runtime.evaluate', {
      expression: `(() => { const a=[...document.querySelectorAll('img')];
        return a.length + ':' + a.filter(x=>x.complete && x.naturalWidth>0).length; })()`,
      returnByValue: true
    });
    const v = st && st.result && st.result.value;
    if (v) {
      const [total, done] = v.split(':').map(Number);
      if (total > 0 && done === total) { console.log('IMAGES', done + '/' + total + ' loaded'); break; }
      if (i === 39) console.log('IMAGES 超时 ' + done + '/' + total);
    }
  }
  await new Promise(r => setTimeout(r, 800));

  const shot = async (name, clip) => {
    const params = { format: 'png', captureBeyondViewport: true };   // 不加这个，视口外的区域是全白
    if (clip) params.clip = clip;
    const res = await rpc(ws, id++, 'Page.captureScreenshot', params);
    require('fs').writeFileSync('D:/CUBE/hmall/.workbuddy/preview/' + name, Buffer.from(res.data, 'base64'));
    console.log('saved', name);
  };

  // headless 对视口外的图片会延迟解码，截长图时会留下空白格。
  // 直接把视口撑到整页高度，所有图片都进视口，一次截完。
  const lm = await rpc(ws, id++, 'Page.getLayoutMetrics');
  const fullH = Math.min(Math.ceil(lm.contentSize.height) + 40, 6000);
  await rpc(ws, id++, 'Emulation.setDeviceMetricsOverride', {
    width: 1440, height: fullH, deviceScaleFactor: 1, mobile: false
  });
  await new Promise(r => setTimeout(r, 1200));
  await rpc(ws, id++, 'Runtime.evaluate', {
    expression: `Promise.all([...document.images].map(i => i.decode().catch(() => null))).then(() => 'decoded')`,
    awaitPromise: true, returnByValue: true
  });
  await new Promise(r => setTimeout(r, 1200));

  // 首屏（固定 1000px 高，需要关掉 captureBeyondViewport 才不会截成整页）
  await rpc(ws, id++, 'Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false
  });
  await new Promise(r => setTimeout(r, 600));
  {
    const res = await rpc(ws, id++, 'Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: 1440, height: 1000, scale: 1 }
    });
    require('fs').writeFileSync('D:/CUBE/hmall/.workbuddy/preview/新版首页首屏.png', Buffer.from(res.data, 'base64'));
    console.log('saved 新版首页首屏.png');
  }

  // 整页一次性截会把 Chrome 卡死（1440×3000+ 的缓冲区太大），
  // 改成撑高视口逐屏截，最后用 Python 拼起来（见 scripts/stitch-preview.py）
  const SCREENS = 4;
  const PAGE_H = 1000;
  for (let k = 0; k < SCREENS; k++) {
    await rpc(ws, id++, 'Emulation.setDeviceMetricsOverride', {
      width: 1440, height: PAGE_H, deviceScaleFactor: 1, mobile: false
    });
    await rpc(ws, id++, 'Runtime.evaluate', { expression: 'window.scrollTo(0, ' + (k * PAGE_H) + ')' });
    await new Promise(r => setTimeout(r, 900));
    const res = await rpc(ws, id++, 'Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: k * PAGE_H, width: 1440, height: PAGE_H, scale: 1 },
      captureBeyondViewport: true
    });
    require('fs').writeFileSync('D:/CUBE/hmall/.workbuddy/preview/_seg' + k + '.png', Buffer.from(res.data, 'base64'));
    console.log('saved _seg' + k + '.png');
  }
  await rpc(ws, id++, 'Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' });

  // 关键信息
  const info = await rpc(ws, id++, 'Runtime.evaluate', {
    expression: `
      (() => {
        const imgs = [...document.querySelectorAll('.gd-pic img')];
        const broken = imgs.filter(i => !i.complete || i.naturalWidth === 0);
        return JSON.stringify({
          cards: imgs.length,
          broken: broken.length,
          brokenSrc: broken.slice(0, 12).map(i => i.getAttribute('src')),
          firstSrc: imgs[0] && imgs[0].getAttribute('src'),
          slideBg: getComputedStyle(document.querySelector('.slide.s1')).backgroundImage.slice(0, 90),
          docWidth: document.documentElement.scrollWidth
        }, null, 1);
      })()
    `, returnByValue: true
  });
  console.log('INFO ' + (info && info.result && info.result.value));
  ws.close();
})();
