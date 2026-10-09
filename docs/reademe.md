# RobotControl 开发文档

## 项目总览

RobotControl 是一个多端协同的机器人控制系统：master-app（控制台，Kotlin+WebView+HTML，GATT Server）作为主控面板，slave-app（手机端，Kotlin原生）和watch-app（手表端，WearOS原生）作为BLE客户端接收状态展示，另有 win-app（Windows 桌面版，Electron）作为控制台的桌面端。数据以 Console 经 BLE Notification 向下推送到 Phone 和 Watch 为主，另有客户端上行通道（Heartbeat 心跳、ApiKey 同步、Mode 反向模式推送）；win-app 通过 C# BLE 外设宿主（Windows GATT Server）广播 `RobotControl-Win`，前端与桥接等效于 master-app 控制台，slave-app 可直接扫描或扫码连接。www 共享前端可直接以浏览器打开（未来托管到网站），并内置 App 拉起引导：网页打开后弹窗引导拉起本机 App（`robotcontrol://console`，手机端拉起 master-app / PC 端拉起 win-app），未安装则引导至夸克网盘下载（https://pan.quark.cn/s/e33470bcc0ef）；纯浏览器端首访为强制缓存流程：「获取完整体验」窗口不可关闭/忽略，必须点击置顶的「缓存网页」按钮完成缓存（`rc_full_cache` 标记）才进入控制台，网页更新后自动提示重新缓存（背景图更新除外）；已缓存用户窗口恢复常规可关闭形态，设置页亦有缓存/拉起/下载三按钮。

## 文档导航

- [整体架构](architecture.md)
- [BLE通信协议](ble-protocol.md)
- [数据模型](data-models.md)
- [master-app（控制台端）](master-app/reademe.md)
- [slave-app（手机端）](slave-app/reademe.md)
- [watch-app（手表端）](watch-app/reademe.md)
- [win-app（Windows 桌面版）](win-app/reademe.md)
- [功能文档：移动端设置 UI、连接稳定性、外链打开与语音识别（v1.8.0 交付，语音识别退化口径 v1.9.1 更新）](compose/spec/mobile-settings-connect-voice.md)

## BLE UUID 速查表

| 项目 | UUID/值 | 说明 |
|------|---------|------|
| Service | `00007500-0000-1000-8000-00805f9b34fb` | 主服务 |
| Mode (7501) | `00007501-0000-1000-8000-00805f9b34fb` | 1字节 READ|WRITE|NOTIFY，mode ordinal(0-3, 255=NA)；双向：控制台下发现状 + phone 反向推送切换（详见 BLE协议文档「反向模式推送」） |
| Emotion (7502) | `00007502-0000-1000-8000-00805f9b34fb` | 4字节，obedience,shame,pleasure,mechanical(各0-100) |
| Tasks (7503) | `00007503-0000-1000-8000-00805f9b34fb` | 可变长，UTF-8 JSON数组，支持分片(0x7E) |
| Voice (7504) | `00007504-0000-1000-8000-00805f9b34fb` | 可变长，UTF-8 JSON对象/数组，支持分片(0x7E) |
| Heartbeat (7505) | `00007505-0000-1000-8000-00805f9b34fb` | 双向心跳检测，1字节序列号 |
| ApiKey (7506) | `00007506-0000-1000-8000-00805f9b34fb` | 可变长，UTF-8 MiMo TTS API Key，phone 写入后服务端保存并回显 |
| UiLang (7507) | `00007507-0000-1000-8000-00805f9b34fb` | 1字节 READ|NOTIFY，0=zh/1=en/255=未设置；控制台界面语言单向推送。**v1.10.0 起 slave-app 不再消费该特征**（界面语言改为本机设备检测 + 手选），服务端（master-app / win-app 宿主）仍照常推送与订阅补发，旧版客户端仍可订阅（详见 BLE协议文档） |
| CCC Descriptor | `00002902-0000-1000-8000-00805f9b34fb` | 客户端特征配置描述符 |
| 分片魔数 | `0x7E` | chunk header 3字节(magic,chunkIndex,totalChunks) |
| 设备名前缀 | `RobotControl-` | BLE设备名称前缀 |

## Mode 枚举速查表

| Ordinal | 名称 | 说明 | 颜色 |
|---------|------|------|------|
| 255 | NA | 未设置/无模式 | #666666(灰色) |
| 0 | TEST | 调试模式 | #8FBC8F(暗绿) |
| 1 | RECOVERY | 恢复模式 | #FB923C(橙色) |
| 2 | LOYALTY | 忠诚模式 | #66CCFF(天蓝) |
| 3 | SIMULATED_HUMAN | 拟人模式 | #F472B6(粉色) |

## 面向AI的使用提示

- 修改代码前先阅读对应模块文档和相关的架构/协议/数据模型文档
- BLE UUID、数据格式、分片协议必须与文档保持一致，不得随意更改
- 文件引用使用 file:/// 绝对路径格式
- 各端数据模型保持一致：Mode枚举顺序、Emotion四个维度顺序、Task字段、VoiceMessage字段
- 前端三端以仓库根 `www/` 为唯一主线；同步、按需资源、平台样式边界和共享交互规则见整体架构文档。**硬性规则：修改 www 下任何 class/样式后必须在 `tools/web-build/` 执行 `npm run build` 重新生成静态 `www/css/tailwind.css` 并提交产物**（Tailwind Play CDN 运行时已替换为同版本 CLI 预编译产物，运行时零联网依赖），详见整体架构文档「前端单源架构」。`npm run build` 还会依次重新生成使用说明书 HTML（`tools/manual-build`；改 `www/doc/manual/*.md` 后必须执行）与 `www/cache-manifest.json`（浏览器端 Service Worker 预缓存清单，新增/删除 www 静态文件后同样执行即可），详见整体架构文档「浏览器端分阶段加载与离线缓存」。
- 运行时素材全部本地保存（禁止引入任何外链/CDN 资源）；唯一联网项为 MiMo 云端语音引擎（TTS 与 ASR），及用户主动点击的外链（夸克网盘下载、Telegram 等）。
- **界面默认语言为英文**（v1.10.0 起，需求口径「所有端默认打开均为英文」）；语言决策顺序统一为「用户手选 → 设备语言检测（`zh*`→中文，其余/检测不到→英文）→ 英文」，**自动检测结果不落盘**，仅手选值持久化。新增或修改任何界面文案必须同步词典（www `js/i18n.js` 覆盖 HTML 属性/文本节点与脚本写入串；原生端 `ConsoleI18n` / `PhoneI18n` / win-app `app/i18n.js`），否则 EN 模式会露出中文；改完用 `.zcode/check-i18n-*.cjs` 做一次全量比对。
- 前端任何新增/修改的文字样式必须遵循项目字体规范（中文 `MiSans`、数字/英文 `JetBrains Mono`、win-app 标题栏 `MiSans Full`，沿用全局字体栈，禁止引入新字体）；桌面菜单模式（`html.desktop-chrome`）新增浮层须置于 body 直下，勿放入 `#dynamic-island-clip`（灵动岛裁剪容器会裁剪/隐藏 fixed 子元素）。
- Slave 连接方案仅支持 BLE 扫描与 QR 码；Watch 直接扫描 RobotControl- 前缀 Console 设备（ScanFilter 按服务 UUID 7500 过滤，phone/watch 通用，见 BLE 协议文档「设备命名规则」）。
- 模块级 UI、构建、存储、性能和实现细节写入各端模块文档；协议变更必须先落到 BLE 协议文档再修改代码。
- 文档准确反映当前代码状态，不要假设未实现的功能。

