// ===== hmall 会话管理 =====
// 登录态存 localStorage，所有请求自动带上 X-User-Id / X-Token
// 被 login.html、recharge.html、index.html 共用

(function (global) {
  'use strict';

  const KEY = 'hmall_session';
  const LAST_USER = 'hmall_last_user';
  const BASE_KEY = 'hmall_api_base';

  // 后端端口整体平移时的兜底：默认 8081~8085，
  // 任意页面带 ?base=18080（或本地存过一次）就切到 18081~18085
  // 例：http://localhost:8090/login.html?base=18080
  (function resolveBase() {
    try {
      const q = new URLSearchParams(location.search).get('base');
      if (q) {
        localStorage.setItem(BASE_KEY, q);
        // 只把 base 从地址栏抹掉（保留 ?from= 这类回跳参数），避免刷新后又切一次
        const sp = new URLSearchParams(location.search);
        sp.delete('base');
        const rest = sp.toString();
        history.replaceState(null, '', location.pathname + (rest ? '?' + rest : ''));
      }
    } catch (e) { /* 忽略：不支持 URLSearchParams 就按默认端口 */ }
  })();

  const BASE_PORT = Number(localStorage.getItem(BASE_KEY) || 0);
  const port = (n) => 'http://localhost:' + (BASE_PORT > 0 ? BASE_PORT + n : 8080 + n);

  const API = {
    item: port(1),
    cart: port(2),
    order: port(3),
    pay: port(4),
    user: port(5)
  };

  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function set(session) {
    localStorage.setItem(KEY, JSON.stringify(session));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function isLogin() {
    const s = get();
    return !!(s && s.token && s.userId);
  }

  function userId() {
    const s = get();
    return s ? s.userId : null;
  }

  function token() {
    const s = get();
    return s ? s.token : null;
  }

  /** 当前页面文件名，用于登录后跳回原页面 */
  function currentPage() {
    const file = (location.pathname.split('/').pop() || 'index.html');
    return file + location.search;
  }

  function loginUrl() {
    const page = currentPage();
    if (page.indexOf('login.html') === 0) {
      return 'login.html';
    }
    return 'login.html?from=' + encodeURIComponent(page);
  }

  /** 未登录则跳转登录页，返回 false */
  function guard() {
    if (!isLogin()) {
      location.replace(loginUrl());
      return false;
    }
    return true;
  }

  /**
   * 统一请求封装。
   * @param base   服务地址（API.user 等）
   * @param path   接口路径
   * @param options {method, body, headers, noRedirect}
   */
  async function api(base, path, options) {
    options = options || {};
    const session = get();
    const opts = {
      method: options.method || (options.body !== undefined ? 'POST' : 'GET'),
      headers: {}
    };

    // 身份信息：X-User-Id 给各业务服务用，X-Token 给用户服务校验会话
    if (session && session.userId) opts.headers['X-User-Id'] = String(session.userId);
    if (session && session.token) opts.headers['X-Token'] = session.token;
    Object.assign(opts.headers, options.headers || {});

    if (options.body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(options.body);
    }

    const resp = await fetch(base + path, opts);
    const text = await resp.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = text; }
    }

    if (!resp.ok) {
      const err = new Error((data && data.message) ? data.message : ('HTTP ' + resp.status));
      err.status = resp.status;
      err.data = data;
      // 令牌失效：清掉本地会话并回登录页（登录接口本身不跳）
      if (resp.status === 401 && session && !options.noRedirect
          && String(path).indexOf('/login') < 0) {
        clear();
        location.replace(loginUrl());
      }
      throw err;
    }
    return data;
  }

  /** 轻量提示，页面没有 #toast 时自动创建一个 */
  let toastTimer = null;
  function toast(msg, type) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'toast' + (type ? ' ' + type : '');
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.add('hidden');
    }, 2600);
  }

  function money(n) {
    return Number(n || 0).toFixed(2);
  }

  function rememberUser(username) {
    try { localStorage.setItem(LAST_USER, username); } catch (e) { /* 忽略隐私模式异常 */ }
  }

  function lastUser() {
    try { return localStorage.getItem(LAST_USER) || ''; } catch (e) { return ''; }
  }

  // ===== 商品图：webp → jpg → 占位图 三级降级 =====
  // 800×800 的产品图用 webp(q82) 只有 jpg 的 3 成体积，48 张能省一半多带宽；
  // 但老浏览器（Safari 14 之前）/ 老内核不支持 webp，所以留 jpg 兜底，最后才是占位图。
  const PIC_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">' +
    '<rect width="400" height="400" fill="#f5f6f8"/>' +
    '<text x="200" y="205" text-anchor="middle" font-size="26" fill="#c4c8ce" ' +
    'font-family="Microsoft YaHei, sans-serif">暂无图片</text></svg>');

  function pic(itemId) { return 'images/p' + itemId + '.webp'; }

  /**
   * 内联 onerror 的统一入口（内联写法只能调全局函数）。
   * 第一次失败：webp 换成同名 jpg；再失败：换成占位图并摘掉 onerror。
   */
  function picFallback(img) {
    const src = img.getAttribute('src') || '';
    if (/\.webp$/i.test(src)) {
      img.src = src.replace(/\.webp$/i, '.jpg');
      return;
    }
    img.onerror = null;
    img.src = PIC_FALLBACK;
  }

  /** 拼成可直接塞进模板字符串的属性串 */
  function picAttr(itemId) {
    return 'src="' + pic(itemId) + '" onerror="Hmall.picFallback(this)"';
  }

  global.Hmall = {
    API: API,
    get: get,
    set: set,
    clear: clear,
    isLogin: isLogin,
    userId: userId,
    token: token,
    guard: guard,
    loginUrl: loginUrl,
    currentPage: currentPage,
    api: api,
    toast: toast,
    money: money,
    rememberUser: rememberUser,
    lastUser: lastUser,
    PIC_FALLBACK: PIC_FALLBACK,
    pic: pic,
    picAttr: picAttr,
    picFallback: picFallback
  };
})(window);
