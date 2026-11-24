// ===== 后端服务地址由 session.js 统一提供（8081~8085）=====
const API = Hmall.API;

const state = {
  products: [],
  categories: [],
  cart: [],
  orders: [],
  qtySel: {},          // 商品卡片上选中的数量
  category: '',        // 当前筛选的分类，空 = 全部
  keyword: '',         // 当前搜索词
  seckills: []         // 进行中的秒杀活动
};

// 图片兜底与三级降级统一在 session.js 里实现：Hmall.pic / picAttr / picFallback

// ===== 通用请求：统一走 Hmall.api，自动带 X-User-Id / X-Token =====
function request(base, path, options = {}) {
  return Hmall.api(base, path, options);
}

// 非关键刷新的统一兜底：刷新失败只弹提示，不让 async 函数变成静默的 unhandled rejection
function safe(promise) {
  return promise.catch(e => toast(e.message || '刷新失败，请稍后重试', 'error'));
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2600);
}

function money(n) { return Number(n || 0).toFixed(2); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** 商品图：images/p{id}.webp 优先，失败退 jpg，再失败退占位图（见 session.js） */
function pic(itemId) { return Hmall.pic(itemId); }
function picAttr(itemId) { return Hmall.picAttr(itemId); }

/** 销量/评价数：186300 → 18.6万+ */
function wan(n) {
  const v = Number(n || 0);
  if (v >= 10000) {
    const w = Math.floor(v / 1000) / 10;
    return (w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)) + '万+';
  }
  return v + '+';
}

// ===== 视图切换 =====
function go(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + view);
  if (!target) return;
  target.classList.add('active');
  if (view === 'cart') safe(loadCart());
  if (view === 'orders') safe(loadOrders());
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 所有带 data-nav 的元素（顶栏、购物车按钮、LOGO、继续购物）统一走这里
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (!nav) return;
  const target = nav.dataset.nav;
  if (target === 'recharge') { location.href = 'recharge.html'; return; }
  e.preventDefault();
  go(target);
});

// ===== 商品 =====
async function loadCategories() {
  state.categories = await request(API.item, '/items/categories');
  renderCats();
}

async function loadProducts() {
  const qs = ['limit=60'];
  if (state.category) qs.push('category=' + encodeURIComponent(state.category));
  if (state.keyword) qs.push('keyword=' + encodeURIComponent(state.keyword));
  state.products = await request(API.item, '/items/search?' + qs.join('&'));
  renderProducts();
  renderCats();
  updateResultTip();
}

function renderCats() {
  const ul = document.getElementById('catList');
  if (!ul) return;
  const all = [{ name: '全部商品', key: '' }]
    .concat(state.categories.map(c => ({ name: c, key: c })));
  ul.innerHTML = all.map(c => {
    const on = (c.key === '' && !state.category) || c.key === state.category;
    return '<li class="' + (on ? 'on' : '') + '" data-cat="' + esc(c.key) + '">'
      + '<span>' + esc(c.name) + '</span><span class="cnt">' + (c.key ? '›' : state.products.length) + '</span>'
      + '</li>';
  }).join('');
}

document.getElementById('catList').addEventListener('click', e => {
  const li = e.target.closest('li[data-cat]');
  if (!li) return;
  state.category = li.dataset.cat;
  state.keyword = '';
  document.getElementById('searchInput').value = '';
  safe(loadProducts());
  go('shop');
});

function updateResultTip() {
  const tip = document.getElementById('resultTip');
  if (!tip) return;
  const parts = [];
  if (state.category) parts.push('分类：' + state.category);
  if (state.keyword) parts.push('关键词：' + state.keyword);
  tip.textContent = (parts.length ? parts.join(' · ') + ' · ' : '全场 ')
    + '共 ' + state.products.length + ' 件商品';
}

