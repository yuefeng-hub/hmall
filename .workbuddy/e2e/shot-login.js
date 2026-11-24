// 登录页视觉验证：桌面 / 手机 / 注册 tab 三种状态各截一张
// 用法：node .workbuddy/e2e/shot-login.js
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'preview');
const CDP = 'http://127.0.0.1:9222';
const PAGE = 'http://127.0.0.1:8090/login.html';

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

async function shot(ws, id, file, opts = {}) {
  const res = await rpc(ws, id, 'Page.captureScreenshot', Object.assign({ format: 'png' }, opts));
  const p = path.join(OUT, file);
  fs.writeFileSync(p, Buffer.from(res.data, 'base64'));
  console.log('  ' + file + ' -> ' + (fs.statSync(p).size / 1024).toFixed(0) + ' KB');
}

(async () => {
  const list = await (await fetch(CDP + '/json/list')).json();
  const target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 1;

  await rpc(ws, id++, 'Page.enable', {});
  await rpc(ws, id++, 'Network.enable', {});
  await rpc(ws, id++, 'Network.setCacheDisabled', { cacheDisabled: true });

  async function go(w, h, label) {
    await rpc(ws, id++, 'Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 1, mobile: w < 700
    });
    // 先落到同源的静态文件上清掉登录态，否则 login.js 会直接 replace 到 index.html
    await rpc(ws, id++, 'Page.navigate', { url: 'http://127.0.0.1:8090/styles.css' });
    await new Promise((r) => setTimeout(r, 400));
    await rpc(ws, id++, 'Runtime.evaluate', { expression: 'localStorage.clear(); "cleared"', returnByValue: true });
    await rpc(ws, id++, 'Page.navigate', { url: PAGE });
    await new Promise((r) => setTimeout(r, 1800));
    // 等背景视频出第一帧再截图，否则截到的是静图兜底
    for (let i = 0; i < 12; i++) {
      const st = await rpc(ws, id++, 'Runtime.evaluate', {
        expression: `(() => {
          const v = document.querySelector('.hero-video.active');
          return v ? v.readyState : -1;
        })()`, returnByValue: true
      });
      if (st.result.value >= 2) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    const info = await rpc(ws, id++, 'Runtime.evaluate', {
      expression: `(() => {
        const de = document.documentElement;
        const card = document.querySelector('.auth-card');
        const cs = card ? getComputedStyle(card) : null;
        const photo = getComputedStyle(document.querySelector('.auth-photo'));
        const vids = [...document.querySelectorAll('.hero-video')];
        return JSON.stringify({
          path: location.pathname,
          bg: photo.backgroundImage.slice(0, 60),
          cardW: card ? Math.round(card.getBoundingClientRect().width) : 0,
          cardBg: cs ? cs.backgroundColor : '',
          scrollW: de.scrollWidth, clientW: de.clientWidth,
          overflowX: de.scrollWidth > de.clientWidth + 2,
          videos: vids.map((v, i) => ({
            idx: i, rs: v.readyState, paused: v.paused,
            t: +v.currentTime.toFixed(1), active: v.classList.contains('active'),
            w: v.videoWidth, h: v.videoHeight
          }))
        });
      })()`, returnByValue: true
    });
    console.log(label, info.result.value);
  }

  // 桌面：整屏
  await go(1440, 900, '[desktop]');
  await shot(ws, id++, '登录页-新版.png');

  // 注册 tab（卡片会变高，看是否溢出）
  await rpc(ws, id++, 'Runtime.evaluate', {
    expression: `document.querySelector('.auth-tab[data-tab="reg"]').click(); 'ok'`, returnByValue: true
  });
  await new Promise((r) => setTimeout(r, 400));
  await shot(ws, id++, '登录页-注册tab.png');

  // 手机
  await go(375, 812, '[mobile]');
  await shot(ws, id++, '登录页-手机.png');

  ws.close();
  process.exit(0);
})();
