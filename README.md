# EMCL · Enderman MineCraft Launcher

蓝色主题、PCL2 风格信息层级的 Windows Minecraft Java 版启动器。
目录规范与 PCL2 / 官方启动器兼容，可直接导入已有的 `.minecraft`。

> 本项目是独立实现，不包含 PCL2 的代码或资源。  
> “PCL2 兼容”指 `versions / libraries / assets / mods / saves` 等目录与整合包格式兼容。

---

## 一、直接运行

桌面上的 `EMCL` 文件夹内是打包后的应用：

```
Desktop\EMCL\EMCL.exe
```

双击 `EMCL.exe` 即可。首次启动会自动识别 `%APPDATA%\.minecraft`；也可以
在「设置 → 游戏目录」或「版本 → 导入游戏文件夹」里选择其他目录。

启动器数据目录：

```
%APPDATA%\emcl-launcher\
├── config.json       设置
├── accounts.json     账户（含 token，注意本机安全）
├── logs\             启动日志与 auth.log
├── cache\            下载缓存
└── runtime\          启动器下载的 Java 运行时
```

---

## 二、已实现功能

| 模块 | 实现 |
|---|---|
| PCL2 风格 UI | 蓝色主题、左侧导航、卡片信息流、下载任务浮层 |
| 版本下载 | Mojang / BMCLAPI 版本清单，客户端 jar、libraries、natives、assets 全量校验与并发下载；安装时可顺便选择 Fabric / Quilt / Forge / NeoForge |
| 多版本管理 | 扫描 `versions/`，切换当前版本，补全缺失文件，打开版本目录 |
| 版本隔离 | 每个版本的 mods / saves / resourcepacks / config 独立，库与资源共享 |
| 加载器 | Fabric、Quilt 直接写 profile；Forge、NeoForge 调用官方 installer |
| Java | 检测系统中 Java、手动选择、自动下载 Adoptium / 清华镜像 JRE（8/17/21/25） |
| 启动游戏 | 解析 inheritsFrom、rules、arguments，装配 JVM/游戏参数，实时输出日志 |
| 模组 | Modrinth 搜索、按版本/加载器筛选、安装到 `mods/`、启停、删除 |
| 光影 | Modrinth 搜索、安装到 `shaderpacks/`、启停、删除；装版本时可顺带安装 Iris / Oculus 光影加载器 |
| 资源包 | Modrinth 搜索、安装到 `resourcepacks/`，支持目录/zip |
| 数据包 | 选择存档，安装到 `saves/<存档>/datapacks/`，按存档管理 |
| 整合包 | Modrinth 在线安装；导入 `.mrpack`、带 `.minecraft` 的通用 zip、CurseForge manifest + overrides |
| 账户 | 离线（Java 同款 v3 UUID）、微软 OAuth（已通过 Mojang allowlist 的自有 appID）、第三方 Yggdrasil / authlib-injector；支持多账户启动选择 |
| 服务器 | 本地服务器生成向导、启停、控制台、命令、属性、白名单/OP、备份恢复、崩溃分析、控制台日志下载；远程 RCON / SSH；MCSManager 安装与面板管理 |
| 主页与下载 | 主页服务器推荐、整合后的游戏版本与资源下载、启动前模组依赖检查、启动进度显示 |
| 导入与兼容 | 导入 PCL2 / 官方 `.minecraft` 文件夹、HMCL MultiMC 整合包、zip / mrpack / CurseForge manifest 整合包 |
| 更新与公告 | 启动自动检查 + 每 6 小时检查；远程公告、未读标记、设置页手动检查 |
| 其他 | 下载队列、错误复制弹窗、日志复制、主题色、内存/GC/JVM 参数、快捷打开目录、OptiFine 安装 |

---

## 三、自动更新与公告

启动器启动约 2.5 秒后自动检查，之后每 6 小时检查一次。也可以在
「设置 → 更新」里手动点击「检查更新」。

远程文件放在 GitHub 仓库根目录：

```text
update.json         最新版本、发布日期、更新说明、下载页
announcements.json  公告列表（支持置顶、标签、日期、链接、过期时间）
```

地址：

```text
https://raw.githubusercontent.com/MC-Enderman7810/EndermanMineCraftLauncher/main/update.json
https://raw.githubusercontent.com/MC-Enderman7810/EndermanMineCraftLauncher/main/announcements.json
```

行为：

