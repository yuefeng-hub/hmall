// 验证 file:// 直接打开（open-shop.bat 的用法）时图片链路是否正常：
//   - .webp 能否从本地磁盘加载（file:// 下不走 HTTP，没有 Content-Type）
//   - image-set() 在 file:// 下能否选中 webp
//   - 三级降级在 file:// 下是否照样生效
// 用法：node check-file-protocol.js（需 chrome 9222）
const CDP_BASE = 'http://127.0.0.1:9222';
const APP = 'file:///D:/CUBE/hmall/frontend';

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
  const page = (await (await fetch(CDP_BASE + '/json/list')).json()).find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 1;
  await rpc(ws, id++, 'Page.enable');
  await rpc(ws, id++, 'Runtime.enable');
  // 允许 headless 从 file:// 加载本地资源
  await rpc(ws, id++, 'Page.navigate', { url: APP + '/login.html' });
  await new Promise(r => setTimeout(r, 1500));

  const res = await rpc(ws, id++, 'Runtime.evaluate', {
    expression: `(async () => {
      const load = (src) => new Promise(done => {
        const img = document.createElement('img');
        img.onerror = function () { Hmall.picFallback(this); };
        const t0 = Date.now();
        (function poll() {
          if (img.complete && img.naturalWidth > 0) return done({ ok: true, final: img.src.split('/').pop(), w: img.naturalWidth });
          if (Date.now() - t0 > 6000) return done({ ok: false, final: img.src.slice(0, 30), w: 0 });
          setTimeout(poll, 100);
        })();
        img.src = src;
      });
      const webp = await load(Hmall.pic(1));
      // image-set 实测：造一个用 image-set 的元素，看浏览器选哪条
      const d = document.createElement('div');
      d.style.backgroundImage = 'url(images/banner1.jpg)';
      d.style.backgroundImage = 'image-set(url(images/banner1.webp) type("image/webp"), url(images/banner1.jpg) type("image/jpeg"))';
      document.body.appendChild(d);
      const bg = getComputedStyle(d).backgroundImage;
      d.remove();
      return JSON.stringify({
        protocol: location.protocol,
        hasHmall: typeof Hmall === 'object',
        hasPicFallback: typeof Hmall.picFallback === 'function',
        webp, pickedWebp: /banner1\\.webp/.test(bg), bg: bg.slice(0, 60)
      });
    })()`, awaitPromise: true, returnByValue: true
  });
  console.log(res.result.value || JSON.stringify(res));
  ws.close();
  process.exit(0);
})();