function tagClass(tag) {
  if (tag === '新品') return 't-new';
  if (tag === '热卖') return 't-hot';
  if (tag === '秒杀') return 't-flash';
  return '';
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('shopEmpty');
  if (!state.products.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = state.products.map(p => {
    const qty = state.qtySel[p.id] || 1;
    const soldOut = (p.stock == null || p.stock <= 0);
    return `
    <div class="gd-card" data-detail="${p.id}">
      <div class="gd-pic">
        <img ${picAttr(p.id)} alt="${esc(p.name)}" loading="lazy">
        ${p.tag ? `<span class="gd-tag ${tagClass(p.tag)}">${esc(p.tag)}</span>` : ''}
      </div>
      <div class="gd-body">
        <div class="gd-price"><i>¥</i>${money(p.price)}<em>${soldOut ? '暂时缺货' : '现货 · 库存 ' + p.stock}</em></div>
        <div class="gd-name" title="${esc(p.name)}">${esc(p.name)}</div>
        <div class="gd-sub" title="${esc(p.subtitle || '')}">${esc(p.subtitle || '')}</div>
        <div class="gd-meta"><span>已售 ${wan(p.sales)}</span><span>${wan(p.commentCount)} 条评价</span></div>
        <div class="gd-foot">
          <div class="qty">
            <button data-act="minus" data-id="${p.id}">-</button>
            <span>${qty}</span>
            <button data-act="plus" data-id="${p.id}">+</button>
          </div>
          <button class="btn primary small" data-add="${p.id}" ${soldOut ? 'disabled' : ''}>加入购物车</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ===== 秒杀楼层：场次自动轮换 + 高并发演示 =====
let skDeadline = 0;        // 本场结束的时间戳（用服务端的 secondsLeft 推算，不受本地时钟偏差影响）
let skTimer = null;
let skRefreshing = false;  // 倒计时归零时防止并发重复拉取
let benchConcurrency = 100;

async function loadSeckill() {
  const [round, list] = await Promise.all([
    request(API.item, '/seckill/round').catch(() => null),
    request(API.item, '/seckill/list').catch(() => [])
  ]);
  state.skRound = round;
  state.seckills = list || [];
  if (round && typeof round.secondsLeft === 'number') {
    skDeadline = Date.now() + round.secondsLeft * 1000;
  }
  renderSeckill();
  renderBenchTargets();
  startSeckillCountdown();
}

/** 'yyyy-MM-dd HH:mm:ss' → 'HH:mm' */
function hhmm(s) { return s ? String(s).slice(11, 16) : '--:--'; }

function renderSeckill() {
  const grid = document.getElementById('seckillGrid');
  const empty = document.getElementById('skEmpty');
  if (!grid) return;

  // 场次条：第几场 / 几点到几点 / 换场节奏
  const r = state.skRound;
  if (r) {
    const no = document.getElementById('skRoundNo');
    const time = document.getElementById('skRoundTime');
    const tip = document.getElementById('skTip');
    if (no) no.textContent = '第 ' + r.roundSeq + ' 场';
    if (time) time.textContent = hhmm(r.startTime) + ' – ' + hhmm(r.endTime);
    if (tip) tip.textContent = '每 ' + r.roundMinutes + ' 分钟换一场 · 每人每场限购一件';
  }

  if (!state.seckills.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = state.seckills.map(sk => {
    const stock = sk.stock == null ? 0 : sk.stock;
    const init = sk.initStock || stock || 1;
    const sold = sk.sold == null ? Math.max(0, init - stock) : sk.sold;
    const pct = Math.min(100, Math.round(sold / init * 100));
    const soldOut = stock <= 0;
    const done = soldOut || sk.grabbed;
    const orig = sk.price;
    const btnTxt = soldOut ? '已抢光' : (sk.grabbed ? '本场已抢到' : '马上抢');
    return `
    <div class="gd-card sk-card">
      <div class="gd-pic">
        <img ${picAttr(sk.itemId)} alt="${esc(sk.name || '')}" loading="lazy">
        <span class="gd-tag t-flash">秒杀</span>
      </div>
      <div class="gd-body">
        <div class="gd-price">
          <span class="sk-now"><i>¥</i>${money(sk.seckillPrice)}</span>
          ${orig && Number(orig) > Number(sk.seckillPrice) ? `<span class="sk-orig">¥${money(orig)}</span>` : ''}
        </div>
        <div class="gd-name" title="${esc(sk.name || '')}">${esc(sk.name || '')}</div>
        <div class="sk-progress">
          <div class="sk-bar"><i style="width:${pct}%"></i></div>
          <div class="sk-left"><span>已抢 <b>${sold}</b> / ${init} 件</span><span>${pct}%</span></div>
        </div>
        <button class="btn primary small sk-grab" data-sk="${sk.id}" ${done ? 'disabled' : ''}>${btnTxt}</button>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('seckillGrid').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-sk]');
  if (!btn) return;
  const id = Number(btn.dataset.sk);
  btn.disabled = true;
  btn.textContent = '抢购中…';
  try {
    const res = await request(API.item, '/seckill/' + id + '/grab', { method: 'POST' });
    if (res.success) {
      toast('秒杀成功！订单 ' + res.orderId + '，快去支付', 'success');
      // 抢到后弹支付，与普通下单一致；订单号来自 order-service
      if (res.orderId) openPayModal({ id: res.orderId });
    } else {
      toast(res.failReason || '没抢到', 'error');
    }
  } catch (err) {
    toast(err.message || '抢购失败', 'error');
  } finally {
    await loadSeckill();
  }
});

// 倒计时：用服务端给的 secondsLeft 做基准，本地每秒递减；归零就重新拉场次
function startSeckillCountdown() {
  clearInterval(skTimer);
  const tick = () => {
    const box = document.getElementById('skCd');
    if (!box) return;
    if (!skDeadline) { box.textContent = '--:--:--'; return; }
    const left = skDeadline - Date.now();
    if (left <= 0) {
      box.textContent = '00:00:00';
      skDeadline = 0;
      if (!skRefreshing) {
        skRefreshing = true;
        loadSeckill().finally(() => { skRefreshing = false; });
      }
      return;
    }
    const t = Math.floor(left / 1000);
    box.textContent = [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60]
      .map(n => String(n).padStart(2, '0')).join(':');
  };
  tick();
  skTimer = setInterval(tick, 1000);
}

// ===== 高并发演示：选项、目标商品、压测、重置 =====
function renderBenchTargets() {
  const sel = document.getElementById('benchTarget');
  if (!sel) return;
  const keep = sel.value;
  if (!state.seckills.length) {
    sel.innerHTML = '<option value="">本场暂无商品</option>';
  } else {
    sel.innerHTML = state.seckills.map(sk =>
      `<option value="${sk.id}">${esc((sk.name || '').slice(0, 20))} · 库存 ${sk.stock}</option>`
    ).join('');
    if (keep && Array.prototype.some.call(sel.options, o => o.value === keep)) sel.value = keep;
  }
  const cur = state.seckills.find(s => String(s.id) === sel.value);
  const stockBox = document.getElementById('bmStock');
  if (cur && stockBox) stockBox.textContent = '本场库存 ' + cur.stock + ' / ' + cur.initStock;
}

/** 把压测结果铺到面板上 */
function paintBench(r) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const total = r.concurrency || ((r.success || 0) + (r.soldOut || 0) + (r.duplicate || 0) + (r.error || 0)) || 1;
  const miss = Math.max(0, total - (r.success || 0));
  set('bmSuccess', r.success);
  set('bmSoldOut', r.soldOut);
  set('bmDup', r.duplicate);
  set('bmQps', r.qps);
  set('bmElapsed', r.elapsedMs);
  set('bmP95', r.p95Ms);
  set('bmLegendOk', r.success);
  set('bmLegendOut', miss);

  const okW = Math.round((r.success || 0) / total * 100);
  const barOk = document.getElementById('bmBarOk');
  const barOut = document.getElementById('bmBarOut');
  if (barOk) barOk.style.width = okW + '%';
  if (barOut) barOut.style.width = (100 - okW) + '%';

  const cur = state.seckills.find(s => s.id === r.activityId);
  const stock = document.getElementById('bmStock');
  if (stock) stock.textContent = '本场库存 ' + r.stockAfter + ' / ' + (cur ? cur.initStock : '--');
  const msg = document.getElementById('bmMsg');
  if (msg) msg.textContent = r.message || '';
}

