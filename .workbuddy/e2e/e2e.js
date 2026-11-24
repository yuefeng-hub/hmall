// 用 Chrome DevTools Protocol 跑真实浏览器 E2E
// 覆盖：登录守卫 → 密码登录 → 首页/搜索/分类 → 加购下单支付 → 取消回补 → 再来一单
//       → 充值 → 退出 → 邮箱验证码注册 → 邮箱验证码登录 → 商品详情页 → 详情页守卫
// Node 22 自带 fetch 与 WebSocket，不需要任何依赖
const fs = require('fs');

const CDP_BASE = 'http://127.0.0.1:9222';
const APP = 'http://127.0.0.1:8090';
// 指向平移端口起的那套实例（18081~18085），避免动到 IDEA 里正在跑的 8081~8085。
// 要测默认端口那套就 E2E_BASE=8080（前端会把请求打到 8081~8085）
const BACKEND_BASE = process.env.E2E_BASE || '18080';
const USER_LOG = 'D:/CUBE/hmall/logs/user.log';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  console.log((ok ? '  [PASS] ' : '  [FAIL] ') + name + (detail !== undefined ? '  -> ' + detail : ''));
}

/** 从 user-service 日志里取出某个邮箱最近一次验证码（降级模式专用）。
 *  注意不能只按最后一行取：MyBatis 的 Parameters 行里也可能带邮箱。 */
function codeFromLog(email) {
  const lines = fs.readFileSync(USER_LOG, 'utf8').split('\n')
    .filter((l) => l.indexOf(email) >= 0 && /code=\d{6}/.test(l));
  if (!lines.length) return null;
  const m = lines[lines.length - 1].match(/code=(\d{6})/);
  return m ? m[1] : null;
}

async function findTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(CDP_BASE + '/json/list');
      const list = await r.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (e) { /* 还没起来 */ }
    await sleep(500);
  }
  throw new Error('无法连接 Chrome 调试端口 9222');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      }
    });
  }
  send(method, params) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async eval(expression, awaitPromise) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise: !!awaitPromise, returnByValue: true
    });
    if (r.exceptionDetails) {
      const ex = r.exceptionDetails;
      throw new Error('页面执行异常: ' + ((ex.exception && ex.exception.description) || ex.text));
    }
    return r.result.value;
  }
  async goto(url) {
    await this.send('Page.navigate', { url });
    await sleep(1800);
  }
  async shot(name) {
    try {
      const s = await this.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('D:/CUBE/hmall/.workbuddy/preview/' + name,
        Buffer.from(s.data, 'base64'));
      console.log('  （已截图 .workbuddy/preview/' + name + '）');
    } catch (e) {
      console.log('  截图失败: ' + e.message);
    }
  }
}

// 页面上通用的「填值 + 触发 submit」小工具
const fill = (id, val) => `(function(){ var el=document.getElementById('${id}'); el.value=${JSON.stringify(val)}; return 1; })()`;

