# android-app（控制台端）

## 概述

- **目录**：[android-app](file:///d:/AIProject/RobotControl/android-app)
- **包名**：`com.robotcontrol.console`
- **技术栈**：Kotlin + WebView + HTML/JS/CSS 混合架构
- **BLE 角色**：GATT Server（中心广播端）
- **设备名**：`RobotControl-Console`
- **入口 HTML**：`app/src/main/assets/www/芮誊T系列仿人男性机器人控制台V1.1.html`（构建期由仓库根 `www/` 经 Gradle `syncWww` 同步，勿手改）

## 目录结构

```
android-app/
├── app/
│   ├── src/main/
│   │   ├── java/com/robotcontrol/console/
│   │   │   ├── MainActivity.kt              # 主 Activity，WebView 容器 + JS Bridge + 闪屏视频
│   │   │   └── ble/
│   │   │       ├── BleConstants.kt          # BLE 常量（UUID、状态码、超时）
│   │   │       ├── BlePermissionHelper.kt   # 蓝牙权限请求工具
│   │   │       ├── BondStore.kt             # 配对信息持久化（SharedPreferences）
│   │   │       └── RobotGattServer.kt       # BLE GATT Server 单例实现
│   │   ├── assets/www/                      # 前端资源（Gradle syncWww 从仓库根 www/ 同步，排除 .mimosa 及各级子目录，gitignore，勿手改）
│   │   │   ├── 芮誊T系列仿人男性机器人控制台V1.1.html  # 前端入口
│   │   │   ├── MimoTTSClient.js             # MiMo TTS 引擎封装（白桦/音色设计+localStorage缓存）
│   │   │   ├── RotationSprite.js            # 旋转精灵图引擎（灰模/彩色双精灵 + JSON 状态机）
│   │   │   ├── pic/Rt5Open.mp4              # 闪屏视频（首帧纯黑）
│   │   │   ├── chart.js / chart.umd.min.js
│   │   │   ├── icons/ / webfonts/ / pic/ / sprites/   # 静态资源（sprites 为旋转精灵图+JSON）
│   │   │   ├── doc/                         # 滚动模拟数据文档（JSON + robot_code.txt + 自检.txt）
│   │   │   │   ├── clear_process_data.json  # 清空所有进程的进程列表（80条）
│   │   │   │   ├── system_update_data.json  # 系统更新阶段/代码片段/内容
│   │   │   │   ├── database_update_data.json # 数据库更新数据
│   │   │   │   ├── boot_data.json           # 开机启动阶段数据
│   │   │   │   └── robot_code.txt           # 代码窗口滚动文本
│   │   │   └── ...
│   │   ├── res/
│   │   │   ├── drawable/splash_icon.xml     # 透明drawable，系统SplashScreen图标
│   │   │   ├── layout/activity_main.xml     # FrameLayout(WebView + TextureView闪屏层)
│   │   │   ├── values/themes.xml           # Theme.App.Transparent + Theme.SplashScreen.RobotControl
│   │   │   ├── values-v31/themes.xml        # Android 12+ 原生SplashScreen主题覆盖
│   │   │   ├── values/colors.xml            # splash_background=#000000
│   │   │   └── ...
│   │   └── AndroidManifest.xml
│   └── build.gradle
└── ...
```

## 核心类说明

### MainActivity

[MainActivity.kt](file:///d:/AIProject/RobotControl/android-app/app/src/main/java/com/robotcontrol/console/MainActivity.kt)

单 Activity 架构，职责：
1. 初始化全屏沉浸式 UI（EdgeToEdge）
2. 配置 WebView 并加载本地 HTML
3. 注册 JS Bridge 接口（`Android` 对象）
4. 管理 BLE Server 生命周期
5. 处理系统返回键、文件选择、PDF 打开
6. 处理 SafeArea（状态栏/导航栏/输入法）适配并通知前端
7. 管理闪屏视频覆盖层（TextureView + MediaPlayer），遮住 HTML 加载初期

Manifest 要点（2026-09 架构优化）：`MainActivity` 设 `launchMode=singleTask`（浏览器经 `robotcontrol://console` 深链拉起时 intent 经 onNewIntent 送达现有实例，不堆叠多实例），并在 LAUNCHER 之外新增 VIEW+DEFAULT+BROWSABLE intent-filter（`scheme=robotcontrol, host=console`）——与 www 浏览器端拉起引导（`js/app-launch.js`）及 win-app 的同名协议注册配套；应用已在前台/后台时拉起仅聚焦现有实例，不改变任何运行逻辑。**1.6.0 起 `MainActivity` 补 `android:screenOrientation="portrait"` 竖屏锁定**（历史清单从未锁定，此前"无横屏"仅是窄屏宽度巧合）。

**无登录/激活页平台保证（1.6.0）**：Android App 不存在登录界面与激活引导页，与窗口宽度解耦——`js/platform-bootstrap.js` 暴露 `__rcIsAndroidWebview`（`window.Android && !window.consoleAPI`，排除 win-app preload 的同名 `window.Android` 暴露），app-core 登录门控为 `innerWidth < 750 || __rcIsAndroidWebview`：Android WebView 任意宽度直接进主界面。历史版本门控为纯 `innerWidth < 750` 宽度判断，竖屏 CSS 宽 ≈411px 从未触发 ≥750 分支，属"宽度巧合"而非设计保证。

关键成员：
- `webView: WebView` - WebView 实例
- `splashVideoView: TextureView` - 闪屏视频覆盖层（在 WebView 之上）
- `splashMediaPlayer: MediaPlayer` - 闪屏视频播放器
- `splashSurface: Surface?` - 缓存的 Surface（SurfaceTexture 就绪时保存，用于延迟绑定）
- `videoFirstFrameRendered / videoEnded / webReady / splashDismissed` - 闪屏状态标志
- `splashPlayerPrepared: Boolean` - MediaPlayer 是否已 prepare 完成
- `safeAreaTop / safeAreaBottom: Int` - 安全区域 insets（单位：dp）
- `imeHeightPx: Int` - 输入法高度（像素）
- `networkExecutor: ExecutorService` - 后台线程池（2线程），用于 `mimoFetchAsync` 异步 HTTP 请求和闪屏视频缓存复制
- `mimoFetchResults: ConcurrentHashMap<String, String>` - MiMo Fetch 异步响应存储（通知+拉取模式）
- `ttsMediaPlayer: MediaPlayer?` - TTS 原生音频播放器（解决 WebView Blob URL 静默失败）

### RobotGattServer

[RobotGattServer.kt](file:///d:/AIProject/RobotControl/android-app/app/src/main/java/com/robotcontrol/console/ble/RobotGattServer.kt)

BLE GATT Server 单例（`object`），职责：
1. 创建并启动 GATT Server，添加 Service 和 5 个 Characteristic（含心跳）
2. 启动 BLE 广播（Advertising），设备名设为 `RobotControl-Console`
3. 维护连接设备列表，支持多设备连接
4. 处理 MTU 变更、CCC Descriptor 写入（订阅通知）
5. 发送 Mode/Emotion/Tasks/Voice 数据，支持大数据分片传输（Magic=0x7E）
6. 按“设备地址 → Notification 队列”顺序异步发包，替代阻塞式 `Thread.sleep`，避免大任务/语音分片阻塞心跳与握手
7. 维护心跳检测：每 5s 向所有已连接设备 Notify `0x01`，断开时发送 `0xFF`
8. 独立 BLE 线程（`BleServerThread`）处理所有 BLE 操作

关键 API：
```kotlin
fun initialize(context: Context)
fun startServer(context: Context)  // 内部检查 BLUETOOTH_CONNECT 权限，无权限则安全返回
fun stopServer()
fun ensureAdvertising()            // 内部检查 BLUETOOTH_ADVERTISE 权限，仅在 !isAdvertising 时启动广播
fun sendMode(modeOrdinal: Int)
fun sendEmotion(obedience: Int, shame: Int, pleasure: Int, mechanical: Int)
fun sendTasks(tasksJson: String)
fun sendVoice(voiceJson: String)
fun sendUiLang(lang: String)       // 1.5.0 新增：UiLang(7507) 通知（0x00=zh/0x01=en），语言变化即推，订阅后自动补发
fun sendDisconnectNotification()   // 发送 0xFF 心跳通知所有设备，停止心跳定时器
fun setManualDisconnectReceived()  // 标记收到对端0xFF手动断开信号
fun consumeManualDisconnect(): Boolean  // 消费并返回是否为手动断开，用于 onConnectionStateChanged 区分状态
fun startServerHeartbeat()         // 启动服务端心跳定时器（每 5s 发送 0x01）
fun stopServerHeartbeat()          // 停止服务端心跳定时器
fun validateConnectedDevices()     // 同步 BluetoothGattServer 真实连接列表，清理或回补设备映射
fun isRunning(): Boolean
fun isConnected(): Boolean
var onConnectionStateChanged: ((connected: Boolean, deviceAddress: String?) -> Unit)?
var onApiKeyReceived: ((apiKey: String) -> Unit)?
```

初始特征值（冷启动）：
- Mode: `[0xFF]`（NA 模式，255）
- Emotion: `[100, 0, 100, 50]`（默认情绪）
- Tasks: 空
- Voice: 空
- Heartbeat: `[0x01]`（服务端心跳信号）
- UiLang (7507，1.5.0 新增): `[0x00]` 默认中文，`setupGattService` 时按 `lastUiLang`（最近一次 `sendUiLang` 的值）写入初值

> **注意**：初始特征值仅在 GATT Server 启动时写入。HTML 页面加载后通过 `setInitialNaState()` 同步 mode=255 + emotion + tasks + voice-history 到 GATT 特征值，确保 Phone 端连接时能读到正确的初始数据。

#### Notification 发送可靠性

- 每个 Device 维护独立的 `ConcurrentLinkedQueue`，单包和分片包都经同一队列投递。
- 当前包发送后由 BLE Handler 调度下一包：成功或旧 API 发出后延迟 20ms，非 `GATT_SUCCESS` 延迟 50ms，异常立即跳过当前包继续处理队列。
- 设备断开时清空该设备的 Notification、MTU 和连接映射；服务端心跳保持原 5s 间隔。

#### 连接状态校验

- `validateConnectedDevices()` 以 `BluetoothGattServer.getConnectedDevices()` 为准清理陈旧映射，并回补实际已连接但未记录的设备；GATT Server 未创建时清空全部缓存。
- 权限可用的冷启动服务和 `btStartConnect()` 都会先执行该校验，避免 Activity 重建后的残留映射造成假连接。

### BlePermissionHelper

[BlePermissionHelper.kt](file:///d:/AIProject/RobotControl/android-app/app/src/main/java/com/robotcontrol/console/ble/BlePermissionHelper.kt)

蓝牙权限与开关工具类，处理 Android 12+ 新权限模型。

### BondStore

[BondStore.kt](file:///d:/AIProject/RobotControl/android-app/app/src/main/java/com/robotcontrol/console/ble/BondStore.kt)

SharedPreferences 存储已配对的 Phone 端 MAC 地址，启动时自动重连。

---

## JS Bridge 接口

通过 `webView.addJavascriptInterface(jsObject, "Android")` 绑定，前端通过 `window.Android.xxx()` 调用。

### JS → Kotlin（23 个 @JavascriptInterface 方法）

| 方法名 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `getSafeAreaTop()` | - | `Int` | 获取顶部安全区域高度（dp），用于沉浸式适配 |
| `getSafeAreaBottom()` | - | `Int` | 获取底部安全区域高度（dp） |
| `getImeHeight()` | - | `Int` | 获取输入法键盘高度（像素） |
| `setModalState(open: Boolean)` | open: Boolean | - | 通知原生当前是否有模态框打开（影响返回键行为） |
| `openExternalUrl(url: String)` | url: String | - | 用外部浏览器打开 URL |
| `openPdfFile(filePath: String)` | filePath: String | - | 打开 PDF 文件（支持 http(s)、asset、相对路径），复制到 cache 后通过 FileProvider 打开 |
| `btGetStatus()` | - | `Int` | 获取当前 BLE 连接状态（0=未绑定, 1=已连接, 2=断开, 3=连接中, 4=手动断开） |
| `btUnbond()` | - | - | 断开蓝牙连接，先调用 `setManualDisconnectReceived()` 标记手动断开，再发送 `sendDisconnectNotification()` 通知对端，然后 `disconnectAllClients()` 并清除配对绑定，UI 状态设为 4（手动断开） |
| `btShowQr()` | - | `String` (JSON) | 获取本机用于 QR 码配对的信息：`{"mac","name","service","role":"console"}` |
| `btStartConnect()` | - | - | 启动 BLE Server 并开始广播等待连接 |
| `onDataChanged(type: String, json: String)` | type, json | - | 前端数据变化通知，type 为 `"mode"/"emotion"/"tasks"/"voice"/"voice-history"`，见下方说明 |
| `btOnPageLoaded()` | - | - | 前端页面加载完成回调，若未绑定设备则弹出发现设备模态框 |
| `getMimoApiKey()` | - | `String` | 获取 MiMo TTS API Key（SharedPreferences 持久化，key=`mimo_api_key`） |
| `setMimoApiKey(key: String)` | key: String | - | 保存 MiMo TTS API Key |
| `getTtsEngine()` | - | `String` | 获取当前 TTS 引擎 ID（`birch`/`voicedesign`），默认 `voicedesign`；旧版本残留的 `voiceclone` 自动迁移为 `voicedesign` |
| `setTtsEngine(engine: String)` | engine: String | - | 保存 TTS 引擎选择（仅接受 `birch`/`voicedesign`） |
| `mimoFetchAsync(bodyJson: String, callbackId: String)` | bodyJson: String, callbackId: String | - | 异步代理调用 MiMo TTS API，HTTP 请求在 `networkExecutor` 后台线程执行，完成后将结果存入 `mimoFetchResults` Map 并通过 `evaluateJavascript` 通知 JS 回调（仅传 cbId，不传 resultJson）；作为浏览器 `fetch` 的 fallback |
| `getMimoFetchResult(cbId: String)` | cbId: String | `String` (JSON) | 同步拉取 `mimoFetchAsync` 的完整响应结果（从 `mimoFetchResults` Map 取出并删除），JNI 传递无大小限制；解决 evaluateJavascript 传大响应超 Binder 1MB 限制 |
| `playAudioBase64(base64Data: String, mimeType: String, callbackId: String)` | base64Data, mimeType, callbackId | - | 异步播放 Base64 音频：后台线程 Base64 解码→写临时文件→主线程创建 MediaPlayer→`prepareAsync()`→播放完成回调 `__ttsOnComplete`；解决 WebView `file://` origin 下 `new Audio(blobUrl).play()` 静默失败 |
| `stopAudio()` | - | - | 停止当前原生音频播放，释放 MediaPlayer |
| `getRotationVideoBgColor()` | - | `String` | 桥接兼容保留：固定返回 `"29,62,29"`（原视频边缘色提取已删除；前端已不再调用，`--bt-video-bg-rgb` 变量已移除） |
| `btHasClientBond()` | - | `Boolean` | 查询是否已配对客户端设备（`BondStore.hasClientBond()`），页面加载时用于初始化连接记忆 |
| `setUiLang(lang: String?)` | lang: String? | - | 同步界面语言（`zh`/`en`，www 设置页切换时调用）：写入 `ConsoleI18n`（SharedPreferences `robot_ui_lang`），原生 Toast/PDF 提示文案随动，并调用 `RobotGattServer.sendUiLang()` 经 7507(UiLang) 推给已连接的 phone（显示语言跟随发送端，1.5.0）；原生默认中文，`ConsoleI18n.t()` 按表替换，中文原文一字不改 |

**onDataChanged type 参数说明**：
- `"mode"`: json  mode ordinal 数字字符串（0-3, 255=NA），调用 `RobotGattServer.sendMode()`
- `"emotion"`: json 为 `"obedience,shame,pleasure,mechanical"` 逗号分隔，调用 `sendEmotion()`，每个值自动 coerceIn 0-100
- `"tasks"`: json 为 Task JSON 数组字符串，调用 `sendTasks()`
- `"voice"`: json 为语音内容（纯文本或 VoiceMessage JSON），自动补 timestamp，调用 `sendVoice()`
- `"voice-history"`: json 为 VoiceMessage JSON 数组字符串，调用 `sendVoice()`

### Kotlin → JS（8 个 evaluateJavascript 调用）

Kotlin 端通过 `webView.evaluateJavascript("jsCode(...)", null)` 调用前端 JS 函数：

| JS 函数名 | 调用时机 | 参数说明 |
|---|---|---|
| `btNotifyDeviceConnected(addrJson)` | BLE 设备连接成功时 | addrJson 为带引号的 MAC 地址字符串或 `null` |
| `updateBtStatus(status)` | BLE 状态变更时 | status 为 BLE_STATUS_* 常量（0-4，4=手动断开） |
| `closeActiveModal()` | 返回键按下且 modalOpen=true 时 | 无参，通知前端关闭当前模态框 |
| `btShowDiscoverModal()` | 页面加载完成且未绑定设备时 | 无参，通知前端显示设备发现/配对模态框 |
| `notifyModalState()` | 页面加载完成时 | 无参，通知前端更新 modal 状态 |
| `updateSafeAreaInsets(imeHeightPx)` | WindowInsets 变化时 | imeHeightPx 为输入法像素高度 |
| `__ttsOnComplete(callbackId, resultJson)` | Native MediaPlayer 播放完成/出错时 | callbackId 为回调ID，resultJson 为 `{"ok":true}` 或 `{"ok":false,"error":"..."}` |
| `__mimoFetchCallback(callbackId)` | `mimoFetchAsync` HTTP 请求完成时 | 仅传 callbackId（通知+拉取模式），JS 通过 `Android.getMimoFetchResult(cbId)` 同步拉取完整结果 |

---

## HTML 页面初始化与 BLE 同步时序

### 冷启动 NA 状态同步

页面 `DOMContentLoaded` 时调用 `setInitialNaState()`，将 android-app 置于 NA 模式：

1. 设置 `state.activeMode = null`，`state.isNaState = true`
2. 停用所有模式按钮高亮
3. 通过 `Android.onDataChanged` 同步四项数据到 GATT 特征值：
   - `mode` = `'255'`（NA）
   - `emotion` = 从 localStorage 读取的 4 维情绪值
   - `tasks` = 从 localStorage 读取的任务列表
   - `voice-history` = 最近语音历史

### btNotifyDeviceConnected 时序

设备连接成功后，Native 调用 `btNotifyDeviceConnected(addr)`，按以下逻辑选择 UI 反馈方式：

- **弹窗内显示**：连接弹窗已打开时，状态（已连接/断开按钮等）直接在弹窗内更新，不弹灵动岛
- **灵动岛**（`showDynamicIsland()`）：连接弹窗未打开时，隐藏弹窗并播放轻量级灵动岛通知（4 秒后自动消失）

随后按以下时序同步数据：

| 时间点 | 操作 | 说明 |
|--------|------|------|
| 立即 | 更新 UI 状态、显示连接反馈（弹窗或灵动岛） | 状态设为已连接 |
| 立即 | 同步 `voice-history` | 发送语音历史 |
| **1500ms** | 同步 `mode` + `emotion` + `tasks` + `voice-history` | 首次全量同步，确保 Phone 端收到完整数据 |
| **3000ms** | 重新同步 `tasks` | 二次发送任务列表，确保 Phone 端 Notification 订阅就绪后能收到 |

> **设计意图**：Phone 端连接后需要时间订阅 Notification，1500ms 首次同步确保基础数据送达，3000ms 重发 tasks 作为兜底，弥补 Notification 订阅窗口期。

### BLE 连接弹窗

HTML 页面中的 BLE 连接弹窗（`#bt-modal`）通过左上角按钮打开，提供以下功能：

- **头部**：显示蓝牙图标和当前连接状态（未绑定/已连接/断开/连接中）
- **动作按钮**（`#bt-action-btns`）：
  - "开始连接" / "重连" / "断开"（`#bt-connect-btn`）：根据当前状态动态切换文字和行为
    - 未绑定/断开状态：显示"开始连接"或"重连"，调用 `btStartConnect()` 启动 GATT Server 并广播
    - 连接中状态：显示"连接中"，按钮禁用
    - 已连接状态：显示"断开"（红色），调用 `btDisconnect()` → `btUnbond()`，断开连接的同时清除配对绑定，**弹窗保持显示不关闭**（`btDisconnect()` 不调用 `hideBtModal()`）
  - "二维码"：调用 `btShowQr()` 展示配对二维码
  - "关闭"：关闭弹窗
- **无独立"解绑"按钮**：断开连接即为解除绑定，连接弹窗中不再单独显示解绑操作

---

## 旋转精灵图（RotationSprite.js）

蓝牙弹窗与灵动岛共用一套 Canvas 精灵动画（替代原 `750rotation.mp4` 视频），资源与 win-app 启动器同源：

- 资源：`www/sprites/rotation-huimo-sprite.png`（灰模）、`rotation-color-sprite.png`（彩色）、`rotation-sprites.json`（216×504/帧、11 列、56 帧、30fps、正面第 0 帧）。
- 引擎：`www/RotationSprite.js` 通过 XHR 加载 JSON（file:// 下失败自动回退内嵌同内容常量），预加载双精灵图；Canvas 按设备 DPR（上限 2.5）绘制；rAF 仅在蓝牙弹窗或灵动岛可见且页面可见时运行，`visibilitychange` 自动暂停/恢复以省电。
- 定时器生命周期：页面隐藏时暂停并保留所有 `managedSetInterval` 注册（时钟/运行参数/图表等），恢复可见后统一恢复，避免长时间后台后定时器永久丢失；`visibilitychange` 同时暂停 CSS 动画与精灵 rAF。
- 状态机与 win-app 启动器一致：`IDLE(灰模正面) → CONNECTING(灰模旋转) → WAIT_FRONT_AFTER_CONNECT → PAUSE(320ms) → MORPH_IN(500ms，锁正面帧) → CONNECTED(停 600ms 后彩色旋转)`；断连反向执行 `WAIT_FRONT_AFTER_DISCONNECT → PAUSE → MORPH_OUT → IDLE`。
- 状态映射：`updateBtStatus(0)`→IDLE；`3`→CONNECTING；`1`→回正→MORPH→彩色旋转；`2/4`→已连接走断连链、连接中直接回 IDLE。
- 蓝牙弹窗：`<canvas id="bt-canvas">` 替换原 `<video id="bt-video">`（216:504 比例自适应，`min(56vh, 480px)` 高）；卡片 `max-height: calc(100vh - 12vh)`，底部按钮在容器变矮时仍完整可见；弹窗背景为渐变绿（`29,62,29`/`23,50,23`/`14,30,14` 系）+ `bt-modal-gradient-shift` 柔和渐变流动，上半部叠加大范围模糊的弥散绿色流光（`::before`）；`showBtModal/hideBtModal/btNotifyDeviceConnected` 接入 `rotationSprite.showModal()/hideModal()`。
- 旧资源清理：`www/pic/750rotation.mp4` 与 `750rotation.mp4.bak` 已删除；Native `getRotationVideoBgColor()` 直接返回固定 `"29,62,29"`，不再使用 `MediaMetadataRetriever` 提取视频边缘色。
- 设置段预览：设置弹窗「灵动岛模拟效果」分组新增 `预览灵动岛效果` 按钮（`#preview-island-btn`），点击调用 `showDynamicIsland()` 直接预览灵动岛动画，便于未连接设备时检查样式。
- 电量默认设置：设置弹窗「运行参数设置」剩余电量新增 `#battery-auto` 勾选（默认开启，存于 `robotRuntimeParams.batteryAuto`）；开启时电量按时间自动计算（凌晨1点0%、早7点100%，1-7点充电线性升至100%，7点至次日1点放电降至0%），手动百分比/充电输入隐藏；关闭时恢复手动输入。`updateCurrentTime()` 每秒调用 `refreshAutoBattery()` 刷新，变化时触发 `showChargingIsland()`（开始充电灵动岛动画）。
- 状态栏右上角顺序为电池、网络、机器人模式、蓝牙、信息、设置；图标统一零内边距等高盒子（flex gap 1.625rem，间距一致），圆形图标 16×16，电池为 macOS 菜单栏式横长造型（20×11：外壳 16.5×9.5 细边 1.4 + 端子极耳），纵向居中与圆形图标视觉平衡。电池非充电显示电量条（宽度随电量 0-12.8 线性变化）、低电量（<20%）变红、充电时变绿且电量条让位、居中闪电（Bootstrap bolt 0.6 缩放）；由 `updateStatusBarBattery()` 驱动。
- 默认机器人图片：`www/pic/right.webp` 为三栏"机器人视图2"与设置恢复默认共用的内骨骼默认图（1280×3189，已更换为新版骨架渲染图）；`left.webp` 对应机器人视图1。
- 充电灵动岛：复用 `#dynamic-island` 容器，`showDynamicIsland('charging')` 加 `di-charging` 模式（隐藏机器人区，显示闪电+`正在充电 xx%`，卡片高度 96px），设置弹窗新增 `#preview-charging-island-btn`（预览充电灵动岛）可模拟。
- 灵动岛动画流程：圆点（cam-anim 420ms）→ 药丸（pulse 320ms）→ 内容无背景放大非线性旋转（pop 360ms，scale 1.45/rotate -13°，`transform-origin: center`）→ 非线性回正（settle 440ms）→ 底框/跑马灯/文字（visible）；`di-pulse` 阶段 `.di-robot-wrap` 高度固定 136px，避免放大时中心上移；连接/充电文字均直接叠在卡片上（`.di-text-bar` 无独立色块），设置按钮为「预览连接灵动岛」「预览充电灵动岛」。

## 灵动岛（Dynamic Island）

连接成功且连接弹窗未打开时的轻量级通知，位于屏幕顶部打孔屏下方（win-app 为系统菜单栏下方）。机器人改用透明背景精灵图后，卡片升级为「丰富灵动」风格：渐变流动背景 + 极光光斑 + 呼吸光环 + 上浮粒子 + 机器人悬浮辉光，4 秒后自动消失。

### 触发条件

`btNotifyDeviceConnected(addr)` 中判断：连接弹窗未打开时调用 `showDynamicIsland()`（弹窗已打开则状态只在弹窗内显示）；每次显示前 `rotationSprite.showIsland()` 重置为「彩色正面 → 停顿 600ms → 持续旋转」的新鲜序列。

### 动画阶段

| 阶段 | CSS 类 | 持续 | 说明 |
|------|--------|------|------|
| 0. 摄像头点入场 | `.di-cam-anim` | 420ms | 10px 圆点从摄像头打孔区出现（呼吸绿点 + 扩散环），随后整体下移 |
| 1. 脉冲弹出 | `.di-pulse` | 320ms | 下移同时小药丸（96×22px）弹性放大，中心显示绿色脉动点 |
| 2. 展开显示 | `.di-visible` | ~3.3s | 展开为方卡片（146×162px），渐变背景/弥散边缘流光/粒子/悬浮机器人入场，底部撞色文字条上滑 |
| 3. 收回摄像头 | `.di-shrink` + `.di-cam-exit` | ~0.5s | 卡片收缩回 10px 圆点的同时上移回摄像头打孔区（并行） |                            
| 4. 摄像头处淡出 | `.di-cam-fade` | ~0.24s | 圆点在摄像头处快速淡出消失（不拖沓） |                                 

### DOM 结构

```html
<div id="dynamic-island" class="dynamic-island">
  <div class="di-siri-glow"><div class="di-glow-orbit">…4 个弥散光斑贴边环绕…</div></div>
  <div class="di-card">
    <div class="di-bg"></div>                  <!-- 渐变流动底（与连接弹窗同款渐变绿，12s 往复） -->
    <div class="di-aurora di-aurora-1"></div>
    <div class="di-aurora di-aurora-2"></div>  <!-- 两层模糊极光光斑 -->
    <div class="di-halo"></div>                <!-- 呼吸光环 -->
    <div class="di-particles">…5 个上浮柔光粒子…</div>
    <div class="di-pulse-dot"></div>           <!-- 脉冲阶段中心绿点 -->
    <div class="di-robot-wrap">                <!-- 机器人区域 -->
      <canvas id="di-canvas"></canvas>
    </div>
    <div class="di-text-bar">
      <span>T31-750已与主人连接成功</span>
    </div>
  </div>
</div>
```

### 透明精灵图背景（核心差异）

精灵图帧为透明背景（216×504/帧、11 列 56 帧），因此移除原 `.di-inner-mask` 硬色遮罩与 `rgb(var(--bt-video-bg-rgb))` 纯色填充：

- `.di-bg`：`linear-gradient` 300% 尺寸 + 12s `background-position` 流动动画；
- `.di-aurora-1/2`：模糊径向渐变光斑，7s/9s 交替位移缩放；
- `.di-halo`：机器人背后呼吸光环（4s）；
- `.di-particles`：5 个 2~3px 柔光粒子错峰上浮（约 4.2~5.4s）；
- `#di-canvas`：126px 高、216:504 比例（约 54px 宽），全身立绘完整显示；`di-robot-float`（3.4s 微浮/缩放），辉光由背景呼吸光环提供（canvas 不设 filter，避免逐帧重栅格化闪烁）；
- 卡片周围弥散跑马流光：`.di-glow-orbit` 内 4 个 22px 模糊径向光斑贴卡片四边（上/右/下/左）缓慢环绕旋转（9s），配合 1px 极淡描边勾勒轮廓，无光道、无硬边。

### 配色与桥接兼容

连接弹窗与灵动岛共用同款柔和渐变绿（`#1d3e1d/#173217/#0e1e0e` 系）：弹窗背景带 `bt-modal-gradient-shift` 流动动画，灵动岛 `.di-bg`/`.di-aurora-2`/`.di-glow-blob-2`/粒子统一绿色系（去掉偏蓝观感）。原 `--bt-video-bg-rgb` 变量与前端写入逻辑已删除；Native `getRotationVideoBgColor()` 保留并固定返回 `"29,62,29"`，仅供旧接口兼容。

### 关键 JS 函数

| 函数 | 说明 |
|------|------|
| `showDynamicIsland()` | 重置状态 → `.di-cam-anim`（420ms，摄像头圆点）→ `.di-pulse`（320ms，下移展开药丸）→ `.di-visible` 并调用 `rotationSprite.showIsland()` → 4s 后 `hideDynamicIsland()` |
| `hideDynamicIsland()` | 并行添加 `.di-shrink`/`.di-cam-exit`（收缩+上移回摄像头）→ 约 500ms 后 `.di-cam-fade` 摄像头处淡出 → 清理类名 |
| `rotationSprite.showIsland()` | 重置为彩色正面帧 + 600ms 停顿后持续旋转（Canvas 渲染） |
| `rotationSprite.setStatus(status)` | 按 0/1/2/3/4 状态驱动灰模↔彩色切换状态机（见「旋转精灵图」） |

---

## TTS 语音引擎

[MimoTTSClient.js](file:///d:/AIProject/RobotControl/android-app/app/src/main/assets/www/MimoTTSClient.js) 封装 MiMo TTS API 调用，由前端 HTML 引用，Native 层提供 API Key 持久化、异步 HTTP 代理、原生音频播放。

### 引擎列表

| 引擎 ID | 显示名 | 模型 | 说明 |
|---|---|---|---|
| `voicedesign` | 音色设计 | `mimo-v2.5-tts-voicedesign` | **默认引擎**，通过 prompt 描述生成定制音色 |
| `birch` | 白桦音色 | `mimo-v2.5-tts` | 指定 `voice=白桦` 的预设音色 |

> **已移除**：`voiceclone`（音色复刻，原 `mimo-v2.5-tts-voiceclone`）引擎及参考音频 `voice-clone.mp3` 已彻底删除。Native 层 `getTtsEngine()` 读到旧版残留 `voiceclone` 时自动迁移为 `voicedesign` 并写回 SharedPreferences。

### 异步非阻塞架构

TTS 全流程采用 Fire-and-Forget 模式，确保按钮按下后 UI 动画立即响应，语音在后台异步合成播放：

1. **speak() 关键路径优先**：日志记录、BLE 广播（`Android.onDataChanged('voice', ...)`）、UI 动画在同步代码中立即执行
2. **TTS 延迟到下一 tick**：`setTimeout(function() { ... }, 0)` 将 TTS 合成/播放推迟到事件循环下一个 tick，不阻塞关键路径
3. **Native HTTP 完全异步**：`mimoFetchAsync` 在 `networkExecutor` 后台线程执行 HTTP 请求，JS 调用后立即返回
4. **缓存写入延迟**：音频播放先启动，缓存写入通过 `setTimeout(fn, 0)` 推迟，避免 localStorage I/O 阻塞播放

### 调用链（fallback）

```
speak(text)
  ├─ 关键路径（立即执行）：voiceHistory记录 → BLE广播 → UI动画
  └─ setTimeout(0) → TTS合成/播放（后台异步）
       → _synthesizeAndPlay(engine, text)
         1. 查 localStorage 缓存 → 命中则直接播放（不联网）
         2. 未命中 → 浏览器 fetch(API_URL, ...)
              失败 → Android.mimoFetchAsync(bodyJson, cbId)  // 异步Native HTTP代理
              完成 → __mimoFetchCallback(cbId) → Android.getMimoFetchResult(cbId) 拉取结果
              失败 → throw（由前端 speak() 外层捕获，降级到 Web Speech API）
```

- **API 端点**：`https://api.xiaomimimo.com/v1/chat/completions`
- **请求头**：`Content-Type: application/json; charset=utf-8`，`api-key: <APIKey>`
- **Native 异步代理**：`MainActivity.mimoFetchAsync()` 在 `networkExecutor` 后台线程执行 HTTP 请求（connect 15s / read 60s 超时），使用 `ByteArrayOutputStream` 读取响应；完成后结果存入 `mimoFetchResults`（ConcurrentHashMap），通过 `evaluateJavascript` 通知 JS（仅传 cbId）
- **通知+拉取模式**：JS 收到 `__mimoFetchCallback(cbId)` 通知后，调用同步接口 `Android.getMimoFetchResult(cbId)` 拉取完整响应（JNI 传递，无大小限制），避免 `evaluateJavascript` 传递大响应（含 base64 音频，500KB-2MB）超出 Binder IPC 1MB 限制

### 原生音频播放

Android WebView 在 `file://` origin 下 `new Audio(blobUrl).play()` 会静默失败，`speechSynthesis` 也未实现。因此音频播放通过 Native MediaPlayer 路由：

1. JS 调用 `Android.playAudioBase64(base64, mime, cbId)` 传递 base64 音频
2. 后台线程 Base64 解码 → 写临时文件（`cacheDir/tts_*.wav`）
3. 主线程创建 `MediaPlayer`，`setDataSource(filePath)` → `prepareAsync()`
4. `onPrepared` 时 `mp.start()` 开始播放
5. `onCompletion` 时释放 MediaPlayer、删除临时文件、回调 `__ttsOnComplete(cbId, '{"ok":true}')`
6. 浏览器环境降级：`Blob` + `Audio` 元素播放，完成后 `URL.revokeObjectURL()` 释放

### 音频缓存机制

为降低电量与内存开销，已生成的音频使用 `localStorage` 持久缓存（不使用内存缓存），同一会话内再次点击同一播报直接复用缓存播放，不再联网。

| 配置项 | 值 | 说明 |
|---|---|---|
| 缓存前缀 | `ttsCache_` | 所有缓存 key 统一前缀，便于批量清理 |
| Key 格式 | `ttsCache_<engineId>_<textHash>` | 引擎 ID + 文本哈希（避免同一文本不同引擎命中错误缓存） |
| 最大条目 | 15 | 超出时按时间戳升序清除最早条目（LRU 策略） |
| 存储内容 | `{audio, mime, ts}` | Base64 音频 + MIME 类型 + 时间戳 |

**清理时机**：
1. **页面初始化**：`_initMimoTTS()` 调用 `MimoTTSClient.clearAllCache()` 清除上次会话残留
2. **缓存上限**：写入新条目前调用 `evictOldestCache()`，超出 15 条时清除最早条目
3. **配额溢出**：捕获 `QuotaExceededError`，清空全部 TTS 缓存后重试一次

**异步写入**：API 返回音频后先启动播放（`_playBase64Audio`），再通过 `setTimeout(fn, 0)` 延迟执行 `_setCachedAudio` 写入 localStorage，避免缓存写入阻塞播放启动。

### 文本规范化

分离显示文本和语音文本，确保 BLE 广播/UI 显示与语音播报一致：

- `normalizeForDisplay(text)`：将 `踢三一七五零` → `T31-750`，用于 voiceHistory 记录、BLE 广播、UI 显示
- `normalizeForSpeech(text)`：将 `T31-750` → `踢三一七五零`，用于 TTS 引擎合成

`speak()` 函数中：displayMsg 先记录到 voiceHistory 和 BLE 广播，speechMsg 再传给 TTS 引擎。

### 引擎与 API Key 初始化

`_initMimoTTS()` 由 `initApp()`（登录后）调用执行：
1. 调用 `MimoTTSClient.clearAllCache()` 清理上次会话缓存
2. 优先从 `Android.getMimoApiKey()` 读取 API Key，无 Android 对象时 fallback 到 `localStorage`
3. 默认引擎 `voicedesign`，优先从 `Android.getTtsEngine()` 读取，无 Android 对象时 fallback 到 `localStorage.getMimoTtsEngine()`
4. 旧版残留的 `voiceclone` 值在 Native 层和前端均被过滤为默认引擎

---

## 滚动模拟弹窗（流程类功能按钮）

控制台 HTML 中五个流程类功能按钮（自检、清空所有进程、系统更新、数据库更新、开机）共用同一个弹窗组件 `#self-check-modal`，由 `openProcessModal(options)` 统一驱动。所有滚动文本数据已从 HTML 内嵌剥离为独立 JSON 文件，存放在 `assets/www/doc/` 目录下。

### 数据外部化与预加载

| 数据文件 | 用途 | 关键字段 |
|---|---|---|
| [clear_process_data.json](file:///d:/AIProject/RobotControl/android-app/app/src/main/assets/www/doc/clear_process_data.json) | 清空所有进程的进程列表 | `processes: [{name, pid}]`（80 条） |
| [system_update_data.json](file:///d:/AIProject/RobotControl/android-app/app/src/main/assets/www/doc/system_update_data.json) | 系统更新阶段文本 | `stages / codeSnippets / contents` |
| [database_update_data.json](file:///d:/AIProject/RobotControl/android-app/app/src/main/assets/www/doc/database_update_data.json) | 数据库更新数据 | `dbs / codeSnippets / versions / infos` |
| [boot_data.json](file:///d:/AIProject/RobotControl/android-app/app/src/main/assets/www/doc/boot_data.json) | 开机启动阶段数据 | `stages / hardware / codeSnippets` |

- 页面初始化时 `preloadAllScrollData()` 并发预加载所有 4 个 JSON 到 `_scrollDataCache` 内存缓存
- 弹窗打开时直接读缓存，不重复 fetch
- JSON 加载失败时回退到函数内置的最小 fallback 数据集（功能不中断，仅文本量减少）

### openProcessModal 通用驱动

| 配置项 | 类型 | 说明 |
|---|---|---|
| `lines` | `Array` 或 `GeneratorFunction` | 数组用于有限行数场景；generator 用于无限循环场景（系统更新/数据库更新/开机） |
| `durationMs` | `number` | 进度条总时长（ms），0 表示按 lines 数量驱动进度 |
| `lineInterval` | `number \| 'auto' \| function` | 行间隔：数字为固定毫秒；`'auto'` 自动按 `durationMs/totalLines` 计算（最小 30ms）；函数返回动态间隔 |
| `showResources` | `boolean` | 是否显示 CPU/GPU/内存资源条（清空所有进程用） |
| `statusText` / `finishText` | `string` | 状态栏文案 |
| `onComplete` | `function` | 完成回调（关闭弹窗后执行，触发 TTS 播报 + 日志记录） |

### 进度条同步机制

- `durationMs > 0` 时，每 100ms 推进进度条（按时间比例），到时调用 `finish()`
- `durationMs === 0` 时，进度按 `index/totalLines` 推进，lines 跑完即 `finish()`
- `feed()` 通过 `setTimeout` 递归调用，间隔由 `getNextDelay()` 决定：
  - `lineInterval` 为函数 → 调用返回值（自检用，模拟随机耗时 50-10000ms）
  - `lineInterval` 为数字 → 固定值
  - `lineInterval === 'auto'` → `Math.max(30, Math.floor(durationMs / totalLines))`

### 五个弹窗的参数

| 弹窗 | lines 类型 | durationMs | lineInterval | 资源条 |
|---|---|---|---|---|
| 自检 | 数组（SELF_CHECK_LINES） | 0 | 函数 `() => 50 + Math.random() * 9950` | 否 |
| 清空所有进程 | 数组（255 行） | **12000** | **`'auto'`** | 是 |
| 系统更新 | generator（无限循环） | 180000 | `'auto'` | 否 |
| 数据库更新 | generator（无限循环） | 20000 | `'auto'` | 否 |
| 开机 | generator（无限循环） | 10000 | `'auto'` | 否 |

### 自检 Male_2.png 传输叠加层（Android / 移动端路径）

自检文本进行到关键行时经 `openProcessModal` 新增的 `onLine(line, index)` 行钩子触发两个叠加层（桌面端为 DWM 浮窗，Android WebView 与 <750px 移动端走 CSS 回退路径）：

- **传输行**（`正在向…传输文件"Male_2.png"…`）：右侧弹出图片浮动卡片 `#male2-image-modal`（右对齐、**3:4 竖版**图区 `aspect-ratio:3/4`、容器不拦截点击；图片 `pic/Male_2.png` 懒加载，替换该文件即换图）+ 全屏进度对话框 `#male2-transfer-dialog`（「正在发送至T31-750…」+ 绿色渐变进度条，复用 `self-check-alert` 卡片样式）；进度固定约 1.5s 走完（不随随机行间隔拖长）。
- **接收行**（`已接收文件"Male_2.png"`）：若对话框仍在显示则提前补满 100%、文案切「Male_2.png 已发送至T31-750」，停留 0.5s 后随 `.visible` 移除淡出。
- **诊断完成行**（`软件性别和仿真性设置已成功运行`）：图片卡片淡出收起；自检弹窗被关闭或关机/重启中止冻结时两个叠加层连带收起。

完整实现细节见整体架构文档「自检Male_2.png传输叠加层」条目。

### 清空所有进程的同步设计

**问题背景**：原方案 40 条进程生成 124 行文本，固定 `lineInterval=80ms` × 124 = 9920ms，与 `durationMs=8000ms` 不匹配，文本在进度条结束前/后过早/过晚结束。

**当前方案**（80 条进程 + auto 间隔 + 描述性行）：

1. **进程数扩容**：[clear_process_data.json](file:///d:/AIProject/RobotControl/android-app/app/src/main/assets/www/doc/clear_process_data.json) 含 80 条进程（系统守护、IO、传感器、驱动、网络、安全、感知、规划、NLP 等全栈分类）
2. **总时长调整**：`durationMs` 从 8000ms 提升到 12000ms，给 80 条进程留出充分展示时间
3. **auto 间隔**：`lineInterval: 'auto'`，由 `Math.floor(12000 / 255) = 47ms` 自动计算，无需硬编码
4. **描述性行补充**：`getClearProcessLines()` 在扫描阶段和收尾阶段补充描述性行
   - 扫描阶段：`正在扫描活动进程…` / `正在读取 /proc 目录…` / `共发现 N 个活动进程` / `正在统计内存占用…` / `正在分析进程依赖关系…` / `正在释放系统资源…`
   - 收尾阶段：`正在清理内存碎片…` / `正在刷新进程表…` / `正在重置硬件状态…` / `正在释放共享内存段…` / `正在清理信号量…`
5. **完美同步**：255 行 × 47ms = 11938ms，与进度条 12000ms 仅差 62ms（约 0.5%），最后一行 `所有进程已成功清空` 在进度条接近 100% 时显示

**容错**：JSON 加载失败回退到 10 条进程时，auto 间隔自动调整为 `Math.floor(12000 / 45) = 266ms`，总时长 11704ms，仍与进度条同步。

---

## WebView 配置

关键 WebView 设置（[MainActivity.kt:253-268](file:///d:/AIProject/RobotControl/android-app/app/src/main/java/com/robotcontrol/console/MainActivity.kt#L253-L268)）：
- `javaScriptEnabled = true`
- `domStorageEnabled = true`
- `allowFileAccess = true`
- `allowContentAccess = true`
- `mixedContentMode = MIXED_CONTENT_ALWAYS_ALLOW`
- `cacheMode = LOAD_DEFAULT`
- `allowFileAccessFromFileURLs = true`
- `allowUniversalAccessFromFileURLs = true`
- `mediaPlaybackRequiresUserGesture = false`（允许静音视频自动播放，Android 12 WebView 默认要求用户手势）
- `overScrollMode = OVER_SCROLL_NEVER`（禁用过度滚动光晕）
- `setBackgroundColor(Color.BLACK)` + `background = null`（黑色背景，避免HTML加载前白闪）

支持文件选择：
- 图片类型使用 `PickVisualMedia`（Photo Picker）
- 其他类型使用 `GetContent`
- 通过 `WebChromeClient.onShowFileChooser` 实现

---

## 闪屏页

### 设计目标

App 启动时遮住 HTML 加载初期，播放品牌视频（`assets/www/pic/Rt5Open.mp4`，首帧纯黑），全程纯黑无缝衔接，无白色闪烁。

### 全链路黑色保障（四层）

| 阶段 | 显示内容 | 黑色保障机制 |
|------|---------|-------------|
| 1. 系统 SplashScreen | 纯黑背景 | `windowSplashScreenBackground=#000000` + `windowSplashScreenAnimatedIcon`设为透明drawable（[splash_icon.xml](file:///d:/AIProject/RobotControl/android-app/app/src/main/res/drawable/splash_icon.xml)），消除默认图标的灰色背景 |
| 2. Activity 首帧 | 纯黑 | `Theme.App.Transparent`的`windowBackground=@android:color/black` + `colorBackgroundCacheHint=@null` |
| 3. 视频准备期 | 纯黑 | TextureView `isOpaque=true` + 初始`visibility=visible`，透明区域显示底层黑色；WebView `setBackgroundColor(BLACK)` |
| 4. 视频播放 | 视频首帧(黑)→内容 | 视频首帧本身为纯黑，与前面黑色无缝衔接 |

### 主题配置

- [values/themes.xml](file:///d:/AIProject/RobotControl/android-app/app/src/main/res/values/themes.xml)：`Theme.SplashScreen.RobotControl`（兼容库主题，Android 12以下也显示单色背景）
- [values-v31/themes.xml](file:///d:/AIProject/RobotControl/android-app/app/src/main/res/values-v31/themes.xml)：Android 12+ 原生SplashScreen主题覆盖，额外设置`windowSplashScreenIconBackgroundColor=@android:color/black`
- [AndroidManifest.xml](file:///d:/AIProject/RobotControl/android-app/app/src/main/AndroidManifest.xml)：MainActivity的`android:theme`设为`@style/Theme.SplashScreen.RobotControl`
- [colors.xml](file:///d:/AIProject/RobotControl/android-app/app/src/main/res/values/colors.xml)：`splash_background=#000000`

### 关键实现（[MainActivity.kt](file:///d:/AIProject/RobotControl/android-app/app/src/main/java/com/robotcontrol/console/MainActivity.kt)）

**布局**（[activity_main.xml](file:///d:/AIProject/RobotControl/android-app/app/src/main/res/layout/activity_main.xml)）：`FrameLayout`中WebView在下、TextureView在上，TextureView初始`visibility=visible`。

**onCreate**：仅调用`installSplashScreen()`安装系统SplashScreen，**不使用`setKeepOnScreenCondition`等待视频首帧**（会阻塞Activity窗口渲染，导致TextureView的SurfaceTexture长时间无法创建，视频无法播放）。

**并行加载**：`initSplashVideo()`与`setupWebView()`并行执行。视频加载流程：
1. 后台线程将视频从 `assets/www/pic/Rt5Open.mp4` 复制到 `cacheDir/splash_video.mp4`——使用文件路径避免 `AssetFileDescriptor` 的 `offset` 兼容性问题导致视频开头几百毫秒丢失
2. `prepareSplashPlayer(cachedFile)`——创建 MediaPlayer，设置文件路径 `setDataSource`，GPU硬件级 centerCrop 缩放（`VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING`，避免手动 resize 导致主线程 layout thrash 引起掉帧），若 Surface 已就绪则立即绑定，调用 `prepareAsync()`
3. `onSurfaceTextureAvailable`——保存 Surface 到 `splashSurface`，移除旧超时并重新计时 8 秒，尝试绑定到已存在的 MediaPlayer；若 player 已 prepared 则立即 `start()`
4. `onPrepared`——清除超时计时器，设 `splashPlayerPrepared=true`，若 Surface 已绑定则立即 `mp.start()`
5. `MEDIA_INFO_VIDEO_RENDERING_START`——首帧渲染回调，设 `videoFirstFrameRendered=true`
6. `onCompletion`——视频结束，设 `videoEnded=true`，调 `checkSplashDismiss()`
7. `WebView.onPageFinished`——HTML 加载完成，设 `webReady=true`，调 `checkSplashDismiss()`
8. `checkSplashDismiss()`——视频结束**且**WebView 就绪时才 `dismissSplashVideo()`；若视频先结束则停在最后一帧等待 WebView，若 WebView 先就绪则等待视频播放完成

**Toast 抑制**：`showToastSafely()` 方法检查 `splashDismissed` 标志，闪屏期间（`splashDismissed==false`）抑制所有 Toast 弹出，避免遮挡品牌启动动画；闪屏结束后恢复正常。

**超时兜底**：`SPLASH_TIMEOUT_MS=8000L`，从 `initSplashVideo()` 和 `onSurfaceTextureAvailable` 两个时机计时，`onPrepared` 时清除。超时后直接 dismiss（显示黑色背景而非白屏）。

**dismissSplashVideo()**：释放 MediaPlayer，TextureView 执行 200ms 淡出动画后 `visibility=.GONE`，清理缓存视频文件，清除 `FLAG_KEEP_SCREEN_ON`。

**触摸跳过**：点击屏幕可跳过闪屏。

### 关键陷阱：setKeepOnScreenCondition 导致闪屏失效

**禁止使用** `splashScreen.setKeepOnScreenCondition { !videoFirstFrameRendered }`。Android 12+的系统SplashScreen是独立全屏窗口覆盖在Activity之上，保持显示时会遮挡Activity窗口，导致TextureView的SurfaceTexture无法及时创建（模拟器上约20秒，真机也可能延迟），造成：超长闪屏→视频不播放→超时dismiss→状态错乱白屏。正确做法是让SplashScreen在Activity首帧后自然dismiss，靠全链路黑色保障无缝衔接。

---

## 构建配置

- **compileSdk / targetSdk**: 34
- **minSdk**: 31 (Android 12)
- **主要依赖**: AndroidX AppCompat、Core KTX、WebKit、Material、ZXing（二维码）、`androidx.core:core-splashscreen:1.0.1`（闪屏页兼容库）
- **权限**: BLUETOOTH、BLUETOOTH_ADMIN、BLUETOOTH_CONNECT、BLUETOOTH_ADVERTISE、BLUETOOTH_SCAN、INTERNET（等）
