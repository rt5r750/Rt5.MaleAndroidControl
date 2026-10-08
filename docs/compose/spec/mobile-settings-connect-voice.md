---
feature: mobile-settings-connect-voice
status: delivered
updated: 2026-10-07
branch: main
commits: 03ba035（v1.6.0 基线）.. c08ff38（v1.9.0）
---

# 移动端设置 UI、连接稳定性、外链打开与语音识别收口

## Report

**What was built** — 手机端（android-app WebView / 手机浏览器）设置页一级列表与主界面内容边距对齐（卡片 16..396px＝主内容边距、卡片高 56px、间距 12px、组名 17px、图标 1.6rem），一级 ↔ 二级补 240ms 位移+淡入过渡，底部操作条的「改为默认设置 / 取消 / 应用更改」上移到顶栏右侧成为三枚 36px 圆形图标按钮（点击转发底部同 id 按钮，行为单源）；修好二级设置组滑不动（`.settings-columns` 缺 flex 高度链，内容被 `.settings-content{overflow:hidden}` 裁掉）与一级列表滚动。android-app 侧把设置里的外链（MiMo 官网、夸克网盘、Telegram，含 `target="_blank"`）从「在控制台 WebView 内原地导航顶掉界面」改为交给系统默认浏览器（`handleUrlLoading` → `openExternalBrowser()`，站内资源与锚点不受影响），win-app 两个窗口补 `will-navigate` 兜底。连接链路按「权限前置 + 全段异常兜底」加固：android-app 补 `BLUETOOTH_ADVERTISE` 校验、`setName` 与广播拆成独立段、连接态/MTU/读写/通知回调全部 `runCatching`、扫描器缓存独立重试（修掉我引入的粘性失败）、桥入口补权限校验与提示；phone-app 扫描回调、取址、初始化、所有连接入口同样收口。语音识别复核后补了「连续 3 次错误即退化」的低功耗策略（不再每 300ms 无限重启）与一套 JVM 单测。

**Verification** — `phone-app ./gradlew :app:testReleaseUnitTest` 10/10 通过；`phone-app`/`android-app` `assembleRelease` 均 BUILD SUCCESSFUL（APK 19:23 / 19:52，dex 抽验含全部新加固字符串与 1.7.1 语音/反向推送特征）；`tools/web-build npm run build` 通过（cache-manifest `9f876994dd45`）；headless Chromium 在 412×915 与 900×700（含摘掉 `desktop-chrome` 模拟 Android WebView）实测卡片对齐/滚动/动画/三按钮行为，桌面菜单模式（1440×900）底部操作条与左侧栏未变，EN 模式几何与中文一致且 `aria-label` 已翻译；Android 12 真机版 AVD（`Phone_Android12`）安装改前基线 APK 与改后 APK 对照：权限齐全与吊销 `BLUETOOTH_ADVERTISE` 两种情形点击「开始连接」均无 FATAL（**用户报告的闪退未复现**），phone-app 圆钮点击 → `local recognizer started` → 连续失败后退化停止、进程存活，android-app 重建后 GATT 服务 7500 注册成功。win-app `runtime/`（19:38 构建）与 `RobotControl-Console.exe` 已重新组装并抽验内嵌 www 为本轮版本。

**Journey log**

- MiMo Desktop 本体（Xiaomi MiMo.exe）会锁住 electron-builder 输出目录里的 `resources/default_app.asar`：同一目录二次构建必失败（`EBUSY: unlink default_app.asar`），Restart Manager 定为宿主 App 持锁，改「每次换全新输出目录 + `package-with-splash.ps1 -ElectronUnpackedDir`」绕过；失败的构建会先把输出目录删空，被 git 跟踪的 `win-app/dist-new` 因此被清空，需 `git checkout -- win-app/dist-new` 还原。
- 直接跑 `npx electron-builder` 会跳过 `predist` 的 `sync-www.ps1`：必须手动先同步，否则打出的包内嵌旧 www（本轮曾因此产出一次旧 CSS 的 runtime，重新同步后重打）。
- www 验证必须绕开 Service Worker 的 cache-first（否则量到旧 CSS）；并且测量几何前要冻结 `transition/animation`，否则会量到设置弹窗开场 `scale(.95)` 的中间态——曾据此误判「EN 模式比中文多 10px 内缩」。
- 模拟器截图是物理像素、按目测坐标点会点空（1080×2400 下按钮实际在 y≈2111）；改用 PIL 按按钮填充色扫 bbox 求中心再 `adb input tap` 才可靠。单台模拟器的虚拟 BT 控制器不支持应用间发现，android-app ↔ phone-app 的真实连接只能真机验证。
- 闪退未能复现 → 结论只能是「按静态分析逐点加固」而非「已修复闪退」；真机 logcat/tombstone 才能定论，这一点必须对用户直说。

