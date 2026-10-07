# BLE 通信协议

## GATT Service 定义

三端共用同一套 GATT Service 定义：

| 项 | UUID |
|---|---|
| Service | `00007500-0000-1000-8000-00805f9b34fb` |
| Characteristic - Mode | `00007501-0000-1000-8000-00805f9b34fb` |
| Characteristic - Emotion | `00007502-0000-1000-8000-00805f9b34fb` |
| Characteristic - Tasks | `00007503-0000-1000-8000-00805f9b34fb` |
| Characteristic - Voice | `00007504-0000-1000-8000-00805f9b34fb` |
| Characteristic - Heartbeat | `00007505-0000-1000-8000-00805f9b34fb` |
| Characteristic - ApiKey | `00007506-0000-1000-8000-00805f9b34fb` |
| Characteristic - UiLang | `00007507-0000-1000-8000-00805f9b34fb` |
| CCC Descriptor | `00002902-0000-1000-8000-00805f9b34fb` |

Emotion/Tasks/Voice/UiLang Characteristic 属性：`PROPERTY_READ | PROPERTY_NOTIFY`，权限 `PERMISSION_READ`。
Mode/Heartbeat/ApiKey Characteristic 属性：`PROPERTY_READ | PROPERTY_WRITE | PROPERTY_NOTIFY`，权限 `PERMISSION_READ | PERMISSION_WRITE`。

## Characteristic 数据格式

### CHAR_MODE (7501) - 当前模式

- **长度**：1 字节
- **属性**：`PROPERTY_READ | PROPERTY_WRITE | PROPERTY_NOTIFY`
- **权限**：`PERMISSION_READ | PERMISSION_WRITE`
- **方向**：双向。Server→Client 由控制台 Notify 当前模式；Client→Server 由 phone-app 写入 ordinal 反向切换控制台模式（见「反向模式推送」）
- **字节布局**：

| 偏移 | 字段 | 类型 | 说明 |
|---|---|---|---|
| 0 | modeOrdinal | uint8 | Mode 枚举的 ordinal 值（0-3, 255=NA） |

### CHAR_EMOTION (7502) - 情绪状态

- **长度**：4 字节
- **字节布局**：

| 偏移 | 字段 | 类型 | 范围 | 说明 |
|---|---|---|---|---|
| 0 | obedience | uint8 | 0-100 | 服从度 |
| 1 | shame | uint8 | 0-100 | 羞耻度 |
| 2 | pleasure | uint8 | 0-100 | 愉悦度 |
| 3 | mechanical | uint8 | 0-100 | 机械度 |

### CHAR_TASKS (7503) - 任务列表

- **长度**：可变（UTF-8 JSON 数组）
- **格式**：UTF-8 编码的 JSON 数组字符串，每个元素是 Task 对象
- **支持分片传输**：当数据超过 MTU 限制时使用分片协议（见下文）

### CHAR_VOICE (7504) - 语音消息/历史

- **长度**：可变（UTF-8 JSON）
- **格式**：
  - **单条消息**：UTF-8 编码的 JSON 对象（VoiceMessage）
  - **历史消息**：UTF-8 编码的 JSON 数组（VoiceMessage 数组）
  - 接收端通过首字符判断：`{` 为单条，`[` 为历史，其他视为纯文本（自动包装为对象）
- **支持分片传输**：当数据超过 MTU 限制时使用分片协议（见下文）

### CHAR_HEARTBEAT (7505) - 双向心跳检测

- **长度**：1 字节
- **属性**：`PROPERTY_READ | PROPERTY_WRITE | PROPERTY_NOTIFY`
- **权限**：`PERMISSION_READ | PERMISSION_WRITE`
- **CCCD**：已配置，支持 Notification 订阅

**心跳协议**：

| 角色 | 方向 | 间隔 | 数据 | 说明 |
|------|------|------|------|------|
| Server (android-app / win-app) | Notify → Client | 每 5s | `0x01` | 服务端心跳信号 |
| Client (phone-app) | Write → Server | 每 5s | 递增序列号 (0x00-0xFF) | 客户端心跳信号，Server 收到后回传 Notification |
| Server (android-app / win-app) | Notify → Client | 断开时 | `0xFF` | 主动断开通知 |

**断联检测规则**：
- Client 连续 **2 次**心跳写入失败 → 判定连接断开，触发 `onConnectionStateChange(DISCONNECTED)`
- Client 心跳写入成功后等待服务端回传 **15s**（3 个心跳周期）；超时同样强制清理并按意外断开恢复
- Client 收到 `0xFF` 心跳 → 判定为对端主动断开，设置 `activeDisconnect=true` + `userDisconnected=true`，显示"连接已手动断开"（状态4），不自动重连
- Server 收到 Client 写入的 `0xFF` → 设置 `manualDisconnectReceived=true`，`onConnectionStateChanged` 中通过 `consumeManualDisconnect()` 判断后显示"连接已手动断开"（状态4）
- 每次成功收到心跳数据（非 0xFF）→ 重置失败计数器

