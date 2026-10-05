# phone-app（手机端）

## 概述

- **目录**：[phone-app](file:///d:/AIProject/RobotControl/phone-app)
- **包名**：`com.robotcontrol.phone`
- **技术栈**：Kotlin 原生 Android，纯代码构建 UI（无 XML 布局编写、无 Compose）
- **BLE 角色**：GATT Client（连接 Console）；代码中存在 WatchGattServer 但未在 MainActivity 中启动
- **配对方式**：BLE 扫描、QR 码扫描（NFC 已移除）
- **入口**：MainActivity + QrScanActivity

## 目录结构

```
phone-app/
├── app/
│   ├── src/main/
│   │   ├── java/com/robotcontrol/phone/
│   │   │   ├── MainActivity.kt              # 主界面，BLE 连接管理 + UI 构建
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
│   │   │   │   ├── Mode.kt                  # Mode 枚举
│   │   │   │   ├── Emotion.kt               # Emotion 数据类
│   │   │   │   ├── Task.kt                  # Task 数据类
│   │   │   │   └── VoiceMessage.kt          # VoiceMessage 数据类
│   │   │   └── ui/
│   │   │       └── EmotionPanelView.kt      # 情绪面板自定义 View（4 个进度条）
│   │   ├── res/
│   │   │   ├── anim/
│   │   │   │   ├── dialog_enter.xml         # 连接弹窗进入动画（淡入，180ms）
│   │   │   │   └── dialog_exit.xml          # 连接弹窗退出动画（淡出，180ms）
│   │   │   ├── drawable/                    # 背景 drawable（胶囊、按钮、卡片、渐变等）
│   │   │   │   └── qr_btn_circle_bg.xml     # 扫码界面关闭按钮正圆形背景
│   │   │   ├── layout/
│   │   │   │   ├── activity_main.xml        # 主布局（容器，UI 内容代码动态添加）
│   │   │   │   └── activity_qr_scan.xml     # 扫码界面布局
│   │   │   └── values/
│   │   │       ├── styles.xml               # 主题样式（含 BleDialogTheme、DialogAnimation）
│   │   └── AndroidManifest.xml
│   └── build.gradle
└── ...
```

## 核心类说明

### PhoneI18n

[PhoneI18n.kt](file:///d:/AIProject/RobotControl/phone-app/app/src/main/java/com/robotcontrol/phone/PhoneI18n.kt)

界面语言覆盖层（1.3.0 新增）：默认中文，`t(中文)` 按表返回英文、中文原文一字不改，覆盖情绪面板/任务名/语音消息/模式名/连接面板/权限与扫描提示等全部原生文案。`values-en/strings.xml` 仅承载随系统语言的启动器标签与胶囊初始文案。**1.5.0 起无手动语言设置（长按胶囊切换已移除），显示语言完全跟随发送端**：ConsoleBleClient 订阅+初读 BLE `7507(UiLang)`（`0x00`=zh/`0x01`=en/`0xFF` 保持当前语言），MainActivity 收到 `onLangReceived` 后 `PhoneI18n.setLang` 并 recreate；最近一次收到的语言经 SharedPreferences `robot_ui_lang` 持久化，作为未连接时的初始语言。

### MainActivity

[MainActivity.kt](file:///d:/AIProject/RobotControl/phone-app/app/src/main/java/com/robotcontrol/phone/MainActivity.kt)

职责：
1. 全屏 EdgeToEdge 沉浸式显示，状态栏/导航栏透明，不设置 FLAG_KEEP_SCREEN_ON（按系统默认息屏时间）
2. 代码动态构建全部 UI（顶栏胶囊、情绪面板、双列任务/语音列表）
3. 管理 Console BLE 连接生命周期
4. 提供 BLE 对话框（Dialog + BleDialogTheme 淡入/淡出动画，180ms）：扫描设备、扫码、断开（同时清除绑定）
5. 通过 `styleDialog()` 统一设置对话框背景（圆角+半透明边框）和窗口属性
6. 监听 PhoneDataStore 变化并更新 UI
7. 长按蓝牙按钮注入模拟测试数据

关键 UI 成员：
- `capsule: TextView` - 顶部模式显示胶囊
- `btConsoleBtn: TextView` - 左上角蓝牙连接按钮
- `emotionPanel: EmotionPanelView` - 情绪面板（固定在顶部）
- `topGradientBg: View` - 顶部黑色渐变遮罩
- `scrollView: ScrollView` - 下部滚动容器
- `tasksContainer / voiceContainer: LinearLayout` - 任务/语音列表容器
- `topFixedContainer: FrameLayout` - 固定在顶部不滚动的容器

关键数据处理：
- `onTasksReceived`：解析任务 JSON 时，id 先尝试 `getLong` 再 `getString` 兼容数字/字符串类型；name 使用 `optString` 安全处理
- `onEmotionChanged(emotion: Emotion?)`：回调参数为可空类型，`null` 时显示 NA 状态（4 个进度条归零）
- Mode ordinal 255 映射到 `Mode.NA`：`ordinal == 255 → Mode.NA`，`ordinal in 0..3 → Mode.values()[ordinal + 1]`（因为 NA 排在枚举首位）

### ConsoleBleClient

[ConsoleBleClient.kt](file:///d:/AIProject/RobotControl/phone-app/app/src/main/java/com/robotcontrol/phone/ble/ConsoleBleClient.kt)

BLE GATT Client 单例，连接 Console 端：
1. 扫描：`ScanFilter` 按服务 UUID 7500 过滤，回调同时接受“名称以 `RobotControl-` 开头”或“广告含服务 UUID 7500”的设备（兼容 android-app `RobotControl-Console` 与 win-app `RobotControl-Win`）
2. 连接后请求 MTU=512，发现服务
3. 订阅 7 个 Characteristic（Mode/Emotion/Tasks/Voice/Heartbeat/ApiKey/UiLang）的 Notification
4. 连接成功后立即读取 Mode/Emotion/UiLang 当前值（READ_CHAR）；Voice 使用 READ_LONG_CHAR 读取历史
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
var onLangReceived: ((lang: String) -> Unit)?   // 1.5.0 新增：UiLang(7507)，"zh"/"en"，0xFF 不回调
```

Voice 数据分发规则：
- 首字符 `[` → `onVoiceHistoryReceived`
- 首字符 `{` → `onVoiceReceived`
- 其他纯文本 → 自动包装为对象后调用 `onVoiceReceived`

**连接可靠性规则**：

- 心跳兜底以服务端 Notification 为准；写入成功后 15s 内未收到服务端心跳则调用统一的断连恢复流程。
- 恢复流程只允许 `userDisconnected=true` 阻止自动重连；否则同时执行限次重连和周期扫描。
- 清理 GATT 时重置 `currentGattAction`，防止上一轮操作残留导致新连接的 GATT 队列不推进。
- Activity 销毁先断开并清空 `ConsoleBleClient` 全部回调引用，避免旧 Activity 监听器在重建后重复触发。

关键 API：
```kotlin
fun initialize(context: Context)
fun startScanAndConnect(onDeviceFound: ((name, address) -> Unit)?)
fun connect(context: Context, address: String)
fun disconnect()              // 发送 0xFF 通知对端后断开，设置 userDisconnected=true
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

[PhoneDataStore.kt](file:///d:/AIProject/RobotControl/phone-app/app/src/main/java/com/robotcontrol/phone/data/PhoneDataStore.kt)

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
- 收到新语音消息时发送系统通知（标题"主人指令"）

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
fun clear()  // 重置所有状态为 NA + 清除持久化数据
val hasReceivedRealData: Boolean  // 是否收到过真实 BLE 数据
```

### EmotionPanelView

[EmotionPanelView.kt](file:///d:/AIProject/RobotControl/phone-app/app/src/main/java/com/robotcontrol/phone/ui/EmotionPanelView.kt)

自定义 View，展示 4 个情绪维度（服从度/羞耻度/愉悦度/机械度）的水平进度条。
- `setEmotion(emotion: Emotion?)`：设置情绪值，传入 `null` 时显示 NA 状态（全部进度条归零）
- `showState()`：强制显示 NA 状态（不修改内部 emotion 值）

### QrScanActivity

[QrScanActivity.kt](file:///d:/AIProject/RobotControl/phone-app/app/src/main/java/com/robotcontrol/phone/QrScanActivity.kt)

基于 Camera2 API + ZXing 的 QR 码扫描 Activity，扫码成功后通过 `EXTRA_QR_DATA` 返回 JSON 字符串给 MainActivity。

#### 布局

[activity_qr_scan.xml](file:///d:/AIProject/RobotControl/phone-app/app/src/main/res/layout/activity_qr_scan.xml)

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

[styles.xml](file:///d:/AIProject/RobotControl/phone-app/app/src/main/res/values/styles.xml) 中 `Theme.QrScan`：

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

[QrScanActivity.kt](file:///d:/AIProject/RobotControl/phone-app/app/src/main/java/com/robotcontrol/phone/QrScanActivity.kt#L396-L429) 中的 `configureTransform` 方法负责将横屏传感器缓冲区映射到竖屏全屏显示，同时保证画面不拉伸。

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

[QrScanActivity.kt](file:///d:/AIProject/RobotControl/phone-app/app/src/main/java/com/robotcontrol/phone/QrScanActivity.kt#L636-L725) 中的内部类 `ScanOverlayView`，自定义 View 绘制：

- **半透明遮罩**：`Path.FillType.EVEN_ODD` 绘制全屏黑色半透明遮罩（`#99000000`），中心挖空正方形扫描框
- **扫描框**：正方形（`minDim × 0.65`），白色半透明描边（`#66FFFFFF`），无圆角矩形
- **四角装饰**：青色（`#00C3FF`）L 形角标，每条边 28dp，线宽 4dp
- **无扫描动画**：不绘制移动横线

#### 二维码解码

- 使用 ZXing `MultiFormatReader`，仅识别 QR_CODE 格式
- `ImageReader.OnImageAvailableListener` 中获取 YUV 帧，通过 `cropAndRotate` 按 `getRotation()` 角度旋转 YUV 数据后解码
- 解码成功后通过 `setResult(RESULT_OK)` 返回，`finish()` 关闭

#### 生命周期

- `onResume`：启动后台线程，设置沉浸模式，打开相机
- `onPause`：关闭相机，停止后台线程
- `onWindowFocusChanged`：窗口获得焦点时重新进入沉浸模式

#### 相关资源文件

| 文件 | 说明 |
|------|------|
| [activity_qr_scan.xml](file:///d:/AIProject/RobotControl/phone-app/app/src/main/res/layout/activity_qr_scan.xml) | 扫码界面布局 |
| [qr_btn_circle_bg.xml](file:///d:/AIProject/RobotControl/phone-app/app/src/main/res/drawable/qr_btn_circle_bg.xml) | 关闭按钮正圆形背景（oval, 48dp×48dp） |
| [styles.xml](file:///d:/AIProject/RobotControl/phone-app/app/src/main/res/values/styles.xml) | Theme.QrScan 主题定义 |

### BondStore

[BondStore.kt](file:///d:/AIProject/RobotControl/phone-app/app/src/main/java/com/robotcontrol/phone/ble/BondStore.kt)

SharedPreferences 持久化已绑定 Console 的 MAC 地址。

---

## UI 结构

### 布局层级

```
FrameLayout (root, 全屏黑底)
├── View (topGradientBg)             # 顶部渐变遮罩（黑→透明）
├── FrameLayout (topFixedContainer)   # 固定顶部区域
│   ├── TextView (btConsoleBtn)      # 左上角蓝牙按钮 "B"
│   ├── TextView (capsule)           # 顶部中间模式胶囊
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

3. **扫码连接**：
   - 启动 QrScanActivity 扫码
   - 解析 JSON 中的 mac 字段直接连接

4. **数据接收**：
 - 连接成功后自动启用 6 个 Characteristic（含 Heartbeat/ApiKey）的 Notification
   - 立即读取 Mode/Emotion 当前值（READ_CHAR），Voice 使用 READ_LONG_CHAR
   - **Tasks 不主动读取**，完全依赖 android-app 的 BLE Notification 推送（1500ms + 3000ms 两次发送）
   - 3000ms 后执行 READ_CHAR 作为 Tasks 兜底
   - 2s 后再次读取 Voice（拉取历史）
   - 通过回调更新 PhoneDataStore

---

## 构建配置

- **compileSdk / targetSdk**: 34
- **minSdk**: 31 (Android 12)
- **主要依赖**: AndroidX AppCompat/CoreKTX、ZXing（二维码扫描）
- **Application 类**: RobotPhoneApplication（创建通知渠道 `RobotControl`）
- **权限**: BLUETOOTH_CONNECT/ADVERTISE/SCAN、CAMERA（扫码）、POST_NOTIFICATIONS（Android 13+）
