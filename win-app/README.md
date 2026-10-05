# RobotControl 控制台（Windows 版）

将 android-app 的网页控制台（Kotlin + WebView + HTML/JS）迁移为 Windows 桌面应用，默认以 1440×900 宽屏打开，自动进入页面的桌面三栏布局。

## 运行

- 直接双击 `RobotControl-Console.exe`（无窗口 C# 启动器，拉起 Electron 后立即退出）即可进入控制台；运行时位于同目录 `runtime/`。2026-08-08 起已打包产物（`RobotControl-Console.exe` + `runtime/`）整理至项目根目录 `_unused\win-app\`，需要运行时先执行 `scripts\package-with-splash.ps1` 重新生成。
- 默认账号：`admin` / `T31750`。
- 启动流程：双击 `RobotControl-Console.exe`（无窗口 C# 启动器，拉起 Electron 后立即退出）→ 启动器直接出现（冷启动约 0.5s、常规约 1.0~1.3s，无前序加载界面）→ 识别/测试模式连接后点击设备按钮（立即弹出“正在进入控制台”遮罩）→ 主窗口即时显示轻量闪屏页（Rt5Open_169.mp4 横屏视频、无文字，点击/任意按键立即跳过）→ 登录页 → 三栏控制台。
- 主控制台为无边框窗口，标题栏为**系统级 Acrylic 深色毛玻璃**（与启动器同一 DWM 机制，body 透明、网页背景下沉到 40px 以下、标题栏透出桌面；条带暗绿渐变 + blur 22px）：左侧返回按钮与右侧窗口按钮完全同款（46×40 方形、紧贴左缘、悬停/按压动画与颜色一致），图标统一 12×12px，标题使用 Win11 风格字体（Segoe UI Variable 12px 近白）；右侧全屏/最小化/最大化还原/关闭（仿 Win11 指示器，最大化图标自动切换）；网页内背景图与网页内模糊（`header` blur 16px）保持原版；全屏时标题栏隐藏，Esc/F11 退出。启动器仍为无边框 + Acrylic 毛玻璃 + 右上角自绘最小化/关闭；顶栏空白处可拖拽移动窗口；应用图标与 Android-app 的 launcher 图标一致。
- 本地资源通过固定 `app://design`（启动器）/ `app://bundle`（控制台）协议加载（不再使用随机端口），localStorage（启动器 USB 规则、账号记忆、任务、TTS Key 等）跨启动稳定持久化。

## 功能与桥接说明

前端资源为 android-app `assets/www` 的原样副本（仅修正了使用说明书的 PDF 路径，原路径指向不存在的 www 根目录）。

| 功能 | Windows 实现 |
|------|-------------|
| 安全区 / 输入法 | 桌面无手机安全区，返回 0 |
| 外链 / PDF | 系统浏览器打开 / 系统默认 PDF 程序打开；宽屏模式内嵌 PDF 阅读器 |
| 二维码 | 生成含 `RobotControl-Win` 配对信息的 QR 图（使用宿主真实 MAC，phone-app 可扫码直连） |
| 蓝牙连接 | Windows GATT Service Provider 外设模式：`ble-host/`（C#）广播 `RobotControl-Win`，phone-app 扫描/扫码连接后实时接收 Mode/Emotion/Tasks/Voice；适配器不支持外设模式时提示并保持未绑定 |
| MiMo TTS | API Key/引擎持久化到本地存储；浏览器请求失败时经主进程代理（无 CORS 限制）；音频经 preload 播放并回调 `__ttsOnComplete` |
| localStorage | 持久化在代码根目录 `huancun/userData/`（自动迁移旧 `%APPDATA%` 数据） |
| USB 前置启动器 | PowerShell WMI 轮询可移动盘（DriveType=2 反查物理磁盘）+ 多设备匹配规则（支持 deviceId/卷标/盘符，设置面板自动扫描）；F2 测试模式；huimo/color 精灵图状态机；点击进入控制台 |

窗口控制说明：启动器为无边框（非透明）+ `setBackgroundMaterial('acrylic')` 毛玻璃圆角窗口（DWM 原生圆角/阴影），右上角自绘仿 Win11 最小化/关闭（IPC 调原生窗口方法，保留系统动画）；主控制台为无边框窗口 + 系统级 Acrylic 深色毛玻璃标题栏（`window.consoleAPI` → `win-minimize` / `win-maximize-toggle` / `win-close` / `win-fullscreen-toggle` / `win-back-to-launcher`，最大化状态经 `win-maximized` 事件同步图标，全屏状态经 `win-fullscreen` 事件同步）。`app/titlebar-width.js` 保留；`app/titlebar.js` 已删除。

## 体积优化说明

- 前端资源已无损压缩：两个视频（Rt5Open_169 / 750rotation）重新编码为 H.264 CRF27（共约 11MB → 0.9MB），机器人立绘转 WebP（约 4.4MB → 0.46MB），并删除未引用文件（.bak、chart.umd.min.js、login 冗余图）。
- `asar` 已禁用（避免 `app.asar` 锁定导致目录无法删除/更新），压缩级别 maximum，仅保留中英文 locale。
- 体积主体是 Electron 运行时（`runtime/` 约 330MB 展开目录）；若需进一步大幅瘦身（<40MB）需更换运行时壳（如 WebView2/Tauri），属于技术栈变更。

## 开发与构建

```powershell
npm install
npm test        # 核心模块自动化测试（node:test）
npm start       # 开发模式启动（Electron）
npm run dist    # 打包 unpacked 目录到 dist-new/win-unpacked/
```

首次安装 Electron 二进制失败时，使用镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'
```

构建缓存一律放在 D 盘（已写入用户环境变量）：Gradle、npm、Electron 缓存统一在
`D:\11764\HUANCUN\.deps\`（`GRADLE_USER_HOME` / `npm_config_cache` / `ELECTRON_CACHE` / `ELECTRON_BUILDER_CACHE`）。

## 目录

- `app/main.js` — 主进程：本地静态服务、窗口、USB watcher、IPC 桥接
- `app/preload.js` / `app/preload-launcher.js` — 主控制台 / 启动器 preload 桥接
- `app/usb.js` / `app/usb-watcher.js` — USB 设备解析、规则匹配、WMI 轮询与热插拔事件
- `app/protocol-handler.js` / `app/static-responder.js` — 固定 `app://design` / `app://bundle` 协议静态服务（MIME、Range、路径穿越防护）
- `app/splash.html` — 黑色闪屏页
- `splash-loader/` — 无窗口 C# 启动器源码（Program.cs）
- `scripts/` — 打包脚本（package-with-splash.ps1，生成入口 exe + runtime/）
- `app/www/` — 主控制台前端资源（从 android-app 复制，含系统级 Acrylic 毛玻璃标题栏）
- `design/launcher.html` / `design/launcher-assets/` — 启动器页面与精灵图、字体资源
- `test/` — 自动化测试
- `tools/` — CDP 调试脚本（截图/状态/桥接自检，不参与打包）
