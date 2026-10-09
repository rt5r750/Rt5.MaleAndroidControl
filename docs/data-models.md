# 数据模型

三端共用统一的数据模型定义，以下字段在三端保持一致。

---

## Mode（运行模式）

**枚举定义**：

| ordinal | 枚举名 | displayName | 颜色 (ARGB) | 色值 HEX |
|---|---|---|---|---|
| 255 | NA | 未设置 | 0xFF666666 | `#666666`（灰色） |
| 0 | TEST | 调试模式 | 0xFF8FBC8F | `#8FBC8F`（暗绿色） |
| 1 | RECOVERY | 恢复模式 | 0xFFFB923C | `#FB923C`（橙色） |
| 2 | LOYALTY | 忠诚模式 | 0xFF66CCFF | `#66CCFF`（天蓝色） |
| 3 | SIMULATED_HUMAN | 拟人模式 | 0xFFF472B6 | `#F472B6`（粉色） |

**代码位置**：
- [Mode.kt (slave-app)](../slave-app/app/src/main/java/com/robotcontrol/phone/data/Mode.kt)
- [Mode.kt (watch-app)](../watch-app/app/src/main/java/com/robotcontrol/watch/data/Mode.kt)

**BLE 传输**：通过 CHAR_MODE (7501) 以 1 字节 ordinal 传输。

**模式显示名自定义（1.5.0 起，www 三端设置页）**：
- 存储键 localStorage `robotModeNames`：`{test, recovery, loyalty, simulated-human}` 四键全量对象，`''` = 用默认名；数据仅存于各端本地显示，不参与 BLE 传输（7501 仍只传 ordinal）
- 匹配规则（**整组**判定）：四名整体完全等于中文默认组 → 匹配中文；整体完全等于英文默认组（= i18n 词典译文）→ 匹配英文；混搭（一半中文默认一半英文默认）与自定义均视为不匹配。匹配时按界面语言显示对应语言默认名（EN 仍由 i18n 词典翻译中文源串），不匹配时四个名称一律按保存原文显示（自定义名不支持中英双语标签）；留空 = 恢复该模式默认名
- 消费点：模式按钮/showcase 圆钮/模式菜单/日志与终端/TTS 播报/状态栏 title 全部经 `getModeNameSource()` 解析；设置页「模式名称设置」组（含各模式功能简介），应用更改时若有修改先弹确认对话框逐条列出「原名→新名+简介」
- 自定义内容经 `I18N.setProtected()` 注册精确匹配保护集，EN 模式不做子串误译

**仿人男性机器人信息参数（www `robotStatusItems`）中英文逻辑（1.6.0 起整组判定）**：22 项 label/value **整组**判定——全部项与默认组（标签锚定默认项，值与该项中文默认或英文默认 i18n 词典译文一致）完全匹配 → 随界面语言显示对应语言默认内容；**任意一项不匹配 → 全组按保存原文显示**（全部渲染输出源串注册保护集，含留空回退的默认串，防 EN 子串误译）。作用于移动端状态列表、三栏信息参数 chips、「关于本机」窗口。前两行（主人/制造公司）为锁定行：值恒取型号信息源串（`resolveStatusItems()` 驱动），设置组内不渲染不可改。

**型号信息（1.6.0 起，www `robotModelInfo`）**：`{fullName, shortName, company, master, ttsReading}` 五键全量对象，`''` = 用默认值；与模式名同规则**整组**判定（五项整体等于中文默认组或英文默认组才随界面语言，任意一项自定义全组按原文，留空恢复该默认值）。`ttsReading` 为**全型号语音读法**（默认 zh「踢三一七五零型仿人男性机器人」/ en「T-Three-One-seven-five-0 Male Android」，照 EN 翻译标签念），`normalizeForSpeech()` 按当前界面语言把句中完整型号与简称统一替换为该读法。驱动界面各处型号/公司/主人显示（`data-model-info` + 模板句）、信息参数锁定两行、win-app 启动器标题。

**信息面板链接（1.6.0 起，www `robotInfoLinks`）**：4 条可配置链接 `{id, name, url}` 数组（PDF 条目文件名含公司名固定不可配）；`null` = 全默认（默认名随界面语言），任意名称自定义则按原文显示（保护集豁免）。作用于信息面板文件列表（与内置 FILES 按 id 合并生效）。**1.10.0 起 `type:'doc'`（App 使用说明书）与 `type:'action'`（获取 App）是固定条目，不进本列表**——`getEffectiveInfoLinks()` 过滤二者，其名称/路径由 `manualName()` / `manualPath()` 按界面语言直出。

**激活标记（1.6.0 起，www `robotActivated`）**：首次启动激活引导页完成标记（`true` 后不再出现）。**1.10.0 起覆盖到全部客户端**：Android WebView / 窄屏不再免除激活页（未激活时先显示激活页、完成/跳过后再进主界面），win-app 首次启动以独立激活窗口（`?firstrun=1`）承载并回写本标记；登录页的免除保证仍只与登录界面有关，两回事。

