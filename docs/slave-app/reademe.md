# slave-app（手机端 / Slave）

## 概述

- **目录**：[slave-app](../../slave-app)
- **显示名（1.10.0）**：**Slave**（`app_name`，中英 `values`/`values-en` 同值；原「750接收端」随改名统一；Gradle `rootProject.name` 亦改为 `Slave`）
- **图标（1.10.0）**：与 master 同一套 Rt5 构图，靠**明暗对调**区分——master = 深绿底 `#0d1a0d` + 银圆 + 深绿字，slave = **银底 `#cfd3cf` + 深绿圆 `#163a1e` + 银字**。原实现是「深绿→深蓝的色相偏移」，两端都是深色块、缩到启动器/桌面尺寸几乎无法分辨，故改为互换。生成脚本 `tools/gen-slave-icon.py`（由 master 图标逐档转换 5 档 mipmap × 方形/圆形，另含 `res/` 根下两个 72px 历史副本；`--check` 只做几何与主色核对）
- **包名**：`com.robotcontrol.phone`（1.10.0 刻意不改：改包名会让已装用户数据丢失且需卸载重装）
- **技术栈**：Kotlin 原生 Android，纯代码构建 UI（无 XML 布局编写、无 Compose）
- **BLE 角色**：GATT Client（连接 Console）；代码中存在 WatchGattServer 但未在 MainActivity 中启动
- **配对方式**：BLE 扫描、QR 码扫描（NFC 已移除）
- **入口**：MainActivity + QrScanActivity

## 目录结构

```
slave-app/
├── app/
│   ├── src/main/
│   │   ├── java/com/robotcontrol/phone/
│   │   │   ├── MainActivity.kt              # 主界面，BLE 连接管理 + UI 构建 + 首启设置界面
│   │   │   ├── PhoneI18n.kt                 # 界面语言覆盖层（设备检测 + 手选，v1.10.0）
│   │   │   ├── QrScanActivity.kt            # QR 码扫描 Activity（ZXing）
│   │   │   ├── RobotPhoneApplication.kt     # Application 类，通知渠道创建
│   │   │   ├── ble/
│   │   │   │   ├── BleConstants.kt          # BLE 常量
│   │   │   │   ├── BlePermissionHelper.kt   # 蓝牙权限工具
│   │   │   │   ├── BondStore.kt             # 配对地址持久化
│   │   │   │   ├── ConsoleBleClient.kt      # BLE Client（连接 Console）单例
│   │   │   │   ├── QrCodeGenerator.kt       # QR 码生成工具
│   │   │   │   └── WatchGattServer.kt       # （未启用）供 Watch 连接的 GATT Server
│   │   │   ├── data/
│   │   │   │   ├── PhoneDataStore.kt        # 数据中心单例 + 观察者模式
│   │   │   │   ├── ApiKeyStore.kt           # MiMo API Key / ASR 云端开关 / ASR 开关状态持久化
│   │   │   │   ├── Mode.kt                  # Mode 枚举
│   │   │   │   ├── Emotion.kt               # Emotion 数据类
│   │   │   │   ├── Task.kt                  # Task 数据类
│   │   │   │   └── VoiceMessage.kt          # VoiceMessage 数据类
│   │   │   ├── speech/
│   │   │   │   ├── VoiceCommandMatcher.kt   # 本地模式读音规则（拼音同音匹配 + 否定词 + 语言门控）
│   │   │   │   ├── MimoAsrClient.kt         # MiMo ASR（mimo-v2.5-asr）云端识别客户端
│   │   │   │   └── PhoneSpeechController.kt # 语音识别控制器（本地优先 + 云端兜底 + 录音缓冲）
│   │   │   └── ui/
│   │   │       └── EmotionPanelView.kt      # 情绪面板自定义 View（4 个进度条）
│   │   ├── res/
│   │   │   ├── anim/
│   │   │   │   ├── dialog_enter.xml         # 连接弹窗进入动画（淡入，180ms）
│   │   │   │   └── dialog_exit.xml          # 连接弹窗退出动画（淡出，180ms）
│   │   │   ├── drawable/                    # 背景 drawable（胶囊、按钮、卡片、渐变等）
│   │   │   │   ├── qr_btn_circle_bg.xml     # 扫码界面关闭按钮正圆形背景
│   │   │   │   ├── ic_asr_mic.xml           # 语音识别圆钮麦克风矢量图
│   │   │   │   ├── asr_btn_bg.xml           # 语音识别圆钮正圆形背景（开/关两态）
│   │   │   │   ├── asr_switch_track.xml     # 设置页云端开关轨道（开=模式绿/关=深灰）
│   │   │   │   └── asr_switch_thumb.xml     # 设置页云端开关滑块（开=白/关=灰）
│   │   │   ├── layout/
│   │   │   │   ├── activity_main.xml        # 主布局（容器，UI 内容代码动态添加；含 firstRunContainer 首启覆盖层）
│   │   │   │   └── activity_qr_scan.xml     # 扫码界面布局
│   │   │   └── values/
│   │   │       ├── styles.xml               # 主题样式（含 BleDialogTheme、DialogAnimation）
│   │   └── AndroidManifest.xml
│   └── build.gradle
└── ...
```

## 核心类说明

### PhoneI18n

[PhoneI18n.kt](../../slave-app/app/src/main/java/com/robotcontrol/phone/PhoneI18n.kt)

界面语言覆盖层（1.3.0 新增，1.10.0 重做决策链路）：`t(中文)` 在英文模式按表返回英文、中文原文一字不改，覆盖情绪面板/任务名/语音消息/模式名/连接面板与蓝牙对话框/首启界面/权限与扫描提示等全部原生文案。`values-en/strings.xml` 仅承载随系统语言的启动器标签与胶囊初始文案。**1.10.0 起语言完全由本机决定**（不再跟随控制端 7507 推送，见下），决策顺序与三端统一：

1. **用户手选**：SharedPreferences `robot_ui_lang` 中 `lang` 非空**且** `lang_manual=true`
2. **设备语言自动检测**：`Locale.getDefault().toLanguageTag()` —— 主语言标签 `zh*` → 中文，其余（含 en 在内的所有其他语言）/取不到 → 英文
3. **兜底英文**（**界面默认语言由中文改为英文**，1.10.0）

