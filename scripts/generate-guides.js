const fs = require('fs');
const path = require('path');

const outDir = 'C:/emcl-release/docs/guides';
fs.mkdirSync(outDir, { recursive: true });

const guides = [
  {
    id: 'install',
    title: '游戏安装与启动',
    lead: '从零安装一个 Minecraft 版本，或者给已安装版本补上 Forge、Fabric、NeoForge、Quilt 加载器。',
    where: '左侧 <b>下载</b> → <b>游戏版本</b>',
    steps: [
      ['选择游戏版本', '打开「下载」→「游戏版本」，在版本列表里找到要玩的 Minecraft 版本。'],
      ['下载原版', '点「下载安装」。启动器会下载游戏文件、资源索引和运行库，进度显示在按钮和状态文字里。'],
      ['需要模组时安装加载器', '如果这个版本要装模组，点「安装选项」或加载器入口，选择 Forge、Fabric、NeoForge 或 Quilt，并确认加载器版本与游戏版本匹配。'],
      ['检查已安装', '切到「已安装」，确认新版本出现在列表里。每个版本都有独立的模组和配置目录。'],
      ['启动游戏', '回主页选择版本，必要时先在「设置」里指定 Java 和内存，再点「启动游戏」。']
    ],
    note: '<b>版本隔离：</b>原版、Forge、Fabric 和整合包会各自使用独立目录，装模组时不要混到别的版本里。',
    notes: [
      '新版本通常需要 Java 17 或 21；启动前在设置页确认 Java 已被识别。',
      '加载器必须和游戏版本对应，例如 Fabric 1.21.1 不能装到 1.20.1。',
      '安装失败时先看「日志」页的错误输出，再检查网络和磁盘空间。'
    ],
    faq: [
      ['点下载后没有反应？', '确认网络可访问资源站；切换页面再回来，或查看日志页是否有下载错误。'],
      ['Java 显示未检测到？', '在「设置」里手动选择 Java 可执行文件。新版 Minecraft 通常需要 Java 17 或 21。'],
      ['启动后退回启动器？', '打开「日志」查看崩溃原因，常见是 Java 版本不对、内存过大或模组冲突。']
    ]
  },
  {
    id: 'resources',
    title: '资源下载',
    lead: '在启动器里搜索模组、光影、资源包和数据包，按当前版本与加载器筛选后直接安装。',
    where: '左侧 <b>下载</b> → <b>资源下载</b>，先选一个已安装版本',
    steps: [
      ['选择目标版本', '在右上角版本下拉框选择要安装资源的版本。过滤条件会跟随这个版本的游戏版本和加载器。'],
      ['选择资源类型', '用标签切换「推荐」「模组」「光影」「资源包」「数据包」「整合包」。'],
      ['搜索并选择文件', '输入名称搜索，进入资源详情，选择与你的游戏版本、加载器匹配的文件。'],
      ['安装', '点「安装」。模组、光影和资源包会放入当前版本的对应目录；数据包会安装到所选存档的 datapacks 目录。'],
      ['重启游戏', '安装完成后完全退出游戏再启动，让新资源生效。']
    ],
    note: '<b>数据包需要先选存档：</b>安装数据包前，在数据包页选择目标存档，否则不会写入正确的世界目录。',
    notes: [
      '模组必须匹配游戏版本和加载器；光影还需要对应的光影加载器。',
      '启动器会显示来源和筛选条件，安装前确认文件支持你的环境。',
      '一次不要装太多模组，出现冲突时用日志排查。'
    ],
    faq: [
      ['搜索不到某个模组？', '检查资源类型和版本筛选；有些项目只支持特定加载器或游戏版本。'],
      ['安装后游戏里没有？', '确认安装到了当前启动的版本；模组需要对应加载器，资源包需要在游戏内启用。'],
      ['数据包没有生效？', '确认安装时选对了存档，并在游戏内用 /datapack list 检查。']
    ]
  },
  {
    id: 'modpacks',
    title: '整合包',
    lead: '导入 PCL2、Modrinth 或 CurseForge 整合包，作为独立实例启动，不覆盖现有版本。',
    where: '左侧 <b>整合包</b> → <b>导入整合包</b>',
    steps: [
      ['准备整合包', '下载整合包压缩包，或准备已经解压的整合包文件夹。'],
      ['选择导入方式', '在「整合包」页点「导入整合包」，选择 zip 或文件夹。'],
      ['确认实例信息', '启动器会读取整合包内的版本、模组和配置。给它一个容易辨认的名称。'],
      ['等待安装', '确认后等待文件复制和依赖检查完成；大整合包需要更长时间。'],
      ['启动实例', '在整合包列表里点启动。它会使用自己的目录，不会影响正式版或其他版本。']
    ],
    note: '<b>不要直接覆盖：</b>导入会创建独立实例。想更新整合包时，先备份存档，再导入新版本。',
    notes: [
      '整合包自带模组和配置，不要随意把别的模组装进去。',
      '大型整合包建议分配 4GB 以上内存，并确认 Java 版本符合要求。',
      '整合包内的授权和模组版权归原作者，启动器只负责本地导入和启动。'
    ],
    faq: [
      ['导入后启动崩溃？', '先看日志页；常见原因是内存不足、Java 版本不匹配或整合包文件不完整。'],
      ['能导入 PCL2 的整合包吗？', '可以，启动器支持读取 PCL2 整合包结构；无法识别时会提示缺少的文件。'],
      ['整合包更新会覆盖存档吗？', '不会自动覆盖。更新前请先备份存档目录。']
    ]
  },
  {
    id: 'accounts',
    title: '账户与登录',
    lead: '管理 Microsoft 正版账户、离线档案和第三方验证账户，启动前选择本次使用的身份。',
    where: '左侧 <b>账户</b> → <b>添加账户</b>',
    steps: [
      ['添加 Microsoft 账户', '点「添加账户」选择 Microsoft，浏览器会打开微软登录页，授权后回到启动器。'],
      ['添加离线档案', '选择「离线」，输入游戏内用户名。离线档案不需要密码，也不能访问正版服务器。'],
      ['第三方验证', '如果服务器使用第三方验证，选择对应方式并按提示填写验证地址和凭据。'],
      ['设为当前账户', '在账户列表里选择要使用的账户，主页和启动按钮会显示当前身份。'],
      ['检查皮肤', '正版账户登录后，皮肤和披风会跟随账户；离线档案使用本地皮肤设置。']
    ],
    note: '<b>账户安全：</b>启动器不会保存你的 Microsoft 密码。不要把账户令牌、验证码或第三方凭据发给别人。',
    notes: [
      '离线用户名不能用于需要正版验证的服务器。',
      'Microsoft 登录需要浏览器完成授权；如果浏览器没有自动回到启动器，重新点一次登录。',
      '多个账户可以同时保存，启动前确认选中的是正确账户。'
    ],
    faq: [
      ['微软登录一直转圈？', '检查默认浏览器和网络；关闭拦截弹窗的扩展后重试。'],
      ['离线用户名能用中文吗？', '建议使用英文、数字和下划线，避免服务器或皮肤系统不兼容。'],
      ['皮肤没有同步？', '确认当前是 Microsoft 账户且登录成功；离线档案只显示本地皮肤。']
    ]
  },
  {
    id: 'skins',
    title: '皮肤与披风',
    lead: '正面预览皮肤，切换 Steve / Alex 模型和衣层，选择推荐皮肤、上传本地皮肤并切换披风。',
    where: '左侧 <b>皮肤</b> → 选择当前账户',
    steps: [
      ['选择账户', '在皮肤页顶部确认当前账户。正版账户会读取官方皮肤，离线账户使用本地设置。'],
      ['切换模型', '在 Steve / Alex 之间选择，预览会立即更新。'],
      ['调整衣层', '用衣层开关显示或隐藏帽子、外套、袖子、裤子和鞋子。'],
      ['选择推荐皮肤', '在推荐列表里点一款皮肤应用；也可以上传本地 PNG 皮肤文件。'],
      ['切换披风', '如果账户有可用披风，在披风列表里选择并应用。'],
      ['确认效果', '正面预览确认外观后启动游戏；服务器是否显示取决于服务器和账户验证。']
    ],
    note: '<b>本地皮肤：</b>上传的皮肤先保存在本地。离线档案可以使用本地皮肤，但正版服务器可能不显示。',
    notes: [
      '皮肤文件使用 Minecraft 标准 PNG 格式，建议 64×64。',
      '披风通常需要正版账户和官方披风资格。',
      '衣层设置只影响预览和本地显示，不会修改服务器规则。'
    ],
    faq: [
      ['上传皮肤失败？', '确认文件是 PNG 且尺寸正确，文件名不要包含特殊字符。'],
      ['游戏里看不到皮肤？', '检查账户是否正版登录，以及服务器是否使用正版验证。'],
      ['换了模型没变化？', '确认应用后重新启动游戏；部分服务器会缓存皮肤。']
    ]
  },
  {
    id: 'servers',
    title: '本地服务器',
    lead: '管理本地 Java 服务端、远程 RCON 和 MCSManager 面板，启动、停止、看控制台、改属性、备份和分析。',
    where: '左侧 <b>服务器</b>',
    steps: [
      ['本地服务端', '点「添加本地服务端」，选择已有的 server.jar 所在目录；启动器会读取服务端类型和配置。'],
      ['生成服务器', '没有服务端时点「生成服务器」，按向导选择版本和加载器，启动器会下载并生成基础文件。'],
      ['远程 RCON', '点「添加远程 RCON」，填写主机、端口和 RCON 密码，用于管理远程服务器。'],
      ['MCSManager', '需要面板时点「安装 MCSManager」或「MCSManager 面板」，按提示安装并打开。']
    ],
    note: '<b>安全：</b>不要把 RCON 端口直接暴露到公网；远程管理建议使用隧道或只允许可信 IP。',
    notes: [
      '<b>启动 / 停止：</b>在服务器卡片右侧操作；停止前先保存世界。',
      '<b>控制台：</b>输入 list、say 等命令，输出会实时显示。',
      '<b>属性：</b>修改 server.properties，保存后重启生效。',
      '<b>备份：</b>创建世界备份，升级或换模组前先备份。',
      '<b>玩家：</b>查看在线玩家并执行管理操作。'
    ],
    faq: [
      ['启动提示端口被占用？', '修改 server.properties 的 server-port，或关闭占用该端口的程序。'],
      ['RCON 连接失败？', '确认远程服务端已开启 enable-rcon、端口和密码一致，并检查防火墙。'],
      ['服务端卡顿？', '检查内存分配、视距和实体数量；备份后再调整配置。']
    ]
  },
  {
    id: 'settings',
    title: '日志与设置',
    lead: '在设置页管理 Java、内存、游戏目录，在日志页查看启动输出和错误现场。',
    where: '左侧 <b>设置</b> 和 <b>日志</b>',
    steps: [
      ['选择 Java', '在设置页查看自动检测到的 Java；如果没有或版本不对，手动选择 java.exe。'],
      ['调整内存', '设置最大内存。整合包和大型模组建议 4GB 以上，但不要超过机器可用内存。'],
      ['修改游戏目录', '需要把游戏放到其他磁盘时，在这里更换目录；更换后旧版本不会自动迁移。'],
      ['保存并重启', '修改后保存设置，重新启动游戏让 Java 和内存生效。']
    ],
    note: '<b>建议：</b>改动 Java、内存或游戏目录后，先用一个原版版本测试启动，再切回整合包排查。',
    notes: [
      '启动失败、崩溃或模组报错时，先打开「日志」页。',
      '日志保留启动输出和错误现场，可以复制关键行提交反馈。',
      '提交前删除账户令牌、路径中的个人信息等敏感内容。'
    ],
    faq: [
      ['Java 检测不到？', '手动指定 java.exe；确认安装的是 64 位 JDK/JRE，版本符合游戏要求。'],
      ['内存越大越好吗？', '不是。过大会增加 GC 压力，按版本和整合包大小分配即可。'],
      ['日志在哪里？', '启动器「日志」页直接显示；需要完整文件时可在游戏目录的 logs 文件夹查看。']
    ]
  },
  {
    id: 'updates',
    title: '公告、更新与反馈',
    lead: '了解自动更新、三个更新通道和反馈流程。',
    where: '主页公告、更新提示、左侧 <b>设置</b> 中的刷新，以及应用内 <b>反馈</b> 按钮',
    steps: [
      ['启动时自动检查', '启动器启动后会读取公告和更新清单；有新版本时显示更新提示。'],
      ['手动刷新', '在公告/更新入口点「刷新公告和更新」，重新拉取最新内容。'],
      ['查看版本说明', '更新提示里会显示版本号和更新内容；确认后再下载。'],
      ['安装更新', '按提示下载并替换当前版本；更新前关闭正在运行的游戏。'],
      ['反馈问题', '点应用内「反馈」，会打开网页反馈表单，自动带上应用名和版本号。']
    ],
    note: '<b>反馈需要邮箱：</b>网页表单要求填写邮箱，方便回复；邮箱不会公开。提交后会进入开发者反馈收件箱。',
    notes: [
      '<b>正式版：</b>稳定功能，更新源为 emcl.life/update.json。',
      '<b>商弦特供版：</b>独立主题与入口，更新源为 emcl.life/sianhgheln/update.json。',
      '<b>开发者版：</b>内部测试，更新源为 emcl.life/dev/update.json。'
    ],
    faq: [
      ['检查不到更新？', '确认网络能访问 emcl.life；当前版本已经是最新时不会提示。'],
      ['公告是空的？', '可能是网络或公告源暂时不可用，稍后刷新；也可以直接打开公告页。'],
      ['反馈提交失败？', '检查邮箱格式和网络；稍后重试，或直接发邮件到 EMCLsupport2026@163.com。']
    ]
  }
];