## 源码目录链接

- [master-app源码](../master-app)
- [slave-app源码](../slave-app)
- [watch-app源码](../watch-app)
- [win-app源码](../win-app)

## 版本记录

版本号三位 `x.y.z`：新会话开发第二位 +1（第三位归零），同一会话内每轮更新只递增第三位；条目按 移除 → 新增 → 优化 → 修复 排序，同一会话内多次第三位递增原地合并写最终结果。**本段只保留最近 5 个版本**（更早条目随提交清理移出，历史追溯用 `git log -p -- docs/reademe.md`）。

- **1.10.0**（2026-10-09）：
  - 移除：**slave-app 不再跟随控制端界面语言**——删除 7507(UiLang) 的订阅、初读与 `onLangReceived` 语言跟随链路，界面语言只由本机决定；蓝牙对话框新增「语言」手选行（原「胶囊长按切语言」早在 1.5.0 移除，本轮把语言设置入口补回对话框）。服务端特征保留并照常推送/补发（旧版客户端仍订阅）；`BleConstants.CHAR_UI_LANG_UUID` 保留并注明本端不再读写。
  - 新增：**设备语言自动检测（三端 + www 统一口径）**——判定规则统一为「主语言标签 `zh*` → 中文；其余（含 en 在内的所有其他语言）或检测不到 → 英文」；**自动检测结果不落盘**，每次启动重新检测，只有用户手选才持久化，故「设备是中文」与「用户改回英文」不会互相覆盖。链路：www `js/i18n.js` 初始语言按「手选(localStorage `robot_ui_lang`) → 原生桥 `consoleAPI.bootLang`(win-app) → `navigator.languages/language` → 兜底 en」；master-app `ConsoleI18n` 与 slave-app `PhoneI18n` 在无手选标记时按 `Locale.getDefault().toLanguageTag()` 检测；win-app `app/i18n.js` 按「手选 → `app.getLocale()`（未就绪时 Intl / 环境变量兜底）→ 兜底 en」，状态文件改存 `{lang, manual}`（**兼容旧文件**：v1.10.0 前的 `i18n-lang.json` 只有 lang 而无 manual，而旧实现仅在用户手动切换时写入，故一律视为手选，避免升级后把用户的显式选择改回设备语言）。**界面默认语言由中文改为英文**（需求「所有端默认打开均为英文」）。英文默认同时暴露并补齐了历史未译文案（见修复）。
  - 新增：**First Run（首次启动）流程统一**——www 控制台新增 `?firstrun=1` 模式：只渲染激活页、不显示登录层、不进入主界面，表单实现与主控制台只有一份（同一 `#activation-modal` 与十组设置），完成/跳过后派发 `rc-firstrun-done` 并回调宿主（`consoleAPI.firstRunReady(needsForm)` / `firstRunDone`）。
    - **master-app**：Android WebView / 窄屏不再免除激活页——未激活时先显示激活页（原生品牌 PV 本就等 `videoEnded && webReady` 才揭开，故 PV 播完必定先见 First Run），完成/跳过后再 `initApp()` 进入主界面；登录页免除保证不变（**该平台仍无登录界面**）。窄屏浏览器同规则。
    - **win-app**：新增 `createFirstRunWindow()`（1080×860，`app://bundle/<控制台页>?firstrun=1`，与主控制台同 origin 共享 localStorage）——**首次启动时激活窗口先于启动器出现**，完成后经 IPC `firstrun-done` 写 `huancun/activated.json` → 关激活窗口 → 再建启动器继续原流程；窗口保持隐藏直到页面判定**真的需要填表**（已激活用户如从旧版升级、或宿主标记丢失时由 `firstRunReady(false)` 直接收尾回启动器，不闪窗，3s 兜底显示）；用户直接关闭激活窗口视为跳过（不写标记，控制台内激活页仍是兜底），照常进启动器；控制台内完成激活也回写同一标记，两处状态一致、不会二次弹出。
    - **slave-app**：新增原生首启界面（`firstRunContainer` 覆盖主界面，代码构建 UI 与主界面同风格）——语言（默认按设备检测/英文，可改）+ MiMo API Key（可选）+ 「识别引擎调用云端（MiMo ASR）」开关（此前这两项只藏在蓝牙对话框里），按钮「开始使用」/「跳过，保持默认」；标记存 SharedPreferences `first_run_prefs.first_run_done`，完成后不再出现。
  - 新增：**App 使用说明书（中英双版本）**——覆盖全部客户端全部功能的完整手册：客户端分工、安装与首次启动、语言、连接方式（BLE/二维码/USB 进入/协议拉起）、控制台各面板与设置组、信息面板、slave-app 全功能、手表端、浏览器版（缓存/离线/拉起）、故障排查。单一源为 `www/doc/manual/manual.en.md` 与 `manual.zh-CN.md`（仓库内可直接在 GitHub 阅读），构建产物 `manual.{en,zh-CN}.html` 随包入库供应用内阅读；新增无依赖转换器 `tools/manual-build/build.mjs`（受限 Markdown 子集 → 与控制台同风格自包含 HTML，含中/EN 互切链接），并入 `tools/web-build` 的 `npm run build` 链（tailwind → manual → cache-manifest）；`generate-cache-manifest.mjs` 排除 `.md` 源（运行时只 fetch `.html`）。**信息面板新增「App 使用说明书」条目**（`type:'doc'`，与 `action` 一样不进「信息面板链接」可配置列表）：按当前界面语言取对应版本、名称随语言显示（`App 使用说明书` / `App User Manual`），复用 PDF 阅读器弹窗在应用内阅读（Android 也不外抛，保证任何端都读得到），`rc-lang-changed` 时刷新条目名与版本。
  - 新增：**客户端改名（master / slave 体系）**——目录 `android-app/` → **`master-app/`**、`phone-app/` → **`slave-app/`**（`git mv` 等价，全仓引用同步：`.gitignore`、README 双语、docs 全群、Gradle `rootProject.name` 改 `MACS`/`Slave`、`win-app/test/titlebar.test.js` 图标源路径）；显示名 master 侧统一 **MACS**（master-app `app_name`、win-app `productName` 与启动器标题），slave 侧统一 **Slave**（`app_name`）；**slave-app 图标按 master 同族色相偏移**（深绿→深蓝，仅绿占优像素做色相旋转、Rt5 Logo 灰度部分与形状构图不变，全套 mipmap + round 与根目录两张同改）以区分两端。**刻意保留不动**：Android 包名（`com.robotcontrol.console` / `.phone`，改包名会让已装用户数据丢失且需卸载重装）、BLE 广播名与扫描前缀（`RobotControl-Console` / `-Win` / `-Phone`，协议冻结）、exe 文件名。
  - 优化：**使用说明书构建并入 www 资源链**——`tools/web-build` 新增 `build:css` / `build:manual` 子脚本，`build` 依次跑 Tailwind → 说明书 → 缓存清单，保证新增文件自动进 SW 预缓存清单（本轮 62 项 14.83 MB，版本 `3e659b53ac94`）。
  - 优化：**slave-app 文案与词条订正**——`机械度` 英文由 `Robotical` 改为项目规范用词 `Robotic`；`750接收端` 词条随显示名更新为 `Slave`；`QrScanActivity` 五条未走词典的中文 Toast（无法打开相机/未找到相机/相机不支持/相机访问失败/无相机权限）收口进 `PhoneI18n`。
  - 修复：**激活完成后窄屏/Android 露出登录页**（本次改动引入）——`hideActivationModal()` 原先无条件把登录层恢复可见，而窄屏浏览器与 Android WebView 本无登录界面；改为仅在「确有登录界面（宽度 ≥750 且非 Android WebView）且非 firstrun 模式」时回落登录层。
  - 修复：**slave-app 手选语言对主界面不生效**（本次改动引入）——`PhoneI18n.init()` 排在 `buildContent()` 之后，界面已按默认语言渲染；调换为语言先初始化再构建界面，首启界面与主界面口径一致。实测：AVD Android 16 装 debug 包，首启选中文 → 主界面全部中文且重启保持。
  - 修复：**英文默认后暴露的历史未译文案**——`www` 控制台 HTML 属性与脚本写入串共 8 条补齐词典（激活页密码占位两条、激活页 MiMo Key 占位、设置页 TTS 说明句与「前往 MiMo 开放平台申请 API Key ↗」、设置导航 aria-label、`更新完成` / `系统已成功更新`，另有 TTS 段落尾句含前导句号变体）；**单栏 hero 首行「X的」改为按语言生成**（英文 `X's`），不再固定中文助词。核对工具：全量扫描 HTML 文本节点/属性与 `app-core.js` 等脚本的写入串比对词典（结果：缺失 0）。
  - 修复：**win-app 升级后既不弹激活窗口也无法补齐激活**——首次启动判定原先只认主机 `huancun/activated.json`，而既存用户（旧版本升级、或从 `%APPDATA%` 迁移过来的 profile）只有控制台 localStorage 里的 `robotActivated`；现以页面探测结果为准（`firstRunReady(false)` → 直接写标记回启动器），两条路径都不会漏。
  - **实测口径**：浏览器（412×915 手机视口 / 1440×900 桌面，`http://` 静态服务）验证中英两态、激活页在窄屏与桌面的门控与回落、`?firstrun=1` 只渲染激活页、信息面板说明书条目（英文 22,045 字符 / 中文 7,888 字符渲染、语言切换后条目名与版本同步）；AVD Android 16（`Phone_Android16`）装 debug 包：slave-app 首启界面（英文默认、选中文后主界面全中文、`first_run_done=true` + `lang_manual=true` 落库、重启不再出现、明文设备语言不落盘）与 master-app（清数据 → PV 播完必定进激活页 → 完成后进主界面 → 信息面板可开「App User Manual」并在 WebView 内阅读）；win-app 本机 electron + CDP 驱动：无标记且未激活 → 激活窗口(1092×866)先于启动器出现、填表后 `model-info.json` 落库并写 `activated.json`、关窗开启动器；已激活 → 不弹窗直接进启动器；启动器 F2 测试模式进控制台无二次激活页。三端 release 产物与校验串见 `docs/release-ledger.md`。
