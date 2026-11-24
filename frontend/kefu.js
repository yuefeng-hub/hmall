/* ============================================================
   黑马商城 · 智能客服「小马」
   ------------------------------------------------------------
   设计要点：
   1. 不引第三方库、不加后端服务。身份走 session.js 的 Hmall.api
      （自动带 X-User-Id / X-Token），所以能真查到「我的订单 / 余额 /
      购物车 / 本场秒杀 / 商品库存」，而不是只能回固定话术。
   2. 意图识别是本地打分：先把句子归一化，再按 意图词 匹配；
      政策类问题走 KB 知识库（关键词加权打分），查不到就兜底引导。
   3. 带上下文：问过某个商品后，再说「这个多少钱 / 还有货吗」
      能接上；问过订单号后同理。
   4. 挂在三个登录后页面（index / detail / recharge），
      自己注入 DOM，HTML 只加一行 <script>。
   ============================================================ */
(function (global) {
  'use strict';
  if (global.HmallKefu) return;

  var H = global.Hmall;
  if (!H || !H.api) return;
  var API = H.API;

  // ===== 小工具 =====
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return Number(n || 0).toFixed(2); }
  function hhmm(s) { return s ? String(s).slice(11, 16) : '--:--'; }
  function mmss(sec) {
    var t = Math.max(0, Math.floor(sec || 0));
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  }
  var STATUS = { 1: ['待支付', 's1'], 2: ['已支付', 's2'], 3: ['已取消', 's3'] };

  // ===== 政策知识库：命中词越具体（越长）得分越高 =====
  var KB = [
    {
      id: 'ship',
      kw: ['发货', '多久到', '几天到', '什么时候发', '物流', '快递', '配送', '送达', '次日达', '签收'],
      html: '<b>配送时效</b><br>' +
        '· 现货商品下单后 24 小时内出库，广东省内次日达，省外 2~3 天<br>' +
        '· 你在「我的订单」里能随时看到订单状态<br>' +
        '· 本演示项目没有真实物流单号，状态只到「已支付」为止'
    },
    {
      id: 'freight',
      kw: ['运费', '包邮', '邮费', '快递费', '满多少免邮'],
      html: '<b>运费规则</b><br>' +
        '· 单笔实付满 99 元包邮（秒杀商品同样参与）<br>' +
        '· 不满 99 元收 8 元运费，大件家电另计<br>' +
        '· 演示项目下单页没有单独算运费，金额＝商品价 × 数量'
    },
    {
      id: 'refund',
      kw: ['退货', '退款', '七天', '7天', '无理由', '换货', '退换', '不想要了', '质量'],
      html: '<b>退换货政策</b><br>' +
        '· 签收后 7 天内不影响二次销售可无理由退货<br>' +
        '· 质量问题 15 天内可换货，运费我们承担<br>' +
        '· 退款到「账户余额」即时到账；原路退回 1~3 个工作日<br>' +
        '· 演示项目里「取消订单」会自动回补库存，等于模拟了取消退款'
    },
    {
      id: 'invoice',
      kw: ['发票', '开票', '报销', '增值税'],
      html: '<b>发票</b><br>' +
        '· 支持电子普通发票，下单后 24 小时内在「我的订单」申请<br>' +
        '· 企业抬头需要提供税号；演示项目未实现开票按钮'
    },
    {
      id: 'warranty',
      kw: ['保修', '售后', '维修', '质保', '坏了', '故障'],
      html: '<b>售后与保修</b><br>' +
        '· 手机 / 电脑 / 家电均为全国联保，凭订单号到品牌售后网点即可<br>' +
        '· 数码配件 12 个月、大家电 3 年主要部件保修<br>' +
        '· 需要人工介入请说「转人工」'
    },
    {
      id: 'pay',
      kw: ['支付', '付款', '怎么付', '付不了', '支付失败', '密码', '余额不足', '扣款'],
      html: '<b>支付说明</b><br>' +
        '· 本站用<b>账户余额</b>支付，演示账号初始密码 <b>123456</b><br>' +
        '· 余额不足会直接引导你去充值页，不会产生欠款<br>' +
        '· 同一笔订单重复提交不会二次扣款（支付服务做了幂等）<br>' +
        '· 待支付订单 30 分钟不付款会自动取消并回补库存'
    },
    {
      id: 'coupon',
      kw: ['优惠券', '新人', '礼金', '满减', '折扣', '活动', '便宜'],
      html: '<b>优惠与新人福利</b><br>' +
        '· 邮箱验证码注册即送 <b>500 元</b>新人礼金，直接进余额<br>' +
        '· 每 10 分钟一场<b>限时秒杀</b>，每人每场限购 1 件<br>' +
        '· 演示项目没有做优惠券叠加，秒杀价就是最低价'
    },
    {
      id: 'account',
      kw: ['注册', '登录', '密码忘了', '忘记密码', '验证码', '收不到', '邮箱', '换账号'],
      html: '<b>账号相关</b><br>' +
        '· 注册 / 登录都支持<b>邮箱验证码</b>，6 位码 5 分钟有效<br>' +
        '· 收不到验证码：先看垃圾箱；同邮箱 60 秒内只能发一次<br>' +
        '· 演示账号：zhangsan / lisi / wangwu，密码都是 123456<br>' +
        '· 想换账号点右上角「退出登录」'
    },
    {
      id: 'seckill',
      kw: ['秒杀规则', '限购', '抢不到', '为什么没抢到', '抢光', '一场', '几点开始', '换场'],
      html: '<b>秒杀规则</b><br>' +
        '· 每 <b>10 分钟</b>换一场，场次由服务端按时间实时轮转<br>' +
        '· 每人每场每件限购 1 件，重复抢会被拦<br>' +
        '· 库存扣减是原子的，抢到的件数永远不超过本场库存<br>' +
        '· 首页「高并发抢购演示」可以亲眼看 200 并发下不超卖'
    },
    {
      id: 'address',
      kw: ['地址', '改收货', '收货人', '改地址', '填错'],
      html: '<b>收货地址</b><br>' +
        '· 下单时在结算弹窗里填，默认「广东省深圳市南山区黑马大厦」<br>' +
        '· 提交后不能改，需要取消订单重新下单（取消会自动回补库存）'
    }
  ];

  // ===== 上下文 =====
  var ctx = { itemId: null, itemName: null, orderId: null };
  var lastOrders = [];
  var lastItems = [];

  // ===== DOM 注入 =====
  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M12 3C7.03 3 3 6.58 3 11c0 2.4 1.28 4.53 3.28 5.96V21l3.3-1.83c.77.16 1.58.25 2.42.25 4.97 0 9-3.58 9-8s-4.03-8-9-8z" ' +
    'fill="currentColor"/><circle cx="8.6" cy="11" r="1.15" fill="#e1251b"/><circle cx="12" cy="11" r="1.15" fill="#e1251b"/>' +
    '<circle cx="15.4" cy="11" r="1.15" fill="#e1251b"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4l17.2-8.4L3.4 3.6l.02 6.5L15 12 3.42 13.9z" fill="currentColor"/></svg>';

  var wrap = document.createElement('div');
  wrap.className = 'kefu';
  wrap.innerHTML =
    '<button class="kefu-fab" id="kefuFab" type="button" aria-label="打开在线客服">' +
      ICON_CHAT + '<em class="kefu-badge hidden" id="kefuBadge">1</em>' +
    '</button>' +
    '<div class="kefu-tip hidden" id="kefuTip">有问题随时问我</div>' +
    '<section class="kefu-panel hidden" id="kefuPanel" role="dialog" aria-label="在线客服">' +
      '<header class="kefu-head">' +
        '<span class="kefu-avatar">&#128100;</span>' +
        '<div class="kefu-id"><b>黑马小助手</b><i><span class="kefu-dot"></span>在线 · 秒回</i></div>' +
        '<button class="kefu-close" id="kefuClose" type="button" aria-label="收起">&#215;</button>' +
      '</header>' +
      '<div class="kefu-body" id="kefuBody" aria-live="polite"></div>' +
      '<div class="kefu-chips" id="kefuChips"></div>' +
      '<form class="kefu-input" id="kefuForm" autocomplete="off">' +
        '<input id="kefuText" type="text" placeholder="比如「我的订单」「推荐个手机」" maxlength="100">' +
        '<button type="submit" class="kefu-send" id="kefuSend" aria-label="发送">' + ICON_SEND + '</button>' +
      '</form>' +
    '</section>';
  document.body.appendChild(wrap);

  var fab = document.getElementById('kefuFab');
  var badge = document.getElementById('kefuBadge');
  var tip = document.getElementById('kefuTip');
  var panel = document.getElementById('kefuPanel');
  var body = document.getElementById('kefuBody');
  var chipsBox = document.getElementById('kefuChips');
  var form = document.getElementById('kefuForm');
  var input = document.getElementById('kefuText');

  var opened = false;
  var greeted = false;
  var typingEl = null;
  var chipSeq = 0;

  // ===== 消息渲染 =====
  function scrollBottom() {
    body.scrollTop = body.scrollHeight;
  }

  function nowStr() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /** role: 'bot' | 'me' */
  function push(role, html, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = 'kf-msg ' + role + (opts.plain ? ' kf-plain' : '');
    el.innerHTML =
      (role === 'bot' ? '<span class="kf-ava">&#128100;</span>' : '') +
      '<div class="kf-wrap"><div class="kf-bubble">' + html + '</div>' +
      '<span class="kf-time">' + nowStr() + '</span></div>';
    body.appendChild(el);
    scrollBottom();
    return el;
  }

  function typingOn() {
    typingOff();
    typingEl = push('bot', '<span class="kf-typing"><i></i><i></i><i></i></span>');
  }
  function typingOff() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  /** 机器人说话：先转圈，再出气泡 */
  function say(html, delay) {
    return new Promise(function (resolve) {
      typingOn();
      setTimeout(function () {
        typingOff();
        push('bot', html);
        resolve();
      }, delay == null ? 420 : delay);
    });
  }

  function setChips(list) {
    chipsBox.innerHTML = '';
    if (!list || !list.length) return;
    var mark = 'c' + (++chipSeq);
    chipsBox.dataset.seq = mark;
    list.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'kf-chip';
      b.textContent = c.label;
      if (c.href) {
        b.addEventListener('click', function () { location.href = c.href; });
      } else {
        b.addEventListener('click', function () { send(c.send || c.label); });
      }
      chipsBox.appendChild(b);
    });
  }

  // ===== 卡片渲染 =====
  function orderCard(o) {
    var st = STATUS[o.status] || ['未知', 's3'];
    var names = (o.details || []).map(function (d) {
      return (d.name || ('商品' + d.itemId)) + ' ×' + (Number(d.num) || 1);
    }).join('、');
    if (names.length > 46) names = names.slice(0, 46) + '…';
    var canPay = o.status === 1 && typeof global.openPayModal === 'function';
    return '<div class="kf-card">' +
      '<div class="kf-card-top"><b>订单 #' + o.id + '</b>' +
      '<span class="kf-st ' + st[1] + '">' + st[0] + '</span></div>' +
      '<div class="kf-card-sub">' + esc(names || '（无明细）') + '</div>' +
      '<div class="kf-card-foot"><b>¥' + money(o.totalFee) + '</b>' +
        '<div class="kf-card-btns">' +
          (canPay ? '<button type="button" class="kf-bt primary" data-kfpay="' + o.id + '">去支付</button>' : '') +
          '<button type="button" class="kf-bt" data-kforder="' + o.id + '">明细</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function itemCard(p) {
    var out = p.stock == null || p.stock <= 0;
    return '<div class="kf-card kf-item">' +
      '<img ' + H.picAttr(p.id) + ' alt="" data-kfgo="' + p.id + '">' +
      '<div class="kf-item-info">' +
        '<div class="kf-item-name">' + esc(p.name) + '</div>' +
        '<div class="kf-item-meta"><b>¥' + money(p.price) + '</b>' +
          '<span>' + (out ? '暂时缺货' : '库存 ' + p.stock) + '</span></div>' +
        '<div class="kf-card-btns">' +
          '<button type="button" class="kf-bt primary" data-kfadd="' + p.id + '"' + (out ? ' disabled' : '') + '>加购物车</button>' +
          '<button type="button" class="kf-bt" data-kfgo="' + p.id + '">看详情</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ===== 意图：各条业务线 =====
  async function replyOrders() {
    var list = await H.api(API.order, '/orders?limit=20');
    lastOrders = list || [];
    if (!lastOrders.length) {
      return say('你还没有下过单。要不要看看今天的<b>限时秒杀</b>，或者我帮你找件商品？',
        null).then(function () {
        setChips([{ label: '看看秒杀' }, { label: '推荐个手机' }, { label: '新人有什么福利' }]);
      });
    }
    var pending = lastOrders.filter(function (o) { return o.status === 1; });
    var paid = lastOrders.filter(function (o) { return o.status === 2; });
    var top = lastOrders.slice(0, 3);
    var lead = '你一共有 <b>' + lastOrders.length + '</b> 笔订单' +
      (pending.length ? '，其中 <b>' + pending.length + '</b> 笔待支付' : '') +
      (paid.length ? '，' + paid.length + ' 笔已支付' : '') + '：';
    await say(lead + top.map(orderCard).join(''), 520);
    setChips([
      { label: '待支付的怎么付？', send: '待支付订单怎么支付' },
      { label: '查看全部订单', href: 'index.html#orders' },
      { label: '查物流' }
    ]);
  }

  async function replyOrderDetail(orderId) {
    var o = null;
    try {
      o = await H.api(API.order, '/orders/' + orderId);
    } catch (e) {
      await say('没找到 <b>#' + orderId + '</b> 这笔订单（' + esc(e.message) + '）。要我列出你最近的订单吗？');
      setChips([{ label: '我的订单' }]);
      return;
    }
    if (!o) {
      await say('没找到 <b>#' + orderId + '</b> 这笔订单。');
      return;
    }
    ctx.orderId = o.id;
    var st = STATUS[o.status] || ['未知', ''];
    var items = (o.details || []).map(function (d) {
      return '· ' + esc(d.name || ('商品' + d.itemId)) + ' ×' + (Number(d.num) || 1) +
        '（¥' + money(d.price) + '）';
    }).join('<br>');
    var time = o.createTime ? String(o.createTime).replace('T', ' ').slice(0, 16) : '';
    var extra = '';
    if (o.status === 1) {
      extra = '<br>这笔还<b>没付款</b>。待支付订单 30 分钟不付会自动取消并回补库存，' +
        (typeof global.openPayModal === 'function' ? '点下面「去支付」就行。' : '到「我的订单」里点「去支付」。');
    } else if (o.status === 2) {
      extra = '<br>已经付款成功，等待出库。';
    } else {
      extra = '<br>这笔已经取消，库存已自动回补。想要的话可以「再来一单」。';
    }
    await say('<b>订单 #' + o.id + '</b> · ' + st[0] + (time ? ' · ' + time : '') + '<br>' +
      (items || '（无明细）') + '<br>合计 <b>¥' + money(o.totalFee) + '</b>' + extra, 480);
    setChips(o.status === 1
      ? [{ label: '我的订单', href: 'index.html#orders' }, { label: '怎么取消订单' }, { label: '支付方式有哪些' }]
      : [{ label: '我的订单', href: 'index.html#orders' }, { label: '退换货政策' }]);
  }

  /** 商品搜索：先把口语前缀/后缀削掉，再退回原句、分类名 */
  async function searchItems(text) {
    // 只剥「开头的前缀」「结尾的后缀」，不做全串替换 ——
    // 全串删字会把「笔记本」里的「本」也删掉（踩过），必须按位置削
    var LEAD = ['帮我', '麻烦', '给我', '我想', '想要', '想买', '我要', '要买', '买一个', '买个',
      '来一个', '来一件', '来', '推荐一下', '推荐', '有没有', '有卖', '找一下', '找找', '我要买',
      '搜一下', '搜索', '搜搜', '搜', '看看', '看一下', '看', '请问', '想看看', '能买', '可以买',
      '哪款', '什么', '请', '想'];
    var TAIL = ['多少钱呀', '多少钱', '什么价', '价格', '多钱', '贵不贵', '有货吗', '有库存吗',
      '还有货吗', '怎么卖', '吗', '呢', '吧', '啊', '呀', '的', '了'];
    var MEASURE = /^(个|款|部|台|件|只|支|双|套|张|条|瓶|盒|些)/;

    var cleaned = String(text).replace(/[，。！？、,.!?~\s]/g, '');
    var core = cleaned;
    for (var round = 0; round < 3; round++) {
      var before = core;
      LEAD.forEach(function (w) {
        if (core.length > w.length + 1 && core.indexOf(w) === 0) core = core.slice(w.length);
      });
      TAIL.forEach(function (w) {
        if (core.length > w.length + 1 && core.lastIndexOf(w) === core.length - w.length) {
          core = core.slice(0, core.length - w.length);
        }
      });
      if (core === before) break;
    }
    // 「推荐个手机」削完是「个手机」，开头的量词还要再去一层
    var core2 = core.replace(MEASURE, '');
    if (core2.length >= 2) core = core2;

    // 查询计划：分类优先 → 关键词兜底。
    // 只按 keyword 查会出事：「手机」会命中充电器卖点里的「适配手机 / 平板」，
    // 结果推荐出来的是充电头（踩过）。分类命中才是真的意图。
    var cats = window.__hmallCats || [];
    var plan = [];
    if (core.length >= 2) {
      cats.forEach(function (c) {
        if ((c.indexOf(core) >= 0 || core.indexOf(c) >= 0) && !plan.some(function (x) { return x.v === c; })) {
          plan.push({ type: 'cat', v: c });
        }
      });
    }
    cats.forEach(function (c) {
      if (cleaned.indexOf(c) >= 0 && !plan.some(function (x) { return x.v === c; })) {
        plan.push({ type: 'cat', v: c });
      }
    });
    if (core.length >= 2 && !plan.some(function (x) { return x.v === core; })) plan.push({ type: 'kw', v: core });
    if (cleaned.length >= 2 && cleaned !== core && !plan.some(function (x) { return x.v === cleaned; })) {
      plan.push({ type: 'kw', v: cleaned });
    }

    for (var i = 0; i < plan.length; i++) {
      var t = plan[i];
      var qs = t.type === 'cat'
        ? 'limit=4&category=' + encodeURIComponent(t.v)
        : 'limit=4&keyword=' + encodeURIComponent(t.v);
      try {
        var list = await H.api(API.item, '/items/search?' + qs);
        if (list && list.length) {
          if (t.type === 'kw') {
            // 关键词查出来的按「名称里真有这个词」优先，其余保持销量序
            var hit = [], rest = [];
            list.forEach(function (p) {
              ((p.name || '').indexOf(t.v) >= 0 ? hit : rest).push(p);
            });
            list = hit.concat(rest);
          }
          return { list: list, kw: t.v };
        }
      } catch (e) { /* 换下一个查询 */ }
    }
    return { list: [], kw: (plan[0] && plan[0].v) || cleaned };
  }

  async function replyItems(text) {
    var r = await searchItems(text);
    lastItems = r.list;
    if (!r.list.length) {
      await say('没搜到和「<b>' + esc(r.kw) + '</b>」相关的商品。换个说法试试？' +
        '比如「手机」「耳机」「空调」「充电宝」。');
      setChips([{ label: '手机' }, { label: '耳机' }, { label: '笔记本' }, { label: '空调' }]);
      return;
    }
    ctx.itemId = r.list[0].id;
    ctx.itemName = r.list[0].name;
    var head = r.list.length === 1
      ? '帮你找到这件：'
      : '和「<b>' + esc(r.kw) + '</b>」相关的有 ' + r.list.length + ' 件，挑几件给你看：';
    await say(head + r.list.slice(0, 3).map(itemCard).join(''), 620);
    setChips([
      { label: '这件多少钱' },
      { label: '有货吗' },
      { label: '看看秒杀' },
      { label: '退换货政策' }
    ]);
  }

  async function replyItemPrice() {
    if (!ctx.itemId) {
      await say('你想问哪件商品？说个名字或分类，我帮你查价格和库存。');
      setChips([{ label: '推荐个手机' }, { label: '耳机多少钱' }]);
      return;
    }
    var p = null;
    try { p = await H.api(API.item, '/items/' + ctx.itemId); } catch (e) { /* 用搜索兜底 */ }
    if (!p) {
      await say('这件商品的信息没取到，可能已经下架了。');
      return;
    }
    var out = p.stock == null || p.stock <= 0;
    await say('<b>' + esc(p.name) + '</b><br>' +
      '现价 <b>¥' + money(p.price) + '</b>' + (p.brand ? ' · ' + esc(p.brand) : '') + '<br>' +
      (out ? '现在<b>缺货</b>，可以先加购物车等补货。' :
        '还有 <b>' + p.stock + '</b> 件现货，' + (p.sales ? '已售 ' + p.sales + ' 件。' : '')) +
      (p.subtitle ? '<br><span class="kf-dim">' + esc(p.subtitle) + '</span>' : ''));
    setChips([{ label: '加购物车', send: '把' + (p.name || '它') + '加入购物车' }, { label: '看详情', href: 'detail.html?id=' + p.id }]);
  }

  async function replySeckill() {
    var pair = await Promise.all([
      H.api(API.item, '/seckill/round').catch(function () { return null; }),
      H.api(API.item, '/seckill/list').catch(function () { return []; })
    ]);
    var round = pair[0];
    var list = pair[1] || [];
    if (!round) {
      await say('秒杀信息暂时取不到，稍后再问我一次。');
      return;
    }
    var head = '<b>第 ' + round.roundSeq + ' 场</b>秒杀 · ' +
      hhmm(round.startTime) + '–' + hhmm(round.endTime) +
      ' · 还剩 <b>' + mmss(round.secondsLeft) + '</b>' +
      '<br><span class="kf-dim">每 ' + round.roundMinutes + ' 分钟换一场，每人每场限购 1 件</span>';
    if (!list.length) {
      await say(head + '<br>本场暂时没有秒杀商品，下一场马上开始。');
      setChips([{ label: '秒杀怎么玩' }]);
      return;
    }
    var lines = list.slice(0, 3).map(function (s) {
      var sold = s.stock != null && s.stock <= 0;
      return '· ' + esc(s.name || ('商品' + s.itemId)) + ' <b>¥' + money(s.seckillPrice) + '</b>' +
        (sold ? '（已抢光）' : '（剩 ' + s.stock + ' 件）') + (s.grabbed ? ' · 你已抢到' : '');
    }).join('<br>');
    await say(head + '<br>' + lines, 560);
    setChips([
      { label: '去秒杀', href: 'index.html' },
      { label: '为什么抢不到', send: '秒杀为什么抢不到' },
      { label: '秒杀规则' }
    ]);
  }

  async function replyBalance() {
    var u = await H.api(API.user, '/users/me');
    var bal = Number(u.balance || 0);
    var s = H.get() || {};
    if (s.userId) { s.balance = bal; H.set(s); }
    await say('你的账户余额是 <b>¥' + money(bal) + '</b>。' +
      (bal < 100 ? '<br>余额不多了，充值后可以继续下单或支付待支付订单。' : '<br>足够下单和支付。'));
    setChips([{ label: '去充值', href: 'recharge.html' }, { label: '我的订单' }, { label: '支付方式有哪些' }]);
  }

  async function replyCart() {
    var list = await H.api(API.cart, '/carts');
    if (!list || !list.length) {
      await say('购物车还是空的。要我帮你推荐点好物吗？');
      setChips([{ label: '推荐个手机' }, { label: '看看秒杀' }]);
      return;
    }
    var kinds = list.length;
    var nums = list.reduce(function (s, c) { return s + (Number(c.num) || 0); }, 0);
    var total = list.reduce(function (s, c) {
      return s + Number(c.newPrice || c.price || 0) * (Number(c.num) || 0);
    }, 0);
    var lines = list.slice(0, 4).map(function (c) {
      return '· ' + esc(c.name) + ' ×' + c.num + '（¥' + money(Number(c.newPrice || c.price) * c.num) + '）';
    }).join('<br>');
    await say('购物车里有 <b>' + kinds + '</b> 种、共 <b>' + nums + '</b> 件，合计 <b>¥' + money(total) + '</b>：<br>' +
      lines + (list.length > 4 ? '<br>…' : ''), 560);
    setChips([{ label: '去结算', href: 'index.html#cart' }, { label: '怎么退货' }]);
  }

  function replyHuman() {
    return say('我是自动客服，真人同事在线时间 <b>9:00–21:00</b>：<br>' +
      '· 客服电话：400-000-0000（演示号码）<br>' +
      '· 邮箱：kefu@hmall.com<br>' +
      '大部分问题我也能直接处理，比如查订单、算余额、找商品。');
  }

  function replyKB(entry) {
    return say(entry.html).then(function () {
      setChips([{ label: '还有别的问题' }, { label: '转人工' }, { label: '我的订单' }]);
    });
  }

  // ===== 意图路由 =====
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[\s，。！？、,.!?~]/g, '');
  }

  /** 知识库打分：命中词越长分越高，避免「支付」被「付款」类泛词抢走 */
  function matchKB(t) {
    var best = null;
    var bestScore = 0;
    KB.forEach(function (e) {
      var score = 0;
      e.kw.forEach(function (w) {
        if (t.indexOf(norm(w)) >= 0) score += norm(w).length;
      });
      if (score > bestScore) { bestScore = score; best = e; }
    });
    return bestScore >= 2 ? best : null;
  }

  async function route(text) {
    var t = norm(text);

    // 0. 空 / 表情
    if (!t) {
      await say('在的，你想问点什么？');
      return;
    }

    // 1. 人工
    if (/人工|真人|客服电话|投诉|转接/.test(t)) {
      return replyHuman();
    }

    // 2. 订单号（订单/单号/# 后面跟数字，或整句就是一个号）
    // 演示库的订单号是 53 这种两位短号，所以不能只认 4 位以上
    var om = text.match(/(?:订单|单号|编号|#)\s*[:：]?\s*(\d{1,8})/);
    if (!om && /^\d{1,8}$/.test(t)) om = [null, t];
    if (om) {
      return replyOrderDetail(Number(om[1]));
    }

    // 3. 订单相关
    if (/订单|下单|买了什么|待支付|待收货|我的单/.test(t)) {
      if (/怎么付|怎么支付|如何支付|付不了|付款|支付失败/.test(t)) return replyKB(KB.find(function (k) { return k.id === 'pay'; }));
      if (/取消|退/.test(t)) return replyKB(KB.find(function (k) { return k.id === 'refund'; }));
      return replyOrders();
    }

    // 4. 余额 / 钱包
    if (/余额|钱包|钱不够|充值|还剩多少/.test(t)) {
      if (/充值|怎么充/.test(t)) {
        return say('点「我的钱包」或下面的按钮就能充值，演示项目是直接加余额，不接真实支付。')
          .then(function () { setChips([{ label: '去充值', href: 'recharge.html' }, { label: '查余额' }]); });
      }
      return replyBalance();
    }

    // 5. 秒杀
    if (/秒杀|抢购|限时|抢不到|抢光/.test(t)) {
      if (/规则|限购|为什么|怎么玩|几点/.test(t)) {
        return replyKB(KB.find(function (k) { return k.id === 'seckill'; }));
      }
      return replySeckill();
    }

    // 6. 购物车 / 结算
    if (/购物车|结算|清空|几件/.test(t)) {
      if (/怎么结算|怎么下单|如何下单/.test(t)) {
        return say('流程是：商品页「加入购物车」→ 右上角购物车 → 去结算 → 填地址 → 提交订单 → 余额支付。');
      }
      return replyCart();
    }

    // 7. 指代上一件商品：这个 / 它 / 这件
    if (/(这个|这件|它|该商品|刚才|刚刚|那个)/.test(t) && /(多少钱|价格|贵|便宜|有货|库存|现货|买)/.test(t)) {
      return replyItemPrice();
    }

    // 8. 政策知识库（放在商品搜索前：避免「退货」被当成搜「退货」商品）
    var kb = matchKB(t);
    if (kb) return replyKB(kb);

    // 9. 商品搜索
    if (/(推荐|搜|找|有没有|有卖|多少钱|价格|买|想要|想买|来一个|看看)/.test(t) ||
        /手机|耳机|笔记本|电脑|空调|冰箱|洗衣机|电视|手表|手环|相机|音响|充电|键盘|鼠标|显示器|平板|路由|扫地/.test(t)) {
      return replyItems(text);
    }

    // 10. 问候 / 感谢 / 帮助
    if (/^(你好|您好|hi|hello|在吗|在不在|嗨)/.test(t)) {
      await say('在的 😊 想查订单、找商品，还是问售后政策？');
      setChips([{ label: '我的订单' }, { label: '推荐个手机' }, { label: '秒杀怎么玩' }]);
      return;
    }
    if (/谢谢|感谢|thanks|thx/.test(t)) {
      return say('不客气，还有需要随时喊我。');
    }
    if (/帮助|能做什么|会什么|功能|怎么用/.test(t)) {
      return replyHelp();
    }

    // 11. 兜底
    await say('这个我还没学会 🙈 我目前能帮你：<br>' +
      '· 查订单 / 订单进度（说「我的订单」或直接发订单号）<br>' +
      '· 找商品、看价格和库存（说「推荐个手机」）<br>' +
      '· 秒杀场次与规则、余额、购物车<br>' +
      '· 发货、运费、退换货、发票、保修等政策');
    setChips([{ label: '我的订单' }, { label: '推荐个手机' }, { label: '退换货政策' }, { label: '转人工' }]);
  }

  function replyHelp() {
    return say('我是黑马商城的自动客服，能直接查系统里的真实数据：<br>' +
      '· <b>订单</b>：说「我的订单」看最近 3 笔，或直接发订单号<br>' +
      '· <b>商品</b>：说「推荐个手机 / 耳机多少钱」，会带价格和库存<br>' +
      '· <b>秒杀</b>：说「看看秒杀」，能报当前第几场和剩余时间<br>' +
      '· <b>账户</b>：说「余额」「购物车」<br>' +
      '· <b>政策</b>：发货、运费、退货、发票、保修<br>' +
      '其他问题说「转人工」。').then(function () {
        setChips([{ label: '我的订单' }, { label: '推荐个手机' }, { label: '看看秒杀' }, { label: '余额' }]);
      });
  }

  // ===== 发送 =====
  var busy = false;
  async function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    busy = true;
    push('me', esc(text));
    input.value = '';
    setChips([]);
    try {
      await route(text);
    } catch (e) {
      typingOff();
      var msg = e && e.message ? e.message : '网络异常';
      await say('出了点小状况：' + esc(msg) + '<br>稍后再试一次，或者直接去对应页面操作。', 300);
    } finally {
      busy = false;
      input.focus();
    }
  }

  // ===== 面板开关 =====
  function open() {
    if (opened) return;
    opened = true;
    panel.classList.remove('hidden');
    fab.classList.add('on');
    badge.classList.add('hidden');
    tip.classList.add('hidden');
    try { sessionStorage.setItem('hmall_kefu_seen', '1'); } catch (e) { /* 隐私模式忽略 */ }
    if (!greeted) {
      greeted = true;
      push('bot', '你好，我是<b>黑马小助手</b> 🐎<br>' +
        '订单、商品、秒杀、余额都能帮你查，直接问就行。');
      setChips([
        { label: '我的订单' },
        { label: '推荐个手机' },
        { label: '看看秒杀' },
        { label: '退换货政策' }
      ]);
    }
    input.focus();
  }

  function close() {
    opened = false;
    panel.classList.add('hidden');
    fab.classList.remove('on');
  }

  fab.addEventListener('click', function () {
    if (opened) close(); else open();
  });
  document.getElementById('kefuClose').addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && opened) close();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    send(input.value);
  });

  // ===== 卡片里的按钮（事件委托，气泡是动态插入的）=====
  body.addEventListener('click', async function (e) {
    var payBtn = e.target.closest('[data-kfpay]');
    var orderBtn = e.target.closest('[data-kforder]');
    var addBtn = e.target.closest('[data-kfadd]');
    var goBtn = e.target.closest('[data-kfgo]');

    if (payBtn) {
      var o = lastOrders.find(function (x) { return String(x.id) === payBtn.dataset.kfpay; });
      if (o && typeof global.openPayModal === 'function') {
        close();
        global.openPayModal(o);
      }
      return;
    }

    if (orderBtn) {
      var id = Number(orderBtn.dataset.kforder);
      var od = lastOrders.find(function (x) { return x.id === id; });
      if (!od) return;
      var items = (od.details || []).map(function (d) {
        return '· ' + (d.name || ('商品' + d.itemId)) + ' ×' + (Number(d.num) || 1);
      }).join('<br>');
      var st = STATUS[od.status] || ['未知', ''];
      await say('<b>订单 #' + od.id + '</b> · ' + st[0] + '<br>' + (items || '（无明细）') +
        '<br>合计 <b>¥' + money(od.totalFee) + '</b>', 320);
      return;
    }

    if (addBtn) {
      var pid = Number(addBtn.dataset.kfadd);
      addBtn.disabled = true;
      addBtn.textContent = '加点中…';
      try {
        await H.api(API.cart, '/carts', { method: 'POST', body: { itemId: pid, num: 1 } });
        addBtn.textContent = '已加入';
        if (typeof H.toast === 'function') H.toast('已加入购物车', 'success');
        // 首页有购物车角标，顺手刷新一下
        if (typeof global.loadCart === 'function') { try { await global.loadCart(); } catch (err) { /* 角标刷新失败不影响 */ } }
      } catch (err) {
        addBtn.disabled = false;
        addBtn.textContent = '加购物车';
        if (typeof H.toast === 'function') H.toast(err.message || '加购失败', 'error');
      }
      return;
    }

    if (goBtn) {
      location.href = 'detail.html?id=' + goBtn.dataset.kfgo;
    }
  });

  // 首次进站：小红点 + 一句招呼（只做一次，不打扰人）
  setTimeout(function () {
    var seen = false;
    try { seen = sessionStorage.getItem('hmall_kefu_seen') === '1'; } catch (e) { /* 忽略 */ }
    if (seen || opened) return;
    badge.classList.remove('hidden');
    tip.classList.remove('hidden');
    setTimeout(function () { tip.classList.add('hidden'); }, 6000);
  }, 1600);

  // 分类名给搜索用（首页有 state.categories，这里通过 DOM 兜底抄一份）
  setTimeout(function () {
    var cats = [];
    document.querySelectorAll('#catList li[data-cat]').forEach(function (li) {
      if (li.dataset.cat) cats.push(li.dataset.cat);
    });
    window.__hmallCats = cats;
  }, 2500);

  global.HmallKefu = { open: open, close: close, send: send, route: route, KB: KB };
})(window);