- **自动检测结果不落盘**——每次启动重新检测，仅手选值持久化（`setLang()` 同时写 `lang` 与 `lang_manual=true`），故「设备是中文」与「用户改回英文」不会互相覆盖；`init(context)` 只在 `manual && (lang=="en"||"zh")` 时采用手选值。
- `isManual(context)` 返回是否已被手选（供首启页/蓝牙对话框回显选中态）。
- **手选入口两处**：首启界面（1.10.0 新增）与蓝牙对话框的「语言」行（中文 / English）。两处点击手选后均 `recreate()` 使全部文案即时生效。
- **初始化顺序**：`PhoneI18n.init(this)` 必须早于 `buildContent()` 与首启界面渲染，否则界面会按默认语言渲染、手选语言当轮不生效（1.10.0 修复项）。
- **不再跟随控制端**：`ConsoleBleClient` 已移除 7507(UiLang) 的订阅、初读与 `onLangReceived` 回调，`MainActivity` 中对应的语言跟随链路一并删除；服务端（master-app / win-app 宿主）仍照常推送，供旧版客户端使用。`BleConstants.CHAR_UI_LANG_UUID` 常量保留但本端不再读写。
- 术语订正（1.10.0）：`机械度` 英文由 `Robotical` 改为项目规范用词 **`Robotic`**。

### MainActivity

[MainActivity.kt](../../slave-app/app/src/main/java/com/robotcontrol/phone/MainActivity.kt)

职责：
1. 全屏 EdgeToEdge 沉浸式显示，状态栏/导航栏透明，不设置 FLAG_KEEP_SCREEN_ON（按系统默认息屏时间）
2. 代码动态构建全部 UI（顶栏胶囊、情绪面板、双列任务/语音列表）
3. 管理 Console BLE 连接生命周期
4. 提供 BLE 对话框（Dialog + BleDialogTheme 淡入/淡出动画，180ms）：扫描设备、扫码、断开（同时清除绑定）、MiMo API Key、ASR 云端开关与**界面语言行（中文/English，1.10.0 新增）**（即手机端设置页）
5. 通过 `styleDialog()` 统一设置对话框背景（圆角+半透明边框）和窗口属性
6. 监听 PhoneDataStore 变化并更新 UI
7. 长按蓝牙按钮注入模拟测试数据
8. **长按模式胶囊弹出模式菜单**（1.7.0）：4 项模式（各用模式色）+ 关闭，选中后经 `ConsoleBleClient.writeMode()` 反向推送到控制台；未连接时提示「未连接控制面板」
9. **语音识别圆钮**（1.7.0）：右上角 `asrBtn` 单击开/关语音识别（常态保持、SharedPreferences 持久、前台恢复/后台停止），识别命中模式读音走与手动推送相同的链路
10. **连接链路加固（1.8.0）**：新增 `connectToConsole(address, autoConnect)` 统一包装**所有**连接入口（对话框点设备、扫码两条路径），BLE 层异常只回退连接状态并 Toast「连接失败」；`startBleServices()` 的自动连接/自动扫描段同样 try/catch
11. **首次启动设置界面**（1.10.0）：`firstRunContainer`（`activity_main.xml`，全屏 `#FF05100A`、`elevation=24dp`、初始 `gone`）覆盖主界面，内容由 `buildFirstRunView()` 代码构建；`showFirstRunIfNeeded()` 在 `onCreate` 末尾（语言初始化之后）判定，未完成则显示。详见下文「首次启动（First Run）」。

关键 UI 成员：
- `capsule: TextView` - 顶部模式显示胶囊（**长按弹模式菜单**）
- `btConsoleBtn: TextView` - 左上角蓝牙连接按钮
- `asrBtn: ImageView` - 右上角语音识别圆钮（40dp 正圆，与胶囊同行；开=绿/关=灰，`ic_asr_mic` + `asr_btn_bg`）
- `emotionPanel: EmotionPanelView` - 情绪面板（固定在顶部）
- `topGradientBg: View` - 顶部黑色渐变遮罩
- `scrollView: ScrollView` - 下部滚动容器
- `tasksContainer / voiceContainer: LinearLayout` - 任务/语音列表容器
- `topFixedContainer: FrameLayout` - 固定在顶部不滚动的容器
- `firstRunContainer: FrameLayout?` - 首启设置覆盖层宿主（1.10.0；完成后置 `GONE` 并清空子视图）

关键数据处理：
- `onTasksReceived`：解析任务 JSON 时，id 先尝试 `getLong` 再 `getString` 兼容数字/字符串类型；name 使用 `optString` 安全处理
- `onEmotionChanged(emotion: Emotion?)`：回调参数为可空类型，`null` 时显示 NA 状态（4 个进度条归零）
- Mode ordinal 255 映射到 `Mode.NA`：`ordinal == 255 → Mode.NA`，`ordinal in 0..3 → Mode.values()[ordinal + 1]`（因为 NA 排在枚举首位）

### ConsoleBleClient

[ConsoleBleClient.kt](../../slave-app/app/src/main/java/com/robotcontrol/phone/ble/ConsoleBleClient.kt)

