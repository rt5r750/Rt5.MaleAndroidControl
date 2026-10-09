# watch-app（手表端）

## 概述

- **目录**：[watch-app](../../watch-app)
- **包名**：`com.robotcontrol.watch`
- **技术栈**：Kotlin 原生 WearOS
- **BLE 角色**：GATT Client（连接 Console：master-app / win-app）
- **入口**：MainActivity（单 Activity）

---

## 目录结构

```
watch-app/
├── app/
│   ├── src/main/
│   │   ├── java/com/robotcontrol/watch/
│   │   │   ├── MainActivity.kt              # 主界面，三页面滑动容器 + 权限引导/扫描连接UI/保活设置引导
│   │   │   ├── ble/
│   │   │   │   ├── BleConstants.kt          # BLE 常量（UUID、状态、超时）
│   │   │   │   ├── BlePermissionHelper.kt   # 蓝牙权限工具（仅 SCAN/CONNECT，纯客户端）
│   │   │   │   ├── BleKeepAliveService.kt   # BLE 保活前台服务（connectedDevice）：连接生命周期/回调接线/震动/常驻通知
│   │   │   │   ├── BootReceiver.kt          # 开机自启（已绑定时拉起保活服务）
│   │   │   │   ├── BondStore.kt             # 配对地址持久化（SharedPreferences）
│   │   │   │   ├── PhoneBleClient.kt        # BLE Client 单例（串行队列+MTU+分片重组）
│   │   │   │   └── QrCodeGenerator.kt       # QR码生成（未使用）
│   │   │   ├── data/
│   │   │   │   ├── WatchDataStore.kt        # 数据中心单例 + 观察者模式
│   │   │   │   ├── Mode.kt                  # Mode 枚举
│   │   │   │   ├── Emotion.kt               # Emotion 数据类
│   │   │   │   ├── Task.kt                  # Task 数据类（无type字段）
│   │   │   │   └── VoiceMessage.kt          # VoiceMessage 数据类
│   │   │   └── ui/
│   │   │       ├── PageContainer.kt         # 自定义 ViewGroup，三页面横向滑动
│   │   │       ├── EmotionView.kt           # 情绪面板自定义 View（纯 onDraw 绘制）
│   │   │       ├── TaskPageView.kt          # 任务页
│   │   │       └── VoicePageView.kt         # 语音页
│   │   ├── res/
│   │   │   ├── drawable/
│   │   │   │   └── bt_btn_bg.xml            # 蓝牙按钮圆形边框背景
│   │   │   ├── layout/
│   │   │   │   └── activity_main.xml        # 主布局容器
│   │   │   └── values/
│   │   └── AndroidManifest.xml
│   └── build.gradle
└── ...
```

---

## 核心类说明

### MainActivity

[MainActivity.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/MainActivity.kt)

职责：
1. 全屏黑色背景、常亮（`FLAG_KEEP_SCREEN_ON`）、无标题栏
2. 三页面横滑容器 `PageContainer` + 三个自定义 View（Emotion/Task/Voice）
3. 圆形屏幕 safePadding 计算：`minDimension * 0.08f`，最小 18dp
4. 蓝牙按钮在右下角，仅支持单击弹出对话框（无长按模拟数据功能）；对话框含「扫描/断开/解绑/保活设置/关闭」
5. 时间实时显示（HH:mm 格式，顶部居中，16sp 白色）
6. 模式胶囊在顶部居中（marginTop=32dp，14sp，带边框圆角胶囊背景 #CC000000）
7. 旋转表冠支持：仅 Task/Voice 页面滚动列表
8. 默认显示 TaskPageView（page1）
9. **BLE 生命周期不在 Activity**：权限/蓝牙开启引导通过后仅 `BleKeepAliveService.start()` 拉起前台服务（连接与回调接线在服务）；`onDestroy` 不再断开 BLE（1.5.0 前销毁即断连）

