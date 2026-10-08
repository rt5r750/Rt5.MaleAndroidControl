<div align="center">

<img src="design/launcher-assets/logo.png" width="120" alt="Rt5">

# RobotControl · 芮誊T系列仿人男性机器人控制台

多端协同的机器人控制台：一套共享前端 + 控制台 App / 机器人端 App / WearOS 手表端 / Windows 桌面端，端间以 BLE GATT 自定义协议互联。

![platform](https://img.shields.io/badge/platform-Android%20%7C%20WearOS%20%7C%20Windows-blue)
![license](https://img.shields.io/badge/license-MIT-green)

</div>

> 本项目是虚构产品（Rt5 A.I. Fictional Liability Company）的界面与控制逻辑实现，产品设定与文案含成人向内容，仅供技术参考。

## 端与仓库结构

| 目录 | 说明 | 技术栈 |
|---|---|---|
| `www/` | **三端共用的唯一前端主线**：控制台页面、样式、字体、词典与素材（同步副本一律从它生成，禁止手工拷贝） | 原生 HTML/CSS/JS（Tailwind 已静态化，运行时零外链） |
| `android-app/` | 控制台 Android App：WebView 壳 + BLE GATT Server + 外链处理 | Kotlin，compileSdk/targetSdk 34，minSdk 31 |
| `phone-app/` | 机器人端 Android App：模式/情绪/任务/连接面板，语音识别（四大模式按读音匹配） | Kotlin，minSdk 24 |
| `watch-app/` | WearOS 手表端：保活前台服务、模式切换震动、连接状态 | Kotlin，minSdk 31 |
| `win-app/` | Windows 桌面端：Electron 主程序 + C# BLE 宿主 + 启动器窗口 + 闪屏入口 | Electron 43 + Node + .NET 8 |
| `design/` | 启动器 UI 设计稿与精灵图素材 | 原生 HTML/CSS/Canvas |
| `tools/` | 构建辅助：`gen-mono-narrow.py`（英文窄体字体生成）、`web-build`（Tailwind 静态化 + 缓存清单） | Python / Node |
| `docs/` | 开发文档群，入口 [`docs/reademe.md`](docs/reademe.md)（整体架构 / BLE 协议 / 数据模型 / 各端说明） | Markdown |

## 快速开始

**环境要求**：JDK 17、Android SDK（Platform 34 / Build-Tools 34）、Node.js 20+、.NET 8 SDK、PowerShell 7、Python 3（可选，生成窄体字体时需要 `fonttools`）。

### 共享前端 `www/`

`www/` 是三端唯一的页面来源；改动 `www/` 下的 class/样式后必须重新生成静态产物：

```bash
cd tools/web-build
npm install
npm run build        # 重新生成 www/css/tailwind.css 与 www/cache-manifest.json
```

### android-app（控制台 APK）

```bash
cd android-app
./gradlew assembleRelease      # 产物 app/build/outputs/apk/release/app-release.apk
./gradlew assembleDebug        # 迭代用；adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`preBuild` 会自动执行 `syncWww`，把仓库根 `www/` 同步进 `app/src/main/assets/www/`（该副本不入库，本地构建自动生成）。

### phone-app / watch-app

```bash
cd phone-app && ./gradlew assembleRelease
cd watch-app && ./gradlew assembleRelease
```

### win-app（桌面端）

```bash
cd win-app
npm install
npm start                      # 开发运行（prestart 会先同步 www 到 app/www）
npm test                       # node --test；先跑 pwsh scripts/sync-www.ps1 同步前端副本
npm run dist                   # predist：dotnet publish BLE 宿主 + 同步 www，再走 electron-builder
pwsh scripts/package-with-splash.ps1   # 组装 runtime/ 与双击入口 exe
```

语音播报/识别（TTS / ASR）需要使用者自行在应用设置中填入服务商 API Key，仓库不含任何密钥。

## 仓库结构（哪些入库、哪些由脚本生成）

同一棵目录树里既有源码也有构建产物：**只跟踪源码/文档/素材**（带 ⚙️ 的目录由脚本生成，已在 `.gitignore` 中排除）；发布产物走 [Releases](../../releases)，不进仓库。

```
RobotControl/
├── www/                              ✔ 前端唯一主线（页面/样式/字体/词典/素材）
├── android-app/                      ✔ 控制台 App 源码
│   └── app/src/main/assets/www/      ⚙ 构建期由 Gradle syncWww 从 www/ 生成
│   └── app/build/                    ⚙ Gradle 构建产物
├── phone-app/  watch-app/            ✔ 机器人端 / 手表端源码（app/build 为 ⚙ 产物）
├── win-app/                          ✔ 桌面端源码（app/、ble-host/*.cs、scripts/、test/、splash-loader/源码）
│   ├── app/www/                      ⚙ npm start/dist 前由 scripts/sync-www.ps1 从 www/ 生成
│   ├── ble-host/{bin,obj,publish}/   ⚙ dotnet publish 产物
│   ├── {dist-new,runtime}/           ⚙ electron-builder 与 package-with-splash 产物
│   ├── node_modules/                 ⚙ npm install 生成
│   ├── build/icon.ico                ✔（electron-builder 资源，仍入库）
│   └── huancun/                      ⚙ 运行期用户数据（localStorage、设备绑定等），不入库
├── design/                           ✔ 启动器设计稿与精灵图素材
├── tools/                            ✔ 构建辅助（窄体字体生成、Tailwind 静态化；node_modules 为 ⚙）
└── docs/                             ✔ 开发文档群
```

查看实际入库内容与生成物：

```bash
git ls-files | wc -l        # 入库文件数（约 300）
git ls-files android-app    # 某个目录里到底有没有入库
git status --ignored --short   # 被 .gitignore 排除（只在本地）的内容
```

## 相关文档

- [开发文档群入口](docs/reademe.md) ｜ [整体架构](docs/architecture.md) ｜ [BLE 协议](docs/ble-protocol.md) ｜ [数据模型](docs/data-models.md)
- 各端说明：[android-app](docs/android-app/reademe.md) · [phone-app](docs/phone-app/reademe.md) · [watch-app](docs/watch-app/reademe.md) · [win-app](docs/win-app/reademe.md)

## 许可

[MIT](LICENSE)