async function runBench() {
  const sel = document.getElementById('benchTarget');
  const id = Number(sel && sel.value);
  if (!id) { toast('本场没有可压测的商品', 'error'); return; }
  const btn = document.getElementById('benchRun');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '压测中…';
  const msg = document.getElementById('bmMsg');
  if (msg) msg.textContent = '正在同时发起 ' + benchConcurrency + ' 个抢购请求…';
  // 先清掉上一次的柱子，避免误读成这次的结果
  const barOk = document.getElementById('bmBarOk');
  const barOut = document.getElementById('bmBarOut');
  if (barOk) barOk.style.width = '0%';
  if (barOut) barOut.style.width = '0%';
  try {
    const res = await request(API.item,
      '/seckill/' + id + '/bench?concurrency=' + benchConcurrency + '&autoReset=true',
      { method: 'POST' });
    paintBench(res);
    toast('压测完成：' + res.success + ' 件抢到 / ' + res.elapsedMs + ' ms', 'success');
  } catch (err) {
    toast(err.message || '压测失败', 'error');
    if (msg) msg.textContent = err.message || '压测失败';
  } finally {
    btn.disabled = false;
    btn.textContent = '开始压测';
    await loadSeckill();
  }
}

async function resetSeckillRound() {
  const sel = document.getElementById('benchTarget');
  const id = Number(sel && sel.value);
  if (!id) return;
  const btn = document.getElementById('benchReset');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  try {
    const n = await request(API.item, '/seckill/' + id + '/reset', { method: 'POST' });
    toast('已重置本场：清掉 ' + n + ' 条抢购记录，库存已还原', 'success');
    await loadSeckill();
  } catch (err) {
    toast(err.message || '重置失败', 'error');
  } finally {
    btn.disabled = false;
  }
}

