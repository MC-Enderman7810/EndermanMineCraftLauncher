/* Shared light/dark + language state for every public page.
   The language choice is stored once and reused across all pages. */
(function () {
  'use strict';

  var LANGS = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR', 'fr-FR', 'ru-RU'];
  var LABELS = {
    'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'en-US': 'English',
    'ja-JP': '日本語', 'ko-KR': '한국어', 'fr-FR': 'Français', 'ru-RU': 'Русский'
  };
  var common = {
    '功能': 'Features', '说明': 'Guides', '下载': 'Download', '公告': 'News',
    '反馈': 'Feedback', '商弦': 'Sianh', '主页': 'Home', '首页': 'Home',
    '开发者模式': 'Developer mode', '隐私政策': 'Privacy', '服务条款': 'Terms',
    '历史版本': 'Version history', '使用说明': 'Guides', '返回首页': 'Back to home',
    '下载 EMCL': 'Download EMCL', '商弦特供版': 'Sianh Edition',
    '选择下载方式': 'Choose a download', '安装版': 'Installer', '便携版': 'Portable',
    '微软商店': 'Microsoft Store', '系统要求': 'Requirements',
    '更新内容': 'Release notes', '已知问题': 'Known issues',
    '提交反馈': 'Send feedback', '查看完整使用说明': 'Read the full guide',
    '功能清单': 'Feature list', '使用流程': 'How it works', '定制版本': 'Custom builds',
    '常见问题': 'FAQ', '返回': 'Back', '复制': 'Copy', '已复制': 'Copied',
    '简体中文': 'Simplified Chinese', '繁體中文': 'Traditional Chinese',
    '日本語': 'Japanese', '한국어': 'Korean', 'Français': 'French', 'Русский': 'Russian'
  };
  var en = Object.assign({}, common);

  function read(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }

  var query = new URLSearchParams(location.search);
  var savedTheme = query.get('theme') || read('emcl-theme', '');
  if (savedTheme !== 'dark' && savedTheme !== 'light') {
    savedTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = savedTheme;
  if (query.get('theme')) write('emcl-theme', savedTheme);

  var savedLang = query.get('lang') || read('emcl-lang', 'zh-CN');
  if (LANGS.indexOf(savedLang) < 0) savedLang = 'zh-CN';
  if (query.get('lang')) write('emcl-lang', savedLang);
  document.documentElement.lang = savedLang;
  document.documentElement.dataset.lang = savedLang;

  var originals = new WeakMap();
  var textNodes = [];

  function collectText() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        var tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'OPTION' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) {
      originals.set(walker.currentNode, walker.currentNode.nodeValue);
      textNodes.push(walker.currentNode);
    }
  }

  function applyLanguage(lang) {
    if (LANGS.indexOf(lang) < 0) lang = 'zh-CN';
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    write('emcl-lang', lang);
    document.dispatchEvent(new CustomEvent('emcl:language-changed', { detail: { lang: lang } }));
    if (!textNodes.length) collectText();
    var dict = lang === 'zh-CN' ? null : en;
    textNodes.forEach(function (node) {
      var raw = originals.get(node);
      if (raw == null) return;
      if (!dict) { node.nodeValue = raw; return; }
      var key = raw.trim();
      var value = dict[key];
      node.nodeValue = value ? raw.replace(key, value) : raw;
    });
    var sel = document.getElementById('siteLangSelect');
    if (sel && sel.value !== lang) sel.value = lang;
  }

  function syncThemeButton(button) {
    if (!button) return;
    var dark = document.documentElement.dataset.theme === 'dark';
    button.textContent = dark ? '☀' : '☾';
    button.title = dark ? 'Light mode' : 'Dark mode';
    button.setAttribute('aria-label', button.title);
  }

  function mountControls() {
    var existingTheme = document.getElementById('themeToggle');
    var existingLang = document.getElementById('langSelect');
    if (existingTheme && existingLang) {
      // Homepage has its own controls.
      existingLang.value = document.documentElement.lang;
      return;
    }
    if (document.querySelector('.site-prefs')) return;

    var box = document.createElement('div');
    box.className = 'site-prefs';
    box.innerHTML = '<button type="button" id="siteThemeToggle" aria-label="Toggle theme"></button>' +
      '<select id="siteLangSelect" aria-label="Language">' +
      LANGS.map(function (code) {
        return '<option value="' + code + '">' + LABELS[code] + '</option>';
      }).join('') + '</select>';
    document.body.appendChild(box);

    var button = box.querySelector('#siteThemeToggle');
    var select = box.querySelector('#siteLangSelect');
    select.value = document.documentElement.lang;
    syncThemeButton(button);

    button.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      write('emcl-theme', next);
      syncThemeButton(button);
    });
    select.addEventListener('change', function () { applyLanguage(select.value); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      collectText();
      applyLanguage(savedLang);
      mountControls();
    });
  } else {
    collectText();
    applyLanguage(savedLang);
    mountControls();
  }
})();