- **1.9.1**（2026-10-07）：
  - 优化：**slave-app 本地语音规则单测扩容**——`VoiceCommandMatcherTest` 由 10 项增至 12 项，补「真实 ASR 输出带标点/句号仍正常命中或否定」与「英文否定词按词边界（know / nothing 等含 no、not 子串的普通词不得误否定）」两项；`./gradlew :app:testReleaseUnitTest` 12 项全绿。
  - 修复：**slave-app 语音识别在真机/部分设备上整体不可用**（用户实测 release 包「没实现」的根因）——三层根因一并收口：① Manifest 缺 `<queries>`（`android.speech.RecognitionService`），Android 11+ 包可见性过滤下 `isRecognitionAvailable()` / `isOnDeviceRecognitionAvailable()` 查不到系统识别服务，本地识别恒判不可用；② 设备端离线识别连续失败后直接退化（有云端条件切「仅云端」，否则关闭并提示「本地语音识别不可用」），从不回退系统识别器；③ 系统识别器强制 `EXTRA_PREFER_OFFLINE=true`，设备未下载离线语言包时同样必然失败（AVD Android 16 实测两端都落到 SODA 离线引擎报 `Failed to get language pack of required locale: error 12/13`）。现改为**三级引擎逐级回退**：设备端离线 → 系统识别器（离线优先）→ 系统识别器（允许联网），同一引擎连续 3 次错误即换下一级，三级全失败才按云端条件退化；`ERROR_INSUFFICIENT_PERMISSIONS`（录音权限被撤销）保持直接停并提示，偶发 `ERROR_CLIENT` 由「直接判死」改为计入退化计数。**实测口径**：AVD Android 16 装 release APK，点圆钮后日志完整走 `ON_DEVICE → SYSTEM_OFFLINE → SYSTEM_ONLINE → degraded to cloud-only mode`（已配 API Key 时不再关闭、圆钮保持绿色），全程无 FATAL；MiMo ASR 契约以 MiMo TTS 合成「进入调试模式」音频经 `mimo-v2.5-asr` 实测返回「进入调试模式。」，与 `MimoAsrClient` 的请求体/响应路径一致。
  - 修复：**英文否定词子串误否定**——`no` / `not` 等按子串匹配会把 know、nothing 等普通词判为否定（「I know the test mode is fine」不切换），改按词边界匹配（`\b`）；中文否定词维持子串口径不变。