(function bindBench() {
  const seg = document.getElementById('benchSeg');
  if (seg) {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button[data-c]');
      if (!b) return;
      benchConcurrency = Number(b.dataset.c);
      Array.prototype.forEach.call(seg.children, x => x.classList.toggle('on', x === b));
    });
  }
  const run = document.getElementById('benchRun');
  if (run) run.addEventListener('click', runBench);
  const reset = document.getElementById('benchReset');
  if (reset) reset.addEventListener('click', resetSeckillRound);
})();

// 委托绑定：商品网格只重建 innerHTML，监听器挂在网格上不会丢
document.getElementById('productGrid').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-act], button[data-add]');

  // 没点到按钮 = 点到了卡片本体 → 进详情页（数量/加购按钮不触发跳转）
  if (!btn) {
    const card = e.target.closest('.gd-card[data-detail]');
    if (card) location.href = 'detail.html?id=' + card.dataset.detail;
    return;
  }

  if (btn.dataset.act) {
    const id = Number(btn.dataset.id);
    const product = state.products.find(x => x.id === id);
    if (!product) return;
    const cur = state.qtySel[id] || 1;
    state.qtySel[id] = btn.dataset.act === 'plus'
      ? Math.min(cur + 1, Math.max(product.stock || 1, 1))
      : Math.max(cur - 1, 1);
    renderProducts();
    return;
  }

  const id = Number(btn.dataset.add);
  btn.disabled = true;
  try {
    await request(API.cart, '/carts', {
      method: 'POST',
      body: { itemId: id, num: state.qtySel[id] || 1 }
    });
    toast('已加入购物车', 'success');
    await loadCart();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

// ===== 购物车 =====
async function loadCart() {
  state.cart = await request(API.cart, '/carts');
  const list = document.getElementById('cartList');
  const footer = document.getElementById('cartFooter');
  const badge = document.getElementById('cartBadge');
  const totalNum = state.cart.reduce((s, c) => s + c.num, 0);

  badge.textContent = totalNum;
  badge.classList.toggle('hidden', totalNum === 0);

  if (!state.cart.length) {
    list.innerHTML = '<div class="empty">购物车还是空的，去商品页挑点好物吧</div>';
    footer.classList.add('hidden');
    return;
  }
  footer.classList.remove('hidden');

  list.innerHTML = state.cart.map(c => {
    const unit = c.newPrice || c.price;
    return `
    <div class="cart-item">
      <img ${picAttr(c.itemId)} alt="" data-detail="${c.itemId}">
      <div class="cname" data-detail="${c.itemId}" title="查看详情">${esc(c.name)}</div>
      <div class="qty">
        <button data-cact="minus" data-cid="${c.id}">-</button>
        <span>${c.num}</span>
        <button data-cact="plus" data-cid="${c.id}">+</button>
      </div>
      <div class="cprice">${money(unit * c.num)}</div>
      <button class="btn small" data-del="${c.id}">删除</button>
    </div>`;
  }).join('');

  const total = state.cart.reduce((s, c) => s + (c.newPrice || c.price) * c.num, 0);
  document.getElementById('cartTotal').textContent = money(total);
}

document.getElementById('cartList').addEventListener('click', async e => {
  const act = e.target.closest('button[data-cact]');
  const del = e.target.closest('button[data-del]');

  // 点图或商品名 = 看详情；点按钮还是改数量/删除
  if (!act && !del) {
    const link = e.target.closest('[data-detail]');
    if (link) location.href = 'detail.html?id=' + link.dataset.detail;
    return;
  }

  if (act) {
    const cid = Number(act.dataset.cid);
    const item = state.cart.find(x => x.id === cid);
    if (!item) return;
    const num = act.dataset.cact === 'plus' ? item.num + 1 : Math.max(item.num - 1, 1);
    try { await request(API.cart, '/carts', { method: 'PUT', body: { id: cid, num } }); await loadCart(); }
    catch (err) { toast(err.message, 'error'); }
    return;
  }

  if (del) {
    try { await request(API.cart, '/carts?ids=' + del.dataset.del, { method: 'DELETE' }); await loadCart(); }
    catch (err) { toast(err.message, 'error'); }
  }
});

// ===== 结算与支付 =====
document.getElementById('checkoutBtn').addEventListener('click', () => openAddressModal());

const modal = document.getElementById('modal');
function showModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  // 每次打开都重置按钮，否则会残留上一次的「去充值」「确认取消」
  const ok = document.getElementById('modalOk');
  ok.textContent = '确定';
  ok.disabled = false;
  ok.onclick = null;
  modal.classList.remove('hidden');
}
document.getElementById('modalCancel').addEventListener('click', () => modal.classList.add('hidden'));

