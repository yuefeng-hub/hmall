// 一次性量一下详情页关键元素的真实尺寸（用 CDP，不引入依赖）
const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let seq = 0; const pend = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  });
  const send = (method, params = {}) => {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise(r => pend.set(id, r));
  };
  const evaluate = async (expr, awaitPromise) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: !!awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  await send('Page.enable'); await send('Runtime.enable');
  // 用已注册的 E2E 账号登录（走接口拿 token，直接塞 localStorage）
  await send('Page.navigate', { url: 'http://127.0.0.1:8090/login.html?base=18080' });
  await sleep(1500);
  const info = await evaluate(`(async function(){
    var r = await fetch(Hmall.API.user + '/users/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username:'zhangsan', password:'123456' })
    });
    var d = await r.json();
    if (d.token) Hmall.set({ token:d.token, userId:d.userId, username:d.username, email:d.email, balance:d.balance });
    return d.token ? 'ok' : JSON.stringify(d);
  })()`, true);
  console.log('登录：' + info);

  await send('Page.navigate', { url: 'http://127.0.0.1:8090/detail.html?id=1' });
  await sleep(2500);
  const m = await evaluate(`(function(){
    var img = document.getElementById('dPic').getBoundingClientRect();
    var main = document.querySelector('.detail-main').getBoundingClientRect();
    var info = document.querySelector('.detail-info').getBoundingClientRect();
    return {
      viewport: innerWidth + 'x' + innerHeight,
      img: Math.round(img.width) + 'x' + Math.round(img.height),
      natural: document.getElementById('dPic').naturalWidth + 'x' + document.getElementById('dPic').naturalHeight,
      main: Math.round(main.width) + 'x' + Math.round(main.height),
      info: Math.round(info.width) + 'x' + Math.round(info.height),
      overflowX: document.documentElement.scrollWidth > innerWidth
    };
  })()`);
  console.log(JSON.stringify(m, null, 2));
  ws.close();
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(2); });
