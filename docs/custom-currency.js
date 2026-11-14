(function () {
  'use strict';

  var CNY = 7.5;
  var GOLD_PER_CNY = 19283829;
  var RATES = {
    CNY: 1,
    USD: 0.1408,
    GBP: 0.1117,
    CAD: 0.2041,
    AUD: 0.2128,
    EUR: 0.1307,
    CHF: 0.1250,
    HKD: 1.09,
    MOP: 1.15,
    SGD: 0.1893,
    TWD: 4.45,
    MYR: 0.7467,
    JPY: 21.3,
    KRW: 190,
    RUB: 113
  };
  var LABELS = {
    CNY: '人民币 CNY', USD: '美元 USD', GBP: '英镑 GBP', CAD: '加元 CAD',
    AUD: '澳元 AUD', EUR: '欧元 EUR', CHF: '瑞士法郎 CHF', HKD: '港币 HKD',
    MOP: '澳门币 MOP', SGD: '新加坡元 SGD', TWD: '新台币 TWD', MYR: '马来西亚林吉特 MYR',
    JPY: '日元 JPY', KRW: '韩元 KRW', RUB: '卢布 RUB'
  };
  var BY_LANG = {
    'zh-CN': ['CNY'],
    'zh-TW': ['CNY', 'HKD', 'MOP', 'SGD', 'TWD', 'MYR', 'GOLD'],
    'en-US': ['USD', 'GBP', 'CAD', 'AUD'],
    'fr-FR': ['EUR', 'CHF'],
    'ja-JP': ['JPY'],
    'ko-KR': ['KRW'],
    'ru-RU': ['RUB']
  };
  var TEXT = {
    'zh-CN': {
      unit: '元 / 次 · 基础定制',
      include: '7.5 元包含什么',
      exclude: '7.5 元是基础品牌定制，不包含新增大型功能、重写界面、服务器托管或 Minecraft 游戏本体。',
      confirm: '确认素材、链接和 7.5 元费用。',
      note: '汇率仅供参考，实际支付金额以付款时为准。'
    },
    'zh-TW': {
      unit: '人民幣 / 次 · 基礎客製',
      include: '7.5 元人民幣包含什麼',
      exclude: '7.5 元人民幣是基礎品牌客製，不包含新增大型功能、重寫介面、伺服器託管或 Minecraft 遊戲本體。',
      confirm: '確認素材、連結和 7.5 元人民幣費用。',
      note: '匯率僅供參考，實際支付金額以付款時為準。'
    },
    'en-US': {
      unit: 'per customization · base package',
      include: 'What the base package includes',
      exclude: 'The base price covers branding only. It does not include major new features, UI rewrites, server hosting, or Minecraft itself.',
      confirm: 'Confirm the assets, links and base price.',
      note: 'Reference rates only. The amount charged at checkout may differ.'
    },
    'fr-FR': {
      unit: 'par personnalisation · offre de base',
      include: 'Ce que comprend l’offre de base',
      exclude: 'Le tarif de base couvre uniquement la personnalisation. Il ne comprend pas de nouvelles fonctionnalités majeures, la réécriture de l’interface, l’hébergement ou Minecraft.',
      confirm: 'Confirmer les éléments, les liens et le tarif de base.',
      note: 'Taux indicatifs. Le montant débité peut varier.'
    },
    'ja-JP': {
      unit: '1回 · ベースカスタマイズ',
      include: 'ベースカスタマイズに含まれる内容',
      exclude: '基本料金はブランド変更のみです。大型機能の追加、UI の書き換え、サーバー托管、Minecraft 本体は含まれません。',
      confirm: '素材、リンク、基本料金を確認します。',
      note: '為替レートは参考値です。実際の請求額は異なる場合があります。'
    },
    'ko-KR': {
      unit: '1회 · 기본 커스터마이징',
      include: '기본 커스터마이징 포함 내용',
      exclude: '기본 요금은 브랜딩만 포함합니다. 대형 기능 추가, UI 재작성, 서버 호스팅, Minecraft 본체는 포함되지 않습니다.',
      confirm: '소재, 링크, 기본 요금을 확인합니다.',
      note: '환율은 참고용입니다. 실제 결제 금액은 다를 수 있습니다.'
    },
    'ru-RU': {
      unit: 'за персонализацию · базовый пакет',
      include: 'Что входит в базовый пакет',
      exclude: 'Базовая цена включает только брендинг. Крупные новые функции, переписывание интерфейса, хостинг и сам Minecraft не входят.',
      confirm: 'Подтвердите материалы, ссылки и базовую цену.',
      note: 'Курсы указаны для справки. Итоговая сумма может отличаться.'
    }
  };

  function money(amount, code, locale) {
    if (code === 'GOLD') {
      return Math.round(amount * GOLD_PER_CNY).toLocaleString('zh-TW') + ' 金圓券';
    }
    var digits = (code === 'JPY' || code === 'KRW' || code === 'TWD') ? 0 : 2;
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency: code,
        minimumFractionDigits: digits, maximumFractionDigits: digits
      }).format(amount);
    } catch (e) {
      return amount.toFixed(digits) + ' ' + code;
    }
  }

  function render(lang) {
    var normalized = lang || document.documentElement.lang || 'zh-CN';
    if (!BY_LANG[normalized]) normalized = 'zh-CN';
    var base = TEXT[normalized];
    var codes = BY_LANG[normalized];
    var first = codes[0];
    var main = money(CNY * RATES[first], first, normalized);
    var mainEl = document.getElementById('priceMain');
    var unitEl = document.getElementById('priceUnit');
    if (mainEl) mainEl.textContent = main;
    if (unitEl) unitEl.textContent = base.unit;

    var include = document.getElementById('includeTitle');
    if (include) include.textContent = base.include;
    var exclude = document.getElementById('excludeDesc');
    if (exclude) exclude.textContent = base.exclude;
    var confirm = document.getElementById('confirmStep');
    if (confirm) confirm.textContent = base.confirm;

    var list = document.getElementById('priceList');
    if (list) {
      list.innerHTML = codes.map(function (code) {
        var label = code === 'GOLD' ? '金圓券（玩笑）' : LABELS[code];
        var amount = code === 'GOLD' ? CNY : CNY * RATES[code];
        return '<div class="price-chip' + (code === 'GOLD' ? ' gold' : '') + '">' +
          '<b>' + money(amount, code, normalized) + '</b><span>' + label + '</span></div>';
      }).join('');
    }

    var note = document.getElementById('priceNote');
    if (note) {
      note.textContent = base.note;
      if (normalized === 'zh-TW') {
        var joke = document.createElement('div');
        joke.className = 'price-joke';
        joke.textContent = '金圓券換算純屬玩笑，不是真實可付款貨幣。';
        note.appendChild(joke);
      }
    }
  }

  document.addEventListener('emcl:language-changed', function (event) {
    render(event && event.detail ? event.detail.lang : null);
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { render(); });
  } else {
    render();
  }
})();
