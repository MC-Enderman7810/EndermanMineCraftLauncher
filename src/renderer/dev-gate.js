'use strict';

/* Developer edition access gate.
   The password hash is checked locally; the unlocked version is stored so a
   new developer build (or a new app version after an update) asks again. */
(function () {
  const PASSWORD_HASH = '40e4f5d73f5889029e17cfe1c08fb71d67a7db422ba1d3b5ad7794f8d0d39705';
  const VERSION_KEY = 'emcl-dev-gate-version';
  const api = window.emcl;
  if (!api || typeof api.getState !== 'function') return;

  const style = document.createElement('style');
  style.textContent = `
    .dev-gate {
      position: fixed; inset: 40px 0 0; z-index: 99999;
      display: grid; place-items: center; padding: 24px;
      background: #f6f7f9; color: #263547;
      font-family: "Segoe UI", "Microsoft YaHei UI", sans-serif;
    }
    .dev-gate-card {
      width: min(380px, 100%); padding: 32px; border-radius: 8px;
      background: #fff; border: 1px solid #e0e5ec;
    }
    .dev-gate-mark { display: flex; align-items: center; gap: 9px; font-weight: 600; font-size: 14px; }
    .dev-gate-mark img { width: 24px; height: 24px; }
    .dev-gate h1 { margin: 28px 0 10px; font-size: 20px; font-weight: 600; color: #263547; }
    .dev-gate p { margin: 0 0 26px; color: #6b7787; font-size: 13px; line-height: 1.8; }
    .dev-gate label { display: block; margin-bottom: 8px; color: #536174; font-size: 13px; }
    .dev-gate input {
      width: 100%; height: 38px; padding: 0 11px; border-radius: 5px;
      border: 1px solid #d8dfe7; background: #fff; color: #263547;
      outline: none; font-size: 14px;
    }
    .dev-gate input:focus { border-color: #2f7fd1; outline: 2px solid #2f7fd1; outline-offset: 2px; }
    .dev-gate button {
      width: 100%; height: 38px; margin-top: 16px; border: 0; border-radius: 5px;
      background: #2f7fd1; color: #fff; font-size: 13px; font-weight: 500; cursor: pointer;
    }
    .dev-gate button:hover { background: #2368ae; }
    .dev-gate-error { min-height: 18px; margin-top: 10px; color: #b74646; font-size: 12px; }
    .dev-gate-note { margin-top: 14px; color: #6b7787; font-size: 12px; line-height: 1.7; }
  `;
  document.head.appendChild(style);

  const gate = document.createElement('div');
  gate.className = 'dev-gate';
  gate.id = 'devGate';
  gate.innerHTML = `
    <div class="dev-gate-card" role="dialog" aria-modal="true" aria-labelledby="devGateTitle">
      <div class="dev-gate-mark"><img src="../../assets/icon.png" alt="">EMCL <span>DEV</span></div>
      <h1 id="devGateTitle">开发者验证</h1>
      <p>输入开发者密码以继续。</p>
      <label for="devGatePassword">开发者密码</label>
      <input id="devGatePassword" type="password" autocomplete="off" />
      <button id="devGateSubmit" type="button">继续</button>
      <div class="dev-gate-error" id="devGateError" role="alert"></div>
      <div class="dev-gate-note">首次打开或更新后需要重新验证。</div>
    </div>
  `;
  document.body.appendChild(gate);

  const input = gate.querySelector('#devGatePassword');
  const submit = gate.querySelector('#devGateSubmit');
  const error = gate.querySelector('#devGateError');

  async function sha256(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function currentVersion() {
    try {
      const state = await api.getState();
      return String(state && state.appVersion ? state.appVersion : 'unknown');
    } catch (e) {
      return 'unknown';
    }
  }

  async function check() {
    const version = await currentVersion();
    let unlocked = '';
    try { unlocked = localStorage.getItem(VERSION_KEY) || ''; } catch (e) { /* ignore */ }
    if (unlocked === version && version !== 'unknown') {
      gate.remove();
      return;
    }
    setTimeout(() => input.focus(), 80);
  }

  async function tryUnlock() {
    error.textContent = '';
    const value = input.value;
    if (!value) {
      error.textContent = '请输入开发者密码';
      input.focus();
      return;
    }
    try {
      const hash = await sha256(value);
      if (hash !== PASSWORD_HASH) {
        error.textContent = '密码错误';
        input.select();
        return;
      }
      const version = await currentVersion();
      try { localStorage.setItem(VERSION_KEY, version); } catch (e) { /* ignore */ }
      gate.remove();
    } catch (e) {
      error.textContent = '当前环境无法验证密码';
    }
  }

  submit.addEventListener('click', tryUnlock);
  gate.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    if (event.shiftKey && document.activeElement === input) { event.preventDefault(); submit.focus(); }
    else if (!event.shiftKey && document.activeElement === submit) { event.preventDefault(); input.focus(); }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryUnlock();
  });
  check();
})();
