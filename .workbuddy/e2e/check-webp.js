// 校验前端商品图是否真的走了 webp：
//   1) 统计实际请求的图片后缀分布 + 真实传输体积（Network.loadingFinished 才带准数）
//   2) 统计破图数量（确认 webp→jpg→占位图 降级链没把图弄丢）
//
// 两个必须踩过的坑：
//   a) 视口外的懒加载图在 headless 里不会解码，直接数 naturalWidth 会得到一堆"破图"
//      → 先 Emulation.setDeviceMetricsOverride 把视口撑到整页高
//   b) Network.responseReceived 的 encodedDataLength 常常是 0
//      → 用 loadingFinished 的 encodedDataLength
//
// 用法：chrome --headless=new --remote-debugging-port=9222 → node check-webp.js
const CDP_BASE = 'http://127.0.0.1:9222';
const APP = 'http://127.0.0.1:8090';

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
  const list = await (await fetch(CDP_BASE + '/json/list')).json();
  let page = list.find(t => t.type === 'page');
  if (!page) {
    await fetch(CDP_BASE + '/json/new?about:blank');
    page = (await (await fetch(CDP_BASE + '/json/list')).json()).find(t => t.type === 'page');
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  let id = 1;
  await rpc(ws, id++, 'Page.enable');
  await rpc(ws, id++, 'Runtime.enable');
  await rpc(ws, id++, 'Network.enable');
  await rpc(ws, id++, 'Network.setCacheDisabled', { cacheDisabled: true });

  // requestId → 图片 url，等 loadingFinished 时按 id 取体积
  const imgReq = new Map();
  const hits = [];
  ws.addEventListener('message', ev => {
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    const p = m.params || {};
    if (m.method === 'Network.responseReceived') {
      if (/image\//.test(p.response.mimeType || '')) imgReq.set(p.requestId, p.response.url);
    } else if (m.method === 'Network.loadingFinished') {
      if (imgReq.has(p.requestId)) {
        hits.push({ url: imgReq.get(p.requestId), size: p.encodedDataLength || 0 });
        imgReq.delete(p.requestId);
      }
    }
  });

  // 必须先在同源页面写 localStorage：about:blank 和 127.0.0.1:8090 不是同一个存储区
  await rpc(ws, id++, 'Page.navigate', { url: APP + '/login.html' });
  await new Promise(r => setTimeout(r, 1200));

  const loginRes = await fetch('http://localhost:8085/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zhangsan', password: '123456' })
  });
  const session = await loginRes.json();
  const inj = await rpc(ws, id++, 'Runtime.evaluate', {
    expression: `localStorage.clear();
      localStorage.setItem('hmall_session', ${JSON.stringify(JSON.stringify(session))});
      'session:' + !!localStorage.getItem('hmall_session')`,
    returnByValue: true
  });
  console.log('INJECT', inj.result.value);

  await rpc(ws, id++, 'Page.navigate', { url: APP + '/index.html' });
  await new Promise(r => setTimeout(r, 2500));

  // 撑高视口，让懒加载图全部进入"可视区"并解码
  const dh = await rpc(ws, id++, 'Runtime.evaluate', {
    expression: 'document.documentElement.scrollHeight', returnByValue: true
  });
  const fullH = Math.min(9000, Math.max(1000, dh.result.value || 3000));
  await rpc(ws, id++, 'Emulation.setDeviceMetricsOverride', {
    width: 1440, height: fullH, deviceScaleFactor: 1, mobile: false
  });

  let done = 0, total = 0;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    const st = await rpc(ws, id++, 'Runtime.evaluate', {
      expression: `(() => { const a = [...document.querySelectorAll('img')];
        return a.length + ':' + a.filter(x => x.complete && x.naturalWidth > 0).length; })()`,
      returnByValue: true
    });
    const v = st.result && st.result.value;
    if (!v) continue;
    [total, done] = v.split(':').map(Number);
    if (total > 0 && done === total) break;
  }
  await new Promise(r => setTimeout(r, 1500));   // 等尾巴上的响应结算

  const stat = await rpc(ws, id++, 'Runtime.evaluate', {
    expression: `(() => {
      const a = [...document.querySelectorAll('img')];
      const broken = a.filter(x => !(x.complete && x.naturalWidth > 0));
      return JSON.stringify({
        imgs: a.length,
        loaded: a.filter(x => x.complete && x.naturalWidth > 0).length,
        broken: broken.length,
        brokenSrc: broken.slice(0, 5).map(x => x.getAttribute('src')),
        sample: a.slice(0, 3).map(x => x.currentSrc.replace(location.origin + '/', ''))
      });
    })()`, returnByValue: true
  });
  console.log('页面', stat.result.value);

  const byExt = {};
  let sum = 0;
  for (const h of hits) {
    const ext = (h.url.split('?')[0].match(/\.(\w+)$/) || [, '?'])[1].toLowerCase();
    byExt[ext] = byExt[ext] || { n: 0, kb: 0 };
    byExt[ext].n++;
    byExt[ext].kb += h.size / 1024;
    sum += h.size;
  }
  console.log('图片响应', JSON.stringify(byExt));
  console.log('首屏实际传输', (sum / 1024).toFixed(1), 'KB /', hits.length, '个图');

  // 磁盘对照：48 张商品图的 jpg / webp 两份总大小
  let jpg = 0, webp = 0, n = 0;
  for (let i = 1; i <= 48; i++) {
    const f = 'D:/CUBE/hmall/frontend/images/p' + i;
    try {
      jpg += require('fs').statSync(f + '.jpg').size;
      webp += require('fs').statSync(f + '.webp').size;
      n++;
    } catch (e) { /* 该 id 无图，跳过 */ }
  }
  console.log('=== 结论');
  console.log('同 ' + n + ' 张图：jpg', (jpg / 1048576).toFixed(2), 'MB → webp',
              (webp / 1048576).toFixed(2), 'MB');
  console.log('单张平均', (jpg / n / 1024).toFixed(1), 'KB →', (webp / n / 1024).toFixed(1),
              'KB，省', ((1 - webp / jpg) * 100).toFixed(1) + '%');
  ws.close();
  process.exit(0);
})();
