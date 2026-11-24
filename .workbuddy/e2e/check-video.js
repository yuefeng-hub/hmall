// 登录页背景视频轮播验证
// 断言：四段视频就绪 / 8 秒自动切换 / 暂停按钮停止轮播 / prefers-reduced-motion 下默认静止
// 用法：node .workbuddy/e2e/check-video.js（需 8090 静态服务 + 9222 headless chrome）
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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const list = await (await fetch(CDP + '/json/list')).json();
  const target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 1;
  let pass = 0, fail = 0;

  const ok = (cond, label, extra) => {
    if (cond) { pass++; console.log('  [OK]   ' + label); }
    else { fail++; console.log('  [FAIL] ' + label + (extra ? '  →  ' + extra : '')); }
  };
  const evalJs = async (expr) => {
    const r = await rpc(ws, id++, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };
  const state = () => evalJs(`(() => {
    const vids = [...document.querySelectorAll('.hero-video')];
    return {
      n: vids.length,
      rs: vids.map(v => v.readyState),
      paused: vids.map(v => v.paused),
      visible: vids.filter(v => v.classList.contains('active')).length,
      active: vids.findIndex(v => v.classList.contains('active')),
      t: vids.map(v => +v.currentTime.toFixed(1)),
      btn: document.querySelector('#motionBtn').getAttribute('aria-label')
    };
  })()`);

  async function load(media) {
    await rpc(ws, id++, 'Page.enable', {});
    await rpc(ws, id++, 'Network.enable', {});
    await rpc(ws, id++, 'Network.setCacheDisabled', { cacheDisabled: true });
    if (media) {
      await rpc(ws, id++, 'Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: media }]
      });
    } else {
      await rpc(ws, id++, 'Emulation.setEmulatedMedia', { features: [] });
    }
    // 先落静态文件清 session，否则 login.js 会直接跳首页
    await rpc(ws, id++, 'Page.navigate', { url: 'http://127.0.0.1:8090/styles.css' });
    await wait(300);
    await evalJs('localStorage.clear(); "ok"');
    await rpc(ws, id++, 'Page.navigate', { url: PAGE });
    for (let i = 0; i < 20; i++) {
      await wait(300);
      const s = await evalJs(`document.querySelectorAll('.hero-video').length`).catch(() => 0);
      const rs = await evalJs(`(() => { const v = document.querySelector('.hero-video.active'); return v ? v.readyState : -1; })()`).catch(() => -1);
      if (s === 4 && rs >= 2) break;
    }
  }

  // ---------- 1. 基本就绪 ----------
  console.log('\n[1] 四段视频加载');
  await load();
  let s = await state();
  ok(s.n === 4, '四个 <video> 都已插入', 'n=' + s.n);
  ok(s.rs.every((r) => r >= 3), '四段都拿到可播数据 (readyState>=3)', s.rs.join(','));
  ok(s.visible === 1 && s.active === 0, '只有第一段带 .active 且不透明', 'active=' + s.active + ' 可见=' + s.visible);
  ok(s.paused.every((p) => p === false), '全部处于播放状态（静音自动播）', s.paused.join(','));
  ok(s.btn === '暂停背景视频', '按钮 aria-label 与实际状态一致', s.btn);

  // ---------- 2. 8 秒自动切换 ----------
  console.log('\n[2] 自动轮播（8s）');
  ok(s.active === 0, '第 0 秒停在第 1 段', 'active=' + s.active);
  await wait(4500);
  s = await state();
  ok(s.active === 0, '4.5 秒时还没切（未到 8 秒）', 'active=' + s.active);
  await wait(4500);
  s = await state();
  ok(s.active === 1, '9 秒时切到第 2 段', 'active=' + s.active);
  ok(s.visible === 1, '任意时刻只有一段可见（交叉淡出）', '可见=' + s.visible);

  // ---------- 3. 暂停按钮 ----------
  console.log('\n[3] 播放 / 暂停按钮');
  await evalJs(`document.querySelector('#motionBtn').click(); 'ok'`);
  await wait(500);
  s = await state();
  ok(s.paused.every((p) => p === true), '点击后四段全部暂停', s.paused.join(','));
  ok(s.btn === '播放背景视频', '按钮切到「播放」语义', s.btn);
  const frozen = s.active;
  await wait(9000);
  s = await state();
  ok(s.active === frozen, '暂停期间不再切换场景', 'before=' + frozen + ' after=' + s.active);

  await evalJs(`document.querySelector('#motionBtn').click(); 'ok'`);
  await wait(600);
  s = await state();
  ok(s.paused.every((p) => p === false), '再点一次恢复播放', s.paused.join(','));
  ok(s.btn === '暂停背景视频', '按钮语义回到「暂停」', s.btn);

  // ---------- 4. prefers-reduced-motion ----------
  console.log('\n[4] 系统「减少动态效果」');
  await load('reduce');
  s = await state();
  ok(s.paused.every((p) => p === true), '默认不播放，只留首帧静图感', s.paused.join(','));
  ok(s.btn === '播放背景视频', '按钮默认显示「播放」', s.btn);
  ok(s.active === 0, '仍显示第一段（不是黑屏）', 'active=' + s.active);
  await wait(9000);
  s = await state();
  ok(s.active === 0, '不轮播', 'active=' + s.active);

  await rpc(ws, id++, 'Emulation.setEmulatedMedia', { features: [] });
  ws.close();
  console.log(`\n汇总：${pass} 通过 / ${fail} 失败\n`);
  process.exit(fail ? 1 : 0);
})();