function openAddressModal() {
  const total = state.cart.reduce((s, c) => s + (c.newPrice || c.price) * c.num, 0);
  const count = state.cart.reduce((s, c) => s + c.num, 0);
  showModal('确认订单', `
    <label>收货地址</label>
    <input id="addressInput" value="广东省深圳市南山区黑马大厦">
    <div class="hint">共 ${count} 件商品（${state.cart.length} 种），下单后按实际数量扣减库存并清空购物车</div>
    <div class="sum-line total" style="margin-top:14px"><span>应付金额</span><span>¥${money(total)}</span></div>
  `);
  const ok = document.getElementById('modalOk');
  ok.onclick = async () => {
    const address = document.getElementById('addressInput').value.trim();
    if (!address) { toast('请填写收货地址', 'error'); return; }
    ok.disabled = true;
    try {
      // 数量一起传给后端：购物车里买 2 件就要按 2 件算钱、扣库存
      const order = await request(API.order, '/orders', {
        body: { address, items: state.cart.map(c => ({ itemId: c.itemId, num: c.num })) }
      });
      modal.classList.add('hidden');
      toast('下单成功，订单号 ' + order.id, 'success');
      await Promise.all([safe(loadCart()), loadOrders()]);
      openPayModal(order);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      ok.disabled = false;
    }
  };
}

async function openPayModal(order) {
  // 订单可能已被取消、支付服务可能没起来。这里必须兜住，
  // 否则点「去支付」会是一个没有任何反馈的 unhandled rejection
  let payOrder;
  try {
    payOrder = await request(API.pay, '/pay-orders', { body: { orderId: order.id } });
  } catch (e) {
    toast(e.message || '支付单创建失败，请稍后重试', 'error');
    return;
  }

  // 余额不够就别让用户白输密码，直接引导去充值
  const cached = Hmall.get() || {};
  const balance = Number(cached.balance || 0);
  const notEnough = Number(payOrder.amount) > balance;

  showModal('余额支付', `
    <div class="sum-line"><span>订单号</span><span>${order.id}</span></div>
    <div class="sum-line"><span>支付单号</span><span>${payOrder.payOrderNo}</span></div>
    <div class="sum-line"><span>支付金额</span><span>¥${money(payOrder.amount)}</span></div>
    <div class="sum-line"><span>当前余额</span><span class="${notEnough ? 'warn' : ''}">¥${money(balance)}</span></div>
    ${notEnough
      ? `<div class="hint warn">余额不足，还差 ¥${money(Number(payOrder.amount) - balance)}，请先充值</div>`
      : `<label>支付密码（演示账号密码 123456）</label>
         <input id="pwInput" type="password" value="123456">
         <div class="hint">支付成功后会扣减余额并回调订单服务，重复提交不会二次扣款</div>`}
  `);

  const ok = document.getElementById('modalOk');

  if (notEnough) {
    ok.textContent = '去充值';
    ok.onclick = () => { location.href = 'recharge.html'; };
    return;
  }

  ok.textContent = '确定';
  ok.onclick = async () => {
    const pw = document.getElementById('pwInput').value;
    ok.disabled = true;
    try {
      await request(API.pay, '/pay-orders?payOrderNo=' + encodeURIComponent(payOrder.payOrderNo) + '&pw=' + encodeURIComponent(pw),
        { method: 'PUT' });
      modal.classList.add('hidden');
      toast('支付成功', 'success');
      await Promise.all([safe(refreshBalance()), loadOrders()]);
    } catch (e) {
      // 兜底：本地缓存的余额可能已经过期，服务端判定余额不足时同样引导去充值
      if (String(e.message).indexOf('余额') >= 0) {
        toast('余额不足，已为你打开充值页', 'error');
        setTimeout(() => { location.href = 'recharge.html'; }, 900);
        return;
      }
      toast(e.message, 'error');
    } finally {
      ok.disabled = false;
    }
  };
}

