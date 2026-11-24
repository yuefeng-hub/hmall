// 验证图片三级降级真的能用：webp 缺失 → 自动退 jpg；jpg 也缺失 → 退占位图
//
// 做法：临时造一张只有 jpg、没有 webp 的图 _t1.jpg，让 <img> 去请求 _t1.webp，
// 命中 404 后应该自动变成 _t1.jpg 并成功 load；再试一个两份都不存在的 _t9，应落到占位图。
//
// 用完会删掉临时文件。用法：node check-fallback.js（需 chrome 9222 + 静态服务 8090）
const fs = require('fs');
const CDP_BASE = 'http://127.0.0.1:9222';
const APP = 'http://127.0.0.1:8090';
const IMG = 'D:/CUBE/hmall/frontend/images/';

async function rpc(ws, id, method, params) {
  ws.send(JSON.stringify({ id, method, params: params || {} }));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout ' + method)), 30000);
    const onMsg = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id === id) { clearTimeout(t); ws.removeEventListener('message', onMsg); resolve(m.result); }
    };
    ws.addEventListener('message', onMsg);
  });
}

(async () => {
  // 只留 jpg，故意不留 webp
  fs.copyFileSync(IMG + 'p1.jpg', IMG + '_t1.jpg');

  const page = (await (await fetch(CDP_BASE + '/json/list')).json()).find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 1;
  await rpc(ws, id++, 'Page.enable');
  await rpc(ws, id++, 'Runtime.enable');
  await rpc(ws, id++, 'Network.enable');
  await rpc(ws, id++, 'Network.setCacheDisabled', { cacheDisabled: true });

  await rpc(ws, id++, 'Page.navigate', { url: APP + '/login.html' });
  await new Promise(r => setTimeout(r, 1200));

  const res = await rpc(ws, id++, 'Runtime.evaluate', {
    expression: `(async () => {
      const load = (src) => new Promise(done => {
        const img = document.createElement('img');
        img.onerror = function () { Hmall.picFallback(this); };
        img.onload = () => done({ ok: true, final: img.src.split('/').pop(), w: img.naturalWidth });
        // 三级都失败时 src 会变成 data: URI，onerror 已摘掉，靠轮询收口
        const t0 = Date.now();
        (function poll() {
          if (img.complete && img.naturalWidth > 0) return done({ ok: true, final: img.src.split('/').pop(), w: img.naturalWidth });
          if (Date.now() - t0 > 5000) return done({ ok: false, final: img.src.slice(0, 40), w: 0 });
          setTimeout(poll, 100);
        })();
        img.src = src;
      });
      const a = await load('images/_t1.webp');   // 只有 jpg → 应退到 _t1.jpg
      const b = await load('images/_t9.webp');   // 两份都没有 → 应退到占位图
      return JSON.stringify({ a, b, placeholder: Hmall.PIC_FALLBACK.slice(0, 24) });
    })()`, awaitPromise: true, returnByValue: true
  });
  console.log(res.result.value);
  ws.close();

  fs.unlinkSync(IMG + '_t1.jpg');
  process.exit(0);
})();