---

## UiLang（界面语言，BLE）

| 值 | 含义 |
|---|---|
| `0x00` | 中文（zh） |
| `0x01` | English（en） |
| `0xFF` | 未设置（接收方保持当前语言） |

- 传输：CHAR_UI_LANG (7507)，1 字节 `READ|NOTIFY`，单向 Server→Client
- 消费方（v1.10.0 起）：**新版 slave-app 不再消费**——其界面语言由本机决定（用户手选 → 设备语言检测 → 英文），已删除订阅/初读/`onLangReceived` 链路；特征与服务端推送/补发行为均保留，旧版 slave-app 仍可跟随。watch-app 不订阅（保持中文）
- **手机端语言的来源已改**：v1.10.0 前 slave-app 的语言来自控制端 7507 推送（`PhoneI18n` 由 `onLangReceived` 写入）；现该来源已移除，两端各自独立决策（master-app `ConsoleI18n` / slave-app `PhoneI18n` 同用一套三级顺序，见下）

### 语言决策顺序（三端统一，v1.10.0 起）

1. **用户手选**（持久化值 + 手选标记）
2. **设备语言自动检测**：主语言标签 `zh*` → 中文；其余（含 en 在内的所有其他语言）/检测不到 → 英文
3. **兜底英文**（**默认语言由中文改为英文**）

| 端 | 检测依据 | 手选存储 |
|---|---|---|
| www 控制台 | `navigator.languages` / `navigator.language` | localStorage `robot_ui_lang`（仅 `setLang` 写入）；win-app 另由原生桥 `consoleAPI.bootLang` 覆盖 |
| master-app | `Locale.getDefault().toLanguageTag()` | SharedPreferences `robot_ui_lang`：`lang` + `lang_manual` |
| slave-app | 同 master-app | SharedPreferences `robot_ui_lang`：`lang` + `lang_manual` |
| win-app | `app.getLocale()`（未就绪时 Intl / 环境变量兜底） | `huancun/i18n-lang.json`：`{lang, manual}` |

- **自动检测结果一律不落盘**：每次启动重新检测，仅手选值持久化（Android 端手选时同写 `lang_manual=true`），故「设备是中文」与「用户改回英文」不会互相覆盖。
- **win-app 旧文件兼容**：v1.10.0 前的 `i18n-lang.json` 只有 `lang` 而无 `manual`，而旧实现仅在用户手动切换时写入，故一律视为手选（`manual` 缺省即 `true`）。

---

## Emotion（情绪状态）

**数据类字段**：

| 字段名 | 类型 | 范围 | 说明 |
|---|---|---|---|
| obedience | Int | 0-100 | 服从度 |
| shame | Int | 0-100 | 羞耻度 |
| pleasure | Int | 0-100 | 愉悦度 |
| mechanical | Int | 0-100 | 机械度 |

> **注意**：slave-app 的 Emotion 数据类无默认参数值，所有字段必须显式传入。slave-app 中使用 `Emotion?` 可空类型，null 表示未接收到数据（显示 NA）。

**代码位置**：
- [Emotion.kt (slave-app)](../slave-app/app/src/main/java/com/robotcontrol/phone/data/Emotion.kt)
- [Emotion.kt (watch-app)](../watch-app/app/src/main/java/com/robotcontrol/watch/data/Emotion.kt)

**BLE 传输**：通过 CHAR_EMOTION (7502) 传输，4 字节顺序为 `[obedience, shame, pleasure, mechanical]`。

---

## Task（任务项）

**数据类字段**：

| 字段名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| id | String | - | 任务唯一标识 |
| name | String | - | 任务显示名称 |
| status | String | `"pending"` | 任务状态：`"pending"` / `"done"` 等 |
| type | String? | `null` | 任务类型，见下表 |

**type 可选值与排序优先级**：

| type 值 | typePriority | 显示符号 | 说明 |
|---|---|---|---|
| `"cognitive"` | 0 | ◈（橙色） | 认知类任务（最高优先级，排在最前） |
| `"terminal"` | 1 | ◇（青色） | 终端/执行类任务 |
| `null`/其他 | 2 | ●（当前模式色） | 普通任务 |
| `"button"` | 3 | ◆（当前模式色） | 按钮类操作（最低优先级，排在最后） |

**派生属性**：
- `isDone: Boolean`：当 `status == "done"` 时为 true
- `typePriority: Int`：用于列表排序（见上表）

**代码位置**：
- [Task.kt (slave-app)](../slave-app/app/src/main/java/com/robotcontrol/phone/data/Task.kt)
- [Task.kt (watch-app)](../watch-app/app/src/main/java/com/robotcontrol/watch/data/Task.kt)

**BLE 传输**：通过 CHAR_TASKS (7503) 传输，UTF-8 JSON 数组。

