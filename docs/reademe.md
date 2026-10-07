# RobotControl 开发文档

## 项目总览

RobotControl 是一个多端协同的机器人控制系统：android-app（控制台，Kotlin+WebView+HTML，GATT Server）作为主控面板，phone-app（手机端，Kotlin原生）和watch-app（手表端，WearOS原生）作为BLE客户端接收状态展示，另有 win-app（Windows 桌面版，Electron）作为控制台的桌面端。数据以 Console 经 BLE Notification 向下推送到 Phone 和 Watch 为主，另有客户端上行通道（Heartbeat 心跳、ApiKey 同步、Mode 反向模式推送）；win-app 通过 C# BLE 外设宿主（Windows GATT Server）广播 `RobotControl-Win`，前端与桥接等效于 android-app 控制台，phone-app 可直接扫描或扫码连接。www 共享前端可直接以浏览器打开（未来托管到网站），并内置 App 拉起引导：网页打开后弹窗引导拉起本机 App（`robotcontrol://console`，手机端拉起 android-app / PC 端拉起 win-app），未安装则引导至夸克网盘下载（https://pan.quark.cn/s/e33470bcc0ef）；纯浏览器端首访为强制缓存流程：「获取完整体验」窗口不可关闭/忽略，必须点击置顶的「缓存网页」按钮完成缓存（`rc_full_cache` 标记）才进入控制台，网页更新后自动提示重新缓存（背景图更新除外）；已缓存用户窗口恢复常规可关闭形态，设置页亦有缓存/拉起/下载三按钮。

## 文档导航