BLE GATT Client 单例，连接 Console 端：
1. 扫描：`ScanFilter` 按服务 UUID 7500 过滤，回调同时接受“名称以 `RobotControl-` 开头”或“广告含服务 UUID 7500”的设备（兼容 master-app `RobotControl-Console` 与 win-app `RobotControl-Win`）
2. 连接后请求 MTU=512，发现服务
3. 订阅 6 个 Characteristic（Mode/Emotion/Tasks/Voice/Heartbeat/ApiKey）的 Notification（**1.10.0 起不再订阅 UiLang(7507)**，见下）
4. 连接成功后立即读取 Mode/Emotion 当前值（READ_CHAR）；Voice 使用 READ_LONG_CHAR 读取历史（**1.10.0 起不再初读 UiLang**）
5. **Tasks 不执行 READ_LONG_CHAR**，完全依赖 BLE Notification 推送 + 3000ms 延迟 READ_CHAR 兜底
6. 支持 GATT 操作队列（`currentGattAction` 追踪当前操作），避免并发操作
7. 支持长读（Long Read）通过反射调用隐藏 API（仅用于 Voice）
8. 支持分片重组（Magic=0x7E），totalChunks==1 直接完成
9. 自动重连（最多 3 次，间隔 3 秒），`scheduleReconnect()` 使用 `autoConnect=true` 后台连接 + `startAutoScan()` 周期扫描兜底，不受 `activeDisconnect` 阻断，仅 `userDisconnected` 阻断
10. 心跳写入成功后启动 15s 服务端心跳兜底超时；超时强制清理 GATT 并按意外断开恢复
11. 收到 0xFF 心跳信号 → 设置 `activeDisconnect=true` + `userDisconnected=true`，不自动重连
12. 独立 BLE 线程（`BleClientThread`）

回调接口：
```kotlin
var onConnectionStateChanged: ((state: Int) -> Unit)?
var onModeReceived: ((modeOrdinal: Int) -> Unit)?
var onEmotionReceived: ((obedience, shame, pleasure, mechanical: Int) -> Unit)?
var onTasksReceived: ((tasksJson: String) -> Unit)?
var onVoiceReceived: ((voiceJson: String) -> Unit)?
var onVoiceHistoryReceived: ((historyJson: String) -> Unit)?
// 1.11.0 新增：onApiKeySynced——同步裁决采用 Master 的 Key 后回调宿主（提示）
// 1.10.0 移除：onLangReceived（原 1.5.0 新增的 7507(UiLang) 回调）——界面语言不再跟随控制端
```

Voice 数据分发规则：
- 首字符 `[` → `onVoiceHistoryReceived`
- 首字符 `{` → `onVoiceReceived`
- 其他纯文本 → 自动包装为对象后调用 `onVoiceReceived`

**连接可靠性规则**：

- 心跳兜底以服务端 Notification 为准；写入成功后 15s 内未收到服务端心跳则调用统一的断连恢复流程。
- **7507(UiLang) 不再消费（1.10.0）**：`onCharacteristicChanged` 中已无该分支、连接时也不订阅/初读——语言只由本机 `PhoneI18n` 决定；服务端特征与推送保留（旧版客户端仍订阅），`BleConstants.CHAR_UI_LANG_UUID` 常量保留备查。

**ApiKey(7506) 双端同步裁决（1.11.0，取代旧版「连接后无条件上传」）**：

- 连接成功约 500ms 后对 7506 执行 READ_CHAR（取代旧的 `writeApiKey` 直写）；读取值与后续 Notify 都进入 `maybeSyncApiKey(remoteKey)`。
- `ApiKeyStore.decideSync(local, remote)` 纯函数裁决（可用 = 格式合法 `sk-` 前缀 ≥16 字符 且无失败历史；远端历史不可知，非空格式合法即视为可用——Master 只发布可用 Key，自知失效按空发布）：
  `PUSH_TO_MASTER`（本地可用、远端空/不可用）→ `writeApiKey`；`ADOPT_FROM_MASTER`（本地空/不可用、远端可用）→ `saveApiKey` + `onApiKeySynced` 回调提示「API Key 已从控制端同步」；其余（双方可用不同 → 各用各的；双方皆不可用；同 Key）→ 不动。
- `lastRemoteApiKey` 去重：同一远端 Key 不重复裁决（写后回显、重连短路），远端变化（Master 改 Key）才重裁；断连清理时复位。
- 成败标志：`MimoAsrClient` 对 401/403 落 `recordKeyResult(false)`、成功落 `true`（`ApiKeyStore.key_state_<sha256 前 8 字节>` 键）；`ApiKeyStore` 另有 `isWellFormed/keyState/isUsable` 判定与 `KeyState/SyncAction` 枚举。完整矩阵见 `docs/ble-protocol.md` 7506 节。
- 恢复流程只允许 `userDisconnected=true` 阻止自动重连；否则同时执行限次重连和周期扫描。
- 清理 GATT 时重置 `currentGattAction`，防止上一轮操作残留导致新连接的 GATT 队列不推进。
- Activity 销毁先断开并清空 `ConsoleBleClient` 全部回调引用，避免旧 Activity 监听器在重建后重复触发。
- **权限相关取值全部收口（1.8.0，Android 12+ 全版本范围）**：BLE 回调运行在 `BleClientThread`/扫描线程上，`SecurityException` 逃出线程即进程崩溃——扫描回调的 `device.name`/`device.address`、`connectInternal()` 取址（失败即回退断开态并放弃本次连接）、`BlePermissionHelper.isBluetoothEnabled()` 全部 runCatching；`initialize()` 的扫描器缓存**独立于 `bluetoothManager` 单独判断与重试**（同一 `runCatching` 内先赋值 manager 会在中途抛异常时留下残态，让 null 守卫永久跳过初始化，补授权限后扫描也起不来）；反射长读（隐藏 API `readCharacteristic(BluetoothGattCharacteristic,int)`）仍按原样 try/catch 并回退到分片读取日志。

关键 API：
```kotlin
fun initialize(context: Context)
fun startScanAndConnect(onDeviceFound: ((name, address) -> Unit)?)
fun connect(context: Context, address: String)
fun disconnect()              // 发送 0xFF 通知对端后断开，设置 userDisconnected=true
fun writeMode(ordinal: Int): Boolean  // 1.7.0 反向模式推送：写入 Mode(7501) 1 字节 ordinal（仅 0-3，未连接/非法返回 false）
fun stopScan()
fun isConnected(): Boolean
fun isActiveDisconnect(): Boolean  // 返回是否为主动断开（0xFF 或用户点击断开）
fun getConnectedDeviceAddress(): String?
fun startAutoScan()           // 启动周期性扫描（15s间隔，8s时长）作为重连兜底
fun stopAutoScan()
fun pauseAutoScanForDialog()  // 对话框扫描时暂停自动扫描
fun resumeAutoScanAfterDialog()
```

### PhoneDataStore