## [S1] Problem

本轮四条用户可见问题（均在 1.7.1 未提交工作区之上）：

1. **移动端设置页太挤**——一级导航卡片贴着屏幕边缘（未与主界面内容边距对齐）、卡片间距偏小、图标与组名偏小；一级 ↔ 二级硬切无过渡；底部三按钮在一级被隐藏、二级要滑到底才可用；部分二级组滑不动。
2. **连接点击闪退**——用户在 Android 12 真机 release 包点击连接即闪退、phone-app 随之连不上；需在两端受支持版本范围内（phone-app `minSdk 24`、android-app `minSdk 31`）排除同类问题。
3. **语音识别未在 release 包得到确认**——需要复核完整性并重新打包。
4. **设置里的 MiMo 链接在 App 内打开**——android-app WebView 未拦截外链，会在控制台 WebView 内原地导航顶掉界面。

## [S2] Design

### [S2.1] 移动端设置一级/二级界面（仅移动端，桌面菜单模式不变）

- **两级门控必须同口径**：移动端形态的 JS/类门控是 `html:not(.desktop-chrome)`（Android WebView 任意宽度），样式写在 `@media (max-width:749px)`（手机浏览器亦需命中）——因此移动端样式存在两处等价分支，Android 平板/横屏（≥750px）同样得到顶栏三按钮与可滚动列表，win-app 与浏览器带 `desktop-chrome` 不受影响。
- 一级卡片：左右与主界面内容边距对齐（1rem）、卡片间距 12px、`min-height:3.5rem`、组名 17px、图标 1.6rem/1.15rem；一级列表 `overflow-y:auto`。
- 二级滚动：`.settings-columns` 补 `display:flex; flex-direction:column; flex:1 1 auto; min-height:0`，使 `.settings-body`（`flex:1 1 auto; min-height:0; overflow-y:auto`）成为真正的滚动容器。
- 顶部栏三圆形图标：底部操作条在手机宽度下一律隐藏，`.modal-mobile-actions` 三枚 36px 圆形按钮置于 `.modal-mobile-header` 右侧、标题占满剩余宽度；点击转发 `#reset-settings`/`#cancel-settings`/`#save-settings`（桌面仍用底部操作条）；EN 经 `aria-label` 翻译。
- 一级 ↔ 二级：`sm-detail-in` / `sm-nav-in`（240ms 位移 1rem + 淡入），由既有 `settings-mobile-detail` 类切换驱动，`prefers-reduced-motion` 自动降级。

### [S2.2] 设置内外部链接交由系统默认浏览器

- android-app：`handleUrlLoading()` 拦截主框架 http(s)（含 `target="_blank"`）→ `openExternalBrowser()`（`ACTION_VIEW`）；`file:///android_asset`、blob/about 与页内锚点不拦截；JS 桥 `openExternalUrl` 复用同一实现。
- win-app：两个窗口 `setWindowOpenHandler` + `will-navigate` 双层接管，避免壳内导航。
- 纯网页端保持新标签页（零 JS 拦截）。

### [S2.3] 连接链路稳定性（android-app + phone-app，Android 24~34）

- 原则：BLE 回调运行在 BLE 线程上，**异常逃出即进程崩溃** → 「受权限约束的取值前置校验 + 回调整段 `runCatching`」成对使用。
- android-app：ADVERTISE 前置校验；`setName` 与广播拆成两段独立 `runCatching`（顺序仍先改名，保证首个广告包带正确名）；`startServer`/服务重加/连接态/MTU/读写/描述符/通知发送链路全部收口；`sendGattResponse()` 统一回包；扫描器与 manager 分开缓存、失败可重试；桥入口与 `startBleServices` 补权限校验与可见提示。
- phone-app：扫描回调 `device.name`/`device.address`、`connectInternal` 取址、`initialize`、`isBluetoothEnabled` 收口；`connectToConsole()` 统一所有连接入口；`startBleServices` 自动连接段 try/catch。
- 判定：两端点击连接不再闪退；失败时只回退状态与提示。

### [S2.4] 语音识别收口（仅 phone-app）

- 复核 1.7.1 链路（圆钮常态保持、前台/后台功耗口径、本地规则四大模式读音 + 否定词 + 中英门控、云端兜底门槛、与 TTS 共用 Key、命中即同一条反向推送链路）。
- 补**低功耗退化与可用性回退**（1.9.1 定型）：同一本地引擎连续 3 次识别错误（`ERROR_NO_MATCH`/`ERROR_SPEECH_TIMEOUT` 除外）即换下一级引擎（设备端离线 → 系统识别器离线优先 → 系统识别器允许联网），三级全失败才「有云端条件切仅云端，否则关闭并提示」；`ERROR_INSUFFICIENT_PERMISSIONS` 直接停，其余含偶发 `ERROR_CLIENT` 计入计数；只有 `onResults` 才清零计数。
- 补**系统识别服务可见性**声明（`<queries>` → `android.speech.RecognitionService`）：Android 11+ 包可见性过滤下缺失会令本地识别恒判不可用。
- 补 JVM 单测覆盖本地规则；功能必须进 release APK（dex 抽验）。