// ===== 订单展示 =====
async function loadOrders() {
  const el = document.getElementById('orderList');
  try {
    state.orders = await request(API.order, '/orders?limit=20');
    renderOrders();
  } catch (e) {
    el.innerHTML = '<div class="empty">订单加载失败：' + esc(e.message) + '</div>';
  }
}

function renderOrders() {
  const el = document.getElementById('orderList');
  if (!state.orders.length) {
    el.innerHTML = '<div class="empty">还没有订单，去商品页下一单试试</div>';
    return;
  }
  const statusText = { 1: ['待支付', 's1'], 2: ['已支付', 's2'], 3: ['已取消', 's3'] };
  el.innerHTML = state.orders.map(o => {
    const st = statusText[o.status] || ['未知', 's3'];
    const details = (o.details || []).map(d => {
      const local = state.products.find(x => x.id === d.itemId);
      const name = d.name || (local ? local.name : '商品' + d.itemId);
      return `<div class="order-detail">
        <img ${picAttr(d.itemId)} alt="">
        <span class="od-name">${esc(name)}</span>
        <span>× ${d.num}</span>
      </div>`;
    }).join('');
    const time = o.createTime ? String(o.createTime).replace('T', ' ').slice(0, 19) : '';
    return `<div class="order-card">
      <div class="order-head">
        <span>订单号：${o.id}${time ? ' · ' + time : ''}</span>
        <span class="order-status ${st[1]}">${st[0]}</span>
      </div>
      <div class="order-body">${details}</div>
      <div class="order-total">
        <span>合计：<b>¥${money(o.totalFee)}</b></span>
        <div class="order-actions">
          ${o.status === 1 ? `<button class="btn small" data-cancel="${o.id}">取消订单</button>` : ''}
          ${o.status === 1 ? `<button class="btn small primary" data-pay="${o.id}">去支付</button>` : ''}
          ${(o.status === 2 || o.status === 3) ? `<button class="btn small" data-reorder="${o.id}">再来一单</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('orderList').addEventListener('click', e => {
  const pay = e.target.closest('button[data-pay]');
  const cancel = e.target.closest('button[data-cancel]');
  const reorderBtn = e.target.closest('button[data-reorder]');

  if (pay) {
    const t = state.orders.find(x => String(x.id) === pay.dataset.pay);
    if (t) openPayModal(t);
    return;
  }
  if (cancel) {
    const t = state.orders.find(x => String(x.id) === cancel.dataset.cancel);
    if (t) openCancelModal(t);
    return;
  }
  if (reorderBtn) {
    const t = state.orders.find(x => String(x.id) === reorderBtn.dataset.reorder);
    if (t) reorder(t);
  }
});

async function reorder(order) {
  const details = order.details || [];
  if (!details.length) { toast('这个订单没有商品明细', 'error'); return; }
  try {
    for (const d of details) {
      await request(API.cart, '/carts', {
        method: 'POST',
        body: { itemId: d.itemId, num: Number(d.num) || 1 }
      });
    }
    toast('已把 ' + details.length + ' 种商品加回购物车', 'success');
    await safe(loadCart());
  } catch (e) {
    toast(e.message || '加回购物车失败', 'error');
  }
}

function openCancelModal(order) {
  const count = (order.details || []).reduce((s, d) => s + (Number(d.num) || 1), 0);
  showModal('取消订单', `
    <div class="sum-line"><span>订单号</span><span>${order.id}</span></div>
    <div class="sum-line"><span>订单金额</span><span>¥${money(order.totalFee)}</span></div>
    <div class="hint">取消后这 ${count} 件商品的库存会自动回补，订单不可恢复</div>
  `);
  const ok = document.getElementById('modalOk');
  ok.textContent = '确认取消';
  ok.onclick = async () => {
    ok.disabled = true;
    try {
      await request(API.order, '/orders/' + order.id + '/cancel', { method: 'PUT' });
      modal.classList.add('hidden');
      toast('订单已取消，库存已回补', 'success');
      // 商品库存变了，连带刷新商品页
      await Promise.all([loadOrders(), safe(loadProducts())]);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      ok.disabled = false;
    }
  };
}

async function refreshBalance() {
  const user = await request(API.user, '/users/me');
  const el = document.getElementById('balance');
  if (el) el.textContent = money(user.balance);
  // 同步回本地会话，充值页返回后余额立刻是对的
  const s = Hmall.get();
  if (s) { s.balance = user.balance; Hmall.set(s); }
}

// ===== 顶栏：用户信息 / 充值 / 退出 =====
function renderUserBar() {
  const s = Hmall.get() || {};
  const name = s.username || ('用户' + s.userId);
  const u = document.getElementById('username');
  const a = document.getElementById('avatar');
  const tb = document.getElementById('tbUser');
  if (u) u.textContent = name;
  if (a) a.textContent = name.slice(0, 1).toUpperCase();
  if (tb) tb.textContent = name;
  const link = document.getElementById('tbAuthLink');
  if (link) { link.textContent = '切换账号'; link.href = 'login.html'; }
}

document.getElementById('rechargeBtn').addEventListener('click', () => {
  location.href = 'recharge.html';
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await request(API.user, '/users/logout', { method: 'POST' }); } catch (e) { /* 令牌注销失败不影响本地退出 */ }
  Hmall.clear();
  location.replace('login.html');
});

// ===== 搜索 =====
function doSearch() {
  state.keyword = document.getElementById('searchInput').value.trim();
  safe(loadProducts());
  go('shop');
}
document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
});
document.querySelectorAll('.hotwords button').forEach(b => {
  b.addEventListener('click', () => {
    document.getElementById('searchInput').value = b.dataset.kw;
    doSearch();
  });
});
document.querySelectorAll('.sub-item').forEach(b => {
  b.addEventListener('click', () => {
    state.category = b.dataset.cat;
    state.keyword = '';
    document.getElementById('searchInput').value = '';
    safe(loadProducts());
    go('shop');
  });
});