const css = `
:root{color-scheme:light;--blue:#2F7FD1;--blue-dark:#1D5FA8;--blue-soft:#EAF4FF;--ink:#14283B;--muted:#62788D;--line:#D8E7F5;--bg:#F5F9FE;--green:#2DBE7E}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif;color:var(--ink);background:linear-gradient(180deg,#F9FCFF,#F5F9FE 60%,#EEF6FE);min-height:100vh;line-height:1.7}
a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}.wrap{width:min(1040px,calc(100% - 48px));margin:0 auto}
header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:9px;color:var(--ink);font-weight:900;letter-spacing:-.3px}.brand:hover{text-decoration:none}
.gem{width:28px;height:28px;border-radius:8px;background:linear-gradient(145deg,#65B4FF,#1F6FCA);box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
.brand small{display:block;font-size:8px;color:var(--muted);letter-spacing:1.3px}nav{display:flex;gap:16px;flex-wrap:wrap;font-size:12px}nav a{color:var(--muted);font-weight:650}
.crumb{padding:24px 0 0;color:var(--muted);font-size:11px}.crumb a{color:var(--muted)}
.hero{padding:18px 0 24px;border-bottom:1px solid var(--line)}.badge{display:inline-block;padding:5px 9px;border-radius:999px;background:var(--blue-soft);color:var(--blue-dark);font-size:10px;font-weight:800;letter-spacing:.8px}
h1{margin:12px 0 8px;font-size:clamp(28px,4vw,42px);line-height:1.15;letter-spacing:-1.2px}.lead{margin:0;max-width:700px;color:var(--muted);font-size:13px;line-height:1.85}
.layout{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:34px;padding:28px 0 50px}.article h2{font-size:17px;margin:26px 0 12px;letter-spacing:-.3px}.article h2:first-child{margin-top:0}
.where{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:12px;color:#4C657B}.where b{color:var(--ink)}
.steps{counter-reset:step;margin:0;padding:0;list-style:none}.steps li{display:grid;grid-template-columns:34px 1fr;gap:10px;padding:11px 0;border-bottom:1px solid #E9F1FA}
.steps li::before{counter-increment:step;content:counter(step);display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:var(--blue-soft);color:var(--blue-dark);font-size:11px;font-weight:900}
.steps b{display:block;font-size:13px;margin-bottom:2px}.steps span{display:block;color:var(--muted);font-size:12px;line-height:1.75}
.note{margin:14px 0;padding:12px 14px;border-left:3px solid #9DC7EE;background:#F3F9FF;color:#506B83;font-size:12px;line-height:1.75;border-radius:0 8px 8px 0}
.faq{border:1px solid var(--line);border-radius:10px;background:#fff;padding:2px 14px}.faq details{border-bottom:1px solid #EDF4FB;padding:10px 0}.faq details:last-child{border-bottom:0}
.faq summary{font-size:12px;font-weight:750;cursor:pointer}.faq p{margin:6px 0 0;color:var(--muted);font-size:12px}
aside{font-size:12px}aside .box{background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px}aside h3{margin:0 0 8px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)}
aside a{display:block;padding:7px 0;border-bottom:1px solid #EDF4FB;color:#3D5D78;font-size:11px}aside a:last-child{border-bottom:0}aside a.active{color:var(--blue-dark);font-weight:800}
footer{padding:28px 0 36px;border-top:1px solid var(--line);color:#8A9BAC;font-size:11px;line-height:1.8}.footer-links{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px}.footer-links a{color:#6C8298}
@media(max-width:820px){.layout{grid-template-columns:1fr;gap:10px}aside{order:-1}aside .box{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}aside h3{grid-column:1/-1}aside a{padding:6px 0}}
@media(max-width:560px){.wrap{width:calc(100% - 32px)}nav{display:none}h1{letter-spacing:-.8px}}
`;