[PhoneDataStore.kt](../../slave-app/app/src/main/java/com/robotcontrol/phone/data/PhoneDataStore.kt)

数据中心单例（线程安全，`@Volatile`），观察者模式 + SharedPreferences 持久化：

- 维护当前 mode、tasks、emotion（`Emotion?` 可空）、voiceMessages
- **持久化策略**（20 天过期）：
  - mode：持久化到 SharedPreferences，过期后恢复为 `Mode.NA`
  - emotion：持久化到 SharedPreferences，过期后恢复为 `null`（NA 状态）
  - tasks：**不持久化**，始终 `emptyList()`，断开连接时清空
  - voiceMessages：仅内存，不持久化
- 新增 `hasReceivedRealData` 标志：收到过真实 BLE 数据时为 `true`，用于 UI 层判断是否显示 NA
- 订阅者通过 `DataStoreListener` 接收变更通知
- 语音消息自动去重（按 timestamp），保留最新 100 条，按时间倒序
- 收到新语音消息时发送系统通知，标题按场景取值：**普通语音消息为「主人指令」；反向模式推送的回声为「推送成功」**（1.7.0，见下）

**反向推送通知口径（1.7.0，防同一次推送双弹）**：

- `armReversePushEcho(windowMs=4000)`：手机端发起反向推送后开启回声窗口；窗口内到达的语音通知标题改用「推送成功」并消费窗口（**只弹这一条**）
- `isAwaitingReverseEcho()`：是否仍在等待回声（未被语音通知消费）
- `notifyReversePushSuccess(body)`：4s 兜底——回声未到时本地弹一条「推送成功」（正文=模式名），并置 4s 抑制窗口挡住晚到的回声
- `sendVoiceNotification()` 开头：处于抑制窗口直接 return；处于回声窗口则标题「推送成功」并清零窗口；否则标题「主人指令」（原行为）

```kotlin
interface DataStoreListener {
    fun onModeChanged(mode: Mode)
    fun onTasksChanged(tasks: List<Task>)
    fun onEmotionChanged(emotion: Emotion?)  // 可空，null 表示 NA
    fun onVoiceMessagesChanged(messages: List<VoiceMessage>)
}
```

关键 API：
```kotlin
fun initialize(context: Context)  // 从 SharedPreferences 恢复数据，检查过期
fun setNotificationContext(context: Context)
fun addListener(listener: DataStoreListener)
fun removeListener(listener: DataStoreListener)
fun setMode(newMode: Mode)
fun setTasks(newTasks: List<Task>)
fun addTask(task: Task)
fun updateTaskStatus(id: String, status: String)
fun setEmotion(newEmotion: Emotion)  // 传入非空 Emotion
fun addVoiceMessage(message: VoiceMessage)
fun addVoiceMessageIfNew(message: VoiceMessage)
fun setVoiceHistory(messages: List<VoiceMessage>)
fun armReversePushEcho(windowMs: Long = 4000L)  // 1.7.0 反向推送回声窗口
fun isAwaitingReverseEcho(): Boolean
fun notifyReversePushSuccess(body: String)      // 1.7.0 兜底弹「推送成功」并抑制晚到回声
fun clear()  // 重置所有状态为 NA + 清除持久化数据
val hasReceivedRealData: Boolean  // 是否收到过真实 BLE 数据
```

### EmotionPanelView

[EmotionPanelView.kt](../../slave-app/app/src/main/java/com/robotcontrol/phone/ui/EmotionPanelView.kt)

自定义 View，展示 4 个情绪维度（服从度/羞耻度/愉悦度/机械度）的水平进度条。
- `setEmotion(emotion: Emotion?)`：设置情绪值，传入 `null` 时显示 NA 状态（全部进度条归零）
- `showState()`：强制显示 NA 状态（不修改内部 emotion 值）

### QrScanActivity

[QrScanActivity.kt](../../slave-app/app/src/main/java/com/robotcontrol/phone/QrScanActivity.kt)

基于 Camera2 API + ZXing 的 QR 码扫描 Activity，扫码成功后通过 `EXTRA_QR_DATA` 返回 JSON 字符串给 MainActivity。

#### 布局

[activity_qr_scan.xml](../../slave-app/app/src/main/res/layout/activity_qr_scan.xml)

```
FrameLayout (root, 全屏黑底, clipChildren=false, clipToPadding=false)
├── TextureView (previewView)              # 相机预览，match_parent 全屏
├── FrameLayout (overlayContainer)         # 扫描遮罩层（LAYER_TYPE_HARDWARE）
│   ├── ScanOverlayView (代码动态添加)      # 自定义遮罩 + 扫描框
│   ├── TextView (hintText)                # 顶部提示 "将二维码放入框内自动扫描"
│   └── TextView (bottomHint)              # 底部提示 "请对准二维码"
├── View (cancelBtn)                       # 关闭按钮背景，48x48dp 正圆形
└── TextView (cancelIcon)                  # 关闭按钮图标 "✕"
```

关键设计要点：
- **根布局** `clipChildren="false"` + `clipToPadding="false"`：确保相机预览不受裁剪，内容可延伸到状态栏/导航栏区域
- **overlayContainer** 和 **cancelBtn/cancelIcon** 设置 `LAYER_TYPE_HARDWARE`：确保 UI 元素渲染在相机预览之上，避免 TextureView 内容溢出遮挡
- **cancelBtn** 使用固定 `48dp × 48dp` 尺寸，配合 `qr_btn_circle_bg.xml`（oval shape + 半透明填充 + 描边）实现正圆形按钮

#### 主题

[styles.xml](../../slave-app/app/src/main/res/values/styles.xml) 中 `Theme.QrScan`：

```xml
<style name="Theme.QrScan" parent="@android:style/Theme.Black.NoTitleBar">
    <item name="android:windowBackground">@android:color/black</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@android:color/transparent</item>
    <item name="android:windowDrawsSystemBarBackgrounds">true</item>
    <item name="android:enforceNavigationBarContrast">false</item>
    <item name="android:enforceStatusBarContrast">false</item>
    <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
</style>
```

#### 沉浸式状态栏/导航栏