// ===== 首屏轮播 =====
(function initSlider() {
  const slides = Array.prototype.slice.call(document.querySelectorAll('#slider .slide'));
  const dots = document.getElementById('sliderDots');
  if (!slides.length || !dots) return;
  let idx = 0;

  dots.innerHTML = slides.map((_, i) => '<i data-i="' + i + '" class="' + (i === 0 ? 'on' : '') + '"></i>').join('');

  function show(i) {
    idx = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('active', k === idx));
    Array.prototype.forEach.call(dots.children, (d, k) => d.classList.toggle('on', k === idx));
  }
  dots.addEventListener('click', e => {
    const t = e.target.closest('i[data-i]');
    if (t) show(Number(t.dataset.i));
  });
  setInterval(() => show(idx + 1), 4500);
})();

// ===== 启动 =====
(async function init() {
  if (!Hmall.guard()) return;              // 未登录直接跳登录页
  renderUserBar();
  const cached = Hmall.get() || {};
  document.getElementById('balance').textContent = money(cached.balance);

  // 从详情页带回来的入口参数：?kw=关键词 / ?cat=分类 / #cart #orders
  const params = new URLSearchParams(location.search);
  const kw = params.get('kw');
  const cat = params.get('cat');
  if (kw) {
    state.keyword = kw;
    document.getElementById('searchInput').value = kw;
  }
  if (cat) state.category = cat;

  try {
    await Promise.all([loadCategories(), loadProducts(), refreshBalance(), loadCart(), loadSeckill()]);
  } catch (e) {
    toast('后端服务未启动：请先启动 5 个服务（' + e.message + '）', 'error');
  }
  startSeckillCountdown();

  const hash = (location.hash || '').replace('#', '');
  if (hash === 'cart' || hash === 'orders') go(hash);
})();

