(function () {
  'use strict';

  function detect() {
    var ua = navigator.userAgent || '';
    var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/Android/i.test(ua)) return { key: 'android', label: 'Android 电脑 / 平板' };
    if (/iPhone|iPad|iPod/i.test(ua)) return { key: 'android', label: 'iOS / iPadOS（暂无原生构建）' };
    if (/Mac OS X|Macintosh/i.test(ua) || /mac/i.test(platform)) {
      return { key: 'mac', label: 'macOS' };
    }
    if (/Windows NT 6\.1/i.test(ua)) return { key: 'legacy', label: 'Windows 7（旧版）' };
    if (/Windows NT 6\.2/i.test(ua)) return { key: 'legacy', label: 'Windows 8（旧版）' };
    if (/Windows NT 6\.3/i.test(ua)) return { key: 'legacy', label: 'Windows 8.1（旧版）' };
    if (/Windows/i.test(ua)) return { key: 'windows', label: 'Windows 10 / 11' };
    if (/Linux/i.test(ua)) return { key: 'linux', label: 'Linux' };
    return { key: 'windows', label: 'Windows' };
  }

  function apply(info) {
    var value = document.getElementById('osName');
    if (value) value.textContent = info.label;
    var grid = document.getElementById('allPlatforms');
    if (!grid) return;
    var card = grid.querySelector('[data-platform="' + info.key + '"]');
    if (!card) card = grid.querySelector('[data-platform="windows"]');
    if (!card) return;
    grid.insertBefore(card, grid.firstElementChild);
    card.classList.add('recommended');
    document.documentElement.dataset.os = info.key;
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