关键 UI 成员：
- `root: FrameLayout` - 根容器（黑色背景）
- `pageContainer: PageContainer` - 三页面横滑容器
- `emotionPage: EmotionView` - 情绪页（page0）
- `taskPage: TaskPageView` - 任务页（page1，默认）
- `voicePage: VoicePageView` - 语音页（page2）
- `timeText: TextView` - 实时时间（顶部居中）
- `capsule: TextView` - 模式胶囊（顶部居中）
- `btBtn: TextView` - 蓝牙按钮（右下角，48x48dp 圆形边框，显示"B"）

### PhoneBleClient

[PhoneBleClient.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/ble/PhoneBleClient.kt)

BLE GATT Client 单例（object），连接 Console（master-app `RobotControl-Console` / win-app `RobotControl-Win`），与 slave-app ConsoleBleClient 同一套成熟模式（1.5.0 对齐重写）：
1. 扫描按 `ScanFilter`（Service UUID=7500）过滤，命中即接受（名称以 `scanRecord` 优先、系统缓存名兜底，仅用于展示——旧版因首轮 `device.name` 为 null 直接丢设备的缺陷已修复）
2. 独立 BLE 线程 + **GATT 操作串行队列**（CCCD 订阅×4、初读排队执行——旧版连发 4 次 `writeDescriptor` 只等第 1 次，Emotion/Tasks/Voice 通知订阅失败的缺陷已修复）
3. 连接后 `requestMtu(512)` 协商再发现服务；`connectGatt` 指定 `TRANSPORT_LE`
4. **支持 0x7E 分片重组**（3 字节包头 magic/chunkIndex/totalChunks，收齐回调整包——旧版把每片当完整 JSON 解析失败、任务/语音页空白的缺陷已修复）
5. 自动重连（最多 3 次，间隔 3 秒）
6. 不读取 Voice 历史（voice 初读仅取单包，长历史由通知分片补齐）

回调接口：
```kotlin
var onConnectionStateChanged: ((state: Int) -> Unit)?
var onModeReceived: ((modeOrdinal: Int) -> Unit)?
var onEmotionReceived: ((obedience, shame, pleasure, mechanical: Int) -> Unit)?
var onTasksReceived: ((tasksJson: String) -> Unit)?
var onVoiceReceived: ((voiceJson: String) -> Unit)?
```

关键 API：
```kotlin
fun initialize(context: Context)
fun startScan(onDeviceFound: ((name, address) -> Unit)?)
fun connect(context: Context, address: String)
fun disconnect()
fun stopScan()
fun isConnected(): Boolean
```

### WatchDataStore

[WatchDataStore.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/data/WatchDataStore.kt)

数据中心单例（object，`@Volatile` 线程安全），观察者模式：
- 维护当前 mode、tasks、emotion、voiceMessages 与 `connectionState`（BLE 连接状态，BleConstants.BLE_STATUS_*）
- 订阅者通过 `DataStoreListener` 接收变更通知（5个回调，`onBleStateChanged` 默认空实现）
- `addVoiceMessage` 自动保留最新 20 条
- 新消息插入到列表头部

```kotlin
interface DataStoreListener {
    fun onModeChanged(mode: Mode)
    fun onTasksChanged(tasks: List<Task>)
    fun onEmotionChanged(emotion: Emotion)
    fun onVoiceMessagesChanged(messages: List<VoiceMessage>)
    fun onBleStateChanged(state: Int) {}   // 1.5.0 新增
}
```

### BleKeepAliveService（保活前台服务）

[BleKeepAliveService.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/ble/BleKeepAliveService.kt)

BLE 保活前台服务（`foregroundServiceType="connectedDevice"`，`START_STICKY`），1.5.0 新增——**连接生命周期、数据回调接线（→WatchDataStore）、模式切换震动全部收拢于此**，Activity 退出/被杀/息屏后连接与震动仍工作：