`onCreate()` 中设置窗口标志，`enterImmersiveMode()` 在多个生命周期节点（onResume、onWindowFocusChanged）延迟调用以确保生效：

- **API 30+**：`setDecorFitsSystemWindows(false)` + `InsetsController.hide()` + `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`
- **API 11+**：`SYSTEM_UI_FLAG_LAYOUT_STABLE | LAYOUT_HIDE_NAVIGATION | LAYOUT_FULLSCREEN | HIDE_NAVIGATION | FULLSCREEN | IMMERSIVE_STICKY`
- 窗口背景透明，系统栏颜色透明，关闭对比度强制，清除 `TRANSLUCENT_STATUS/TRANSLUCENT_NAVIGATION` 标志
- 添加 `FLAG_FULLSCREEN` + `FLAG_LAYOUT_NO_LIMITS` + `FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS` 使内容延伸到系统栏区域
- 不设置 `FLAG_KEEP_SCREEN_ON`，按系统默认息屏时间

#### 相机预览（Camera2 API）

**相机选择**：优先后置摄像头（`LENS_FACING_BACK`），备用前置，最后 fallback 到 cameraId[0]。

**预览尺寸选择**（`chooseOptimalSize`）：
- 根据传感器方向（`sensorOrientation`）和显示旋转（`displayRotation`）交换宽高
- 最大预览尺寸限制为 4096×4096（保证清晰度）
- 选择与 JPEG 最大尺寸宽高比匹配且不小于 View 尺寸的最大分辨率

**相机参数**：
- `sensorOrientation`：从 `CameraCharacteristics.SENSOR_ORIENTATION` 获取（典型值 90）
- `previewSize`：通过 `chooseOptimalSize` 选择，如 1856×1392
- `ImageReader`：YUV_420_888 格式，4 缓冲，用于 ZXing 解码

#### configureTransform：矩阵变换（画面方向与无拉伸）

