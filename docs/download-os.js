(function () {
  'use strict';

  function detect() {
    var ua = navigator.userAgent || '';
    var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/Android/i.test(ua)) return { key: 'android', label: 'Android 电脑 / 平板' };
    if (/iPhone|iPad|iPod/i.test(ua)) return { key: 'unknown', label: 'iOS / iPadOS（暂无桌面版本）' };
    if (/Mac OS X|Macintosh/i.test(ua) || /mac/i.test(platform)) {
      return { key: 'mac', label: 'macOS' };
    }
    if (/Windows NT 6\.1/i.test(ua)) return { key: 'legacy', label: 'Windows 7（旧版）' };
    if (/Windows NT 6\.2/i.test(ua)) return { key: 'legacy', label: 'Windows 8（旧版）' };
    if (/Windows NT 6\.3/i.test(ua)) return { key: 'legacy', label: 'Windows 8.1（旧版）' };
    if (/Windows/i.test(ua)) return { key: 'windows', label: 'Windows 10 / 11' };
    if (/Linux/i.test(ua)) return { key: 'linux', label: 'Linux' };
    return { key: 'unknown', label: '未能识别你的操作系统' };
  }

  function apply(info) {
    var value = document.getElementById('osName');
    if (value) value.textContent = info.label;
    var kicker = document.getElementById('osKicker');
    var note = document.getElementById('osNote');
    var banner = document.getElementById('osRecommendation');
    document.documentElement.dataset.os = info.key;
    if (info.key === 'unknown') {
      if (kicker) kicker.textContent = '系统识别失败';
      if (note) note.textContent = '请根据下方平台手动选择，不会自动推荐 Windows';
      if (banner) banner.classList.add('os-unknown');
      var gridUnknown = document.getElementById('allPlatforms');
      if (gridUnknown) {
        var oldNotice = gridUnknown.querySelector('.platform-unknown');
        if (oldNotice) oldNotice.remove();
        var notice = document.createElement('article');
        notice.className = 'platform-card platform-unknown';
        notice.innerHTML = '<div class="platform-head"><div class="platform-icon">?</div><div><div class="tag">需要手动选择</div><h2>未能识别你的系统</h2></div></div><p>浏览器没有提供可用的系统信息。请根据你的电脑或手机，在下方选择对应平台；不会默认推荐 Windows。</p><div class="platform-meta">如果你使用的是 Windows 7 / 8，请选择“旧版 Windows”。</div>';
        gridUnknown.insertBefore(notice, gridUnknown.firstElementChild);
      }
      return;
    }
    if (kicker) kicker.textContent = '检测到你的系统';
    if (note) note.textContent = '已把适合你的下载放在第一位';
    if (banner) banner.classList.remove('os-unknown');
    var grid = document.getElementById('allPlatforms');
    if (grid) { var oldNotice = grid.querySelector('.platform-unknown'); if (oldNotice) oldNotice.remove(); }
    if (!grid) return;
    var card = grid.querySelector('[data-platform="' + info.key + '"]');
    if (!card) {
      if (kicker) kicker.textContent = '系统识别失败';
      if (note) note.textContent = '请根据下方平台手动选择，不要默认下载 Windows 版';
      if (banner) banner.classList.add('os-unknown');
      return;
    }
    grid.insertBefore(card, grid.firstElementChild);
    card.classList.add('recommended');
  }

  var info = detect();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { apply(info); });
  } else {
    apply(info);
  }

  // Apple Silicon and Intel are indistinguishable in the basic UA. Ask for
  // the architecture when the browser supports it, then refine the label.
  if (info.key === 'mac' && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    navigator.userAgentData.getHighEntropyValues(['architecture']).then(function (data) {
      var arch = data && data.architecture;
      var value = document.getElementById('osName');
      if (value && arch) value.textContent = 'macOS · ' + (arch === 'arm' ? 'Apple Silicon' : 'Intel');
    }).catch(function () { /* keep generic macOS label */ });
  }
})();