- **前台常驻通知**（渠道 `ble_keepalive`，IMPORTANCE_LOW 静默）：标题「750接收端运行中」，正文随状态（已连接：当前模式 / 正在连接 / 重连中 / 未绑定），点击回 MainActivity；`startForeground` 显式传 `FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE`（targetSdk 34 要求 manifest 同声明 `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_CONNECTED_DEVICE`）
- **模式切换震动**（`VibrationEffect.createWaveform`，需 `VIBRATE` 权限）：拟人模式=两短 `[0,150,150,150]`、忠诚模式=两长 `[0,600,200,600]`、调试模式=一长 `[0,600]`；恢复模式与 NA 不震；**同一序号 1s 内去重**（初读+订阅推送双触发不双震）
- **被杀拉起**：`onTaskRemoved` 经 AlarmManager `getForegroundService` 1s 后自重启；开机由 `BootReceiver`（`BOOT_COMPLETED`，仅已绑定时）拉起恢复连接
- 权限不足/蓝牙未开时服务驻留（通知提示），用户打开 App 完成授权后 `MainActivity.startBle()` 再次拉起

**保活设置引导**（MainActivity，首连成功弹一次、蓝牙按钮菜单「保活设置」可再开）：按 `Build.MANUFACTURER` 适配——小米（自启动授权管理+耗电优化无限制+任务锁定）、OPPO/一加/真我（自启动管理+耗电管理允许后台），其余通用文案；按钮「电池优化白名单」（`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`，失败回退列表页）与「应用信息」；一次性记忆于 SharedPreferences `keepalive_prefs`。

### PageContainer

[PageContainer.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/ui/PageContainer.kt)

自定义 ViewGroup，三页面横向滑动：
- 手势阈值 24px 拦截
- 滑动切换阈值 0.35（滑动距离超过宽度 35% 即翻页）
- fling 速度阈值 500px/s
- 动画时长 150ms，LinearInterpolator
- 透明度渐变切换动画

关键 API：
```kotlin
fun addView(view: View)
fun setCurrentPage(index: Int, animate: Boolean)
fun getCurrentPage(): Int
```

### EmotionView

[EmotionView.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/ui/EmotionView.kt)

自定义 View（纯 onDraw 绘制），4 个情绪维度：
- 服从度：#4ade80（绿色）
- 羞耻度：#fb923c（橙色）
- 愉悦度：#f472b6（粉色）
- 机械度：#f87171（红色）
- 圆角进度条高度 10dp，圆角半径 barHeight/2
- 居中显示

### TaskPageView

[TaskPageView.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/ui/TaskPageView.kt)

ScrollView + 垂直 LinearLayout：
- 不解析 task.type 字段（只有 id/name/status）
- 任务项符号：已完成 ✓（灰色）、未完成 ●（当前模式色）
- `setContentTopPadding` 设置顶部内边距避开胶囊

### VoicePageView

[VoicePageView.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/ui/VoicePageView.kt)

ScrollView + 垂直 LinearLayout：
- 时间格式 HH:mm:ss（灰色 11sp）
- 内容 15sp 白色
- 新消息自动滚动到顶部（`scrollTo(0,0)`）

### BondStore

[BondStore.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/ble/BondStore.kt)

SharedPreferences 保存 Phone 地址：
- `hasConsoleBond(): Boolean`
- `getConsoleAddress(): String?`
- `saveConsoleAddress(address: String)`
- `clearConsoleBond()`

### BlePermissionHelper

[BlePermissionHelper.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/ble/BlePermissionHelper.kt)

蓝牙权限工具，处理运行时权限请求和蓝牙开关检查。

### QrCodeGenerator

[QrCodeGenerator.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/ble/QrCodeGenerator.kt)

QR码生成工具类存在，但当前 MainActivity 中未使用。

### BleConstants