[QrScanActivity.kt](../../slave-app/app/src/main/java/com/robotcontrol/phone/QrScanActivity.kt#L396-L429) 中的 `configureTransform` 方法负责将横屏传感器缓冲区映射到竖屏全屏显示，同时保证画面不拉伸。

**核心原理**：

1. 传感器输出的是横屏画面（如 1856×1392），但手机竖屏显示（如 1440×3120）
2. `bufferRect` 初始化为 `(0, 0, ps.height, ps.width)`——即**交换宽高后的竖屏尺寸**
3. 通过 `setRectToRect(viewRect, bufferRect, FILL)` 将横屏纹理坐标映射到竖屏视图坐标，完成坐标旋转
4. `postScale` 进行中心裁剪缩放，使画面充满屏幕无黑边

**关键：竖屏（ROTATION_0）不加额外旋转**。`setRectToRect` 已经通过交换 bufferRect 的宽高完成了方向映射，再叠加 `postRotate` 会导致画面多转 90 度。

```kotlin
// 竖屏 ROTATION_0 分支：
bufferRect = RectF(0, 0, ps.height, ps.width)  // 交换宽高，映射到竖屏
bufferRect.offset(centerX - bufferRect.centerX(), centerY - bufferRect.centerY())
matrix.setRectToRect(viewRect, bufferRect, Matrix.ScaleToFit.FILL)  // 坐标映射
scale = max(viewH / ps.h, viewW / ps.w)  // 中心裁剪缩放
matrix.postScale(scale, scale, centerX, centerY)
// 不调用 postRotate
```

| 显示旋转 | 矩阵操作 |
|---------|---------|
| ROTATION_0（竖屏） | setRectToRect(交换宽高) + postScale，无旋转 |
| ROTATION_180 | postRotate(180f) |
| ROTATION_90/270 | setRectToRect + postScale + postRotate(90*(rotation-2)) |

#### 扫描遮罩（ScanOverlayView）

[QrScanActivity.kt](../../slave-app/app/src/main/java/com/robotcontrol/phone/QrScanActivity.kt#L636-L725) 中的内部类 `ScanOverlayView`，自定义 View 绘制：

- **半透明遮罩**：`Path.FillType.EVEN_ODD` 绘制全屏黑色半透明遮罩（`#99000000`），中心挖空正方形扫描框
- **扫描框**：正方形（`minDim × 0.65`），白色半透明描边（`#66FFFFFF`），无圆角矩形
- **四角装饰**：青色（`#00C3FF`）L 形角标，每条边 28dp，线宽 4dp
- **无扫描动画**：不绘制移动横线

#### 二维码解码

- 使用 ZXing `MultiFormatReader`，仅识别 QR_CODE 格式
- `ImageReader.OnImageAvailableListener` 中获取 YUV 帧，通过 `cropAndRotate` 按 `getRotation()` 角度旋转 YUV 数据后解码
- 解码成功后通过 `setResult(RESULT_OK)` 返回，`finish()` 关闭
- **提示文案全部走词典（1.10.0）**：五条原本硬编码的中文 Toast（无法打开相机 / 未找到相机 / 相机不支持 / 相机访问失败 / 无相机权限）改为 `PhoneI18n.t(...)`，英文模式下不再露中文

#### 生命周期

- `onResume`：启动后台线程，设置沉浸模式，打开相机
- `onPause`：关闭相机，停止后台线程
- `onWindowFocusChanged`：窗口获得焦点时重新进入沉浸模式

#### 相关资源文件

| 文件 | 说明 |
|------|------|
| [activity_qr_scan.xml](../../slave-app/app/src/main/res/layout/activity_qr_scan.xml) | 扫码界面布局 |
| [qr_btn_circle_bg.xml](../../slave-app/app/src/main/res/drawable/qr_btn_circle_bg.xml) | 关闭按钮正圆形背景（oval, 48dp×48dp） |
| [styles.xml](../../slave-app/app/src/main/res/values/styles.xml) | Theme.QrScan 主题定义 |

### BondStore

[BondStore.kt](../../slave-app/app/src/main/java/com/robotcontrol/phone/ble/BondStore.kt)

SharedPreferences 持久化已绑定 Console 的 MAC 地址。

---

## UI 结构

### 布局层级

```
FrameLayout (root, 全屏黑底)
├── View (topGradientBg)             # 顶部渐变遮罩（黑→透明）
├── FrameLayout (topFixedContainer)   # 固定顶部区域
│   ├── TextView (btConsoleBtn)      # 左上角蓝牙按钮 "B"
│   ├── TextView (capsule)           # 顶部中间模式胶囊（长按弹模式菜单）
│   ├── ImageView (asrBtn)           # 右上角语音识别圆钮（40dp，与胶囊同行，1.7.0）
│   └── FrameLayout (emotionPanelContainer)
│       └── EmotionPanelView         # 4维情绪面板
└── ScrollView (scrollView)          # 下部可滚动区域
    └── LinearLayout (contentLayout) # 内容容器
        └── LinearLayout (水平双列)
            ├── LinearLayout (左列：任务)
            │   └── tasksContainer + tasksEmpty
            ├── View (垂直分隔线)
            └── LinearLayout (右列：语音)
                └── voiceContainer + voiceEmpty
```

### 布局关键特性

- **顶部固定**：`topFixedContainer` 不随 ScrollView 滚动
- **渐变遮罩**：`topGradientBg` 为黑色渐变，从顶部 70% 黑（#B3000000）到底部透明，过渡区用于遮盖列表与顶部的接缝
- **位置计算**：onGlobalLayout 中动态计算胶囊位置，将 emotionPanel 放在胶囊下方，contentLayout 的 topPadding 设为固定区总高度 + 间距
- **列表卡片**：任务和语音项使用 `item_card_bg.xml`（圆角矩形卡片背景）
- **双列等宽**：左右列使用 layout_weight=1，中间有垂直分隔线

### 任务项样式

- 左侧显示类型图标：
  - cognitive：◈（橙色 #FB923C）
  - terminal：◇（青色 #2DD4BF）
  - button：◆（当前模式色）
  - 其他：●（当前模式色）
  - 已完成（status=done）：✓（灰色）
- 右侧显示任务名称，最多 2 行

### 语音项样式

- 上方显示时间（HH:mm:ss，灰色）
- 下方显示内容，最多 3 行

### 蓝牙按钮状态颜色

| 状态 | 背景色 | 边框/文字色 |
|---|---|---|
| CONNECTED | #FF1a3a1a | #4ade80（绿色） |
| DISCONNECTED | #FF3a1a1a | #ef4444（红色） |
| CONNECTING | #FF3a3018 | #fbbf24（黄色） |
| UNBONDED | BLACK | #66888888（灰色） |

### 蓝牙按钮交互
- **单击**：弹出连接管理对话框
- **长按**：注入模拟测试数据（切换模式、添加示例任务/语音/随机情绪）

---

## BLE 连接流程

1. **启动时**：
   - 检查权限，未授权则请求
   - 权限OK后检查蓝牙开关，未开则请求开启
   - 若有已绑定地址 → 直接尝试连接（`autoConnect=true` 后台连接）+ 启动 `startAutoScan()` 周期扫描兜底
   - 若无绑定地址 → 启动 `startAutoScan()` 周期扫描（15s间隔，8s时长）

2. **控制面板连接弹窗**（`showBleDialog()`）：
   - 使用 `Dialog` + `R.style.BleDialogTheme` 创建，带淡入/淡出动画（180ms，decelerate_quad/accelerate_quad）
   - 从上到下布局为：
     1. **已连接设备信息区**：状态圆点 + 设备名称/地址 + 状态文字（未绑定/已连接/连接失败/连接已手动断开/正在连接...）
     2. 分隔线
     3. **操作按钮区**：重新扫描/停止扫描、扫描二维码、断开（仅已连接时显示）、关闭
     4. 分隔线
     5. **附近设备列表**：标题"附近设备" + 可滚动设备列表（最大高度 35% 屏幕）
   - 断开按钮：调用 `ConsoleBleClient.disconnect()` + `BondStore.clearConsoleBond()`，同时断开连接和清除绑定，不再有独立的"解绑"按钮
   - 扫描 10s 超时后不关闭弹窗，按钮变为"重新扫描"可继续扫描
   - 设备列表中显示的设备状态：正常（白色）、连接中（黄色）、连接失败（红色）
   - 点击设备项发起连接，连接超时 10s 后显示连接失败
   - 状态文字区分：`isActiveDisconnect()` 为 true 时显示"连接已手动断开"，否则显示"连接失败"
   - **界面语言行（1.10.0）**：API Key 区下方「语言」标签 + 「中文 / English」两个按钮（选中态用模式绿 `#8FBC8F` 高亮），点击手选 → `PhoneI18n.setLang()` → 关闭对话框并 `recreate()` 使全部文案即时生效；回显选中态按 `PhoneI18n.getLang()`（无手选时即设备检测结果）

3. **扫码连接**：
   - 启动 QrScanActivity 扫码
   - 解析 JSON 中的 mac 字段直接连接

4. **数据接收**：
 - 连接成功后自动启用 6 个 Characteristic（Mode/Emotion/Tasks/Voice/Heartbeat/ApiKey）的 Notification（UiLang 自 1.10.0 起不订阅）
   - 立即读取 Mode/Emotion 当前值（READ_CHAR），Voice 使用 READ_LONG_CHAR
   - **Tasks 不主动读取**，完全依赖 master-app 的 BLE Notification 推送（1500ms + 3000ms 两次发送）
   - 3000ms 后执行 READ_CHAR 作为 Tasks 兜底
   - 2s 后再次读取 Voice（拉取历史）
   - 通过回调更新 PhoneDataStore

---

## 模式反向推送（1.7.0）

手机端作为机器人端可主动切换四大模式并推给控制台，与「控制台下发模式」方向相反。协议细节见 [BLE 通信协议 · 反向模式推送](../ble-protocol.md)。

- **入口一（手动）**：长按顶部胶囊 `capsule` → `showModeMenuDialog()`：`Dialog` + `R.style.BleDialogTheme` + `styleDialog()`，垂直列表 4 项（调试/恢复/忠诚/拟人，各用模式色 #8FBC8F/#FB923C/#66CCFF/#F472B6，名称走 `PhoneI18n.t(Mode.displayName)`）+「关闭」。选中项：未连接 → Toast「未连接控制面板」；已连接 → `pushModeToConsole()` = `ConsoleBleClient.writeMode(ordinal)` + `armReversePushFeedback()`。
- **入口二（语音）**：语音识别命中模式读音 → `onVoiceModeCommand(ordinal)` → 同一 `pushModeToConsole()`。
- **回声反馈**：`armReversePushFeedback(modeName)` 调 `PhoneDataStore.armReversePushEcho()` 并起 4s  watchdog（`reversePushWatchdog`）；期间控制端回推的语音通知标题变「推送成功」（只一条），watchdog 到期仍未消费则 `notifyReversePushSuccess(modeName)` 兜底弹一条。
- 蓝牙按钮 `btConsoleBtn` 的长按（注入模拟数据）保持不变。

## 语音识别（MiMo ASR，1.7.0）

新包 `com.robotcontrol.phone.speech`，仅 slave-app 具备；识别语言跟随 `PhoneI18n.getLang()`（本机设备检测 + 用户手选；1.10.0 前曾为 BLE 7507 下发）——中文界面只识别中文、英文界面只识别英文。

### 圆钮与生命周期（MainActivity）

- `asrBtn`（布局 `activity_main.xml`，`top|end` + marginEnd 24dp，`setupEdgeToEdgeInsets()` 同步 topMargin）：单击切换开/关，**常态保持**（非按住）；开启前检查 `RECORD_AUDIO`（缺失经 `recordPermissionLauncher` 申请，授权后自动开启）。
- 开/关态经 `ApiKeyStore.isAsrActive()/setAsrActive()`（SharedPreferences `phone_asr_active`）持久；`onCreate` 末尾与 `onResume()` 在「开关为开且已授权」时静默恢复，`onPause()` 停止识别并把按钮回灰（**不改** `isAsrActive` 意图）——即仅前台且开关开启时才识别，控制功耗。`onDestroy()` 释放控制器。
- 按钮视觉：开=绿底绿描边 + 绿色麦克风，关=灰底灰描边 + 灰色麦克风（`asr_btn_bg.xml` / `ic_asr_mic.xml`  tint）。

### PhoneSpeechController

- **本地识别（优先，三级引擎逐级回退）**：① API ≥31 且 `SpeechRecognizer.isOnDeviceRecognitionAvailable()` 时 `createOnDeviceSpeechRecognizer`（设备端离线）；② 不可用/创建失败回退 `createSpeechRecognizer` 且带 `EXTRA_PREFER_OFFLINE=true`（系统识别器离线优先）；③ 该系统识别器离线优先仍连续失败（典型：设备没下载离线语言包）→ 同一系统识别器放开 `EXTRA_PREFER_OFFLINE`（允许联网识别）。`EXTRA_LANGUAGE` 始终随界面语言。**可恢复错误后延迟 300ms 重启监听，同一引擎连续错误达 `MAX_LOCAL_ERRORS`(3) 次即换下一级引擎，三级全失败才退化**（`degradeLocalRecognizer()`）——有云端条件（开关开启 + 有 API Key）则切「仅云端」，否则关闭识别并提示「本地语音识别不可用」。计数口径：`ERROR_NO_MATCH`/`ERROR_SPEECH_TIMEOUT`（用户没说话/超时）属正常态不计入；`ERROR_INSUFFICIENT_PERMISSIONS`（录音权限被撤销）直接停并提示；其余（含偶发 `ERROR_CLIENT` 调用竞态）计入计数走逐级回退，**只有真正拿到识别结果（`onResults`）才清零计数**（`onReadyForSpeech` 不清零：能 ready 却持续报错的服务同样应被退化）。目的：既不让「一次离线包缺失」等同于功能不可用，也不无限重启耗电（Android 16 模拟器实测：`ON_DEVICE → SYSTEM_OFFLINE → SYSTEM_ONLINE → 仅云端` 逐级日志完整，无闪退）。
- **系统识别服务可见性**：targetSdk 30+ 的包可见性过滤会让 `isRecognitionAvailable()` / `isOnDeviceRecognitionAvailable()` 查不到系统识别服务（真机上表现为「本地语音识别不可用」），Manifest 必须声明 `<queries><intent><action android:name="android.speech.RecognitionService"/></intent></queries>`（Android 11+ 通用要求）。
- **录音**：`AudioRecord` 16kHz 单声道 PCM16 + 环形缓冲，上限 12s（≈384KB，远低于 ASR 10MB base64 限制）；每轮识别开始清空。
- **本地规则**：识别文本交 `VoiceCommandMatcher.match(text, lang)`，命中（0-3）即回调 `onModeCommand`，与手动推送同链路；命中后清空本轮缓冲防重复触发。
- **云端兜底门槛**（全部满足才发）：本地文本 ≥ `CLOUD_MIN_CHARS`(4) 字、本地未命中、`ApiKeyStore.isAsrCloudEnabled()`、API Key 非空、缓冲音频 ≥1.2s、距上次云端调用 ≥4s、无进行中调用。阈值集中在 `PhoneSpeechController.Companion` 常量。
- **三个本地引擎都不可用**：开关开启且已配置 API Key 则退化「仅云端」（能量端点切句，≥1.2s 语音段才发）；否则 `onStatusMessage("本地语音识别不可用")` 并关闭识别。

### VoiceCommandMatcher

- 返回 BLE ordinal（0-3）或 null；`containsModeKeyword(text, lang)` 供「是否含模式读音」判断。
- **按读音匹配**：内置紧凑「汉字→拼音（无声调）」表（仅覆盖关键词用字与常见同音字），识别文本转拼音序列后滑窗比对关键词拼音串——同音字（调式/中诚/回复/你人…）同样命中，满足「读音对就切换」。
- **否定词**：中文（不/不要/别/不可以/不能/不用/无需/禁止/请勿/勿）在关键词前 6 字内、英文（not/don't/do not/does not/never/without/no/cancel，**按词边界匹配**——避免 know/nothing 等含 `no`/`not` 子串的词被误判为否定）在关键词前 20 字符内出现 → 判定不切换（如「不可以进入调试模式」）。
- **语言门控**：`zh` 只匹配中文关键词、`en` 只匹配英文关键词。
- 已知取舍：同音误命中（如「回复」判为「恢复」）是「读音对就切换」的既定口径；如需收紧可在本类提高门槛。

### MimoAsrClient

- `recognize(pcm16, sampleRate, lang, apiKey): Result<String>`，单线程 executor 后台执行；PCM16 加 44 字节 WAV 头 → base64 → `POST https://api.xiaomimimo.com/v1/chat/completions`，头 `api-key`，体 `{"model":"mimo-v2.5-asr","messages":[{"role":"user","content":[{"type":"input_audio","input_audio":{"data":"data:audio/wav;base64,..."}}]}],"asr_options":{"language":"zh"|"en"}}`；取 `choices[0].message.content`；连接 15s / 读取 60s 超时。
- 与 TTS 共用同一 API Key（`ApiKeyStore.getApiKey()`）。

## 设置页云端开关（1.7.0）

手机端设置页即 `showBleDialog()` 对话框。API Key 输入区下方新增：

1. 开关行：标签「识别引擎调用云端（MiMo ASR）」+ `Switch`（即时落库 `ApiKeyStore.setAsrCloudEnabled()`）；**框架 `Switch` 在 `Theme.Black` 下轨道/滑块尺寸塌缩不可见，故显式指定 `asr_switch_track.xml` / `asr_switch_thumb.xml`**（开=模式绿轨+白钮，关=深灰轨+灰钮，`showText=false`）。
2. 副提示「关闭后仅使用本地离线识别」。
3. 收费提示「Xiaomi MiMo TTS和ASR可能需要收费，请阅读官网相关文档。」（与控制端 www 同句，词条在 `PhoneI18n`）。
4. **界面语言行（1.10.0）**：「语言」标签 + 中文 / English 两枚按钮（见「蓝牙对话框」条目说明）。

---

## 首次启动（First Run，1.10.0）

首次打开 App（SharedPreferences `first_run_prefs` 中 `first_run_done` 未置位）时，主界面上直接覆盖一层原生首启设置界面，把此前只藏在蓝牙对话框里的两项关键设置前置：

- **宿主与可见性**：`activity_main.xml` 末尾的 `firstRunContainer`（`FrameLayout`，`match_parent`，背景 `#FF05100A`，`elevation=24dp`，初始 `visibility=gone`）；`showFirstRunIfNeeded()` 在 `onCreate` 末尾调用（**排在 `PhoneI18n.init()` 之后**，否则会按默认语言渲染），未完成时 `addView(buildFirstRunView())` 并置 `VISIBLE`。
- **界面内容**（`buildFirstRunView()`，代码构建，风格与主界面一致：黑底 + 模式绿标题 + 灰副文案）：
  1. 标题 `Slave` + 副标题「首次启动设置」
  2. **语言**：「中文 / English」两枚按钮（选中态模式绿高亮），默认按设备语言自动匹配（检测不到即英文），点击手选即 `PhoneI18n.setLang()` 并按新语言重建整个首启界面
  3. **MiMo API Key（可选）**：密码型单行输入 + 说明「用于高质量机械语音合成，连接时自动同步到控制台」
  4. **「识别引擎调用云端（MiMo ASR）」开关**（`ApiKeyStore.isAsrCloudEnabled()/setAsrCloudEnabled()`）+ 副提示
- **按钮**：`开始使用`（非空 Key 时 `ApiKeyStore.saveApiKey()` 落库）与 `跳过，保持默认`，两者都调 `dismissFirstRun()`。
- **完成标记**：`markFirstRunDone()` 写 SharedPreferences `first_run_prefs.first_run_done=true`；`dismissFirstRun()` 同时把容器置 `GONE` 并清空子视图，此后不再出现（实测重启不复现）。语言手选另存 `robot_ui_lang`（含 `lang_manual=true`），与首启完成标记相互独立。

---

### 二轮修复（同日复核）

- **首启界面先于权限申请**：`showFirstRunIfNeeded()` 返回是否已显示，`initBle()` 与相机/通知授权在首启完成前推迟——此前系统蓝牙与相机弹窗会先盖在首启界面上。
- **首启选语言立刻作用于主界面**：语言按钮改为「先落库已输入的 API Key → `PhoneI18n.setLang` → `recreate()`」；此前只重建首启界面本身，主界面要等重启才换语言。
- **切语言不丢 Key**：重建前从当前视图取回已输入内容（`findFirstRunKeyInput`）。
- **二维码扫描页提示随语言**：`hintText`/`bottomHint` 此前只取视图未回写文案，英文模式恒显示中文；现走 `PhoneI18n.t()`。

## 构建配置

- **compileSdk / targetSdk**: 34
- **minSdk**: 24（语音识别的 `createOnDeviceSpeechRecognizer` 为 API 31，运行时按版本与设备可用性兜底）
- **主要依赖**: AndroidX Core、Activity-KTX、ZXing（二维码扫描）
- **单元测试（1.8.0 建，1.9.1 扩容）**: `testImplementation 'junit:junit:4.13.2'` + `app/src/test/java/com/robotcontrol/phone/speech/VoiceCommandMatcherTest.kt`（纯 JVM，无 Android 依赖）覆盖本地语音规则的四大模式读音、同音字命中、否定词与否定局部性、中英语言门控、空文本与「是否含模式读音」判定，以及 1.9.1 补的真实 ASR 输出（带标点/句号）与英文否定词词边界两项；命令 `./gradlew :app:testReleaseUnitTest`（12 项）
- **Application 类**: RobotPhoneApplication（创建通知渠道 `RobotControl`）
- **权限与可见性**: BLUETOOTH_CONNECT/ADVERTISE/SCAN、CAMERA（扫码）、POST_NOTIFICATIONS（Android 13+）、RECORD_AUDIO（语音识别，1.7.0）；另需 `<queries>` 声明 `android.speech.RecognitionService`（系统识别服务可见性，1.9.1）