**重连机制**：
- 主动断开（`userDisconnected=true`）：不触发自动重连，等待用户手动操作
- 意外断开（`!userDisconnected`）：`scheduleReconnect(autoConnect=true)` 后台自动连接 + `startAutoScan()` 周期扫描兜底
- `scheduleReconnect()` 不受 `activeDisconnect` 阻断，仅 `userDisconnected` 阻断

### CHAR_APIKEY (7506) - MiMo TTS API Key

- **长度**：可变（UTF-8）
- **属性**：`PROPERTY_READ | PROPERTY_WRITE | PROPERTY_NOTIFY`
- **权限**：`PERMISSION_READ | PERMISSION_WRITE`
- **方向**：phone-app 连接成功后若本地保存有 MiMo API Key（约 500ms 后）写入该特征；android-app / win-app 服务端收到后保存并向客户端回显 Notify，同时通知前端（`_onMimoApiKeySynced` 覆写 TTS Key）
- **初始值**：空

### CHAR_UI_LANG (7507) - 界面语言

- **长度**：1 字节
- **属性**：`PROPERTY_READ | PROPERTY_NOTIFY`（单向 Server→Client 推送）
- **权限**：`PERMISSION_READ`
- **字节布局**：

| 偏移 | 字段 | 类型 | 值 | 说明 |
|---|---|---|---|---|
| 0 | uiLang | uint8 | `0x00` / `0x01` / `0xFF` | `0x00`=中文（zh）、`0x01`=English（en）、`0xFF`=未设置 |

- **发送时机**：
  - 控制台界面语言变化（www 设置页切换 → android-app JS 桥 `setUiLang` / win-app IPC `i18n-set-lang`）时立即 Notify
  - 客户端订阅 CCCD 后由服务端自动补发当前值（android-app `sendCurrentValueFor`；win-app 在广播启动与宿主就绪时补推）
- **消费方**：
  - phone-app：订阅 + 初读该特征，收到后 `PhoneI18n.setLang` 并重建界面——**phone-app 无语言设置，显示语言完全跟随发送端**；`0xFF` 保持当前语言。上一次收到的语言经 SharedPreferences 持久化，作为未连接时的初始语言
  - watch-app：不订阅（手表端保持中文界面）
- **初值**：服务端启动时取控制台当前语言（android-app `ConsoleI18n.getLang()`；win-app 由 Electron 主进程在宿主就绪/广播启动时推送）

## 反向模式推送（Client → Server）

Mode(7501) 除 Server→Client 的模式下发外，还支持 Client→Server 的**反向写入**：手机端（phone-app）手动或经语音切换模式后把目标模式推给控制台，控制台随之切换并高亮对应模式按钮。

| 项 | 说明 |
|---|---|
| 方向 | Client (phone-app) → Server (android-app / win-app) |
| 操作 | Write Request，服务端立即 `sendResponse(GATT_SUCCESS)` |
| 数据 | 1 字节 modeOrdinal |
| 生效范围 | 仅 `0-3` 生效；`255`(NA) 与其他值忽略 |

**服务端处理**：