[BleConstants.kt](../../watch-app/app/src/main/java/com/robotcontrol/watch/ble/BleConstants.kt)

UUID 常量、状态常量、超时参数，与其他端一致。

---

## UI 结构

### 布局层级

[activity_main.xml](../../watch-app/app/src/main/res/layout/activity_main.xml)

```
FrameLayout (root, 全屏黑底 #000000)
├── PageContainer (pageContainer)       # 全屏放置，三页面横滑容器
│   ├── EmotionView (page0)             # 情绪页
│   ├── TaskPageView (page1)            # 任务页（默认显示）
│   └── VoicePageView (page2)           # 语音页
├── TextView (timeText)                 # 顶部居中，marginTop=8dp，16sp白色
├── TextView (capsule)                  # 顶部居中，marginTop=32dp，14sp，带边框圆角胶囊 #CC000000
└── TextView (btBtn)                    # 右下角，marginEnd=18dp/marginBottom=18dp，48x48dp圆形边框按钮，显示"B"
```

### 蓝牙按钮状态颜色

| 状态 | 边框/文字色 |
|---|---|
| CONNECTED | #4ade80（绿色） |
| DISCONNECTED | #ef4444（红色） |
| CONNECTING | #fbbf24（黄色） |
| UNBONDED | #66888888（灰色） |

### 蓝牙按钮交互
- **单击**：弹出连接管理对话框（扫描/断开/解绑/关闭）
- **无长按功能**：不支持注入模拟测试数据

---

## BLE 连接流程

1. **启动时**：
   - 检查权限，未授权则请求
   - 权限OK后检查蓝牙开关，未开则请求开启
   - 若有已绑定地址 → 直接尝试连接（10s 超时）
   - 若无绑定地址 → 延迟 2s 自动开始扫描

2. **扫描对话框**：
   - 扫描 10s，过滤 Service UUID=7500
   - 列表显示发现的设备（名称+MAC）
   - 点击设备项 → 保存地址、连接
   - 未发现设备提示"未发现设备"

3. **数据接收**：
   - 连接成功后经 GATT 串行队列启用 4 个 Characteristic 的 Notification 并依次读取初始值（`requestMtu(512)` 先行）
   - 通过回调更新 WatchDataStore（接线在 `BleKeepAliveService`，Activity 只观察渲染）
   - **模式切换震动**在服务层 `onModeReceived` 触发（见 BleKeepAliveService 一节）

---

## 关键差异点（与 slave-app 对比）

| 特性 | watch-app | slave-app |
|---|---|---|
| Task 数据类 | 无 type 字段，不区分任务类型/优先级 | 有 type 字段（cognitive/terminal/button等） |
| 语音历史保留 | 20 条 | 100 条 |
| BLE Client | MTU=512 协商 + 0x7E 分片重组 + 串行队列（1.5.0 对齐 slave-app） | MTU=512、分片重组（Magic=0x7E）、长读反射 |
| 语言 | 保持中文（不订阅 7507 UiLang） | 跟随发送端（订阅 7507 UiLang） |
| 保活 | `BleKeepAliveService` 前台服务 + 开机自启 + 划掉自重启 + 模式切换震动 | 无前台服务（Activity 进程内） |
| NFC 读取 | 不支持 | 不支持（已移除） |
| QR 码扫描 | 不支持 | 支持（ZXing） |
| QR 码生成 | 类存在但未使用 | 未使用 |
| 系统通知 | 仅保活常驻通知（连接状态+模式） | 发送（标题"主人指令"） |
| GATT Server | 无（纯 Client 角色） | 有 WatchGattServer 但未启用 |
| 页面切换动画 | 透明度渐变 | 无渐变，纯切换 |
| BLE 角色 | 仅 GATT Client 连接 Console | GATT Client 连接 Console，可选 GATT Server |
| 模拟数据 | 无长按注入 | 长按蓝牙按钮注入模拟测试数据 |