- [整体架构](file:///d:/AIProject/RobotControl/docs/architecture.md)
- [BLE通信协议](file:///d:/AIProject/RobotControl/docs/ble-protocol.md)
- [数据模型](file:///d:/AIProject/RobotControl/docs/data-models.md)
- [android-app（控制台端）](file:///d:/AIProject/RobotControl/docs/android-app/reademe.md)
- [phone-app（手机端）](file:///d:/AIProject/RobotControl/docs/phone-app/reademe.md)
- [watch-app（手表端）](file:///d:/AIProject/RobotControl/docs/watch-app/reademe.md)
- [win-app（Windows 桌面版）](file:///d:/AIProject/RobotControl/docs/win-app/reademe.md)
- [开发计划：v1.6.0（型号信息统一/设置重构/激活引导/配置导入导出，已实施）](file:///d:/AIProject/RobotControl/docs/plans/plan-v1.6.0.md)
- [功能文档：移动端设置 UI、连接稳定性、外链打开与语音识别（v1.8.0 交付，语音识别退化口径 v1.9.0 更新）](file:///d:/AIProject/RobotControl/docs/compose/spec/mobile-settings-connect-voice.md)

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
| UiLang (7507) | `00007507-0000-1000-8000-00805f9b34fb` | 1字节 READ|NOTIFY，0=zh/1=en/255=未设置；控制台界面语言单向推送，phone 订阅后显示语言跟随发送端（详见 BLE协议文档） |
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
- 前端三端以仓库根 `www/` 为唯一主线；同步、按需资源、平台样式边界和共享交互规则见整体架构文档。**硬性规则：修改 www 下任何 class/样式后必须在 `tools/web-build/` 执行 `npm run build` 重新生成静态 `www/css/tailwind.css` 并提交产物**（Tailwind Play CDN 运行时已替换为同版本 CLI 预编译产物，运行时零联网依赖），详见整体架构文档「前端单源架构」。`npm run build` 末步还会自动重新生成 `www/cache-manifest.json`（浏览器端 Service Worker 预缓存清单，新增/删除 www 静态文件后同样执行即可），详见整体架构文档「浏览器端分阶段加载与离线缓存」。
- 运行时素材全部本地保存（禁止引入任何外链/CDN 资源）；唯一联网项为 MiMo 云端语音引擎（TTS 与 ASR），及用户主动点击的外链（夸克网盘下载、Telegram 等）。
- 前端任何新增/修改的文字样式必须遵循项目字体规范（中文 `MiSans`、数字/英文 `JetBrains Mono`、win-app 标题栏 `MiSans Full`，沿用全局字体栈，禁止引入新字体），规范详见项目根 [AGENTS.md](file:///d:/AIProject/RobotControl/AGENTS.md)；桌面菜单模式（`html.desktop-chrome`）新增浮层须置于 body 直下，勿放入 `#dynamic-island-clip`（灵动岛裁剪容器会裁剪/隐藏 fixed 子元素）。
- Phone 连接方案仅支持 BLE 扫描与 QR 码；Watch 直接扫描 RobotControl- 前缀 Console 设备（ScanFilter 按服务 UUID 7500 过滤，phone/watch 通用，见 BLE 协议文档「设备命名规则」）。
- 模块级 UI、构建、存储、性能和实现细节写入各端模块文档；协议变更必须先落到 BLE 协议文档再修改代码。
- 文档准确反映当前代码状态，不要假设未实现的功能。

## 源码目录链接

- [android-app源码](file:///d:/AIProject/RobotControl/android-app)
- [phone-app源码](file:///d:/AIProject/RobotControl/phone-app)
- [watch-app源码](file:///d:/AIProject/RobotControl/watch-app)
- [win-app源码](file:///d:/AIProject/RobotControl/win-app)

## 版本记录

版本号三位 `x.y.z`：新会话开发第二位 +1（第三位归零），同一会话内每轮更新只递增第三位；条目按 移除 → 新增 → 优化 → 修复 排序，同一会话内多次第三位递增原地合并写最终结果。

- **1.9.0**（2026-10-07）：
  - 优化：**phone-app 本地语音规则单测扩容**——`VoiceCommandMatcherTest` 由 10 项增至 12 项，补「真实 ASR 输出带标点/句号仍正常命中或否定」与「英文否定词按词边界（know / nothing 等含 no、not 子串的普通词不得误否定）」两项；`./gradlew :app:testReleaseUnitTest` 12 项全绿。
  - 修复：**phone-app 语音识别在真机/部分设备上整体不可用**（用户实测 release 包「没实现」的根因）——三层根因一并收口：① Manifest 缺 `<queries>`（`android.speech.RecognitionService`），Android 11+ 包可见性过滤下 `isRecognitionAvailable()` / `isOnDeviceRecognitionAvailable()` 查不到系统识别服务，本地识别恒判不可用；② 设备端离线识别连续失败后直接退化（有云端条件切「仅云端」，否则关闭并提示「本地语音识别不可用」），从不回退系统识别器；③ 系统识别器强制 `EXTRA_PREFER_OFFLINE=true`，设备未下载离线语言包时同样必然失败（AVD Android 16 实测两端都落到 SODA 离线引擎报 `Failed to get language pack of required locale: error 12/13`）。现改为**三级引擎逐级回退**：设备端离线 → 系统识别器（离线优先）→ 系统识别器（允许联网），同一引擎连续 3 次错误即换下一级，三级全失败才按云端条件退化；`ERROR_INSUFFICIENT_PERMISSIONS`（录音权限被撤销）保持直接停并提示，偶发 `ERROR_CLIENT` 由「直接判死」改为计入退化计数。**实测口径**：AVD Android 16 装 release APK，点圆钮后日志完整走 `ON_DEVICE → SYSTEM_OFFLINE → SYSTEM_ONLINE → degraded to cloud-only mode`（已配 API Key 时不再关闭、圆钮保持绿色），全程无 FATAL；MiMo ASR 契约以 MiMo TTS 合成「进入调试模式」音频经 `mimo-v2.5-asr` 实测返回「进入调试模式。」，与 `MimoAsrClient` 的请求体/响应路径一致。
  - 修复：**英文否定词子串误否定**——`no` / `not` 等按子串匹配会把 know、nothing 等普通词判为否定（「I know the test mode is fine」不切换），改按词边界匹配（`\b`）；中文否定词维持子串口径不变。
- **1.8.0**（2026-10-07）：
  - 新增：**移动端设置顶栏三枚圆形操作按钮**——「改为默认设置 / 取消 / 应用更改」三个动作在手机宽度下移到设置顶栏右侧，渲染为三枚 36px 圆形图标按钮（`fa-rotate-left` / `fa-xmark` / `fa-check`，点击转发到底部操作条同 id 按钮，行为单源；EN 词条随 `aria-label` 翻译）；桌面菜单模式仍用底部操作条，不受影响。
  - 新增：**移动端设置一级 ↔ 二级过渡动画**——进入二级：内容自右 1rem 淡入（`sm-detail-in` 240ms）；返回一级：导航自左 1rem 淡入（`sm-nav-in` 240ms）。纯 CSS 驱动（由既有 `settings-mobile-detail` 类切换触发），`prefers-reduced-motion` 下自动降级为瞬时。
  - 新增：**设置页外链改系统默认浏览器打开**——android-app WebView `shouldOverrideUrlLoading` 拦截 http(s)（含设置里的 MiMo 官网链接、夸克网盘、Telegram 等，以及 `target="_blank"` 锚点——WebView 未开多窗口，默认会在控制台 WebView 内原地导航顶掉界面）经新增 `openExternalBrowser()` 走 `Intent.ACTION_VIEW` 打开系统默认浏览器；站内资源（`file:///android_asset/`、blob、about）与页内锚点不受影响。win-app 两个窗口在既有 `setWindowOpenHandler` 之外补 `will-navigate` 兜底（无 `target` 的外链同样交给系统浏览器，不留在壳内导航）。纯网页端保持新标签页打开。
  - 新增：**phone-app 本地语音规则单元测试**——`phone-app/app/src/test/.../VoiceCommandMatcherTest.kt`（JVM + JUnit）覆盖四大模式读音、同音字命中（调式/中诚/回复/你人）、否定词排除、否定局部性、中英语言门控与空文本边界，`./gradlew :app:testReleaseUnitTest` 10 项全绿。
  - 优化：**移动端设置一级界面收紧**——导航卡片与主界面内容边距对齐（左右各 1rem，此前贴屏幕边缘）、卡片间距 6.4px→12px、卡片内边距与组名字号 15.2px→17px、图标 20px→25.6px/1.15rem；一级列表在卡片变高后仍可滚动（`overflow-y:auto`）。
  - 优化：**移动端设置操作条改由顶栏承担**——底部操作条在手机宽度（≤749px）下一律隐藏，一级界面无需进二级即可保存/取消；桌面菜单模式保持原底部操作条。
  - 优化：**Android WebView 任意宽度下的设置形态对齐**——移动端设置的 JS/类门控是 `html:not(.desktop-chrome)`，而样式原只写在 `@media (max-width:749px)`，平板/横屏（≥750px）Android WebView 会出现「导航列不可滚 + 没有任何保存/取消入口」的两套口径错位；补 `html:not(.desktop-chrome)` 分支（顶栏三枚圆形按钮、隐藏 macOS 标题与底部操作条、补齐列容器滚动高度链与卡片形态）。win-app 与浏览器均带 `desktop-chrome`，完全不受影响。
  - 优化：**本地识别不可用时的退化（低功耗）**——连续 3 次识别错误后不再每 300ms 重启识别器（此前设备缺少/禁用识别服务时会无限重启持续耗电）：有云端条件（开关开启 + 有 API Key）则退化为「仅云端」，否则关闭识别并提示「本地语音识别不可用」。计数口径：`ERROR_NO_MATCH`/`ERROR_SPEECH_TIMEOUT`（用户没说话）属正常态不计入，且只有真正拿到识别结果才清零计数——避免安静环境或被识别服务「假就绪」时误判。
  - 修复：**移动端部分二级设置组无法滚动**——`.settings-columns` 在移动端无 flex 规则（只有桌面 `desktop-chrome.css` 有），导致 `.settings-body` 的 `flex/min-height:0/overflow-y` 全部失效、内容高度被撑开后被 `.settings-content{overflow:hidden}` 裁掉，长组（如机器人状态设置 1205px）底部不可达；补齐列容器高度链后二级组可正常滚到底。
  - 修复：**连接链路闪退加固（Android 12+ 全版本范围）**——android-app：① `bluetoothAdapter.bluetoothLeAdvertiser` 取用前补 `BLUETOOTH_ADVERTISE` 校验（此前只校验 `BLUETOOTH_CONNECT`，而该 getter 在 API 31+ 需要 ADVERTISE，权限缺失时在 BLE 线程抛 `SecurityException` 直接崩进程）；② `startServer`、服务重加定时器、广播、读请求/写请求/描述符回调、**连接态变化（`onConnectionStateChange`）、MTU 变化（`onMtuChanged`）、通知发送链路（`notifyCharacteristicChangedToDevice`/`queueNotification`/`sendNextNotification`）** 全部 `runCatching`，`device.address` 等受权限约束的取用不再让异常逃出 BLE 线程；③ `setName()` 从广播的同一 `runCatching` 中拆为独立段（顺序仍在广播之前，保证首个广告包带正确设备名；此前两者同段，`setName` 失败会静默中止整段逻辑、广播永不启动 → 手机端扫不到设备「连不上」）；④ 新增 `sendGattResponse()` 统一回包（`value` 空安全）；⑤ `BleScanner` 扫描回调、`BlePermissionHelper.isBluetoothEnabled`、`startBleServices`、JS 桥 `btStartConnect`/`btShowQr` 全部补权限前置校验与异常兜底（新增词条「缺少蓝牙权限，请重新打开控制台授权」）；⑥ `initialize()` 的扫描器缓存改为**独立重试**（此前若 `bluetoothLeScanner` 取用抛异常，`bluetoothManager` 已被赋值会让 null 守卫永久跳过初始化，补授权限后扫描也起不来）。phone-app：扫描回调 `device.name`/`device.address`、`connectInternal`、`initialize` 的 `bluetoothLeScanner` 取用（同样独立重试）、`isBluetoothEnabled` 全部收口，新增 `connectToConsole()` 包装所有连接入口，`startBleServices` 自动连接/自动扫描段加 try/catch（失败只回退连接状态）。**实测口径**：Android 12 模拟器（`Phone_Android12`）上用改前基线 APK（git HEAD 抽出）与改后 APK 做对照，权限齐全与吊销 `BLUETOOTH_ADVERTISE` 两种情形下点击「开始连接」均无 `FATAL`——即用户报告的闪退未能在模拟器复现，本轮属按静态分析逐点加固，真机日志才是定论。
  - 修复：**设置内链接在控制台内打开顶掉界面**（同上「设置页外链改系统默认浏览器打开」，android-app 侧为实际缺陷修复）。
- **1.7.1**（2026-10-07）：
  - 新增：**phone-app 模式反向推送**——手机端长按顶部模式胶囊弹出模式菜单（调试/恢复/忠诚/拟人四项，各用模式色，另有「关闭」），选中后经 `ConsoleBleClient.writeMode(ordinal)` 写入 Mode(7501) 推给控制端；控制端（android-app / win-app / 浏览器）收到后切换到对应模式、高亮模式按钮、TTS 播报并写日志，再按既有链路把模式回推给所有已连接客户端。未连接控制台时选项提示「未连接控制面板」。蓝牙按钮长按的「注入模拟数据」保持原样。
  - 新增：**控制端「推送成功」提示**——反向推送到达控制端时，android-app 弹原生 Toast（`ConsoleI18n` 词条「推送成功 / Push successful」），win-app 与桌面宽度浏览器弹页面内 macOS 风格通知（`showMacosNotification`，图标 `fa-arrow-right-arrow-left`、正文为模式显示名）；Android WebView 不弹页面通知，避免与原生 Toast 重复。前端统一入口为 `window.__rcOnRemoteMode(ordinal)`（`www/js/app-ble.js`）。
  - 新增：**phone-app 语音识别（本地优先 + MiMo ASR 云端兜底）**——屏幕右上角（与模式胶囊同行）新增圆形麦克风按钮，单击开启并**常态保持**（再点关闭），状态经 SharedPreferences 持久、回到前台自动恢复、退到后台自动停（低功耗）；首次开启申请 `RECORD_AUDIO` 权限。识别文本由本地规则 `VoiceCommandMatcher` 判定：**按读音匹配**（内置汉字→无声调拼音小表 + 滑窗比对，同音字如「调式模式」「中诚模式」同样命中）、**否定词排除**（关键词前 6 字内出现 不/不要/别/不可以/不能/不用/无需/禁止/请勿 即不切换）、**语言门控**（跟随 BLE 7507 下发的界面语言：中文设置只识别中文、英文设置只识别英文）；命中即走与手动推送完全相同的链路切换模式。本地识别用 Android 原生离线识别（API ≥31 且设备支持时 `createOnDeviceSpeechRecognizer`，否则 `createSpeechRecognizer` + `EXTRA_PREFER_OFFLINE`）；仅当本地得到**大段文本**（≥4 字）却未命中、且缓冲音频 ≥1.2s、云端开关开启、已有 API Key、距上次调用 ≥4s、无进行中调用时，才把 16kHz 单声道 PCM（环形缓冲上限 12s，加 WAV 头后 base64）发给 `mimo-v2.5-asr` 兜底识别，返回文本再过一次本地规则。本地识别不可用且开关开启时退化为「仅云端」（能量端点切句），两者皆不可用则提示「本地语音识别不可用」。
  - 新增：**phone-app 设置页云端识别开关**——BLE 对话框（即手机端设置页）API Key 区下方新增「识别引擎调用云端（MiMo ASR）」开关（默认开，切换即落库 `asr_cloud_enabled`）与副提示「关闭后仅使用本地离线识别」；关闭后只用本地离线识别、不产生任何云端调用与费用。
  - 新增：**MiMo 收费提示**——www 设置页「TTS 语音引擎」组与激活页 TTS 段、phone-app 设置页 API Key 区均新增「Xiaomi MiMo TTS和ASR可能需要收费，请阅读官网相关文档。」（词条已入 `www/js/i18n.js` 与 `PhoneI18n` 词典，EN 模式随界面翻译）。
  - 新增：**设置导航图标**——设置组导航（桌面左侧栏与移动端一级列表共用）每组前置一枚本地 Font Awesome 图标（`SETTINGS_NAV_ICONS` 13 组映射：语言 fa-language / 型号信息 fa-id-card / 网页缓存 fa-box-archive / 账号 fa-user-shield / TTS fa-microphone / 灵动岛 fa-wand-magic-sparkles / 运行参数 fa-chart-simple / 按钮文本 fa-pen-to-square / 图片 fa-images / 模式名称 fa-tags / 链接 fa-link / 状态 fa-robot / 导入导出 fa-right-left，缺省 fa-gear）；图标字体 `webfonts/fa-solid-900.woff2` 已 vendored，零联网。
  - 新增：**移动端设置一级/二级界面**——非 desktop-chrome（手机浏览器 / Android WebView）下设置打开为**一级列表**：导航以图标+组名整行卡片纵向排列（此前导航在 <750px 无基础样式、组标题糊成一段文字），设置组本体在一级全部隐藏；点击某项进**二级**：仅显示该组、头部标题换为组名（EN 经写入钩子直译）、头部返回键回一级；一级时返回键关闭设置（`settingsMobileBack()`）。平台门控隐藏的组（不支持缓存时的「网页缓存与 App」，内联 `display:none`）不进导航；跨 750px 进入桌面菜单模式时自动退出二级（resize 守卫）。桌面左侧栏行为不变（点击滚动 + 滚动高亮）。
  - 优化：**Mode(7501) 由只读改为双向可写**——属性 `READ|WRITE|NOTIFY`、权限 `READ|WRITE`（android-app `RobotGattServer` 与 win-app C# 宿主同步）；服务端收到写入立即 `sendResponse(GATT_SUCCESS)`、同步 `characteristicValues` 保持读值一致，仅 ordinal `0-3` 生效（`255`=NA 与其他值忽略），经 `onModeReceived`（android-app）/ `ModeReceived` 事件 → IPC `{"type":"mode","ordinal":n}`（win-app）通知前端。其余六个特征属性未变。
  - 优化：**phone-app 通知标题口径**——普通语音消息仍为「主人指令」；反向推送场景改为「推送成功」。防双弹机制：推送发起时开启 4s 回声窗口，窗口内到达的语音通知用「推送成功」标题并消费窗口（只弹这一条）；窗口内未收到控制端回声则兜底弹一条，并置 4s 抑制窗口挡住晚到的回声。
  - 优化：**设置左侧栏加宽 152px→170px**——补偿导航图标占位，中文组名实测零截断、英文截断程度与加图标前持平；导航基础样式（一级列表/图标尺寸）移入 `css/app.css`，`css/desktop-chrome.css` 仅覆盖桌面左侧栏形态（原「非 desktop-chrome 隐藏导航」规则删除）。
- **1.6.0**（2026-10-05）：
  - 新增：**www 设置页「型号信息」组与型号信息统一机制（三端显示统一）**——完整型号/简称/制造公司/主人/语音播报读法五输入框（各带中英默认值提示），存储 localStorage `robotModelInfo`（五键全量对象，`''`=默认）。**整组匹配规则**（与模式名一致）：五项整体完全等于中文默认组或英文默认组（= i18n 词典译文）才随界面语言显示对应语言默认内容；任意一项自定义（含中英混搭）→ 全组按保存原文显示（自定义不支持双语标签）；留空恢复该项默认。**两条显示通路**：① JS 拼接句改用"句子模板函数"按语言直出完整句（modelSentenceSysTitle/PanelTitle/Logout/Connected/ConnectedOk/SendingTo/EnteredMode/MasterDe——不再依赖 DICT 整句词条，自定义简称后整串匹配不失灵），覆盖主/标题栏、三栏 header（含"内部系统面板"拼接）、单栏 hero、bt-modal 设备型号/制造公司/标题、灵动岛连接通知、Male_2 传输行、退出登录菜单与确认弹窗、充电/macOS 通知 appName、进入模式日志与终端回显、document.title；② 静态 DOM 经 `data-model-info` 属性 + `applyModelInfoToDom()` 扫描写入（boot/设置保存/语言切换后调用，语言切换经 i18n.js 新增 `rc-lang-changed` window 事件广播重刷）。自定义内容入 i18n 保护集防 EN 子串误译。**排除区**（不改）：终端 init/system 清单/关机提示、登录页标题、启动器芮誊公司名与版权行、PDF 物理文件名（仅名称显示可配）、phone/watch/android 原生标签。**win-app 启动器联动**：launcher（app://design）与控制台（app://bundle）localStorage 不互通，主进程新增 `huancun/model-info.json` 持久化 + IPC `model-info-get`/`model-info-set`，控制台保存/启动时经 `consoleAPI.setModelInfo` 推送生效值（zh 源串五键），启动器经 `electronAPI.getModelInfo()` 读取并动态刷新 `app-title` 主标题（EN 由 launcher-i18n 覆盖层按默认词条翻译，自定义名无词条自动原文显示）；浏览器/Android 无此桥自动跳过。
  - 新增：**www 设置页「信息面板链接」组**——信息面板 4 个可配置链接（演示合集/公众号/社交账号/机器人日志）的名称与 URL 可自定义，存储 localStorage `robotInfoLinks`（`[{id,name,url}]`，null=全部默认；`get-app` 为 action 项不可配置不进存储）；`renderFileList()` 改按 id 合并生效值渲染（打开/新窗口/日志均用生效 URL 与名称）；URL 仅允许 http/https 前缀校验；名称整组匹配默认时随界面语言（默认名词条已在 DICT），任意一项自定义按原文显示并入保护集；「恢复默认链接」立即回填输入框、应用更改后落库；PDF 说明书条目不进设置组（文件名含公司名固定不可改，恒用默认名）。
  - 新增：**www 设置页「配置导入导出」组**——「导出配置」收集 13 个 localStorage 键（按钮文本/信息参数/模式名称/型号信息/信息链接/运行参数/账号/两张图片/情绪/界面语言/MiMo Key/MiMo 引擎）为 `{version:1, exportedAt, data:{...}}` JSON 下载 `robotcontrol-config-YYYYMMDD.json`；「导入配置」经文件选择校验版本与结构、confirm 确认覆盖后逐键写入并自动刷新页面；`robot_ui_lang` 按裸串存储处理；说明文案标注"含登录密码与 API Key 等敏感信息及可能较大的图片数据，勿外传"。
  - 新增：**www 首次启动激活引导页**——登录页显示前检查 localStorage `robotActivated`，未激活时显示 `#activation-modal`（body 直下，复用 `.login-modal`/`.login-card` 体系与随机登录背景，z 与登录层同级）：单页表单范围与分组见下方「激活页全量设置」条目；「开始使用」复用设置页同一套 set 函数依次落库 + `robotActivated=true` 后回落登录页，「跳过，保持默认」仅置标记；完成后不再出现。文案全部走 DICT（EN 支持）。**仅浏览器与 win-app 出现**：Android App 无登录界面（v1.6.0 起按平台保证——`platform-bootstrap` 暴露 `__rcIsAndroidWebview`（排除 win-app preload 同名暴露的 `window.Android`），登录门控改 `innerWidth < 750 || __rcIsAndroidWebview`，任何宽度直接进主界面，不再依赖 <750 宽度的巧合；历史版本纯宽度判断在 Android ≥750 宽度（平板/横屏）时会误出登录页），phone/watch 原生端亦无；浏览器首访强制缓存窗口（z 952/955）层级高于激活层——先完成缓存再激活，互不卡死。**实现要点**：激活页按钮绑定必须放在 DOMContentLoaded（`initEventListeners` 登录成功后才执行，绑定放那里激活页显示期间点击无响应）。**android-app 竖屏锁定**：MainActivity 补 `android:screenOrientation="portrait"`（历史清单从未锁定，横立时 WebView 宽度 ≥750 会露出桌面 UI；App 设计为竖屏手机端）。
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
- **1.5.0**（2026-10-05）：
  - 移除：phone-app 长按顶部胶囊手动切换语言——显示语言改为**完全跟随发送端**（BLE 7507 UiLang，见新增），phone 端不再提供语言设置入口。
  - 新增：**www 设置页「模式名称设置」组（三端共享）**——四大模式（调试/恢复/忠诚/拟人）显示名自定义，每行附该模式功能简介（附录文案逐字采用，中文原文入 `app-core.js` MODE_DESCRIPTIONS、EN 全文入 i18n 词典）；点击「应用更改」时存在修改先弹确认对话框（`#mode-name-confirm-modal`，复用 self-check-alert 体系 + applyDialogScope）逐条列出「原名 → 新名 + 简介」，确认后随本次设置一并保存、取消整体不保存。存储 localStorage `robotModeNames`（四键全量对象，`''`=默认；「改为默认设置」一并重置）。**匹配规则**：四名整体完全等于中文默认组或英文默认组（= i18n 词典译文）才视为默认，按界面语言显示对应语言默认名（EN 仍走词典翻译与 `.mode-btn` 成组拟合，行为与既有静态文案一致）；一半中文默认一半英文默认的混搭与自定义均按保存原文显示（自定义名不支持中英双语标签），留空恢复该模式默认名。显示统一经 `getModeNameSource()` 中文源串解析——模式按钮（单栏/三栏/showcase 圆钮共 10 处）、模式菜单、进入日志、终端 help/回显、TTS 播报、状态栏 title 全部接入。自定义内容经 i18n.js 新增 `I18N.setProtected()` 精确匹配保护集跳过翻译，防 EN 模式子串误译成中英混杂。
  - 新增：**BLE 7507(UiLang) 界面语言特征 + phone 显示语言跟随发送端**——1 字节 `READ|NOTIFY`（0x00=zh、0x01=en、0xFF=未设置，详见 BLE 协议文档）；android-app `RobotGattServer.sendUiLang()`（初值取 `ConsoleI18n.getLang()`，JS 桥 `setUiLang` 同步推送，订阅 CCCD 后自动补发当前值）；win-app C# 宿主同特征，Electron 主进程在宿主就绪与每次广播启动时补推、IPC `i18n-set-lang` 即时推送（防"先切语言后开广播"被初值覆盖）；phone-app 订阅+初读 7507，`onLangReceived` → `PhoneI18n.setLang` 并 recreate，0xFF 保持当前语言，最近一次语言经 SharedPreferences 持久化为未连接初值。协议先落 BLE 协议文档后改代码。
  - 新增：**watch-app 保活机制**（网络调研小米/OPPO 等定制后台管控后落地，官方正路=connectedDevice 前台服务）——`BleKeepAliveService` 前台服务（`foregroundServiceType="connectedDevice"`、START_STICKY，manifest 增 `FOREGROUND_SERVICE`/`FOREGROUND_SERVICE_CONNECTED_DEVICE`/`POST_NOTIFICATIONS`/`RECEIVE_BOOT_COMPLETED`/`VIBRATE`/`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`）承载 BLE 连接生命周期、数据回调接线（→WatchDataStore）与**模式切换震动**：拟人=两短 `[0,150,150,150]`、忠诚=两长 `[0,600,200,600]`、调试=一长 `[0,600]`（恢复模式与 NA 不震；同一序号 1s 内去重防"初读+订阅推送"双震）；常驻通知（IMPORTANCE_LOW）显示连接状态+当前模式，点击回 App；`onTaskRemoved` 经 AlarmManager 1s 自重启，`BootReceiver` 开机（仅已绑定）拉起恢复连接；**保活设置引导**首连成功弹一次（蓝牙按钮菜单「保活设置」可再开）——按厂商适配文字指引（小米：自启动授权管理+耗电优化无限制+任务锁定；OPPO/一加/真我：自启动管理+耗电管理允许后台）+「电池优化白名单」（`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`，失败回退列表页）与「应用信息」跳转按钮，一次性记忆。MainActivity 的 BLE 生命周期改为仅拉起服务（连接与回调在服务），`onDestroy` 不再断开 BLE（修复销毁即断连）；Activity 经 WatchDataStore 新增的 `onBleStateChanged` 观察连接状态渲染按钮。
  - 修复：**watch-app 无法连接控制台**——三层根因一并收口：① 运行时请求了 manifest 未声明的 `BLUETOOTH_ADVERTISE` 权限，系统直接拒绝（不弹窗）导致 `hasAllPermissions` 恒 false、BLE 永不启动（致命阻断）；② 扫描回调 `device.name` 为 null 时丢设备（android-app 控制台名字在 scan response，首轮缓存名可空）——改为 ScanFilter 按 UUID 过滤命中即接受、名称以 scanRecord 优先仅作展示；③ 4 次 CCCD 写不排队只等第 1 次（Emotion/Tasks/Voice 通知订阅失败、连接后数据不动）+ 无 MTU 协商与分片重组（长 JSON 任务/语音每片被当完整包解析失败）——`PhoneBleClient` 对齐 phone-app ConsoleBleClient 成熟模式重写：GATT 操作串行队列、`requestMtu(512)` 先行再发现服务、`0x7E` 三字节包头分片重组、`connectGatt(TRANSPORT_LE)`。实测（WearOS 模拟器）：权限链路通过、前台服务启动（isForeground、channel=ble_keepalive）、常驻通知内容随状态正确；真机 BLE 射频与震动手感需实机验证。
  - 修复：**仿人男性机器人信息参数中英文显示逻辑**（与四大模式同规则、按项判定）——以标签锚定默认项，值与该项中文默认或英文默认（i18n 词典译文）完全一致时随界面语言显示对应语言默认内容（此前若用户填入英文默认值，中文模式会原样显示英文）；否则按保存原文显示。自定义内容同样入保护集防子串误译；作用于移动端状态列表、三栏信息参数 chips、「关于本机」窗口；设置页输入框仍显示保存原文。
- **1.4.0**（2026-10-03）：
  - 新增：**win-app 启动器设置面板「界面语言」切换组**（`design/launcher.html` 设置面板顶部，中文/English 按钮、`lang-btn.active` 绿色选中态）——点击写 localStorage `robot_ui_lang`（浏览器/宣传影片 iframe 场景的同步源）+ IPC `i18n-set-lang`（主进程 `huancun/i18n-lang.json` 持久化）+ `LauncherI18N.setLang` 界面即时切换；选中态由 `launcher-i18n.js` `applyLang` 派发的 `launcher-lang-changed` 事件统一刷新（初始异步确定语言后同样同步），语言按钮文字各自保持「中文 / English」不翻译。**启动器 → 主控制台语言跟随链路**：`preload.js` 顶层 `sendSync('i18n-get-lang-sync')`（main.js 新增对应 handler，返回 `i18n.getLang()`）经 `consoleAPI.bootLang` 在页面脚本运行前带回，`www/js/i18n.js` 头脚本以该值为初始语言事实源并对齐 localStorage 副本（浏览器/Android 无此桥维持原行为）——启动器切英文后进入控制台即为英文界面（标题栏、登录页、主界面全程英文，无中文闪帧；EN 首屏遮罩判定在 bootLang 采用之后不受影响）。
  - 修复：**EN 模式大量按钮被迫显示成两行**——窄体字体 `www/webfonts/MonoNarrow-{Regular,Bold}.woff2` 是本地生成产物（从未入库），仓库回退时工作区文件丢失，`fonts-face.css` 声明悬空导致 `i18n.js` 窄体可用性门控（`document.fonts.check('MonoNarrow')`）整体跳过拟合，所有按钮按正常字宽放不下即两行；经 `tools/gen-mono-narrow.py` 重新生成（Regular/Bold 各约 8KB）并重建缓存清单后恢复。实测（1440×900 EN 登录+主界面几何审计）：非豁免区 189 个翻译文本叶子 EN 行数与中文全部一致，四枚模式按钮单行、按钮高 68px 与中文一致（Simulated Human Mode 走窄体+分级字号）。
  - 修复：`win-app/test/titlebar.test.js` 三处断言未随实现迁移更新——窗口标题已改经主进程 `i18n.t` 按语言输出、标题栏样式实体已从 HTML 内联迁至 `css/titlebar-fusion.css`（`-webkit-app-region` 拖拽区/窗口按钮/毛玻璃/Acrylic 分层等）、登录壁纸已是 `Background.webp`；断言随实现归属修正，`npm test` 60 项全绿。
- **1.3.5**（2026-09-25）：
  - 移除：phone-app `values/strings.xml` 中布局与代码均未引用的死资源键（emotion_*、test_button、section_* 等），`no_tasks`/`no_voice` 改经 `PhoneI18n` 输出。
  - 新增：全端界面英文模式（手表端不参与），默认中文、设置中可切换。www 主控制台：设置页新增「语言」组（中文/English 按钮；`js/i18n.js` 运行时覆盖层，中文源文案零改动，EN 模式替换文本节点与 title/placeholder 等属性并随动态内容更新，localStorage 持久；术语遵循 T31-750 英文版说明书——Male Android / Simulated Human Mode / Test Mode / Self-check / Artificial Semen / Appearance-Data 等），登录页、主控制台、自检/系统更新全流程输出、终端与缓存控制台均有英文文案；win-app：主进程窗口标题与 BLE 宿主错误文案（`app/i18n.js`，`huancun/i18n-lang.json` 持久，IPC `i18n-get-lang`/`i18n-set-lang` 与页面语言双向同步）、启动器界面（`design/launcher-i18n.js` 覆盖层）与闪屏页标题随动；android-app：原生 Toast/PDF 提示（`ConsoleI18n`）经 JS 桥 `Android.setUiLang` 与页面语言同步，启动器标签随系统语言（`values-en/strings.xml`）；phone-app：原生文案全量接入 `PhoneI18n`（长按顶部胶囊切换中文/英文，情绪面板/任务/语音消息/模式名/连接面板/权限与扫描提示均覆盖），app 标签与胶囊初始文案随系统语言（`values-en/strings.xml`）。实现含两处稳定性收口：MutationObserver 同值重写守卫（同值写入会再次触发 Observer 形成微任务自反馈死循环、卡死渲染——Android WebView 实测复现并修复，www 与启动器覆盖层均带守卫）与登录过渡屏写入时直译（EN 模式不依赖 Observer，防中文闪帧）。机制详见整体架构文档「前端单源架构」。
  - 优化：EN 模式英文字形**自适应缩窄**——等宽英文 75% 横向压缩（advance 0.6em→0.45em，16px 字号下单字 9.6px→7.2px），但**不做全页缩窄**：i18n.js `fitPass` 逐块实测 EN 与中文原文的行高/宽度（块级容器与文本直接父元素双向比对，兼容图标+行内标签结构），仅 EN 占更多行/更宽的元素加 `.i18n-cn-fit`（窄面 + 常规字重窄家族）；窄体仍放不下时**分级缩小字号**（0.9→0.6 倍，辅以 -0.03em 字距；字号只作用于高度增长的文本元素本身，图标/按钮容器不动，板块布局不变），完整术语保持单行显示（三栏模式按钮：Test Mode/Recovery Mode/Loyalty Mode @14px、Simulated Human Mode @9.8px 全部单行），保证与中文相同的行数布局与可读性层级（先缩窄、后缩字号）。窄面字体 `webfonts/MonoNarrow-{Regular,Bold}.woff2`（各约 8KB）由本机 JetBrains Mono 可变字体实例化+横压生成（工具 `tools/gen-mono-narrow.py`，衍生按 OFL 改名不占用保留名）；以 `font-stretch: condensed` 面注册进 'JetBrains Mono' 家族（粗体场景自动命中），中文默认模式无拟合类、渲染与字体下载逐位不变。EN 首屏**一步到位**：i18n.js 头脚本阶段即挂 `html.i18n-fitting` 遮罩（body visibility:hidden，布局保留可离线测量；头脚本执行于首帧绘制前，实测遮罩挂载 @12ms < 首帧 @144ms），全量拟合防抖仅 30ms、完成后立即显形，4s 安全超时兜底；语言动态切换同路径。杜绝「先正常字宽渲染、再缩窄缩字号」的文字闪烁与位移。拟合为增量驱动（语言切换/登录显形全页，动态内容仅重拟合受影响块，秒级时钟不触发全页测量），写入经同值守卫不回灌 Observer。防抽搐四件套：① 判定按「块宽 24px 分桶+原文内容」签名缓存，动态区域（调试日志等）内容不变零重测，杜绝测量翻转引发的类增删振荡；② 重测前先摘窄体类取真实 zh 基线；③ 拟合进行中到达的变更入队不丢弃（收尾自动续跑，修复登录初期静态块——如模式按钮——永久漏拟合），await 字体加载后与逐块拟合前双重复检语言（修复 EN 拟合落在已切回的 zh 页面上的竞态）；④ 切换回中文时 DOM 扫描兜底清 class（防追踪集合替换导致的泄漏）。
  - 优化：**拟合豁免区**——终端输出、调试日志、自检/更新代码窗口等滚动文字不再强制对应中文行数（正常字宽自由换行），App 引导浮窗/通知等可自适应尺寸的浮窗同样豁免（正常字宽更易识别）；窗口 resize 时 EN 模式全页重拟合。窄面字体去 TrueType hinting（`tools/gen-mono-narrow.py` 丢弃 `cvt `/`fpgm`/`prep`）：hinting 指令按原始轮廓坐标写，缩放轮廓后小字号网格拟合错位，会在字母间渲染出「引号状」伪影（复制不可见），去 hinting 后消除。EN 日期改美式习惯 `Sep 25, 2026 Fri 20:45:18`；公司名英译更正为 Rt5 A.I. Fictional Liability Company（芮誊/芮誉智能虚构公司及相关组合句）。
  - 优化：**EN 首屏一步到位**——i18n.js 头脚本阶段即挂 `html.i18n-fitting` 遮罩（body visibility:hidden，布局保留可离线测量），拟合完成后显形，4s 安全超时兜底；语言切换同路径。消除"先正常字宽渲染、再缩窄缩字号"的文字闪烁与位移（字体加载 await 与逐块拟合前双重语言复检，杜绝 EN 拟合落在已切回的 zh 页面）。
  - 优化：EN 文案用词调整——界面显示的 robot 一律作 **Android**（仿人男性机器人=Male Android；Android Control Console/Live Code/Info Parameters 等；C++ 代码内容与包名/协议名类标识符除外），机械度=**Robotical**；.phone-app 同步。
  - 优化：右上角日期 EN 模式随语言输出 `2026-09-25 Fri 12:34:56` 格式（原 `2026年09月25日 周五`，app-core.js 写入时直译，zh 格式一字不变）；EN 文案残留的全角括号统一转半角（`（/）`片段映射）。
  - 修复：**EN 打开/切换仍闪一下**——三层根因一并收口：① `visible()` 把 `html.i18n-fitting` 遮罩下的 `visibility:hidden` 当成不可见，首屏拟合空跑、显形后再补拟合造成位移（遮罩下改按几何尺寸判定）；② fitGroup/class/style 写入经 MutationObserver 回灌 `scheduleFit` 形成无限重拟合，字号来回跳（拟合写入期间 `withMOOff` 断开 Observer + fitGroup 组签名缓存）；③ 增量防抖不断 `clearTimeout` 顶掉全量 0ms 任务，显形与中文清类被拖慢（全量待办优先、不被增量推迟；切回中文 `setLang` 立即 `clearFit`）。另：语言键统一 `robot_ui_lang`（兼容迁移旧键 `android_ui_lang`）；字体已就绪时同步拟合免 Promise 往返，慢加载 180ms 兜底不挂 4s；解析期增量翻译（首帧前完成中→英），主界面 `display` 显形后 `I18N.refit()` 同步补拟合。实测 EN 打开约 160ms 内一步显形且拟合数稳定（无振荡），zh 切换拟合类立即清零。
  - 优化：**EN 拟合策略按视觉硬性要求收紧**——能正常放下的保持正常字宽；放不下才缩窄，仍放不下再缩小字号。**仅 `.mode-btn` 成组**统一字号保证与中文同行数（Simulated Human Mode 等单行、按钮高 68px 与中文一致）；其余兄弟块逐块拟合，禁止被最长标签拖成过小字号（Bath/Furniture 等恢复正常 12px）。代码/弹窗/**「关于本机」**整窗豁免缩窄。关于页英文布局重做：副标题公司全称+元数据两行、状态行长标签上下两行、硬件子标写入时直译且同值不写（防每秒重写引发抽搐）。
  - 新增：**`css/i18n-en.css` 英文专属排版层**——全部选择器挂在 `html[lang='en']`，**中文一字一形零改动**（实测登录卡 zh 384px/24px 与改前逐位一致）。内容：登录卡放宽至 30rem 且标题单行、Latin 字距/行高微调、弹窗（自检提示 32rem / bt-modal 420px）英文侧加宽；后续 EN 细节一律写入此文件，禁止散落进 app.css/fonts.css。h2 增加语义类 `login-title` 便于扩展。
  - 修复：**动态窗口闪中文**——过程/自检/更新/PDF 等运行时 `textContent` 写入先中文再靠 Observer 翻译会闪帧；i18n.js 挂 `Node.textContent` 写入钩子，EN 下含中文则**写入时直译**并保留 `__i18nOrig` 供拟合比对。**可改窗体大小的窗口**（DWM 浮窗/关于/设置/弹窗）整窗豁免缩窄缩字，英文在 `i18n-en.css` 加宽即可；仅主界面固定区（模式按钮等）走缩窄。拟合字号改 **rem**（`0.525rem` 等），浏览器/窗口缩放连续跟手不跳变；resize 全页重拟合防抖 180ms + 签名缓存，避免「先宽后窄」抽搐。中文写入路径实测不变。
- **1.2.0**（2026-09-12）：
  - 移除：登录壁纸 `pic/login/Background.png`（由压缩格式 `Background.webp` 替代，引用与缓存豁免清单同步更新）。
  - 新增：自检「Male_2.png 传输」叠加层——自检文本进行到传输行时弹出右侧图片浮窗（**3:4 竖版**，占位素材 `www/pic/Male_2.png`（960×1280），替换该文件即换图）与「正在发送至T31-750」进度对话框（scope 附着自检过程窗口）；发送进度固定约 1.5 秒走完（接收行提前到达则提前补满）、停留 0.5 秒后淡出，图片窗保留至「软件性别和仿真性设置已成功运行」行显示后按 genie/淡出动画关闭；过程窗口关闭或关机中止时连带收起。版本记录段自本版本起建立。
  - 优化：登录背景图压缩（壁纸 PNG 706KB → WebP 179KB、Gemini 登录封面 620KB → 238KB，像素尺寸不变保持清晰；其余 4 张封面经测试已处于压缩极限，维持原样）；登录页标题「仿人男性机器人操作系统」→「仿人男性机器人控制台」。
  - 修复：win-app 全屏下 DWM 浮窗拖动/最大化上界仍按非全屏的 80px 钳制，窗口无法贴到菜单栏正下方（`headerH()` 改读 body 计算的 `--header-total`，全屏 40px 与菜单栏对齐）；缓存清单嵌套 `.mimosa` 会话目录（`css/.mimosa`/`js/.mimosa` 等任意层级）泄漏未排除；浏览器端登录前打开的缓存控制台窗口被 DWM 焦点序覆盖——窗口内任意点击即把 z 从 955 重写回 920-938、掉到登录层之下不可见（看似"未显示/关不掉"，登录后才重新出现），`bringToFront` 对 ≥950 的提层窗口保持原层级并在焦点序归一化时跳过。
