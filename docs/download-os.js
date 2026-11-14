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
      if (note) note.textContent = '请根据下方平台手动选择，不要默认下载 Windows 版';
      if (banner) banner.classList.add('os-unknown');
      return;
    }
    if (kicker) kicker.textContent = '检测到你的系统';
    if (note) note.textContent = '已把适合你的下载放在第一位';
    if (banner) banner.classList.remove('os-unknown');
    var grid = document.getElementById('allPlatforms');
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
