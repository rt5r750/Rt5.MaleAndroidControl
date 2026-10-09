<div align="center">

<img src="design/launcher-assets/logo.png" width="110" alt="Rt5">

# Rt5 · 仿人男性机器人控制台

**ASFR 向 · 线下控制软件**：面向实体 **T31-750 型仿人男性机器人**的多端协同控制台 —— 一套共享前端 + 控制台 App / 机器人端 App / WearOS 手表端 / Windows 桌面端，端间以自定义 BLE GATT 协议**在本地直连**（除语音引擎外不依赖云端）。

[English](README.md) · **简体中文**

![platform](https://img.shields.io/badge/platform-Android%20%7C%20Wear%20OS%20%7C%20Windows-blue)
![license](https://img.shields.io/badge/license-MIT-green)
[![release](https://img.shields.io/github/v/release/rt5r750/Rt5.MaleAndroidControl)](https://github.com/rt5r750/Rt5.MaleAndroidControl/releases)

</div>

> 本项目是虚构产品，**ASFR 向**：面向实体仿人男性机器人的本地私有控制链路。产品设定与文案含成人向内容，公开仓库仅供技术参考。

## 各客户端与作用

系统分为**控制端（Master）**与**接收端（Slave）**：控制端负责控制与状态分发，接收端负责接收展示，其中机器人端还可反向下发指令。

| 客户端 | 应用名 | 运行环境 | 作用 |
|---|---|---|---|
| 控制台（控制端） | **MACS** | Android 手机/平板（12+）、Windows 10/11 | 完整控制台：模式切换、控制按钮、情绪滑杆、运行参数、终端与全部设置；对外广播蓝牙供其余端连接 |
| 机器人端（接收端） | **Slave** | Android 手机（7.0+） | 随机器人携带：显示模式、情绪、任务与语音消息，并可反向推送模式或语音指令；图标为蓝色调以与 MACS 区分 |
| 手表端 | 750接收端 | Wear OS | 腕上状态速览：情绪、任务、最近语音；自行保持 BLE 连接 |
| 浏览器版 | — | 任意现代浏览器 | 同一套控制台的网页版：可一键缓存整站以实现秒开与离线，并带 App 拉起/下载引导；无蓝牙，适合查看或未安装 App 时使用 |

命名说明：**控制台**在各平台都叫 MACS（Android 控制台 App 与 Windows 桌面端是同一套控制台），**机器人端手机 App** 叫 Slave。两者的 Android 包名与 BLE 设备名（`RobotControl-*`）均保持不变，升级与既有配对不受影响。

## 演示

- **宣传片** —— <https://x.com/rt5_750/status/2107868637948440956>
- **下载** —— [Releases](https://github.com/rt5r750/Rt5.MaleAndroidControl/releases)：`MACS-Android-*.apk`（控制台）、`Slave-Android-*.apk`（机器人端）、`MACS-Windows-*.zip`（Windows 便携版）

## 使用说明书

覆盖全部客户端与全部功能的完整说明（中英双语）：

- [使用说明书（简体中文）](www/doc/manual/manual.zh-CN.md)
- [User manual (English)](www/doc/manual/manual.en.md)

同一份说明书已内置进控制台（HTML 版），可在 **信息面板 → 文件与链接 → App 使用说明书** 中打开，按界面语言显示对应版本。

## 界面

以下为宣传片截帧（界面本身即英文版）。

**一套控制台，三块屏** —— 桌面控制台、手机控制台、WearOS 手表端。

![一套控制台，三块屏](docs/screenshots/ends-overview.jpg)

**控制台 · 桌面布局**（Windows 端 / 宽屏浏览器）：运行参数、控制面板、代码与日志面板、信息参数表。

![控制台桌面布局](docs/screenshots/console-desktop.jpg)

<img src="docs/screenshots/console-panels.jpg" width="49%" alt="实时的子系统面板">
<img src="docs/screenshots/first-run-setup.jpg" width="49%" alt="首次使用设置">

**控制台 · 手机布局** 与 **机器人端 App**。

<img src="docs/screenshots/console-mobile.jpg" width="49%" alt="控制台手机布局">
<img src="docs/screenshots/slave-app.jpg" width="49%" alt="机器人端 App">

## 端与仓库结构

| 目录 | 说明 | 技术栈 |
|---|---|---|
| `www/` | **三端共用的唯一前端主线**（控制台页面、样式、字体、词典、素材）；所有同步副本一律由它生成 | 原生 HTML/CSS/JS（Tailwind 已静态化，运行时零外链） |
| `master-app/` | **MACS** 控制台 App：WebView 壳 + BLE GATT Server + 外链处理 | Kotlin，compileSdk/targetSdk 34，minSdk 31 |
| `slave-app/` | **Slave** 机器人端 App：模式 / 情绪 / 任务 / 连接面板，本地语音识别按读音匹配四大模式 | Kotlin，minSdk 24 |
| `watch-app/` | WearOS 手表端：保活前台服务、模式切换震动、连接状态 | Kotlin，minSdk 31 |
| `win-app/` | **MACS** Windows 桌面端：Electron 主程序 + C# BLE 宿主 + 启动器窗口 + 闪屏入口 | Electron 43 + Node + .NET 8 |
| `design/` | 启动器 UI 设计稿与精灵图素材 | 原生 HTML/CSS/Canvas |
| `tools/` | 构建辅助：`gen-mono-narrow.py`（英文窄体字体生成）、`web-build`（Tailwind 静态化 + 缓存清单）、`manual-build`（说明书 Markdown → 站内 HTML）、`i18n-check`（翻译覆盖检查） | Python / Node |
| `docs/` | 开发文档群，入口 [`docs/reademe.md`](docs/reademe.md) | Markdown |

## 快速开始

**环境要求**：JDK 17、Android SDK（Platform 34 / Build-Tools 34）、Node.js 20+、.NET 8 SDK、PowerShell 7、Python 3（可选，仅重新生成窄体字体时需要 `fonttools`）。

### 共享前端 `www/`

改动 `www/` 下任何内容后必须重新生成静态产物：

```bash
cd tools/web-build
npm install
npm run build        # 依次重生成 tailwind.css、doc/manual/*.html、cache-manifest.json
npm run check:i18n   # 翻译覆盖检查：界面文案无缺项、英文资料不含中文
```

### 控制台 / 机器人端 / 手表端

```bash
cd master-app && ./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk
cd slave-app   && ./gradlew assembleRelease
cd watch-app   && ./gradlew assembleRelease
```

`master-app` 构建前会自动执行 `syncWww`，把仓库根 `www/` 同步进 `app/src/main/assets/www/`（该副本为生成物，不入库）。

### Windows 桌面端

```bash
cd win-app
npm install
npm start                    # 开发运行（prestart 会把 www 同步到 app/www）
npm test                     # node --test；先跑 pwsh scripts/sync-www.ps1 同步前端副本
npm run dist                 # predist：dotnet publish BLE 宿主 + 同步 www，再走 electron-builder
pwsh scripts/package-with-splash.ps1   # 组装 runtime/ 与双击入口 exe
```

语音播报 / 识别需要在使用时于应用设置内填入服务商 API Key，仓库不含任何密钥。

## 仓库结构（哪些入库、哪些由脚本生成）

只跟踪源码、文档与素材；带 ⚙ 的目录由脚本生成、已被 `.gitignore` 排除。发布产物一律走 [Releases](https://github.com/rt5r750/Rt5.MaleAndroidControl/releases)，不进仓库。

```
Rt5.MaleAndroidControl/
├── www/                              ✔ 共享前端唯一主线
├── master-app/                      ✔ Kotlin 源码
│   └── app/src/main/assets/www/      ⚙ 由 Gradle syncWww 生成
│   └── app/build/                    ⚙ 构建产物
├── slave-app/  watch-app/            ✔ Kotlin 源码（app/build/ 为 ⚙）
├── win-app/                          ✔ Electron 与 C# 源码（app/、ble-host/*.cs、scripts/、test/）
│   ├── app/www/                      ⚙ 由 scripts/sync-www.ps1 生成
│   ├── ble-host/{bin,obj,publish}/   ⚙ dotnet publish 产物
│   ├── {dist-new,runtime}/           ⚙ electron-builder 与打包产物
│   ├── node_modules/                 ⚙ npm install 生成
│   ├── build/icon.ico                ✔（electron-builder 资源）
│   └── huancun/                      ⚙ 运行期用户数据，从不发布
├── design/                           ✔ 启动器设计稿与素材
├── tools/                            ✔ 构建辅助（web-build / manual-build / i18n-check）
└── docs/                             ✔ 开发文档群
```

```bash
git ls-files | wc -l            # 实际入库的文件
git status --ignored --short    # 只在本地保留的内容
```

## 文档

[开发文档群入口](docs/reademe.md) · [整体架构](docs/architecture.md) · [BLE 协议](docs/ble-protocol.md) · [数据模型](docs/data-models.md) · 各端说明：[master-app](docs/master-app/reademe.md) · [slave-app](docs/slave-app/reademe.md) · [watch-app](docs/watch-app/reademe.md) · [win-app](docs/win-app/reademe.md)

## 许可

[MIT](LICENSE)