- **1.8.0**（2026-10-07）：
  - 新增：**移动端设置顶栏三枚圆形操作按钮**——「改为默认设置 / 取消 / 应用更改」三个动作在手机宽度下移到设置顶栏右侧，渲染为三枚 36px 圆形图标按钮（`fa-rotate-left` / `fa-xmark` / `fa-check`，点击转发到底部操作条同 id 按钮，行为单源；EN 词条随 `aria-label` 翻译）；桌面菜单模式仍用底部操作条，不受影响。
  - 新增：**移动端设置一级 ↔ 二级过渡动画**——进入二级：内容自右 1rem 淡入（`sm-detail-in` 240ms）；返回一级：导航自左 1rem 淡入（`sm-nav-in` 240ms）。纯 CSS 驱动（由既有 `settings-mobile-detail` 类切换触发），`prefers-reduced-motion` 下自动降级为瞬时。
  - 新增：**设置页外链改系统默认浏览器打开**——master-app WebView `shouldOverrideUrlLoading` 拦截 http(s)（含设置里的 MiMo 官网链接、夸克网盘、Telegram 等，以及 `target="_blank"` 锚点——WebView 未开多窗口，默认会在控制台 WebView 内原地导航顶掉界面）经新增 `openExternalBrowser()` 走 `Intent.ACTION_VIEW` 打开系统默认浏览器；站内资源（`file:///android_asset/`、blob、about）与页内锚点不受影响。win-app 两个窗口在既有 `setWindowOpenHandler` 之外补 `will-navigate` 兜底（无 `target` 的外链同样交给系统浏览器，不留在壳内导航）。纯网页端保持新标签页打开。
  - 新增：**slave-app 本地语音规则单元测试**——`slave-app/app/src/test/.../VoiceCommandMatcherTest.kt`（JVM + JUnit）覆盖四大模式读音、同音字命中（调式/中诚/回复/你人）、否定词排除、否定局部性、中英语言门控与空文本边界，`./gradlew :app:testReleaseUnitTest` 10 项全绿。
  - 优化：**移动端设置一级界面收紧**——导航卡片与主界面内容边距对齐（左右各 1rem，此前贴屏幕边缘）、卡片间距 6.4px→12px、卡片内边距与组名字号 15.2px→17px、图标 20px→25.6px/1.15rem；一级列表在卡片变高后仍可滚动（`overflow-y:auto`）。
  - 优化：**移动端设置操作条改由顶栏承担**——底部操作条在手机宽度（≤749px）下一律隐藏，一级界面无需进二级即可保存/取消；桌面菜单模式保持原底部操作条。
  - 优化：**Android WebView 任意宽度下的设置形态对齐**——移动端设置的 JS/类门控是 `html:not(.desktop-chrome)`，而样式原只写在 `@media (max-width:749px)`，平板/横屏（≥750px）Android WebView 会出现「导航列不可滚 + 没有任何保存/取消入口」的两套口径错位；补 `html:not(.desktop-chrome)` 分支（顶栏三枚圆形按钮、隐藏 macOS 标题与底部操作条、补齐列容器滚动高度链与卡片形态）。win-app 与浏览器均带 `desktop-chrome`，完全不受影响。
  - 优化：**本地识别不可用时的退化（低功耗）**——连续 3 次识别错误后不再每 300ms 重启识别器（此前设备缺少/禁用识别服务时会无限重启持续耗电）：有云端条件（开关开启 + 有 API Key）则退化为「仅云端」，否则关闭识别并提示「本地语音识别不可用」。计数口径：`ERROR_NO_MATCH`/`ERROR_SPEECH_TIMEOUT`（用户没说话）属正常态不计入，且只有真正拿到识别结果才清零计数——避免安静环境或被识别服务「假就绪」时误判。
  - 修复：**移动端部分二级设置组无法滚动**——`.settings-columns` 在移动端无 flex 规则（只有桌面 `desktop-chrome.css` 有），导致 `.settings-body` 的 `flex/min-height:0/overflow-y` 全部失效、内容高度被撑开后被 `.settings-content{overflow:hidden}` 裁掉，长组（如机器人状态设置 1205px）底部不可达；补齐列容器高度链后二级组可正常滚到底。
  - 修复：**连接链路闪退加固（Android 12+ 全版本范围）**——master-app：① `bluetoothAdapter.bluetoothLeAdvertiser` 取用前补 `BLUETOOTH_ADVERTISE` 校验（此前只校验 `BLUETOOTH_CONNECT`，而该 getter 在 API 31+ 需要 ADVERTISE，权限缺失时在 BLE 线程抛 `SecurityException` 直接崩进程）；② `startServer`、服务重加定时器、广播、读请求/写请求/描述符回调、**连接态变化（`onConnectionStateChange`）、MTU 变化（`onMtuChanged`）、通知发送链路（`notifyCharacteristicChangedToDevice`/`queueNotification`/`sendNextNotification`）** 全部 `runCatching`，`device.address` 等受权限约束的取用不再让异常逃出 BLE 线程；③ `setName()` 从广播的同一 `runCatching` 中拆为独立段（顺序仍在广播之前，保证首个广告包带正确设备名；此前两者同段，`setName` 失败会静默中止整段逻辑、广播永不启动 → 手机端扫不到设备「连不上」）；④ 新增 `sendGattResponse()` 统一回包（`value` 空安全）；⑤ `BleScanner` 扫描回调、`BlePermissionHelper.isBluetoothEnabled`、`startBleServices`、JS 桥 `btStartConnect`/`btShowQr` 全部补权限前置校验与异常兜底（新增词条「缺少蓝牙权限，请重新打开控制台授权」）；⑥ `initialize()` 的扫描器缓存改为**独立重试**（此前若 `bluetoothLeScanner` 取用抛异常，`bluetoothManager` 已被赋值会让 null 守卫永久跳过初始化，补授权限后扫描也起不来）。slave-app：扫描回调 `device.name`/`device.address`、`connectInternal`、`initialize` 的 `bluetoothLeScanner` 取用（同样独立重试）、`isBluetoothEnabled` 全部收口，新增 `connectToConsole()` 包装所有连接入口，`startBleServices` 自动连接/自动扫描段加 try/catch（失败只回退连接状态）。**实测口径**：Android 12 模拟器（`Phone_Android12`）上用改前基线 APK（git HEAD 抽出）与改后 APK 做对照，权限齐全与吊销 `BLUETOOTH_ADVERTISE` 两种情形下点击「开始连接」均无 `FATAL`——即用户报告的闪退未能在模拟器复现，本轮属按静态分析逐点加固，真机日志才是定论。
  - 修复：**设置内链接在控制台内打开顶掉界面**（同上「设置页外链改系统默认浏览器打开」，master-app 侧为实际缺陷修复）。