1. 立即 `sendResponse(GATT_SUCCESS)`；
2. 写入值同步进 `characteristicValues`（保持 READ 一致，随后控制台会以自身真实模式回写并 Notify）；
3. `ordinal ∈ 0..3` → 触发回调：android-app `RobotGattServer.onModeReceived`；win-app C# 宿主 `ModeReceived` 事件 → IPC `{"type":"mode","ordinal":n}` → 主进程 `bleBridge.on('mode')`；
4. 前端统一入口 `window.__rcOnRemoteMode(ordinal)`（[app-ble.js](file:///d:/AIProject/RobotControl/www/js/app-ble.js)）→ `activateMode(modeId)`：高亮模式按钮、TTS 播报、写日志，并按既有链路把模式回推给所有已连接客户端（含发起方）；
5. 控制端提示「推送成功」：android-app 用原生 Toast（`ConsoleI18n`）；win-app 与桌面宽度浏览器（`isDesktopChrome()`）用页面内 macOS 风格通知（`showMacosNotification`）；Android WebView 不弹页面通知，避免与原生 Toast 重复。

**客户端（phone-app）通知口径**：反向推送不本地立即弹通知，而是 `PhoneDataStore.armReversePushEcho()` 开启 4s 回声窗口——窗口内到达的语音通知标题由「主人指令」改为「推送成功」并消费窗口（**只弹这一条**）；4s 内未收到回声则由 `notifyReversePushSuccess()` 兜底弹一条，同时置 4s 抑制窗口挡住晚到的回声，防止同一次推送出现两条通知。非反向场景（普通语音消息）标题仍为「主人指令」。

**触发入口（phone-app）**：长按顶部模式胶囊弹出模式菜单（4 项 + 关闭），或语音识别命中模式读音（见 phone-app 文档「语音识别」）。两者均经 `ConsoleBleClient.writeMode(ordinal)` 走同一链路；未连接控制台时提示「未连接控制面板」。

## 分片传输协议

当 Notification 数据超过单包 MTU 大小时，使用分片传输。

### 分片魔数与包头

| 偏移 | 字段 | 长度 | 值 | 说明 |
|---|---|---|---|---|
| 0 | magic | 1 byte | `0x7E` | 分片标识魔数 |
| 1 | chunkIndex | 1 byte | 0-255 | 当前分片序号（从 0 开始） |
| 2 | totalChunks | 1 byte | 1-255 | 总分片数 |
| 3 | payload | N bytes | - | 数据负载 |

- **默认 MTU**：23 字节
- **Notification 开销**：3 字节
- **单包最大 payload**（不分片）：`MTU - 3` 字节
- **每分片最大 payload**：`MTU - 3 - 3 = MTU - 6` 字节
- **发送调度**：Android Console 服务端将每个设备的单包与分片包放入 FIFO 队列，非阻塞地逐个投递；正常完成后约 20ms 出队下一包，失败回退延迟 50ms，避免占用 BLE 线程导致心跳与握手停摆

### 分片重组规则

1. 收到数据首字节为 `0x7E` 时判定为分片包
2. 根据 `chunkIndex == 0` 重置缓冲区
3. 拼接 payload 到缓冲区
4. 当 `chunkIndex == totalChunks - 1` 时，将完整缓冲区数据交给上层处理

### MTU 协商

- Phone 端 ConsoleBleClient 请求 MTU = 512
- 协商成功后使用协商的 MTU，失败回退到默认 23
- MTU 变更时，`maxPayload = mtu - 3`，`chunkPayloadSize = maxPayload - 3`

## 设备命名规则

| 角色 | 设备名 |
|---|---|
| Console | `RobotControl-Console` |
| Windows 控制台 | `RobotControl-Win` |
| Phone | `RobotControl-Phone` |
| 前缀 | `RobotControl-` |

扫描过滤条件：phone-app 与 watch-app 的 `ScanFilter` 均按服务 UUID 7500 过滤。phone-app 扫描回调同时接受“名称以 `RobotControl-` 开头”或“广告含服务 UUID 7500”的设备；watch-app 命中 UUID 过滤即接受（名称以 `scanRecord` 优先、系统缓存名兜底，仅用于展示），因此两端均可发现 android-app（`RobotControl-Console`）与 win-app（`RobotControl-Win`）。

## 连接状态常量

| 常量名 | 值 | 说明 |
|---|---|---|
| BLE_STATUS_UNBONDED | 0 | 未绑定（无配对记录） |
| BLE_STATUS_CONNECTED | 1 | 已连接 |
| BLE_STATUS_DISCONNECTED | 2 | 已断开（连接失败/意外断联） |
| BLE_STATUS_CONNECTING | 3 | 正在连接 |
| BLE_STATUS_MANUAL_DISCONNECTED | 4 | 手动断开（收到0xFF或用户主动断开） |

## 连接参数

| 参数 | 值 |
|---|---|
| 连接超时 | 10000 ms (10s) |
| 最大重连次数 | 3 次 |
| 重连间隔 | 3000 ms (3s) |
| 扫描时长 | 10000 ms (10s) |
| 心跳间隔 | 5000 ms (5s) |
| 心跳最大失败次数 | 2 次 |
| 冷启动扫描间隔 | 15000 ms (15s) |
| 冷启动扫描时长 | 8000 ms (8s) |

## 配对机制

### QR 码格式

QR 码内容为 JSON 字符串：

```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "name": "RobotControl-Console",
  "service": "00007500-0000-1000-8000-00805f9b34fb",
  "role": "console"
}
```

- Phone 端扫码后读取 `mac` 字段直接连接
- win-app 二维码使用真实蓝牙适配器 MAC 与 `name: "RobotControl-Win"`，其余字段与示例一致

### 配对信息持久化

- [BondStore.kt](file:///d:/AIProject/RobotControl/phone-app/app/src/main/java/com/robotcontrol/phone/ble/BondStore.kt) 使用 SharedPreferences 保存已绑定设备 MAC 地址
- 启动时自动尝试连接已绑定设备