(async () => {
  const target = await findTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error('WebSocket 连接失败')));
  });

  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // ========== 1. 登录守卫 ==========
  console.log('===== 1. 未登录访问商城，应被守卫踢到登录页 =====');
  // 注意顺序：先清 localStorage 再写 base。
  // 反过来的话会把 base=18080 一起清掉，后续请求直接打到 8081 那套（可能没启动）
  await cdp.goto(APP + '/index.html');
  await cdp.eval(`localStorage.clear(); 1`);
  await cdp.goto(APP + '/login.html?base=' + BACKEND_BASE);
  await cdp.goto(APP + '/index.html');
  let s = await cdp.eval(`({ path: location.pathname, hasForm: !!document.getElementById('pwdForm') })`);
  check('未登录自动跳登录页', s.hasForm, s.path);

  // ========== 2. 错误密码 ==========
  console.log('===== 2. 错误密码，应留在登录页并提示 =====');
  await cdp.eval(fill('username', 'zhangsan'));
  await cdp.eval(fill('password', '000000'));
  await cdp.eval(`(function(){ document.getElementById('pwdForm').dispatchEvent(new Event('submit',{cancelable:true})); return 1; })()`);
  await sleep(1800);
  s = await cdp.eval(`({
    path: location.pathname,
    toast: (document.getElementById('toast') || {}).textContent || '',
    hasSession: !!localStorage.getItem('hmall_session')
  })`);
  check('错误密码被拒绝', s.path.indexOf('login.html') >= 0 && !s.hasSession, s.toast);

  // ========== 3. 正确密码登录 ==========
  console.log('===== 3. zhangsan 登录，应进入商城 =====');
  await cdp.eval(fill('username', 'zhangsan'));
  await cdp.eval(fill('password', '123456'));
  await cdp.eval(`(function(){ document.getElementById('pwdForm').dispatchEvent(new Event('submit',{cancelable:true})); return 1; })()`);
  await sleep(3400);
  s = await cdp.eval(`({
    path: location.pathname,
    username: (document.getElementById('username') || {}).textContent || '',
    tbUser: (document.getElementById('tbUser') || {}).textContent || '',
    balance: (document.getElementById('balance') || {}).textContent || '',
    cards: document.querySelectorAll('#productGrid .gd-card').length,
    session: JSON.parse(localStorage.getItem('hmall_session') || 'null')
  })`);
  check('登录后跳到商城', s.path.indexOf('index.html') >= 0, s.path);
  check('顶栏显示用户名', s.username === 'zhangsan', s.username);
  check('顶部工具条同步用户名', s.tbUser === 'zhangsan', s.tbUser);
  check('余额已加载', Number(s.balance) > 0, s.balance + ' 元');
  check('商品列表渲染 48 件', s.cards === 48, s.cards + ' 张卡片');
  check('本地会话已写入', !!(s.session && s.session.token && s.session.userId),
    s.session ? 'userId=' + s.session.userId : '无');

  // ========== 4. 首页结构：分类导航 / 轮播 / 图片 ==========
  console.log('===== 4. 首页结构：分类导航、轮播、商品字段 =====');
  s = await cdp.eval(`({
    cats: document.querySelectorAll('#catList li').length,
    catNames: Array.from(document.querySelectorAll('#catList li')).map(function(l){return l.textContent.trim();}),
    slides: document.querySelectorAll('#slider .slide').length,
    dots: document.querySelectorAll('#sliderDots i').length,
    tags: document.querySelectorAll('#productGrid .gd-tag').length,
    brokenImgs: Array.from(document.querySelectorAll('#productGrid img')).filter(function(i){
      return i.complete && i.naturalWidth === 0;
    }).length,
    firstPrice: (document.querySelector('#productGrid .gd-price') || {}).textContent || '',
    firstMeta: (document.querySelector('#productGrid .gd-meta') || {}).textContent || ''
  })`);
  check('左侧分类导航渲染（全部 + 6 个分类）', s.cats === 7, s.cats + ' 项：' + s.catNames.join('/').slice(0, 60));
  check('轮播 3 张且圆点对齐', s.slides === 3 && s.dots === 3, s.slides + ' 张 / ' + s.dots + ' 点');
  check('商品带营销标签', s.tags >= 10, s.tags + ' 个标签');
  check('商品图片全部可加载（无破图）', s.brokenImgs === 0, s.brokenImgs + ' 张失败');
  check('卡片显示价格与销量评价', /¥/.test(s.firstPrice) && /已售/.test(s.firstMeta),
    s.firstPrice.replace(/\s+/g, ' ') + ' | ' + s.firstMeta.replace(/\s+/g, ' '));

  // ========== 5. 搜索 ==========
  console.log('===== 5. 搜索「华为」，应只剩华为商品 =====');
  await cdp.eval(fill('searchInput', '华为'));
  await cdp.eval(`(function(){ document.getElementById('searchBtn').click(); return 1; })()`);
  await sleep(1600);
  s = await cdp.eval(`({
    cards: document.querySelectorAll('#productGrid .gd-card').length,
    names: Array.from(document.querySelectorAll('#productGrid .gd-name')).map(function(e){return e.textContent;}),
    tip: (document.getElementById('resultTip') || {}).textContent || ''
  })`);
  check('搜索命中 5 件华为商品', s.cards === 5, s.cards + ' 件');
  check('搜索结果都是华为', s.names.every(function(n){ return /华为/.test(n); }), s.names.slice(0, 2).join(' / '));
  check('结果提示带关键词', /华为/.test(s.tip), s.tip);

  // ========== 6. 分类筛选 ==========
  console.log('===== 6. 点分类「家用电器」，应只剩 8 件 =====');
  await cdp.eval(fill('searchInput', ''));
  await cdp.eval(`(function(){
    var li = Array.from(document.querySelectorAll('#catList li')).find(function(x){ return x.dataset.cat === '家用电器'; });
    if (li) li.click();
    return !!li;
  })()`);
  await sleep(1600);
  s = await cdp.eval(`({
    cards: document.querySelectorAll('#productGrid .gd-card').length,
    active: (document.querySelector('#catList li.on') || {}).dataset ? document.querySelector('#catList li.on').dataset.cat : ''
  })`);
  check('分类「家用电器」筛出 8 件', s.cards === 8, s.cards + ' 件');
  check('分类项高亮', s.active === '家用电器', s.active);

  // 回到全部商品
  await cdp.eval(`(function(){
    var li = document.querySelector('#catList li[data-cat=""]');
    if (li) li.click();
    return 1;
  })()`);
  await sleep(1600);
  s = await cdp.eval(`({ cards: document.querySelectorAll('#productGrid .gd-card').length })`);
  check('点「全部商品」恢复 48 件', s.cards === 48, s.cards + ' 件');

  // ========== 7. 余额兜底 ==========
  s = await cdp.eval(`({ balance: (document.getElementById('balance') || {}).textContent || '' })`);
  // 演示账号余额会被一轮轮测试跑低，不够买 3999 的手机时，「去支付」会走充值分支。
  // 先垫 4000 再测，免得把正确的余额校验误判成 bug
  if (Number(s.balance) < 4200) {
    await cdp.eval(`(async function(){
      var st = Hmall.get() || {};
      await fetch(Hmall.API.user + '/users/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
                   'X-User-Id': String(st.userId || 1),
                   'X-Token': st.token || '' },
        body: JSON.stringify({ amount: 4000, channel: 'alipay' })
      });
      await refreshBalance();
      return 1;
    })()`, true);
    s = await cdp.eval(`({ balance: (document.getElementById('balance') || {}).textContent || '' })`);
    console.log('  （余额不足，已先垫 4000 元，当前 ' + s.balance + '）');
  }
  const balanceBefore = Number(s.balance);

  // ========== 8. 加购 → 结算 → 下单 ==========
  console.log('===== 8. 加购商品 1 → 结算 → 下单 =====');
  // 上一轮可能留下「再来一单」的商品，先清空购物车，否则本轮订单金额翻倍、还可能误判余额不足
  await cdp.eval(`(async function(){
    var st = Hmall.get() || {};
    var h = { 'X-User-Id': String(st.userId || 1), 'X-Token': st.token || '' };
    var cart = await (await fetch(Hmall.API.cart + '/carts', { headers: h })).json();
    var ids = (cart || []).map(function(c){ return c.id; });
    if (ids.length) {
      await fetch(Hmall.API.cart + '/carts?ids=' + ids.join(','), { method: 'DELETE', headers: h });
    }
    await loadCart();
    return ids.length;
  })()`, true);
  await sleep(600);

  const stockBefore = await cdp.eval(`(function(){
    var card = document.querySelector('button[data-add="1"]').closest('.gd-card');
    return (card.querySelector('.gd-price em') || {}).textContent || '';
  })()`);

  await cdp.eval(`(function(){ document.querySelector('button[data-add="1"]').click(); return 1; })()`);
  await sleep(1800);

  await cdp.eval(`(function(){ document.querySelector('[data-nav="cart"]').click(); return 1; })()`);
  await sleep(1400);
  s = await cdp.eval(`({
    items: document.querySelectorAll('#cartList .cart-item').length,
    total: (document.getElementById('cartTotal') || {}).textContent || '',
    badge: (document.getElementById('cartBadge') || {}).textContent || ''
  })`);
  check('购物车里有 1 件商品', s.items === 1, '合计 ' + s.total + ' 元');
  check('购物车角标同步', Number(s.badge) >= 1, '角标=' + s.badge);

  await cdp.eval(`(function(){ document.getElementById('checkoutBtn').click(); return 1; })()`);
  await sleep(800);
  s = await cdp.eval(`({
    open: !document.getElementById('modal').classList.contains('hidden'),
    title: (document.getElementById('modalTitle') || {}).textContent || ''
  })`);
  check('结算弹窗出现', s.open && s.title === '确认订单', s.title);

  await cdp.eval(`(function(){ document.getElementById('modalOk').click(); return 1; })()`);
  await sleep(3000);
  s = await cdp.eval(`({
    title: (document.getElementById('modalTitle') || {}).textContent || '',
    hasPw: !!document.getElementById('pwInput'),
    btn: (document.getElementById('modalOk') || {}).textContent || ''
  })`);
  check('下单后自动进入支付弹窗', s.title === '余额支付' && s.hasPw, s.title + '（按钮：' + s.btn + '）');

  // 关掉支付，订单停在待支付
  await cdp.eval(`(function(){ document.getElementById('modalCancel').click(); return 1; })()`);
  await sleep(500);

  // ========== 9. 订单列表 ==========
  console.log('===== 9. 订单列表：待支付状态与去支付 =====');
  await cdp.eval(`(function(){ document.querySelector('[data-nav="orders"]').click(); return 1; })()`);
  await sleep(1800);
  s = await cdp.eval(`({
    cards: document.querySelectorAll('#orderList .order-card').length,
    text: ((document.querySelector('#orderList .order-card') || {}).innerText || '').replace(/\\s+/g, ' '),
    empty: !!document.querySelector('#orderList .empty')
  })`);
  check('订单列表从后端读到记录', s.cards >= 1 && !s.empty, s.cards + ' 条');
  check('卡片显示商品名与金额', /小米 14 Pro/.test(s.text) && /3999/.test(s.text), s.text.slice(0, 56));
  check('订单状态为待支付', /待支付/.test(s.text), '');

  await cdp.eval(`(function(){
    var btn = document.querySelector('#orderList button[data-pay]');
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(2000);
  s = await cdp.eval(`({
    hasBtn: !!document.querySelector('#orderList button[data-pay]'),
    title: (document.getElementById('modalTitle') || {}).textContent || '',
    hasPw: !!document.getElementById('pwInput')
  })`);
  check('待支付订单带「去支付」按钮', s.hasBtn, '');
  check('点「去支付」能重新打开支付弹窗', s.title === '余额支付' && s.hasPw, s.title);

  await cdp.eval(`(function(){ document.getElementById('modalCancel').click(); return 1; })()`);
  await sleep(500);
  await cdp.shot('我的订单.png');

  // ========== 10. 取消订单 ==========
  console.log('===== 10. 取消订单：状态变「已取消」且库存回补 =====');
  s = await cdp.eval(`({ hasCancel: !!document.querySelector('#orderList button[data-cancel]') })`);
  check('待支付订单带「取消订单」按钮', s.hasCancel, '');

  await cdp.eval(`(function(){
    var b = document.querySelector('#orderList button[data-cancel]');
    if (b) b.click();
    return 1;
  })()`);
  await sleep(800);
  s = await cdp.eval(`({
    title: (document.getElementById('modalTitle') || {}).textContent || '',
    btn: (document.getElementById('modalOk') || {}).textContent || '',
    hint: (document.getElementById('modalBody') || {}).innerText || ''
  })`);
  check('弹出取消确认框', s.title === '取消订单' && s.btn === '确认取消', s.title + ' / ' + s.btn);
  check('确认框提示库存会回补', /回补/.test(s.hint), s.hint.replace(/\s+/g, ' ').slice(0, 40));

  await cdp.eval(`(function(){ document.getElementById('modalOk').click(); return 1; })()`);
  await sleep(3000);
  // 只看刚取消的那一张（订单按 id 倒序，它排第一）。整页找 button[data-pay]
  // 会把历史上别的待支付订单也算进来 —— 那些本来就应该带「去支付」，不是缺陷
  s = await cdp.eval(`(function(){
    var c = document.querySelector('#orderList .order-card');
    return {
      text: c ? c.innerText.replace(/\\s+/g, ' ') : '',
      hasPay: c ? !!c.querySelector('button[data-pay]') : false,
      hasCancel: c ? !!c.querySelector('button[data-cancel]') : false,
      stock: (function(){
        var card = document.querySelector('button[data-add="1"]').closest('.gd-card');
        return (card.querySelector('.gd-price em') || {}).textContent || '';
      })()
    };
  })()`);
  check('订单状态变为「已取消」', /已取消/.test(s.text), '');
  check('已取消订单不再显示支付/取消按钮', !s.hasPay && !s.hasCancel, '');
  check('商品库存已回补', s.stock === stockBefore, stockBefore + ' -> ' + s.stock);

  await cdp.shot('已取消订单.png');

  // ========== 11. 再来一单 ==========
  console.log('===== 11. 再来一单：把已取消订单的商品加回购物车 =====');
  s = await cdp.eval(`({ hasBtn: !!document.querySelector('#orderList button[data-reorder]') })`);
  check('已取消订单带「再来一单」按钮', s.hasBtn, '');

  await cdp.eval(`(function(){
    var b = document.querySelector('#orderList button[data-reorder]');
    if (b) b.click();
    return 1;
  })()`);
  await sleep(2000);
  s = await cdp.eval(`({
    badge: (document.getElementById('cartBadge') || {}).textContent || '',
    badgeHidden: document.getElementById('cartBadge').classList.contains('hidden'),
    toast: (document.getElementById('toast') || {}).textContent || ''
  })`);
  check('点后购物车角标恢复', Number(s.badge) >= 1 && !s.badgeHidden, '角标=' + s.badge);
  check('弹出加回购物车提示', /加回购物车/.test(s.toast), s.toast);

  // ========== 12. 充值 ==========
  console.log('===== 12. 进入充值页，充 200 元 =====');
  await cdp.goto(APP + '/recharge.html');
  s = await cdp.eval(`({
    path: location.pathname,
    balance: (document.getElementById('balance') || {}).textContent || '',
    presets: document.querySelectorAll('.amount-opt').length
  })`);
  check('充值页可进入（未被踢回登录）', s.path.indexOf('recharge.html') >= 0, s.path);
  check('充值页显示当前余额', Math.abs(Number(s.balance) - balanceBefore) < 0.01, s.balance + ' 元');
  check('金额档位渲染', s.presets === 6, s.presets + ' 档');

  await cdp.eval(`(function(){ document.querySelector('.amount-opt[data-amount="200"]').click(); return 1; })()`);
  await sleep(400);
  s = await cdp.eval(`({ btn: document.getElementById('payBtn').textContent, disabled: document.getElementById('payBtn').disabled })`);
  check('选中金额后按钮可用', !s.disabled, s.btn);

  await cdp.eval(`(function(){ document.getElementById('payBtn').click(); return 1; })()`);
  await sleep(2600);
  s = await cdp.eval(`({
    modalShown: !document.getElementById('modal').classList.contains('hidden'),
    okAmount: (document.getElementById('okAmount') || {}).textContent || '',
    okBalance: (document.getElementById('okBalance') || {}).textContent || '',
    balanceNow: (document.getElementById('balance') || {}).textContent || '',
    records: document.querySelectorAll('#recordList .record').length
  })`);
  check('充值成功弹窗出现', s.modalShown, '');
  check('弹窗金额正确', Math.abs(Number(s.okAmount) - 200) < 0.01, s.okAmount);
  check('余额增加 200', Math.abs(Number(s.okBalance) - (balanceBefore + 200)) < 0.01,
    balanceBefore + ' -> ' + s.okBalance);
  check('页面余额同步刷新', Math.abs(Number(s.balanceNow) - (balanceBefore + 200)) < 0.01, s.balanceNow);
  check('充值记录已写入', s.records >= 1, s.records + ' 条');

  // ========== 13. 退出 ==========
  console.log('===== 13. 退出登录，会话应被清除 =====');
  await cdp.goto(APP + '/index.html');
  await sleep(900);
  await cdp.eval(`(function(){ document.getElementById('logoutBtn').click(); return 1; })()`);
  await sleep(2200);
  s = await cdp.eval(`({ path: location.pathname, hasSession: !!localStorage.getItem('hmall_session') })`);
  check('退出后回到登录页', s.path.indexOf('login.html') >= 0, s.path);
  check('本地会话已清除', !s.hasSession, s.hasSession ? '仍存在' : '已清空');

  // ========== 14. 邮箱验证码注册 ==========
  console.log('===== 14. 邮箱验证码注册新账号 =====');
  const regEmail = 'e2e' + Date.now() + '@qq.com';
  const regUser = 'e2e' + String(Date.now()).slice(-6);
  console.log('  注册邮箱：' + regEmail + ' / 用户名：' + regUser);

  await cdp.eval(`(function(){ document.querySelector('.auth-tab[data-tab="reg"]').click(); return 1; })()`);
  await sleep(300);
  s = await cdp.eval(`({
    regVisible: !document.getElementById('regForm').classList.contains('hidden'),
    title: (document.getElementById('authTitle') || {}).textContent || ''
  })`);
  // 标题文案在重写登录页时改成了「创建账号」，已不含「注册」二字
  check('切到注册 tab', s.regVisible && /注册|创建账号/.test(s.title), s.title);

  await cdp.eval(fill('regUser', regUser));
  await cdp.eval(fill('regEmail', regEmail));
  await cdp.eval(`(function(){ document.getElementById('sendRegCode').click(); return 1; })()`);
  await sleep(2200);
  s = await cdp.eval(`({
    tip: (document.getElementById('regTip') || {}).textContent || '',
    btn: (document.getElementById('sendRegCode') || {}).textContent || '',
    disabled: document.getElementById('sendRegCode').disabled
  })`);
  check('发送验证码后按钮进入倒计时', s.disabled && /重发/.test(s.btn), s.btn);
  check('降级模式提示去日志取码', /日志/.test(s.tip), s.tip.slice(0, 40));

  const regCode = codeFromLog(regEmail);
  if (!regCode) {
    console.log('\n  ! 日志里取不到验证码。若 user-service 配了真实 SMTP，验证码只进邮件不写日志，');
    console.log('    本脚本靠日志取码，必须用降级模式起服务：');
    console.log('      bash scripts/stop-local.sh');
    console.log('      MAIL_DEGRADED=1 bash scripts/start-local.sh   # 再重跑本脚本\n');
  }
  check('能从后端日志取到注册验证码', /^\d{6}$/.test(String(regCode)), regCode || '取不到');

  await cdp.eval(fill('regCode', regCode));
  await cdp.eval(fill('regPwd', 'test1234'));
  await cdp.eval(fill('regPwd2', 'test1234'));
  await cdp.eval(`(function(){ document.getElementById('regForm').dispatchEvent(new Event('submit',{cancelable:true})); return 1; })()`);
  await sleep(3600);
  s = await cdp.eval(`({
    path: location.pathname,
    session: JSON.parse(localStorage.getItem('hmall_session') || 'null'),
    balance: (document.getElementById('balance') || {}).textContent || ''
  })`);
  check('注册后直接登录并进入商城', s.path.indexOf('index.html') >= 0, s.path);
  check('新账号用户名正确', !!(s.session && s.session.username === regUser),
    s.session ? s.session.username : '无会话');
  check('新账号到账 500 元新人礼金', Math.abs(Number(s.balance) - 500) < 0.01, s.balance + ' 元');

  // ========== 15. 邮箱验证码登录 ==========
  console.log('===== 15. 退出后用邮箱验证码登录 =====');
  await cdp.eval(`(function(){ document.getElementById('logoutBtn').click(); return 1; })()`);
  await sleep(2200);

  await cdp.eval(`(function(){ document.querySelector('.auth-tab[data-tab="email"]').click(); return 1; })()`);
  await sleep(300);
  await cdp.eval(fill('emailLogin', regEmail));
  await cdp.eval(`(function(){ document.getElementById('sendLoginCode').click(); return 1; })()`);
  await sleep(2200);

  const loginCode = codeFromLog(regEmail);
  check('能从后端日志取到登录验证码', /^\d{6}$/.test(String(loginCode)), loginCode || '取不到');

  await cdp.eval(fill('emailCode', loginCode));
  await cdp.eval(`(function(){ document.getElementById('emailForm').dispatchEvent(new Event('submit',{cancelable:true})); return 1; })()`);
  await sleep(3400);
  s = await cdp.eval(`({
    path: location.pathname,
    session: JSON.parse(localStorage.getItem('hmall_session') || 'null')
  })`);
  check('邮箱验证码登录成功进入商城', s.path.indexOf('index.html') >= 0, s.path);
  check('登录账号与注册邮箱一致', !!(s.session && s.session.email === regEmail),
    s.session ? s.session.email : '无会话');

  await cdp.shot('京东风格首页.png');

  // ========== 16. 商品详情页 ==========
  console.log('===== 16. 商品详情页：卡片跳转 / 字段渲染 / 同类推荐 / 数量加减 / 加购 =====');
  await cdp.goto(APP + '/index.html');
  await sleep(1800);
  // 点卡片里的商品名（不是数量/加购按钮）应该整块跳详情
  s = await cdp.eval(`(function(){
    var card = document.querySelector('#productGrid .gd-card[data-detail="1"]');
    if (!card) return 'no-card';
    card.querySelector('.gd-name').click();
    return 'clicked';
  })()`);
  await sleep(2100);
  s = await cdp.eval(`({ path: location.pathname + location.search, clicked: ${JSON.stringify(s === 'clicked')} })`);
  check('首页商品卡片可点进详情页', s.clicked && /detail\.html\?id=1/.test(s.path), s.path);

  s = await cdp.eval(`({
    path: location.pathname + location.search,
    name: (document.getElementById('dName') || {}).textContent || '',
    price: (document.getElementById('dPrice') || {}).textContent || '',
    sub: (document.getElementById('dSub') || {}).textContent || '',
    meta: Array.from(document.querySelectorAll('.d-meta em')).map(function(e){ return e.textContent.trim(); }),
    tag: (document.getElementById('dTag') || {}).textContent || '',
    specs: Array.from(document.querySelectorAll('.spec-table td')).map(function(e){ return e.textContent.trim(); }),
    similar: document.querySelectorAll('#similar .gd-card').length,
    brokenImgs: Array.from(document.querySelectorAll('img')).filter(function(i){
      return i.complete && i.naturalWidth === 0;
    }).length,
    crumb: ((document.getElementById('crumb') || {}).textContent || '').replace(/\\s+/g, ' ').trim()
  })`);
  check('详情页正确打开', /detail\.html\?id=1/.test(s.path), s.path);
  check('详情页名称与价格取自后端', /小米 14 Pro/.test(s.name) && s.price === '3999.00',
    s.name.slice(0, 16) + ' ¥' + s.price);
  check('卖点副标题与自营标签都渲染', /骁龙/.test(s.sub) && s.tag === '自营',
    s.tag + ' / ' + s.sub.slice(0, 18));
  check('销量/评价/好评率/库存四格齐全',
    s.meta.length === 4 && /%$/.test(s.meta[2]), s.meta.join(' | '));
  check('规格参数表无空值',
    s.specs.length === 6 && s.specs.every(function(v){ return v && v !== '--'; }),
    s.specs.slice(0, 3).join(' | '));
  // 取 5 件是为了正好铺满一行 5 列网格（6 件会剩一件孤零零占第二行）
  check('同类推荐 5 件（同分类且排除自己）', s.similar === 5, s.similar + ' 件');
  check('详情页无破图', s.brokenImgs === 0, s.brokenImgs + ' 张失败');
  check('面包屑带分类与商品名', /手机通讯/.test(s.crumb) && /小米 14 Pro/.test(s.crumb),
    s.crumb.slice(0, 42));
  await cdp.shot('商品详情页.png');

  await cdp.eval(`(function(){
    document.getElementById('qtyPlus').click();
    document.getElementById('qtyPlus').click();
    return 1;
  })()`);
  await sleep(200);
  s = await cdp.eval(`({
    num: (document.getElementById('qtyNum') || {}).textContent || '',
    minusOff: document.getElementById('qtyMinus').disabled
  })`);
  check('数量 + 两次到 3 且减号可用', s.num === '3' && !s.minusOff, '数量=' + s.num);

  await cdp.eval(`(function(){ document.getElementById('qtyMinus').click(); return 1; })()`);
  await sleep(200);
  s = await cdp.eval(`({ num: (document.getElementById('qtyNum') || {}).textContent || '' })`);
  check('数量 - 回到 2', s.num === '2', '数量=' + s.num);

  await cdp.eval(`(function(){ document.getElementById('addCartBtn').click(); return 1; })()`);
  await sleep(1600);
  s = await cdp.eval(`({
    toast: (document.getElementById('toast') || {}).textContent || '',
    badge: (document.getElementById('cartBadge') || {}).textContent || '',
    hidden: document.getElementById('cartBadge').classList.contains('hidden')
  })`);
  check('详情页加购按选中的数量提示', /2 件/.test(s.toast), s.toast);
  check('详情页购物车角标同步', Number(s.badge) === 2 && !s.hidden, '角标=' + s.badge);

  await cdp.eval(`(function(){ document.getElementById('buyNowBtn').click(); return 1; })()`);
  await sleep(3400);
  s = await cdp.eval(`({
    path: location.pathname,
    hash: location.hash,
    cartActive: !!document.querySelector('#view-cart.active'),
    items: document.querySelectorAll('#cartList .cart-item').length,
    total: (document.getElementById('cartTotal') || {}).textContent || ''
  })`);
  check('立即购买直接落到购物车视图',
    s.path.indexOf('index.html') >= 0 && s.cartActive, s.path + s.hash);
  check('购物车里带着详情页选的商品', s.items === 1 && Number(s.total) > 0,
    s.items + ' 种，合计 ' + s.total);

  // 购物车里的商品名再点回详情，验证反向入口
  await cdp.eval(`(function(){
    var n = document.querySelector('#cartList .cname[data-detail]');
    if (n) n.click();
    return !!n;
  })()`);
  await sleep(2100);
  s = await cdp.eval(`({ path: location.pathname + location.search })`);
  check('购物车商品名可点回详情页', /detail\.html\?id=1/.test(s.path), s.path);

  // ========== 17. 详情页登录守卫 ==========
  console.log('===== 17. 未登录访问详情页：踢回登录页并记住来源 =====');
  await cdp.goto(APP + '/index.html');
  await sleep(900);
  await cdp.eval(`(function(){ document.getElementById('logoutBtn').click(); return 1; })()`);
  await sleep(2200);
  await cdp.goto(APP + '/detail.html?id=1');
  s = await cdp.eval(`({
    path: location.pathname,
    from: new URLSearchParams(location.search).get('from') || ''
  })`);
  check('未登录进详情页被踢回登录页', s.path.indexOf('login.html') >= 0, s.path);
  check('登录页记住了来源详情页', /detail\.html/.test(s.from), s.from);

  // ========== 18. 秒杀楼层：渲染 + 倒计时 + 抢购 ==========
  console.log('===== 18. 秒杀楼层：渲染 / 倒计时 / 抢购交互 =====');
  // 重新登录回商城
  await cdp.goto(APP + '/login.html');
  await sleep(900);
  await cdp.eval(fill('username', 'zhangsan'));
  await cdp.eval(fill('password', '123456'));
  await cdp.eval(`(function(){ document.getElementById('pwdForm').dispatchEvent(new Event('submit',{cancelable:true})); return 1; })()`);
  await sleep(3400);

  s = await cdp.eval(`({
    cards: document.querySelectorAll('#seckillGrid .gd-card').length,
    empty: !document.getElementById('skEmpty').classList.contains('hidden'),
    countdown: (document.getElementById('skCd') || {}).textContent || '',
    prices: Array.from(document.querySelectorAll('#seckillGrid .sk-now')).map(function(e){ return e.textContent.trim(); }),
    grabs: document.querySelectorAll('#seckillGrid button[data-sk]').length
  })`);
  check('秒杀楼层渲染活动卡片', s.cards >= 3, s.cards + ' 个活动');
  check('秒杀楼层非空态', !s.empty, '');
  check('倒计时已启动（HH:MM:SS）', /^\d{2}:\d{2}:\d{2}$/.test(s.countdown), s.countdown);
  check('秒杀价以 ¥ 展示', s.prices.length > 0 && s.prices.every(function(p){ return /¥/.test(p); }), s.prices[0] || '');
  check('抢购按钮渲染', s.grabs >= 3, s.grabs + ' 个按钮');

  // 点第一个可抢的按钮
  const grabbed = await cdp.eval(`(async function(){
    var btn = document.querySelector('#seckillGrid button[data-sk]:not(:disabled)');
    if (!btn) return 'no-available-btn';
    btn.click();
    await new Promise(function(r){ setTimeout(r, 2500); });
    var toast = (document.getElementById('toast') || {}).textContent || '';
    return toast;
  })()`, true);
  check('点击抢购有反馈（成功或提示）', /秒杀|抢|支付|订单/.test(grabbed), grabbed.slice(0, 40));

  // 截图秒杀楼层
  await cdp.eval(`(function(){ window.scrollTo(0, 0); return 1; })()`);
  await sleep(400);
  await cdp.shot('秒杀楼层.png');

  // ========== 汇总 ==========
  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log('===== 汇总: ' + (results.length - failed.length) + ' / ' + results.length + ' 通过 =====');
  if (failed.length) {
    console.log('失败项: ' + failed.map((f) => f.name).join(', '));
  }
  ws.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('E2E 脚本异常: ' + e.message);
  process.exit(2);
});