- **1.7.1**（2026-10-07）：
  - 新增：**slave-app 模式反向推送**——手机端长按顶部模式胶囊弹出模式菜单（调试/恢复/忠诚/拟人四项，各用模式色，另有「关闭」），选中后经 `ConsoleBleClient.writeMode(ordinal)` 写入 Mode(7501) 推给控制端；控制端（master-app / win-app / 浏览器）收到后切换到对应模式、高亮模式按钮、TTS 播报并写日志，再按既有链路把模式回推给所有已连接客户端。未连接控制台时选项提示「未连接控制面板」。蓝牙按钮长按的「注入模拟数据」保持原样。
  - 新增：**控制端「推送成功」提示**——反向推送到达控制端时，master-app 弹原生 Toast（`ConsoleI18n` 词条「推送成功 / Push successful」），win-app 与桌面宽度浏览器弹页面内 macOS 风格通知（`showMacosNotification`，图标 `fa-arrow-right-arrow-left`、正文为模式显示名）；Android WebView 不弹页面通知，避免与原生 Toast 重复。前端统一入口为 `window.__rcOnRemoteMode(ordinal)`（`www/js/app-ble.js`）。
  - 新增：**slave-app 语音识别（本地优先 + MiMo ASR 云端兜底）**——屏幕右上角（与模式胶囊同行）新增圆形麦克风按钮，单击开启并**常态保持**（再点关闭），状态经 SharedPreferences 持久、回到前台自动恢复、退到后台自动停（低功耗）；首次开启申请 `RECORD_AUDIO` 权限。识别文本由本地规则 `VoiceCommandMatcher` 判定：**按读音匹配**（内置汉字→无声调拼音小表 + 滑窗比对，同音字如「调式模式」「中诚模式」同样命中）、**否定词排除**（关键词前 6 字内出现 不/不要/别/不可以/不能/不用/无需/禁止/请勿 即不切换）、**语言门控**（跟随 BLE 7507 下发的界面语言：中文设置只识别中文、英文设置只识别英文）；命中即走与手动推送完全相同的链路切换模式。本地识别用 Android 原生离线识别（API ≥31 且设备支持时 `createOnDeviceSpeechRecognizer`，否则 `createSpeechRecognizer` + `EXTRA_PREFER_OFFLINE`）；仅当本地得到**大段文本**（≥4 字）却未命中、且缓冲音频 ≥1.2s、云端开关开启、已有 API Key、距上次调用 ≥4s、无进行中调用时，才把 16kHz 单声道 PCM（环形缓冲上限 12s，加 WAV 头后 base64）发给 `mimo-v2.5-asr` 兜底识别，返回文本再过一次本地规则。本地识别不可用且开关开启时退化为「仅云端」（能量端点切句），两者皆不可用则提示「本地语音识别不可用」。
  - 新增：**slave-app 设置页云端识别开关**——BLE 对话框（即手机端设置页）API Key 区下方新增「识别引擎调用云端（MiMo ASR）」开关（默认开，切换即落库 `asr_cloud_enabled`）与副提示「关闭后仅使用本地离线识别」；关闭后只用本地离线识别、不产生任何云端调用与费用。
  - 新增：**MiMo 收费提示**——www 设置页「TTS 语音引擎」组与激活页 TTS 段、slave-app 设置页 API Key 区均新增「Xiaomi MiMo TTS和ASR可能需要收费，请阅读官网相关文档。」（词条已入 `www/js/i18n.js` 与 `PhoneI18n` 词典，EN 模式随界面翻译）。
  - 新增：**设置导航图标**——设置组导航（桌面左侧栏与移动端一级列表共用）每组前置一枚本地 Font Awesome 图标（`SETTINGS_NAV_ICONS` 13 组映射：语言 fa-language / 型号信息 fa-id-card / 网页缓存 fa-box-archive / 账号 fa-user-shield / TTS fa-microphone / 灵动岛 fa-wand-magic-sparkles / 运行参数 fa-chart-simple / 按钮文本 fa-pen-to-square / 图片 fa-images / 模式名称 fa-tags / 链接 fa-link / 状态 fa-robot / 导入导出 fa-right-left，缺省 fa-gear）；图标字体 `webfonts/fa-solid-900.woff2` 已 vendored，零联网。
  - 新增：**移动端设置一级/二级界面**——非 desktop-chrome（手机浏览器 / Android WebView）下设置打开为**一级列表**：导航以图标+组名整行卡片纵向排列（此前导航在 <750px 无基础样式、组标题糊成一段文字），设置组本体在一级全部隐藏；点击某项进**二级**：仅显示该组、头部标题换为组名（EN 经写入钩子直译）、头部返回键回一级；一级时返回键关闭设置（`settingsMobileBack()`）。平台门控隐藏的组（不支持缓存时的「网页缓存与 App」，内联 `display:none`）不进导航；跨 750px 进入桌面菜单模式时自动退出二级（resize 守卫）。桌面左侧栏行为不变（点击滚动 + 滚动高亮）。
  - 优化：**Mode(7501) 由只读改为双向可写**——属性 `READ|WRITE|NOTIFY`、权限 `READ|WRITE`（master-app `RobotGattServer` 与 win-app C# 宿主同步）；服务端收到写入立即 `sendResponse(GATT_SUCCESS)`、同步 `characteristicValues` 保持读值一致，仅 ordinal `0-3` 生效（`255`=NA 与其他值忽略），经 `onModeReceived`（master-app）/ `ModeReceived` 事件 → IPC `{"type":"mode","ordinal":n}`（win-app）通知前端。其余六个特征属性未变。
  - 优化：**slave-app 通知标题口径**——普通语音消息仍为「主人指令」；反向推送场景改为「推送成功」。防双弹机制：推送发起时开启 4s 回声窗口，窗口内到达的语音通知用「推送成功」标题并消费窗口（只弹这一条）；窗口内未收到控制端回声则兜底弹一条，并置 4s 抑制窗口挡住晚到的回声。
  - 优化：**设置左侧栏加宽 152px→170px**——补偿导航图标占位，中文组名实测零截断、英文截断程度与加图标前持平；导航基础样式（一级列表/图标尺寸）移入 `css/app.css`，`css/desktop-chrome.css` 仅覆盖桌面左侧栏形态（原「非 desktop-chrome 隐藏导航」规则删除）。