### [S2.5] 构建与文档

- www 改动 → 重建 `tailwind.css` 与 `cache-manifest.json`，并重打 phone-app / android-app release APK 与 win-app 产物（watch-app 未改不打包）。
- 文档按 `docs/reademe.md` 归属更新（1.8.0 版本记录、architecture 机制、各端 reademe），删除与代码不符的旧陈述；收尾清理临时文件与进程。

## [S3] Out of Scope

- 桌面菜单模式（`html.desktop-chrome`）的设置弹窗、左侧栏、底部操作条样式与交互。
- watch-app 与 BLE 协议本身（UUID、特征属性、分片、Mode 反向推送协议 1.7.1 已定稿）。
- 两端原生 UI 主题体系与既有页面布局（除连接链路必要加固）。
- 新增识别语言/引擎、唤醒词类常驻监听。
- 登录、激活引导、型号信息、配置导入导出等既有功能。

## Tasks

- [x] T1: 移动端设置一级卡片视觉收紧 — acceptance: 手机宽度下卡片左右边缘与主内容边距一致、间距加大、图标与组名加大；桌面菜单模式不变 → 实测 16..396 / 56px / 12px / 17px；桌面 nav-item 12.8px 未变 (covers: S2.1)
- [x] T2: 一级↔二级过渡动画 — acceptance: 进出二级均可观测过渡且返回后滚动位置正确 → 动画中段采样 opacity 0→0.39→0.79→0.97 且 translateX 16→0（返回 -16→0），返回后列表恢复可滚 (covers: S2.1)
- [x] T3: 底部三按钮改为移动端顶栏三圆形图标 — acceptance: 移动端一/二级顶栏右侧均有三枚圆形图标且触发原逻辑；桌面底部操作条不变 → 实测 272..396/36px 三枚；reset→确认框→`resetSettings`、cancel→关闭、apply→保存链路；桌面 footer 仍 `flex` (covers: S2.1)
- [x] T4: 修复移动端二级界面滚动 — acceptance: 每个二级组在手机宽度下可滚到底 → 机器人状态设置 1205px 组 `scrollHeight 1265 > clientHeight 850`、`scrollTop 415`；一级列表 896>814 (covers: S2.1)
- [x] T5: MiMo 外链走系统默认浏览器（android-app + win-app） — acceptance: 点链接不改 WebView 页面且系统浏览器打开；纯浏览器端新标签页 → 代码路径 + 站内资源豁免规则实测（`handleUrlLoading` 仅拦 http(s)）；win-app 双层接管 (covers: S2.2)
- [x] T6: 连接闪退根因定位与修复（android-app） — acceptance: 给出根因证据并修复 — **部分达成**：静态分析定位出 6 处可崩点并逐一加固、重建后 GATT 服务注册成功；但 AVD 对照实测（含吊销 ADVERTISE）**未复现**用户报告的闪退，故「根因」为推断而非实证，待真机 logcat 定论 (covers: S2.3)
- [x] T7: 连接链路全版本加固（phone-app） — acceptance: 连接/断开/扫码链路异常均被吞并提示，release 包实测不闪退 → Android 12 AVD 安装+点击无 FATAL，扫描/取址/初始化全部收口 (covers: S2.3)
- [x] T8: 语音识别本地规则单测与缺口修复 — acceptance: 单测覆盖读音/否定词/门控并通过；退化路径有正确提示 → 10/10 通过；退化策略补入并实测（`local recognizer started` → 退化 `stopped`）(covers: S2.4)
- [x] T9: tailwind 重建与三端打包 — acceptance: 产物更新且抽验含本轮特征 → `npm run build`（`9f876994dd45`）；phone-app 369,984B / android-app 31,377,597B release APK、win-app `runtime/`+入口 exe 重新组装，dex/内嵌 www 抽验通过 (covers: S2.5)
- [x] T10: 实测验证 — acceptance: 记录命令与结果，移动端与桌面端无回归 → 见 Report 的 Verification 段 (covers: S2.1, S2.2, S2.3)
- [x] T11: 文档群更新与临时文件清理 — acceptance: 文档与代码一致、无冗余旧陈述；临时脚本/截图/探针/进程清空 → 版本记录 1.8.0 + architecture + phone-app/android-app/win-app 模块文档更新；`%TEMP%\rc_*` 与本会话启动的静态服务/模拟器已清理（详见交付说明） (covers: S2.5)