**JSON 格式示例**：
```json
[
  {
    "id": "cog_1",
    "name": "用户存在红色颜色偏好",
    "status": "pending",
    "type": "cognitive"
  },
  {
    "id": "term_1",
    "name": "执行环境扫描任务",
    "status": "pending",
    "type": "terminal"
  },
  {
    "id": "norm_1",
    "name": "前往充电座充电",
    "status": "done",
    "type": null
  },
  {
    "id": "btn_1",
    "name": "暂停所有任务执行",
    "status": "pending",
    "type": "button"
  }
]
```

> 注意：watch-app 的 Task 数据类中没有 `type` 字段（不解析 type），只有 id/name/status。

---

## VoiceMessage（语音消息）

**数据类字段**：

| 字段名 | 类型 | 说明 |
|---|---|---|
| timestamp | Long | 消息时间戳（毫秒级 Unix 时间） |
| content | String | 消息文本内容 |

**代码位置**：
- [VoiceMessage.kt (slave-app)](../slave-app/app/src/main/java/com/robotcontrol/phone/data/VoiceMessage.kt)
- [VoiceMessage.kt (watch-app)](../watch-app/app/src/main/java/com/robotcontrol/watch/data/VoiceMessage.kt)

**BLE 传输**：通过 CHAR_VOICE (7504) 传输，格式自动识别：
- 首字符 `{` → 单条消息（JSON 对象）
- 首字符 `[` → 历史消息（JSON 数组）
- 其他 → 纯文本，自动包装为 `{"timestamp": 当前时间, "content": 文本}`

**单条消息 JSON 示例**：
```json
{
  "timestamp": 1720000000000,
  "content": "系统已启动，等待指令"
}
```

**历史消息 JSON 示例**：
```json
[
  {
    "timestamp": 1720000000000,
    "content": "系统已启动，等待指令"
  },
  {
    "timestamp": 1720000005000,
    "content": "任务执行完成，请查收"
  }
]
```

**消息保留上限**：
- Phone 端：最多保留 **100 条**，按 timestamp 降序排列，去重（同一 timestamp 只保留一条）
- Watch 端：最多保留 **20 条**

---

## DataStore 观察者接口

Phone 和 Watch 端均使用单例 DataStore + 观察者模式，接口定义基本一致（slave-app 的 `onEmotionChanged` 使用 `Emotion?` 可空类型）：

```kotlin
interface DataStoreListener {
    fun onModeChanged(mode: Mode)
    fun onTasksChanged(tasks: List<Task>)
    fun onEmotionChanged(emotion: Emotion?)  // slave-app: Emotion?（可空）；watch-app: Emotion（非空）
    fun onVoiceMessagesChanged(messages: List<VoiceMessage>)
}
```

- Phone：[PhoneDataStore.kt](../slave-app/app/src/main/java/com/robotcontrol/phone/data/PhoneDataStore.kt) — 使用 SharedPreferences 持久化 mode + emotion（20 天过期），tasks 不持久化
- Watch：[WatchDataStore.kt](../watch-app/app/src/main/java/com/robotcontrol/watch/data/WatchDataStore.kt) — 1.5.0 起新增 `connectionState` 状态与 `onBleStateChanged(state)`（默认空实现）监听方法：BLE 连接状态由保活前台服务 `BleKeepAliveService` 驱动写入，Activity 仅观察渲染

---

## 首启与语言：存储键（v1.10.0）

| 端 | 存储 | 键 / 文件 | 内容 | 说明 |
|---|---|---|---|---|
| 各端 | localStorage / SharedPreferences / 文件 | `robot_ui_lang` | `zh` / `en` | **仅用户手选时写入**；自动检测结果不落盘 |
| master-app / slave-app | SharedPreferences（同文件 `robot_ui_lang`） | `lang_manual` | `boolean` | 1.10.0 新增：手选标记。仅 `manual=true` 时 `lang` 才被采信，否则按 `Locale.getDefault()` 重新检测 |
| win-app | 文件 | `huancun/i18n-lang.json` | `{lang, manual}` | 1.10.0 前只有 `lang`（视为手选）；检测结果不写入本文件 |
| win-app | 文件 | `huancun/activated.json` | `{done:true, at:ISO}` | 1.10.0 新增：**First Run 完成标记**。无文件（或 `done` 非真）视为未激活 → 启动时先弹激活窗口（`?firstrun=1`）；IPC `firstrun-done` 或页面 `firstRunReady(false)` 时写入 |
| slave-app | SharedPreferences | `first_run_prefs` → `first_run_done` | `boolean` | 1.10.0 新增：**首启设置界面完成标记**。「开始使用」与「跳过，保持默认」都置位，此后不再显示 |
| www（控制台内 / `?firstrun=1`） | localStorage | `robotActivated` | `boolean` | 既有键（1.6.0），1.10.0 起 Android WebView 同样生效；win-app 以它 + 宿主 `activated.json` 双条件判定 |

- **标记互相独立**：语言手选（`robot_ui_lang` / `lang_manual`）与首启完成标记互不耦合；win-app 的 `activated.json`（宿主侧）与 localStorage `robotActivated`（页面侧）保持同源同值（控制台内完成激活也回写宿主标记）。
