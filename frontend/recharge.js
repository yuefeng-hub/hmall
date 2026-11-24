// ===== 充值页逻辑 =====
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };

  if (!Hmall.guard()) return;

  const MAX = 50000;
  const MIN = 0.01;

  let amount = null;          // 当前选中的充值金额
  let channel = 'alipay';     // 当前渠道
  let submitting = false;

  const session = Hmall.get();
  const userId = session.userId;

  // ===== 头部信息 =====
  const name = session.username || ('用户' + userId);
  $('username').textContent = name;
  $('avatar').textContent = name.slice(0, 1).toUpperCase();
  $('balance').textContent = Hmall.money(session.balance);

  // ===== 余额刷新 =====
  async function refreshBalance() {
    try {
      const user = await Hmall.api(Hmall.API.user, '/users/me');
      $('balance').textContent = Hmall.money(user.balance);
      updateSession({ balance: user.balance });
    } catch (e) {
      // 令牌过期会由 Hmall.api 自动跳登录页，这里不额外处理
    }
  }

  function updateSession(patch) {
    const s = Hmall.get();
    if (!s) return;
    Object.assign(s, patch);
    Hmall.set(s);
  }

  // ===== 金额选择 =====
  const grid = $('amountGrid');
  const custom = $('customAmount');
  const payBtn = $('payBtn');

  function clearActive() {
    grid.querySelectorAll('.amount-opt').forEach(function (b) { b.classList.remove('active'); });
  }

  function setAmount(value, fromPreset) {
    amount = value;
    if (fromPreset) {
      custom.value = '';
    }
    if (amount === null || isNaN(amount) || amount < MIN) {
      payBtn.disabled = true;
      payBtn.textContent = '请选择充值金额';
      return;
    }
    if (amount > MAX) {
      payBtn.disabled = true;
      payBtn.textContent = '单笔充值不能超过 ' + MAX + ' 元';
      return;
    }
    payBtn.disabled = false;
    payBtn.textContent = '确认充值 ¥' + Hmall.money(amount);
  }

  grid.querySelectorAll('.amount-opt').forEach(function (btn) {
    btn.addEventListener('click', function () {
      clearActive();
      btn.classList.add('active');
      setAmount(Number(btn.dataset.amount), true);
    });
  });

  custom.addEventListener('input', function () {
    clearActive();
    const v = custom.value.trim();
    setAmount(v === '' ? null : Number(v), false);
  });

  // ===== 渠道选择 =====
  $('channels').querySelectorAll('.channel').forEach(function (el) {
    el.addEventListener('click', function () {
      $('channels').querySelectorAll('.channel').forEach(function (c) { c.classList.remove('active'); });
      el.classList.add('active');
      channel = el.dataset.channel;
    });
  });

  // ===== 提交充值 =====
  payBtn.addEventListener('click', async function () {
    if (submitting || amount === null) return;

    if (amount < MIN) {
      Hmall.toast('充值金额至少 0.01 元', 'error');
      return;
    }
    if (amount > MAX) {
      Hmall.toast('单笔充值不能超过 ' + MAX + ' 元', 'error');
      return;
    }

    submitting = true;
    payBtn.disabled = true;
    payBtn.textContent = '充值中…';

    try {
      const res = await Hmall.api(Hmall.API.user, '/users/recharge', {
        body: { amount: amount, channel: channel }
      });

      updateSession({ balance: res.balance });
      $('balance').textContent = Hmall.money(res.balance);

      $('okAmount').textContent = Hmall.money(res.amount);
      $('okChannel').textContent = res.channelName || res.channel;
      $('okNo').textContent = res.rechargeNo;
      $('okBalance').textContent = Hmall.money(res.balance);
      $('modal').classList.remove('hidden');

      Hmall.toast('充值成功', 'success');
      loadRecords();

      // 重置选择
      clearActive();
      custom.value = '';
      amount = null;
      payBtn.textContent = '请选择充值金额';
    } catch (e) {
      Hmall.toast(e.status ? (e.message || '充值失败') : '连不上用户服务，请确认 8085 端口已启动', 'error');
    } finally {
      submitting = false;
      payBtn.disabled = amount === null;
    }
  });

  // ===== 弹窗按钮 =====
  $('okBack').addEventListener('click', function () { location.href = 'index.html'; });
  $('okAgain').addEventListener('click', function () { $('modal').classList.add('hidden'); });

  // ===== 充值记录 =====
  async function loadRecords() {
    const list = $('recordList');
    try {
      const records = await Hmall.api(Hmall.API.user, '/users/recharges?limit=10');
      if (!records || !records.length) {
        list.innerHTML = '<div class="empty small">还没有充值记录</div>';
        $('recordCount').textContent = '';
        return;
      }
      $('recordCount').textContent = '共 ' + records.length + ' 笔';
      list.innerHTML = records.map(function (r) {
        return '<div class="record">'
          + '<div><div class="rchannel">' + escapeHtml(r.channelName || r.channel) + '</div>'
          + '<div class="rno">' + escapeHtml(r.rechargeNo) + '</div></div>'
          + '<div class="rright"><div class="ramt">+¥' + Hmall.money(r.amount) + '</div>'
          + '<div class="rno">' + escapeHtml(r.createTime || '') + '</div></div>'
          + '</div>';
      }).join('');
    } catch (e) {
      list.innerHTML = '<div class="empty small">充值记录加载失败：' + escapeHtml(e.message || '') + '</div>';
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ===== 启动 =====
  refreshBalance();
  loadRecords();
})();
