// ===== 登录 / 注册页逻辑 =====
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };

  /** 登录成功后要去的页面 */
  function targetPage() {
    const from = new URLSearchParams(location.search).get('from');
    if (!from) return 'index.html';
    // 只接受同目录的相对文件名，避免被拼成外部地址
    if (/[\\/:]/.test(from)) return 'index.html';
    return from;
  }

  // 已登录直接回商城
  if (Hmall.isLogin()) {
    location.replace(targetPage());
    return;
  }

  // ==================== tab 切换 ====================
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = { pwd: $('pwdForm'), email: $('emailForm'), reg: $('regForm') };
  const TITLES = {
    pwd: ['欢迎登录', '登录后即可下单、查看余额、在线充值'],
    email: ['邮箱验证码登录', '用注册邮箱收 6 位验证码，免密码登录'],
    reg: ['注册新账号', '花 30 秒注册，立得 500 元新人礼金']
  };

  function switchTab(key) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === key));
    Object.keys(forms).forEach(k => forms[k].classList.toggle('hidden', k !== key));
    $('authTitle').textContent = TITLES[key][0];
    $('authSub').textContent = TITLES[key][1];
    $('demoBox').classList.toggle('hidden', key === 'reg');
  }
  tabs.forEach(t => t.addEventListener('click', function () { switchTab(t.dataset.tab); }));

  // 用 ?tab=reg 直接打开注册页
  const qTab = new URLSearchParams(location.search).get('tab');
  if (qTab && forms[qTab]) switchTab(qTab);

  // ==================== 密码登录 ====================
  const inputUser = $('username');
  const inputPwd = $('password');

  const last = Hmall.lastUser();
  if (last) {
    inputUser.value = last;
    inputPwd.focus();
  } else {
    inputUser.focus();
  }

  $('pwdToggle').addEventListener('click', function () {
    const show = inputPwd.type === 'password';
    inputPwd.type = show ? 'text' : 'password';
    this.textContent = show ? '隐藏' : '显示';
  });

  document.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      inputUser.value = chip.dataset.user;
      inputPwd.value = chip.dataset.pwd;
      inputPwd.focus();
    });
  });

  let submitting = false;

  $('pwdForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (submitting) return;

    const username = inputUser.value.trim();
    const password = inputPwd.value;
    if (!username) { Hmall.toast('请输入用户名或邮箱', 'error'); inputUser.focus(); return; }
    if (!password) { Hmall.toast('请输入密码', 'error'); inputPwd.focus(); return; }

    submitting = true;
    const btn = $('loginBtn');
    btn.disabled = true;
    btn.textContent = '登录中…';

    try {
      const res = await Hmall.api(Hmall.API.user, '/users/login', {
        body: { username: username, password: password },
        noRedirect: true
      });
      Hmall.rememberUser($('remember').checked ? res.username : '');
      afterLogin(res);
    } catch (err) {
      // fetch 本身失败时没有 status，说明服务没起来
      Hmall.toast(err.status ? (err.message || '登录失败') : '连不上用户服务，请确认 8085 端口已启动', 'error');
    } finally {
      submitting = false;
      btn.disabled = false;
      btn.textContent = '登 录';
    }
  });

  // ==================== 发送验证码 ====================
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

  function startCountdown(btn, sec) {
    let n = sec;
    btn.disabled = true;
    btn.textContent = n + 's 后重发';
    const timer = setInterval(function () {
      n -= 1;
      if (n <= 0) {
        clearInterval(timer);
        btn.disabled = false;
        btn.textContent = '重新发送';
        return;
      }
      btn.textContent = n + 's 后重发';
    }, 1000);
  }

  function bindSendCode(btnId, emailId, purpose, tipId) {
    const btn = $(btnId);
    btn.addEventListener('click', async function () {
      const email = $(emailId).value.trim();
      // 前端先拦一道：空的/格式错的不要浪费后端的 60 秒限流窗口
      if (!email) { Hmall.toast('请先填写邮箱', 'error'); $(emailId).focus(); return; }
      if (!EMAIL_RE.test(email)) { Hmall.toast('邮箱格式不正确', 'error'); return; }

      btn.disabled = true;
      btn.textContent = '发送中…';
      try {
        const res = await Hmall.api(Hmall.API.user, '/users/email/code', {
          body: { email: email, purpose: purpose }
        });
        const tip = $(tipId);
        tip.classList.remove('hidden');
        tip.classList.toggle('ok', !res.degraded);
        tip.textContent = res.degraded
          ? res.message + '。打开后端日志 logs/user.log，搜「验证码」即可拿到 6 位数字。'
          : res.message;
        startCountdown(btn, res.resendAfter || 60);
      } catch (err) {
        Hmall.toast(err.message || '验证码发送失败', 'error');
        btn.disabled = false;
        btn.textContent = '获取验证码';
      }
    });
  }

  bindSendCode('sendLoginCode', 'emailLogin', 'LOGIN', 'emailTip');
  bindSendCode('sendRegCode', 'regEmail', 'REGISTER', 'regTip');

  // ==================== 邮箱验证码登录 ====================
  $('emailForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = $('emailLogin').value.trim();
    const code = $('emailCode').value.trim();

    if (!email) { Hmall.toast('请填写邮箱', 'error'); return; }
    if (!EMAIL_RE.test(email)) { Hmall.toast('邮箱格式不正确', 'error'); return; }
    if (!/^\d{6}$/.test(code)) { Hmall.toast('请输入 6 位数字验证码', 'error'); return; }

    const btn = $('emailLoginBtn');
    btn.disabled = true;
    btn.textContent = '登录中…';
    try {
      const res = await Hmall.api(Hmall.API.user, '/users/email/login', {
        body: { email: email, code: code },
        noRedirect: true
      });
      Hmall.rememberUser(res.username || '');
      afterLogin(res);
    } catch (err) {
      Hmall.toast(err.status ? (err.message || '登录失败') : '连不上用户服务，请确认 8085 端口已启动', 'error');
      btn.disabled = false;
      btn.textContent = '登 录';
    }
  });

  // ==================== 注册 ====================
  $('regForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const username = $('regUser').value.trim();
    const email = $('regEmail').value.trim();
    const code = $('regCode').value.trim();
    const pwd = $('regPwd').value;
    const pwd2 = $('regPwd2').value;

    if (!username) { Hmall.toast('请填写用户名', 'error'); return; }
    if (!email) { Hmall.toast('请填写邮箱', 'error'); return; }
    if (!EMAIL_RE.test(email)) { Hmall.toast('邮箱格式不正确', 'error'); return; }
    if (!/^\d{6}$/.test(code)) { Hmall.toast('请输入 6 位数字验证码', 'error'); return; }
    if (pwd.length < 6) { Hmall.toast('密码至少 6 位', 'error'); return; }
    if (pwd !== pwd2) { Hmall.toast('两次输入的密码不一致', 'error'); return; }

    const btn = $('regBtn');
    btn.disabled = true;
    btn.textContent = '注册中…';
    try {
      const res = await Hmall.api(Hmall.API.user, '/users/register', {
        body: { username: username, password: pwd, email: email, code: code },
        noRedirect: true
      });
      Hmall.rememberUser(res.username || username);
      Hmall.toast('注册成功，已送你 500 元新人礼金', 'success');
      afterLogin(res);
    } catch (err) {
      Hmall.toast(err.status ? (err.message || '注册失败') : '连不上用户服务，请确认 8085 端口已启动', 'error');
      btn.disabled = false;
      btn.textContent = '注册并登录';
    }
  });

  // ==================== 登录成功后的统一处理 ====================
  function afterLogin(res) {
    Hmall.set({
      token: res.token,
      userId: res.userId,
      username: res.username,
      email: res.email,
      balance: res.balance
    });
    Hmall.toast('登录成功，正在进入商城', 'success');
    setTimeout(function () { location.replace(targetPage()); }, 350);
  }
})();