const footer = `<footer><div>© 2026 EMCL Studio · 支持邮箱：EMCLsupport2026@163.com</div><div class="footer-links"><a href="../index.html">首页</a><a href="../download.html">下载</a><a href="../announcements.html">公告</a><a href="../feedback/">反馈</a><a href="../dev/">开发者模式</a><a href="../privacy.html">隐私政策</a><a href="../terms.html">服务条款</a></div></footer>`;

function asideFor(current) {
  return `<aside><div class="box"><h3>全部使用说明</h3>${guides.map((g) => `<a class="${g.id === current ? 'active' : ''}" href="${g.id}.html">${g.title}</a>`).join('')}<a href="index.html">功能说明总览</a></div></aside>`;
}

function page(g) {
  const steps = g.steps.map(([title, body]) => `<li><div><b>${title}</b><span>${body}</span></div></li>`).join('');
  const notes = g.notes.map((n) => `<li>${n}</li>`).join('');
  const faq = g.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${g.title} - EMCL 使用说明</title><meta name="description" content="${g.lead.replace(/<[^>]+>/g, '')}"><style>${css}</style></head><body><div class="wrap"><header><a class="brand" href="../index.html"><span class="gem"></span><span>EMCL <small>使用说明</small></span></a><nav><a href="../index.html">首页</a><a href="../download.html">下载</a><a href="index.html">功能总览</a><a href="../feedback/">反馈</a></nav></header><div class="crumb"><a href="../index.html">首页</a> / <a href="index.html">功能说明</a> / ${g.title}</div><main class="layout"><article class="article"><div class="hero"><span class="badge">使用说明 · ${g.title}</span><h1>${g.title}</h1><p class="lead">${g.lead}</p></div><div class="where">入口：${g.where}</div><h2>操作步骤</h2><ol class="steps">${steps}</ol><div class="note">${g.note}</div><h2>注意事项</h2><ul>${notes}</ul><h2>常见问题</h2><div class="faq">${faq}</div></article>${asideFor(g.id)}</main>${footer}</div></body></html>`;
}

for (const g of guides) {
  fs.writeFileSync(path.join(outDir, g.id + '.html'), page(g), 'utf8');
}

const indexItems = guides.map((g) => `<details><summary><a href="${g.id}.html">${g.title}</a></summary><p>${g.lead}</p></details>`).join('');
fs.writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>功能说明总览 - EMCL</title><style>${css}</style></head><body><div class="wrap"><header><a class="brand" href="../index.html"><span class="gem"></span><span>EMCL <small>使用说明</small></span></a><nav><a href="../index.html">首页</a><a href="../download.html">下载</a><a href="../feedback/">反馈</a></nav></header><div class="crumb"><a href="../index.html">首页</a> / 功能说明</div><main class="layout"><article class="article"><div class="hero"><span class="badge">使用说明</span><h1>功能说明总览</h1><p class="lead">每个功能一页，写清楚入口、操作步骤和常见问题。遇到问题时先看对应说明，再查日志或提交反馈。</p></div><div class="faq">${indexItems}</div></article>${asideFor('')}</main>${footer}</div></body></html>`, 'utf8');

console.log('Generated', guides.length + 1, 'UTF-8 guide pages');
