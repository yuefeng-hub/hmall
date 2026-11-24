// ===== 商品详情页逻辑 =====
// 数据全部实时取自 item-service，加购走 cart-service，
// 不做任何本地价格计算——下单时的金额以订单服务为准。

(function () {
  'use strict';

  const API = Hmall.API;
  const $ = function (id) { return document.getElementById(id); };

  const state = { item: null, qty: 1, loaded: false };

  // 图片兜底 + 三级降级统一在 session.js 里实现（Hmall.pic / picAttr / picFallback）
  const PIC_FALLBACK = Hmall.PIC_FALLBACK;

  // ===== 小工具（与 app.js 保持同一套规则）=====
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) { return Number(n || 0).toFixed(2); }

  function pic(id) { return Hmall.pic(id); }

  function picAttr(id) { return Hmall.picAttr(id); }

  /** 186300 → 18.6万+ */
  function wan(n) {
    const v = Number(n || 0);
    if (v >= 10000) {
      const w = Math.floor(v / 1000) / 10;
      return (w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)) + '万+';
    }
    return v + '+';
  }

  function tagClass(tag) {
    if (tag === '新品') return 't-new';
    if (tag === '热卖') return 't-hot';
    if (tag === '秒杀') return 't-flash';
    return '';
  }

  // 后端异常时不要让页面停在「加载中…」——给一条能看懂的话
  function fail(msg) {
    $('dName').textContent = msg;
    $('dSub').textContent = '';
    $('dPrice').textContent = '--';
    $('qtyTip').textContent = '该商品暂时无法购买';
    $('addCartBtn').disabled = true;
    $('buyNowBtn').disabled = true;
    Hmall.toast(msg, 'error');
  }

  // ===== 渲染 =====
  function render(item) {
    state.item = item;
    state.loaded = true;
    const soldOut = (item.stock == null || item.stock <= 0);

    // 先挂 onerror 再赋 src：图命中缓存失败时不会漏掉降级
    $('dPic').onerror = function () { Hmall.picFallback(this); };
    $('dPic').src = pic(item.id);
    $('dPic').alt = item.name || '商品图';

    $('dName').textContent = item.name || ('商品 ' + item.id);
    $('dSub').textContent = item.subtitle || '';
    $('dPrice').textContent = money(item.price);
    $('dSales').textContent = wan(item.sales).replace('+', '');
    $('dComments').textContent = wan(item.commentCount).replace('+', '');
    $('dRate').textContent = (item.goodRate || 0) + '%';
    $('dStock').textContent = soldOut ? '无货' : item.stock + ' 件';

    const tag = $('dTag');
    if (item.tag) {
      tag.textContent = item.tag;
      tag.className = 'pb-tag';
    } else {
      tag.className = 'pb-tag hidden';
    }

    // 面包屑：分类可点回首页的对应筛选
    $('crumbName').textContent = item.name || '';
    if (item.category) {
      $('crumbCat').textContent = item.category;
      $('crumbCat').href = 'index.html?cat=' + encodeURIComponent(item.category);
    } else {
      $('crumbCat').textContent = '全部商品';
    }

    // 规格表
    $('specName').textContent = item.name || '--';
    $('specBrand').textContent = item.brand || '--';
    $('specCat').textContent = item.category || '--';
    $('specSub').textContent = item.subtitle || '--';
    $('specStock').textContent = soldOut ? '暂时缺货' : item.stock + ' 件';
    $('specId').textContent = item.id;

    document.title = (item.name || '商品详情') + ' · 黑马商城';

    if (soldOut) {
      $('qtyTip').textContent = '该商品暂时缺货，看看同类推荐吧';
      $('addCartBtn').disabled = true;
      $('buyNowBtn').disabled = true;
    }
    setQty(1);

    // 同类推荐：同一分类，排除自己
    loadSimilar(item);
  }

  function setQty(n) {
    const max = Math.max(1, Number(state.item && state.item.stock) || 1);
    state.qty = Math.min(Math.max(1, n), max);
    $('qtyNum').textContent = state.qty;
    $('qtyMinus').disabled = state.qty <= 1;
    $('qtyPlus').disabled = state.qty >= max;
  }

  // ===== 数据加载 =====
  async function loadItem(id) {
    const item = await Hmall.api(API.item, '/items/' + id);
    if (!item) { fail('商品不存在或已下架'); return; }
    render(item);
  }

  async function loadSimilar(item) {
    const grid = $('similar');
    const tip = $('similarTip');
    try {
      const qs = '?limit=8' + (item.category ? '&category=' + encodeURIComponent(item.category) : '');
      const list = (await Hmall.api(API.item, '/items/search' + qs))
        .filter(function (p) { return p.id !== item.id; })
        .slice(0, 6);
      if (!list.length) {
        grid.innerHTML = '<div class="empty">同类商品还不够多，回首页看看吧</div>';
        tip.textContent = '';
        return;
      }
      tip.textContent = item.category ? '同为「' + item.category + '」' : '';
      grid.innerHTML = list.map(function (p) {
        return '<a class="gd-card sim-card" href="detail.html?id=' + p.id + '">'
          + '<div class="gd-pic"><img ' + picAttr(p.id) + ' alt="' + esc(p.name) + '" loading="lazy">'
          + (p.tag ? '<span class="gd-tag ' + tagClass(p.tag) + '">' + esc(p.tag) + '</span>' : '')
          + '</div>'
          + '<div class="gd-body">'
          + '<div class="gd-price"><i>¥</i>' + money(p.price) + '</div>'
          + '<div class="gd-name" title="' + esc(p.name) + '">' + esc(p.name) + '</div>'
          + '<div class="gd-sub">' + esc(p.subtitle || '') + '</div>'
          + '<div class="gd-meta"><span>已售 ' + wan(p.sales) + '</span><span>好评 ' + (p.goodRate || 0) + '%</span></div>'
          + '</div></a>';
      }).join('');
    } catch (e) {
      grid.innerHTML = '<div class="empty">同类推荐加载失败</div>';
      tip.textContent = '';
    }
  }

  async function loadBadge() {
    try {
      const cart = await Hmall.api(API.cart, '/carts');
      const num = cart.reduce(function (s, c) { return s + c.num; }, 0);
      const badge = $('cartBadge');
      badge.textContent = num;
      badge.classList.toggle('hidden', num === 0);
    } catch (e) { /* 角标失败不影响浏览 */ }
  }

  // ===== 加购 / 立即购买 =====
  async function addToCart() {
    if (!state.item) return;
    await Hmall.api(API.cart, '/carts', {
      method: 'POST',
      body: { itemId: state.item.id, num: state.qty }
    });
  }

  $('qtyMinus').addEventListener('click', function () { setQty(state.qty - 1); });
  $('qtyPlus').addEventListener('click', function () { setQty(state.qty + 1); });

  $('addCartBtn').addEventListener('click', async function () {
    const btn = this;
    btn.disabled = true;
    try {
      await addToCart();
      Hmall.toast('已加入购物车 ' + state.qty + ' 件', 'success');
      await loadBadge();
    } catch (e) {
      Hmall.toast(e.message || '加入购物车失败', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  $('buyNowBtn').addEventListener('click', async function () {
    const btn = this;
    btn.disabled = true;
    try {
      await addToCart();
      // 首页支持 #cart 直接落到购物车视图
      location.href = 'index.html#cart';
    } catch (e) {
      Hmall.toast(e.message || '加入购物车失败', 'error');
      btn.disabled = false;
    }
  });

  // ===== 顶栏 =====
  function renderUserBar() {
    const s = Hmall.get() || {};
    const name = s.username || ('用户' + s.userId);
    $('tbUser').textContent = name;
    const link = $('tbAuthLink');
    link.textContent = '切换账号';
    link.href = 'login.html';
  }

  // 详情页是独立页面，首页的三个视图要跳回去
  document.addEventListener('click', function (e) {
    const nav = e.target.closest('[data-nav]');
    if (!nav) return;
    e.preventDefault();
    const target = nav.dataset.nav;
    if (target === 'recharge') { location.href = 'recharge.html'; return; }
    if (target === 'cart' || target === 'orders') { location.href = 'index.html#' + target; return; }
    location.href = 'index.html';
  });

  $('logoutBtn').addEventListener('click', async function () {
    try { await Hmall.api(API.user, '/users/logout', { method: 'POST' }); } catch (e) { /* 令牌注销失败也要能本地退出 */ }
    Hmall.clear();
    location.replace('login.html');
  });

  // 搜索：把关键词带回首页，由首页的搜索逻辑处理
  function goSearch(kw) {
    const k = String(kw || '').trim();
    location.href = 'index.html' + (k ? '?kw=' + encodeURIComponent(k) : '');
  }
  $('searchBtn').addEventListener('click', function () { goSearch($('searchInput').value); });
  $('searchInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); goSearch(this.value); }
  });
  document.querySelectorAll('.hotwords button').forEach(function (b) {
    b.addEventListener('click', function () { goSearch(b.dataset.kw); });
  });

  // ===== 启动 =====
  (async function init() {
    if (!Hmall.guard()) return;              // 未登录先回登录页，登录后凭 ?from= 回到本页

    renderUserBar();
    loadBadge();
    $('dPic').src = PIC_FALLBACK;            // 数据回来前先占位，避免显示破图

    const id = Number(new URLSearchParams(location.search).get('id'));
    if (!id) { fail('缺少商品编号，请从商品列表进入'); return; }
    try {
      await loadItem(id);
    } catch (e) {
      fail(e.status === 404 ? '商品不存在或已下架' : ('商品加载失败：' + (e.message || '未知错误')));
    }
  })();
})();