- 新版本：顶栏出现「新版本」标记，主页出现更新卡片，可查看说明并打开下载页。
- 新公告：顶栏出现「N 条新公告」，主页显示公告卡片，可标记已读。
- 网络失败不会阻塞启动；设置页会显示最近一次检查的错误。
- 下载按钮只允许打开 EMCL 官方 GitHub 地址，不会执行远程文件。

发布新版本时，先改 `package.json` 的 version，再改 `update.json` 的 version 和说明，最后推送。

---

## 四、微软登录说明

登录链路：

```
OAuth2 授权码
  → login.microsoftonline.com/consumers/oauth2/v2.0/token
  → user.auth.xboxlive.com/user/authenticate   (RpsTicket=d=<access_token>)
  → xsts.auth.xboxlive.com/xsts/authorize
  → api.minecraftservices.com/authentication/login_with_xbox
  → api.minecraftservices.com/minecraft/profile
```

默认且仅保留 **Azure Entra** 登录方式，公共 Minecraft Live client id 已移除。

实现要点：

- Azure 应用：Personal Microsoft accounts only。
- 重定向 URI：`https://login.microsoftonline.com/common/oauth2/nativeclient`
- 授权码换 token 时带 `scope`，不需要 Live 的 `cobrandid`。
- Xbox Live 的 `RpsTicket` 必须带 `d=` 前缀。
- 每次尝试都会写入 `%APPDATA%\emcl-launcher\logs\auth.log`，失败时先看这个文件。

如果微软页面要求「验证你的电子邮件 / 验证你的身份」，这是微软针对新设备或风险登录
的风控步骤，必须在该窗口内完成邮件验证码或身份验证；启动器无法绕过，也不会索取密码。
完成后再回到启动器即可。

> **重要：Azure client id 必须获得 Minecraft Services 白名单。**
> 新注册的 Azure 应用通常会在 `/authentication/login_with_xbox` 返回
> 403 `Invalid app registration`，仅在 Azure 里勾选 `XboxLive.signin` 不够。
> 需要通过 <https://aka.ms/AppRegInfo> 或
> <https://aka.ms/mce-reviewappid> 申请。未获批准前，微软登录会失败。
> 客户端 ID 可以在「设置 → 账户高级」中查看和替换。

---

## 五、从源码运行 / 构建

环境：Node.js 24+、Windows x64。

```powershell
cd "$env:USERPROFILE\Documents\EMCL"
npm install
npm start
```

打包：

```powershell
npx electron-builder --win dir --x64
# 产物：dist\win-unpacked\EMCL.exe
```

当前仓库的 `cache-electron/dist` 是 Electron 38.8.6 的 Windows x64 二进制；
`package.json` 里的 `electronDist` 指向它，因此构建时不依赖 GitHub 下载。

---

## 六、数据来源与边界

- 版本 JSON / jar / libraries / assets：Mojang 官方或 BMCLAPI 镜像。
- 模组、光影、资源包、数据包、整合包：Modrinth 官方 API 与 `cdn.modrinth.com`。
- 加载器：Fabric Meta、Quilt Meta、MinecraftForge Maven、NeoForged Maven。
- Java：Adoptium API，失败时回退清华镜像。

已知边界：

1. CurseForge manifest 的远程 `files[]` 需要 CurseForge API Key，当前只导入基础版本、
   加载器与 `overrides/`；不会伪称模组已下载。
2. 微软登录完全由微软官方页面处理；账户被要求身份验证时必须人工完成。
3. 请只使用你拥有合法授权的 Minecraft 账户与游戏文件。

---

## 七、目录结构

```
EMCL/
├── src/
│   ├── main/
│   │   ├── main.js          Electron 主进程与 IPC
│   │   ├── store.js         配置/账户持久化
│   │   ├── minecraft.js     版本清单、下载、扫描、补全
│   │   ├── java.js          Java 探测与下载
│   │   ├── loader.js        Fabric / Quilt / Forge / NeoForge
│   │   ├── auth.js          离线 / 微软 / 第三方
│   │   ├── launch.js        启动参数装配与进程
│   │   ├── modrinth.js      Modrinth API
│   │   ├── content.js       本地内容管理
│   │   ├── modpack.js       整合包导入
│   │   └── util.js          下载、哈希、解压、路径安全
│   ├── preload.js           contextBridge 白名单
│   └── renderer/            原生 HTML/CSS/JS 界面
├── assets/                  图标
└── package.json
```
