/* EMCL website language + light/dark theme.
   Languages match the launcher: zh-CN, zh-TW, en-US, ja-JP, ko-KR, fr-FR, ru-RU. */
(function () {
  'use strict';

  var en = {
    '功能': 'Features', '说明': 'Guides', '下载': 'Download', '公告': 'News', '反馈': 'Feedback', '商弦': 'Sianh',
    'Windows 10 / 11 · 正式版 1.26.26.10': 'Windows 10 / 11 · Stable 1.26.26.10',
    'Minecraft Java 日常': 'Minecraft Java, daily', '一个启动器完成。': 'One launcher for all of it.',
    'EMCL 把安装游戏、下载资源、登录账户、管理模组与整合包、换皮肤、开本地服务器和检查更新放在同一个界面里。下面按功能说明，不按主题堆图。':
      'EMCL brings game installation, resource downloads, accounts, mods and modpacks, skins, local servers and updates into one interface. This page explains what each feature does.',
    '下载 EMCL': 'Download EMCL', '商弦特供版': 'Sianh Edition', '查看功能清单': 'View feature list',
    '微软 / 离线 / 第三方登录': 'Microsoft / Offline / Third-party', '自动更新': 'Auto update',
    '功能索引': 'Feature index', '8 个模块': '8 modules',
    '游戏安装与启动': 'Install & launch', '版本 / Java / 内存': 'Versions / Java / RAM',
    '资源下载': 'Resource downloads', '模组 / 光影 / 资源包': 'Mods / Shaders / Packs',
    '整合包': 'Modpacks', '账户与登录': 'Accounts & sign-in', '微软 / 离线 / 第三方': 'Microsoft / Offline / Third-party',
    '皮肤与披风': 'Skins & capes', 'Steve / Alex / 衣层': 'Steve / Alex / Layers',
    '本地服务器': 'Local servers', '启动 / 停止 / RCON': 'Start / Stop / RCON',
    '日志与设置': 'Logs & settings', 'Java / 内存 / 目录': 'Java / RAM / Folders',
    '公告与更新': 'News & updates', '三通道 / 反馈': '3 channels / Feedback',
    '功能清单': 'Feature list', '每一项都对应启动器里的一个实际入口，不是宣传图上的概念。':
      'Every item maps to a real screen in the launcher, not a marketing concept.',
    '选择 Minecraft 版本和加载器，自动补齐游戏文件、运行库和资源。启动前检查 Java 版本和内存上限，避免启动后才发现环境不对。':
      'Pick a Minecraft version and loader. EMCL fetches the game files, libraries and assets, then checks Java and memory before launch.',
    '版本隔离，各自保留模组和配置': 'Versions stay isolated with their own mods and config',
    '自动检测 Java，可手动指定路径': 'Java is detected automatically, or set a path manually',
    '启动前显示内存和版本信息': 'Memory and version are shown before launch',
    '在启动器里搜索并安装模组、光影、资源包和数据包。支持 Modrinth 与 CurseForge 两个来源，下载后放入当前版本对应的目录。':
      'Search and install mods, shaders, resource packs and datapacks inside the launcher. Modrinth and CurseForge sources are supported, and files go into the current version folder.',
    '按版本和加载器筛选资源': 'Filter resources by version and loader',
    '下载前显示文件名和来源': 'Filename and source are shown before download',
    '资源放入独立目录，便于排查': 'Files go into per-version folders for easier troubleshooting',
    '导入 PCL2、Modrinth 或 CurseForge 整合包，读取其中的版本、模组和配置信息，作为独立实例启动，不污染其他版本。':
      'Import PCL2, Modrinth or CurseForge modpacks and read their version, mods and config. Each pack starts as an isolated instance without touching other versions.',
    '整合包独立目录和独立设置': 'Isolated folder and settings for each modpack',
    '导入后可继续添加或移除模组': 'Add or remove mods after import',
    '适合服务器整合包和活动包': 'Suited to server packs and event packs',
    '支持 Microsoft 正版登录、离线档案和第三方验证。多个账户可以同时保存，启动前选择这次要用的档案。':
      'Supports Microsoft sign-in, offline profiles and third-party auth. Keep several accounts and pick the one to use before launch.',
    '正版账户使用 Microsoft OAuth': 'Official accounts use Microsoft OAuth',
    '离线档案自定义用户名': 'Offline profiles use a custom username',
    '账户信息保存在本地': 'Account data stays local',
    '正面预览皮肤，切换 Steve / Alex 模型和衣层显示。可以从推荐皮肤中选择，也可以上传本地皮肤，支持披风切换。':
      'Preview skins from the front, switch between Steve / Alex and toggle layers. Choose a recommended skin, upload a local PNG, and switch capes.',
    '8 款推荐皮肤': '8 recommended skins', '本地皮肤上传': 'Local skin upload', '披风列表与切换': 'Cape list and switching',
    '创建和管理本地 Java 服务端，配置端口、内存和启动参数。支持远程 RCON，查看服务器状态并发送管理命令。':
      'Create and manage a local Java server with port, memory and startup options. Remote RCON lets you check status and send admin commands.',
    '一键启动 / 停止本地服务端': 'Start / stop a local server in one click',
    'RCON 远程命令': 'Remote RCON commands', '服务端目录与配置集中管理': 'Server folder and config in one place',
    '启动失败时查看启动输出和错误现场，不用去翻隐藏目录。设置页集中管理 Java、内存、游戏目录和界面选项。':
      'See launch output and errors when startup fails, without digging through hidden folders. Settings centralise Java, memory, game folder and UI options.',
    '日志页保留启动输出': 'Log page keeps launch output',
    'Java 路径和内存上限可调': 'Adjustable Java path and memory limit',
    '游戏目录可自定义': 'Custom game directory',
    '启动时读取公告和版本清单，自动提示新版本。正式版、商弦特供版和开发者版使用独立更新通道；反馈提交后进入开发者收件箱。':
      'Reads announcements and the version manifest at startup and prompts for updates. Stable, Sianh and Developer builds use separate channels; feedback goes to the developer inbox.',
    '正式版 / 商弦版 / 开发者版独立更新': 'Separate channels: Stable / Sianh / Developer',
    '更新前显示版本说明': 'Release notes before updating', '反馈附带应用名和版本号': 'Feedback includes app name and version',
    '查看完整使用说明 →': 'Read the full guide →',
    '使用流程': 'How it works', '从第一次启动到进入服务器，只有三步。': 'Three steps from first launch to joining a server.',
    '登录或创建档案': 'Sign in or create a profile',
    '微软账号、离线档案或第三方验证，选择这次使用的账户。':
      'Use a Microsoft account, an offline profile or third-party auth, then pick the account for this session.',
    '选择版本和资源': 'Choose a version and resources',
    '安装原版或加载器，按需添加模组、光影、资源包和整合包。':
      'Install vanilla or a loader, then add mods, shaders, resource packs and modpacks as needed.',
    '启动并进入游戏': 'Launch and play',
    '检查 Java 和内存，点启动。日志页保留输出，出问题可以直接看。':
      'Check Java and memory, then launch. The log page keeps the output if something goes wrong.',
    '定制版本': 'Custom builds', '给服务器或社区做独立品牌版本。': 'A branded build for your server or community.',
    '7.5 元 / 次': 'CNY 7.5 / build', '改名、图标、配色、背景和服务器入口': 'Name, icon, colours, background and server entry',
    '独立数据目录、独立更新通道，不影响正式版。适合服务器团队、整合包作者和社区活动。复杂功能单独沟通。':
      'A separate data folder and update channel without affecting the stable build. For server teams, pack authors and community events. Complex features quoted separately.',
    '定制说明': 'Custom build details', '商弦案例': 'Sianh example', '元 / 次': 'CNY / build',
    '基础定制包含名称、图标、配色、背景、官网入口和独立更新。':
      'The base build includes a name, icon, colours, background, website entry and independent updates.',
    '下载 EMCL 1.26.26.10': 'Download EMCL 1.26.26.10',
    'Windows 10 / 11 x64 · 安装版、便携版、Microsoft Store': 'Windows 10 / 11 x64 · Installer, portable build, Microsoft Store',
    '选择下载方式': 'Choose a download', '历史版本': 'Version history', '提交反馈': 'Send feedback',
    '© 2026 EMCL Studio · 支持邮箱：EMCLsupport2026@163.com': '© 2026 EMCL Studio · Support: EMCLsupport2026@163.com',
    '开发者模式': 'Developer mode', '隐私政策': 'Privacy', '服务条款': 'Terms',
    '原版': 'Vanilla', '模组': 'Mods', '光影': 'Shaders', '资源包': 'Resource packs', '数据包': 'Datapacks',
    '离线': 'Offline', '第三方': 'Third-party', '正面预览': 'Front preview', '衣层': 'Layers', '披风': 'Capes',
    'Java 服务端': 'Java server', '端口 / 内存': 'Port / RAM', '启动日志': 'Launch log', '错误输出': 'Errors', '内存': 'RAM',
    '网页反馈': 'Web feedback'
  };

  /* Core website UI translations. Missing keys fall back to English for these locales. */
  var zhTW = {
    '功能': '功能', '说明': '說明', '下载': '下載', '公告': '公告', '反馈': '回饋',
    'Windows 10 / 11 · 正式版 1.26.26.10': 'Windows 10 / 11 · 正式版 1.26.26.10',
    'Minecraft Java 日常': 'Minecraft Java 日常', '一个启动器完成。': '一個啟動器完成。',
    '下载 EMCL': '下載 EMCL', '商弦特供版': '商弦特供版', '查看功能清单': '查看功能清單',
    '功能索引': '功能索引', '8 个模块': '8 個模組', '游戏安装与启动': '遊戲安裝與啟動',
    '资源下载': '資源下載', '整合包': '整合包', '账户与登录': '帳戶與登入', '皮肤与披风': '皮膚與披風',
    '本地服务器': '本機伺服器', '日志与设置': '日誌與設定', '公告与更新': '公告與更新',
    '功能清单': '功能清單', '使用流程': '使用流程', '定制版本': '客製版本', '查看完整使用说明 →': '查看完整使用說明 →',
    '下载 EMCL 1.26.26.10': '下載 EMCL 1.26.26.10', '选择下载方式': '選擇下載方式', '历史版本': '歷史版本'
  };

  var ja = {
    '功能': '機能', '说明': 'ガイド', '下载': 'ダウンロード', '公告': 'お知らせ', '反馈': 'フィードバック',
    'Windows 10 / 11 · 正式版 1.26.26.10': 'Windows 10 / 11 · 安定版 1.26.26.10',
    'Minecraft Java 日常': 'Minecraft Java の日常', '一个启动器完成。': 'ひとつのランチャーで。',
    '下载 EMCL': 'EMCL をダウンロード', '商弦特供版': 'Sianh エディション', '查看功能清单': '機能一覧を見る',
    '功能索引': '機能一覧', '8 个模块': '8 モジュール', '游戏安装与启动': 'インストールと起動',
    '资源下载': 'リソース入手', '整合包': 'MOD パック', '账户与登录': 'アカウントとログイン',
    '皮肤与披风': 'スキンとマント', '本地服务器': 'ローカルサーバー', '日志与设置': 'ログと設定',
    '公告与更新': 'お知らせと更新', '功能清单': '機能一覧', '使用流程': '使い方',
    '定制版本': 'カスタム版', '查看完整使用说明 →': '詳しい使い方を見る →',
    '下载 EMCL 1.26.26.10': 'EMCL 1.26.26.10 をダウンロード', '选择下载方式': 'ダウンロード方法を選ぶ',
    '历史版本': '過去のバージョン', '提交反馈': 'フィードバックを送る'
  };

  var ko = {
    '功能': '기능', '说明': '가이드', '下载': '다운로드', '公告': '공지', '反馈': '피드백',
    'Windows 10 / 11 · 正式版 1.26.26.10': 'Windows 10 / 11 · 안정판 1.26.26.10',
    'Minecraft Java 日常': 'Minecraft Java의 일상', '一个启动器完成。': '하나의 런처로.',
    '下载 EMCL': 'EMCL 다운로드', '商弦特供版': 'Sianh 에디션', '查看功能清单': '기능 목록 보기',
    '功能索引': '기능 색인', '8 个模块': '8개 모듈', '游戏安装与启动': '설치 및 실행',
    '资源下载': '리소스 다운로드', '整合包': '모드팩', '账户与登录': '계정 및 로그인',
    '皮肤与披风': '스킨과 망토', '本地服务器': '로컬 서버', '日志与设置': '로그 및 설정',
    '公告与更新': '공지 및 업데이트', '功能清单': '기능 목록', '使用流程': '사용 흐름',
    '定制版本': '커스텀 빌드', '查看完整使用说明 →': '전체 가이드 보기 →',
    '下载 EMCL 1.26.26.10': 'EMCL 1.26.26.10 다운로드', '选择下载方式': '다운로드 방식 선택',
    '历史版本': '이전 버전', '提交反馈': '피드백 보내기'
  };

  var fr = {
    '功能': 'Fonctions', '说明': 'Guides', '下载': 'Télécharger', '公告': 'Actualités', '反馈': 'Retour',
    'Windows 10 / 11 · 正式版 1.26.26.10': 'Windows 10 / 11 · Stable 1.26.26.10',
    'Minecraft Java 日常': 'Minecraft Java au quotidien', '一个启动器完成。': 'Un seul lanceur.',
    '下载 EMCL': 'Télécharger EMCL', '商弦特供版': 'Édition Sianh', '查看功能清单': 'Voir les fonctions',
    '功能索引': 'Index des fonctions', '8 个模块': '8 modules', '游戏安装与启动': 'Installer et lancer',
    '资源下载': 'Téléchargements', '整合包': 'Modpacks', '账户与登录': 'Comptes et connexion',
    '皮肤与披风': 'Skins et capes', '本地服务器': 'Serveurs locaux', '日志与设置': 'Journaux et réglages',
    '公告与更新': 'Actualités et mises à jour', '功能清单': 'Liste des fonctions', '使用流程': 'Utilisation',
    '定制版本': 'Versions personnalisées', '查看完整使用说明 →': 'Lire le guide complet →',
    '下载 EMCL 1.26.26.10': 'Télécharger EMCL 1.26.26.10', '选择下载方式': 'Choisir un téléchargement',
    '历史版本': 'Versions précédentes', '提交反馈': 'Envoyer un retour'
  };

  var ru = {
    '功能': 'Функции', '说明': 'Руководства', '下载': 'Скачать', '公告': 'Новости', '反馈': 'Отзыв',
    'Windows 10 / 11 · 正式版 1.26.26.10': 'Windows 10 / 11 · Стабильная 1.26.26.10',
    'Minecraft Java 日常': 'Minecraft Java каждый день', '一个启动器完成。': 'Один лаунчер.',
    '下载 EMCL': 'Скачать EMCL', '商弦特供版': 'Издание Sianh', '查看功能清单': 'Список функций',
    '功能索引': 'Указатель функций', '8 个模块': '8 модулей', '游戏安装与启动': 'Установка и запуск',
    '资源下载': 'Загрузка ресурсов', '整合包': 'Сборки', '账户与登录': 'Аккаунты и вход',
    '皮肤与披风': 'Скины и плащи', '本地服务器': 'Локальные серверы', '日志与设置': 'Логи и настройки',
    '公告与更新': 'Новости и обновления', '功能清单': 'Список функций', '使用流程': 'Как это работает',
    '定制版本': 'Индивидуальные сборки', '查看完整使用说明 →': 'Полное руководство →',
    '下载 EMCL 1.26.26.10': 'Скачать EMCL 1.26.26.10', '选择下载方式': 'Выбрать загрузку',
    '历史版本': 'Прошлые версии', '提交反馈': 'Отправить отзыв'
  };

  var dictionaries = { 'en-US': en, 'zh-TW': zhTW, 'ja-JP': ja, 'ko-KR': ko, 'fr-FR': fr, 'ru-RU': ru };

  var originalText = new WeakMap();
  var nodes = [];

  function collectTextNodes() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var tag = node.parentElement ? node.parentElement.tagName : '';
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'OPTION') return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) {
      originalText.set(walker.currentNode, walker.currentNode.nodeValue);
      nodes.push(walker.currentNode);
    }
  }

  function applyLanguage(lang) {
    var normalized = ({ zh: 'zh-CN', en: 'en-US' })[lang] || lang;
    var dict = dictionaries[normalized] || null;
    var english = dictionaries['en-US'];
    nodes.forEach(function (node) {
      var raw = originalText.get(node);
      if (raw == null) return;
      if (!dict) { node.nodeValue = raw; return; }
      var key = raw.trim();
      var value = dict[key];
      if (value == null) value = normalized === 'zh-TW' ? null : english[key];
      node.nodeValue = value ? raw.replace(key, value) : raw;
    });
    document.documentElement.lang = normalized;
    document.documentElement.dataset.lang = normalized;
    try { localStorage.setItem('emcl-lang', normalized); } catch (error) { /* ignore */ }
  }

  var themeButton = document.getElementById('themeToggle');
  var langSelect = document.getElementById('langSelect');

  function syncThemeButton() {
    if (!themeButton) return;
    var dark = document.documentElement.dataset.theme === 'dark';
    themeButton.textContent = dark ? '☀' : '☾';
    themeButton.setAttribute('aria-label', dark ? '切换到明亮主题' : '切换到深色主题');
    themeButton.title = dark ? 'Light mode' : 'Dark mode';
  }

  if (themeButton) {
    syncThemeButton();
    themeButton.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('emcl-theme', next); } catch (error) { /* ignore */ }
      syncThemeButton();
    });
  }

  collectTextNodes();

  var savedLang = 'zh-CN';
  try { savedLang = localStorage.getItem('emcl-lang') || 'zh-CN'; } catch (error) { /* ignore */ }
  savedLang = ({ zh: 'zh-CN', en: 'en-US' })[savedLang] || savedLang;
  if (!['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR', 'fr-FR', 'ru-RU'].includes(savedLang)) savedLang = 'zh-CN';
  if (langSelect) langSelect.value = savedLang;
  applyLanguage(savedLang);

  if (langSelect) {
    langSelect.addEventListener('change', function () {
      applyLanguage(langSelect.value);
    });
  }
})();