- **1.6.0**（2026-10-05）：
  - 新增：**www 设置页「型号信息」组与型号信息统一机制（三端显示统一）**——完整型号/简称/制造公司/主人/语音播报读法五输入框（各带中英默认值提示），存储 localStorage `robotModelInfo`（五键全量对象，`''`=默认）。**整组匹配规则**（与模式名一致）：五项整体完全等于中文默认组或英文默认组（= i18n 词典译文）才随界面语言显示对应语言默认内容；任意一项自定义（含中英混搭）→ 全组按保存原文显示（自定义不支持双语标签）；留空恢复该项默认。**两条显示通路**：① JS 拼接句改用"句子模板函数"按语言直出完整句（modelSentenceSysTitle/PanelTitle/Logout/Connected/ConnectedOk/SendingTo/EnteredMode/MasterDe——不再依赖 DICT 整句词条，自定义简称后整串匹配不失灵），覆盖主/标题栏、三栏 header（含"内部系统面板"拼接）、单栏 hero、bt-modal 设备型号/制造公司/标题、灵动岛连接通知、Male_2 传输行、退出登录菜单与确认弹窗、充电/macOS 通知 appName、进入模式日志与终端回显、document.title；② 静态 DOM 经 `data-model-info` 属性 + `applyModelInfoToDom()` 扫描写入（boot/设置保存/语言切换后调用，语言切换经 i18n.js 新增 `rc-lang-changed` window 事件广播重刷）。自定义内容入 i18n 保护集防 EN 子串误译。**排除区**（不改）：终端 init/system 清单/关机提示、登录页标题、启动器芮誊公司名与版权行、PDF 物理文件名（仅名称显示可配）、phone/watch/android 原生标签。**win-app 启动器联动**：launcher（app://design）与控制台（app://bundle）localStorage 不互通，主进程新增 `huancun/model-info.json` 持久化 + IPC `model-info-get`/`model-info-set`，控制台保存/启动时经 `consoleAPI.setModelInfo` 推送生效值（zh 源串五键），启动器经 `electronAPI.getModelInfo()` 读取并动态刷新 `app-title` 主标题（EN 由 launcher-i18n 覆盖层按默认词条翻译，自定义名无词条自动原文显示）；浏览器/Android 无此桥自动跳过。
  - 新增：**www 设置页「信息面板链接」组**——信息面板 4 个可配置链接（演示合集/公众号/社交账号/机器人日志）的名称与 URL 可自定义，存储 localStorage `robotInfoLinks`（`[{id,name,url}]`，null=全部默认；`get-app` 为 action 项不可配置不进存储）；`renderFileList()` 改按 id 合并生效值渲染（打开/新窗口/日志均用生效 URL 与名称）；URL 仅允许 http/https 前缀校验；名称整组匹配默认时随界面语言（默认名词条已在 DICT），任意一项自定义按原文显示并入保护集；「恢复默认链接」立即回填输入框、应用更改后落库；PDF 说明书条目不进设置组（文件名含公司名固定不可改，恒用默认名）。
  - 新增：**www 设置页「配置导入导出」组**——「导出配置」收集 13 个 localStorage 键（按钮文本/信息参数/模式名称/型号信息/信息链接/运行参数/账号/两张图片/情绪/界面语言/MiMo Key/MiMo 引擎）为 `{version:1, exportedAt, data:{...}}` JSON 下载 `robotcontrol-config-YYYYMMDD.json`；「导入配置」经文件选择校验版本与结构、confirm 确认覆盖后逐键写入并自动刷新页面；`robot_ui_lang` 按裸串存储处理；说明文案标注"含登录密码与 API Key 等敏感信息及可能较大的图片数据，勿外传"。
  - 新增：**www 首次启动激活引导页**——登录页显示前检查 localStorage `robotActivated`，未激活时显示 `#activation-modal`（body 直下，复用 `.login-modal`/`.login-card` 体系与随机登录背景，z 与登录层同级）：单页表单范围与分组见下方「激活页全量设置」条目；「开始使用」复用设置页同一套 set 函数依次落库 + `robotActivated=true` 后回落登录页，「跳过，保持默认」仅置标记；完成后不再出现。文案全部走 DICT（EN 支持）。**仅浏览器与 win-app 出现**：Android App 无登录界面（v1.6.0 起按平台保证——`platform-bootstrap` 暴露 `__rcIsAndroidWebview`（排除 win-app preload 同名暴露的 `window.Android`），登录门控改 `innerWidth < 750 || __rcIsAndroidWebview`，任何宽度直接进主界面，不再依赖 <750 宽度的巧合；历史版本纯宽度判断在 Android ≥750 宽度（平板/横屏）时会误出登录页），phone/watch 原生端亦无；浏览器首访强制缓存窗口（z 952/955）层级高于激活层——先完成缓存再激活，互不卡死。**实现要点**：激活页按钮绑定必须放在 DOMContentLoaded（`initEventListeners` 登录成功后才执行，绑定放那里激活页显示期间点击无响应）。**master-app 竖屏锁定**：MainActivity 补 `android:screenOrientation="portrait"`（历史清单从未锁定，横立时 WebView 宽度 ≥750 会露出桌面 UI；App 设计为竖屏手机端）。
  - 新增：**win-app 启动器版权行**——USB 前置页副标题下方固定显示「© 芮誊智能虚构公司」（`design/launcher.html` `.app-copyright`），`launcher-i18n.js` 增 EN 词条「© Rt5 A.I. Fictional Liability Company」；**固定真公司归属，不读型号信息设置**。
  - 优化：**设置页组顺序重排**——语言 → **型号信息（新）** → 账号管理 → TTS 语音引擎 → 网页缓存与 App → 灵动岛模拟效果 → 运行参数设置 → 控制按钮文本设置 → 机器人图片设置 → 模式名称设置 → **信息面板链接（新）** → 机器人状态设置（主人/制造公司由型号信息驱动，组内不渲染）→ **配置导入导出（新）**；各组内部控件与样式逻辑不动。
  - 优化：**信息参数中英文显示改整组匹配 + 主人/制造公司置首**——匹配规则与模式名/型号信息统一：主人/制造公司两行（由「型号信息」驱动，恒视为匹配不参与判定）之外，其余 20 项 label+value 全组等于中文默认组或英文默认组才随界面语言；任意一项不同（含中英混搭、追加自定义行）→ 全组按保存原文显示；留空=该项默认。`getDefaultStatusItems()` 顺序改为主人第 1、制造公司第 2；旧数据自动迁移（检测制造公司在首位即把两行置首、其余相对顺序不变，用户删过行则保持原样）。作用于移动端状态列表、三栏信息参数 chips、「关于本机」窗口（公司行自动跟随型号信息设置）。
  - 优化：**默认登录密码改 admin/admin**——`StorageManager.DEFAULT_ACCOUNTS` 由 T31750/T31750 改为 admin/admin（新装态；已存 `robotAccounts` 用户不受影响），激活页与登录提示同步引用。
  - 修复：**退出登录菜单项全角引号致样式与点击失效**——v1.6.0 开发中途引入的 HTML 属性引号误用全角 `”`（`class=”ns-menu-item”` 等），浏览器解析为属性值一部分导致桌面菜单退出登录项样式丢失、菜单动作失效，恢复半角引号。
  - 新增：**语音与叙述全链路跟随型号信息**——7 处 `speak()` 播报句（自检完成/清空进程/系统更新/数据库更新/关机/开机/系统已更新）改 `modelSentenceSpeech()` 模板句（zh/en 直出 + 型号插值）；自检叙述 60+ 行与 5 个过程窗口标题（自检/清空所有进程/系统更新/数据库更新/开机启动）及自检完成提示框经 `applyModelInfoToLine()` 按生效值替换（默认串原样保留、EN 整句词典翻译不受影响）；终端 init/关机提示与登录页标题等排除区保持不动。
  - 新增：**MiMo 开放平台申请链接**——设置页「TTS 语音引擎」组与激活页 TTS 段均附"前往 MiMo 开放平台申请 API Key ↗"外链（https://mimo.mi.com/，用户主动点击联网）；**默认无 TTS API 的口径核实**：全仓（www/android/phone/win）确认无任何内置 API Key，默认即为空、必须手动输入（设置输入框显示的 Key 来自本机 localStorage 手输或手机端 7506 同步，非内置默认）。
  - 新增：**设置窗口左侧侧边导航**——设置面板加宽至 860px 并左侧新增 `#settings-nav` 组标题列表（仅桌面菜单模式显示，移动端/Android 隐藏）：JS 按 `.setting-group` 顺序生成（文本节点经 Observer 随 EN 翻译），点击平滑滚动跳转对应组，滚动监听高亮当前组（scroll spy）；语言切换经 `rc-lang-changed` 重建。
  - 新增：**登录页版权水印**——登录卡片下方固定「© 芮誊智能虚构公司」（EN「© Rt5 A.I. Fictional Liability Company」），与启动器版权行同口径（固定真公司归属，不随型号信息设置）。
  - 新增：**激活页全量设置**——首次激活由 4 段扩为**全量表单**：语言/型号信息（五键）/账号密码/TTS（引擎+Key+官网链接）/机器人图片（2 张上传+预览）/模式名称（四行）/信息面板链接（4 行）/信息参数（22 行一行式，主人与制造公司由型号信息驱动不显示）/运行参数（精液/电量/存储）/控制按钮文本（1-10 固定只读、11+ 可编辑）；「开始使用」逐组校验并按与设置页同一套存储键落库（链接/图片等留空即默认），「跳过，保持默认」仅置标记；底部吸底操作条，卡片加宽至 44rem 可滚动。
  - 优化：**设置页行式布局收紧**——机器人状态设置与信息面板链接的"标签+值"两列网格改**一行式**（序号 + 标签输入 + 值输入 + 删除按钮，标签:值按 3.5:6.5 分配），与模式名称行同风格；激活页信息参数/链接行同款；整体设置长度明显缩短。
  - 优化：**机器人状态设置组不再显示主人/制造公司两行**——两行由「型号信息」设置驱动且不可编辑，设置组内不渲染（渲染从第 3 项起连续编号）；信息参数面板/三栏 chips/关于本机等显示区仍正常输出这两行；`#save-settings` 保存索引同步改为 `(i-2)` 对齐。**信息面板链接组去掉 PDF 输入行**——PDF 条目文件名含公司名固定不可改，设置组只含 4 个可配置链接（存储与显示合并仍按 id，PDF 恒用默认名）。
  - 优化：**关机/重启中止期间运行参数窗口只保留电量显示**——`shutdownRobot` 不再清零电量（历史行为置 N/A/0%），电量按自动计划继续显示；`updateRuntimeParamsDisplay()` 关机态只刷新电量字段（修复 USB 状态等事件触发整窗重写导致液体/存储 N/A↔实际值来回跳动）；关机时停挂图表定时器，温度/负载/网络曲线时间轴同步冻结（开机经 `startDynamicParamUpdates` 恢复）。
  - 优化：**信息板块与设置弹窗磨砂动画去露馅**——desktop-chrome 三个菜单面板（连接/信息/设置）容器开合动画原含 `translateY+scaleY` transform 过渡，磨砂卡片（backdrop-filter）在缩放期间背景采样错位出现未磨砂穿帮帧；改为纯透明度淡入（磨砂层全程静止），模糊稳定。
  - 修复：**EN 模式整组判定两处漏洞**（信息参数/模式名称"任意一项不匹配→全组按实际显示"未生效）——① `replacePhrases()` 子串替换绕过保护集（PROTECTED 只拦截整串匹配），改一项后其余项 label/value 仍被词典子串替换成英文默认（实测：改"系列"后 chips 显示 "Series: 我的系列"）——replacePhrases 跳过保护集中的 key；② 保护集注册口径只含**非空自定义值**，留空回退的默认名/默认串未注册（实测：改"调试模式"后其余三项仍显示 Test Mode 等；自定义简称后 Manufacturer 仍显示 Rt5...）——模式名与型号信息整组不匹配时注册**全部渲染输出源串**（含默认回退）。干净环境实测：改一项后全组按原文显示（含锁定行公司名原文），全默认时随语言切换。
  - 修复：**关机态参数"复活跳动"（关机是常态而非瞬间）**——根因：`initApp`（重新登录/刷新页面）无条件调用 `startDynamicParamUpdates()`，其开头会用 `state.dynamicParams` 旧值（关机前的 CPU/NPU/GPU/内存/读写占用率）立即重写 DOM 并挂 5 个 2-5s 随机定时器 + 图表定时器；关机状态下重新登录即触发"参数复活+持续跳动，图表归零但时间轴走动"。修复：① 抽取 `applyPoweredOffDisplay()` 统一冻结显示（电量保持自动计划、其余参数 N/A+进度条 0、图表整条归零），`shutdownRobot` 与新守卫共用；② `startDynamicParamUpdates()` 开头关机守卫——`state.poweredOff` 时只重申冻结显示并 return，任何路径（登录/刷新/initApp）都无法在关机态启动跳动；③ 开机状态仅由"开机/重启按钮 → 过程窗口进度 100%（onComplete 置 `poweredOff=false`）"确立，窗口中途被关闭/中止则保持关机态。实测：关机→登出→重新登录，12 秒采样全程 N/A 冻结（定时器 0 个）、电量保持；开机窗口播放中保持 N/A，100% 完成后恢复（cpu 84%、6 定时器）。
  - 修复：**设置侧边导航滚到顶不高亮"语言"**——spy 滚动高亮增加 `scrollTop <= 2` 强制高亮第一项（与既有"滚到底强制最后一项"对称），消除惯性滚动停在中间位置时首项阈值判定不生效的边缘情况。
  - 优化：**设置页布局二轮收紧**——修复 settings-body 横向滚动条：一行式输入框原 `setting-input` 自带 `width:100%` 使 flex-basis 爆炸（URL 输入框被挤至近不可见），信息面板链接与状态设置的"标签:值"改按 **3.5:6.5** 比例分配（`flex:0 0 35% / 1 1 65%` + `min-width:0`），desktop-chrome 下 settings-body 补 `overflow-x:hidden` 兜底；**型号信息组标题移到输入框左侧**（`.model-info-row` 水平行 + 下方一行默认值小字），单行高度 42px，纵向长度大幅缩短；激活页信息参数/链接行同步 3.5:6.5。
  - 优化：**语音播报读法语义升级为全型号念法**——默认值改为 `踢三一七五零型仿人男性机器人`（EN 经词典 `T-Three-One-seven-five-0 Male Android`，即照最新英文翻译标签朗读）；`normalizeForSpeech()` 按当前界面语言把句中**完整型号与简称**统一替换为生效读法（只此一种读法设置，全句型号均按它念）；旧默认（踢三一七五零）读取时自动迁移；设置页/激活页占位与默认提示同步。实测：`T31-750型仿人男性机器人正在运行自检程序` → `踢三一七五零型仿人男性机器人正在运行自检程序`。
  - 优化：**关机归零口径修正**——cpu/npu/gpu/memory/io 文本由 0% 改 **N/A**（与液体/存储一致，电量除外继续显示）；**图表整条曲线归零**（此前仅置尾点 0、历史曲线残留导致关机态图表非 0），开机由 `savedChartData` 恢复历史；bootRobot 完成回调补 `refreshAutoBattery()`（防恢复值缺字段显示 undefined%）。
  - 修复：**退出登录过渡动画与二次登录动画**——原流程"主界面先渐隐 0.4s → 裸背景 → 登录层再淡入"存在两段跳变硬切感；改为登录层（z 高于主界面）立即显示并播放"整层淡入+卡片落下"过渡盖住主界面，主界面在登录层下方完成渐隐后隐藏；`finishLogout` 恢复显示与 `revealing` 之间强制重排（同帧 remove+add 不触发动画）；`playLoginBoot` 起步摘除残留 `revealing`（快速重登时与 entering 收缩动画叠加导致二次登录动画走样）、`resetLoginBoot` 一并清除 `fade-out`。
  - 优化：**设置侧边导航交互修复**——点击跳转由 `scrollIntoView`（会连带滚动页面级祖先，第一组/最后一组表现为"点不动"）改为按 `getBoundingClientRect` 差值精确 `scrollTo` 面板内滚动容器；滚动高亮补"滚到底强制高亮最后一项"（最后一组矮于视口余量时 top 阈值判定到不了，滑到底高亮停在倒数第二项）；语言组下移（desktop-chrome settings-body 补 padding-top，不再贴标题栏）。
  - 优化：**EN 模式语音播报统一英文**——`speak()` 在 EN 模式经词典翻译后再进入显示与合成（默认按钮名/功能句/窗口名等照英文词条朗读，"处理已中断"/"倒计时结束！"/暂停/停止/恢复/认知偏移与指令前后缀等补齐词条；任务完成句改双语模板），用户自定义与手输内容在保护集中自动豁免按原文；语音读法按界面语言取 EN 默认 `T-Three-One-seven-five-0 Male Android`。
- 更早版本（1.4.0 及以前）的记录已按「只保留最近 5 个版本」的约定清理；追溯用 `git log -p -- docs/reademe.md`。
