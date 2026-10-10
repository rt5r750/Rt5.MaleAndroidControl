# RobotControl 开发文档

## 项目总览

RobotControl 是一个多端协同的机器人控制系统：master-app（控制台，Kotlin+WebView+HTML，GATT Server）作为主控面板，slave-app（手机端，Kotlin原生）和watch-app（手表端，WearOS原生）作为BLE客户端接收状态展示，另有 win-app（Windows 桌面版，Electron）作为控制台的桌面端。数据以 Console 经 BLE Notification 向下推送到 Phone 和 Watch 为主，另有客户端上行通道（Heartbeat 心跳、ApiKey 同步、Mode 反向模式推送）；win-app 通过 C# BLE 外设宿主（Windows GATT Server）广播 `RobotControl-Win`，前端与桥接等效于 master-app 控制台，slave-app 可直接扫描或扫码连接。www 共享前端可直接以浏览器打开（未来托管到网站），并内置 App 拉起引导：网页打开后弹窗引导拉起本机 App（`robotcontrol://console`，手机端拉起 master-app / PC 端拉起 win-app），未安装则引导至 GitHub Releases 下载（https://github.com/rt5r750/Rt5.MaleAndroidControl/releases/latest，1.11.0 起替代原夸克网盘）；纯浏览器端首访为强制缓存流程：「获取完整体验」窗口不可关闭/忽略，必须点击置顶的「缓存网页」按钮完成缓存（`rc_full_cache` 标记）才进入控制台，网页更新后自动提示重新缓存（背景图更新除外）；已缓存用户窗口恢复常规可关闭形态，设置页亦有缓存/拉起/下载三按钮。

## 文档导航

- [整体架构](architecture.md)
- [BLE通信协议](ble-protocol.md)
- [数据模型](data-models.md)
- [master-app（控制台端）](master-app/reademe.md)
- [slave-app（手机端）](slave-app/reademe.md)
- [watch-app（手表端）](watch-app/reademe.md)
- [win-app（Windows 桌面版）](win-app/reademe.md)
- [功能文档：移动端设置 UI、连接稳定性、外链打开与语音识别（v1.8.0 交付，语音识别退化口径 v1.9.1 更新）](compose/spec/mobile-settings-connect-voice.md)
- [功能文档：Clawbot 通知推送与斜杠指令查询（v1.12.0 交付）](compose/spec/clawbot-notify.md)

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

- **1.12.1**（2026-10-10）：
  - 新增：**Clawbot 通知推送与斜杠指令查询（Telegram + 飞书，0 token）**——① **推送两类分开**：语音播报内容（`主人指令：`+内容）挂 `speak()` 统一出口（与语音历史 / BLE Voice 7504 同口径，覆盖终端指令、按钮、模式切换、任务完成、系统通知等全部播报）；实时修改的数据（`数据变更：`+内容）挂情绪滑杆（speak 传 `kind='data'`）、任务增删、设置保存前后快照 diff（只推实际改动项「旧→新」）；前缀与内容随 master 端语言设置（EN 为 `Master's Command: ` / `Data Change: `），模式名等文案取实际设置值（保护集自定义名原样），空白内容不推送，推送队列限速 1 条/秒。② **反向斜杠指令本地解析直接回复（全程不调用大模型 = 0 token）**：`/help /query /mode /emotion /runtime /tasks /model /status /buttons /links` 十条命令覆盖 app 全部参数；空白指令（空串/单独 `/`）不支持、直接忽略，未知指令回帮助；回复语言=当前界面语言；账号密码与 API Key 只回「已设置/未设置」、Bot Token/App Secret 永不回显。③ **平台接入**：Telegram（`sendMessage` + `getUpdates` 长轮询免公网 IP，offset 落库防重放，只响应配置 Chat ID）与飞书（自定义机器人 webhook 仅推送 / 自建应用双向：tenant_access_token 缓存 + `im/v1/messages` 收发、按 create_time 水位去重）独立配置、可同时启用（消息双发、查询回复回指令所在平台）。④ **网络出口三路**：fetch 直连 → 原生通用桥 `httpFetchAsync`（master-app `MainActivity.kt` HttpURLConnection / win-app preload+IPC `net.fetch`，仿 mimoFetch 通知+拉取模式），桥白名单仅 `api.telegram.org` / `open.feishu.cn`（防特权通道滥用）。⑤ **UI**：标题定「IM 通知推送 / IM Notifications」（不带 Clawbot，一眼可知推到 IM；说明文字含 Clawbot 提及）；设置页新增第 14 组（三开关 + 两平台配置 + 测试发送，随「应用更改」保存、校验失败中止）；激活页新增第 11 节（状态行 + 「打开设置」弹出大窗 `#clawbot-modal` 同款表单，**非必要项**，跳过/取消不影响激活完成）；配置键 `robotClawbotConfig` 并入配置导入导出（「改为默认设置」不涉及，与 MiMo Key 同属连接类配置口径）。⑥ **使用说明**：说明书新增 6.2「IM 通知推送（Clawbot）」（BotFather 建 bot、飞书两模式接入步骤、字段说明、命令表、0 token/空白指令/脱敏/网络注意事项），2.5 激活表单补第 11 组（共十一组）、第 6 章分组表与目录同步；README 中英补功能简介与接入教程链接（飞书官方 · 自定义机器人 / 机器人概览、Telegram 教程中文 / English，设置组说明与表单帮助同步内置）及 iOS 无法侧载 Slave 端时的替代用途说明。⑦ **推送口径**：运行参数本身不推送（与不推给 slave 同口径），仅充电状态切换推一条（`notifyChargingChange`，基线不推）；每平台+会话首条出站消息前发一次性绑定提示「（完整型号）已被主人成功绑定，输入/help查看帮助，反查状态需要（主人名称）Master端在线。」（随界面语言含 EN 译文，型号/主人名取实际设置值）。⑧ **Chat ID 智能解析与「自动获取会话 ID」**：t.me 链接 / 用户名 / 纯名自动规范化并经 getChat 解析数字 ID，填 bot 自己的用户名（getMe 对比判定，Chat 对象无 is_bot 字段）给明确指引；自动获取按钮经 getUpdates?offset=-1 从最近消息发现会话 ID；错误分类提示（chat not found / token 无效 / 网络错误）。实现：新模块 `www/js/app-clawbot.js`（推送队列/两平台收发/命令解析/共用表单）+ `app-core.js`（speak 挂点与 kind 参数、performSettingsSave 快照 diff、任务推送、导出键、表单保存/回填）+ `app.css` 大窗样式 + i18n 词条全套 + 两端原生通用 HTTP 桥。功能细节见 `docs/compose/spec/clawbot-notify.md`。
  - 修复：**全新环境下 EN 模式模式名恒中文**（既有缺陷：整组判定漏「空串=默认」情形）——`getModeNamesMatch` 原以「值 == 中文默认名」判整组匹配，而模式名未自定义时存储为全空串（留空=恢复默认），被判「整组不匹配」后全组模式名注册进 i18n 保护集、EN 翻译被挡（模式按钮 / 播报 / Clawbot 查询回复均显中文，与 v1.6.0「全默认时随界面语言」口径不符）。修为与 `getModelInfoMatch` 同口径的空串回退判定（空=默认 → 随界面语言；任一自定义 → 全组原文语义不变）。实测：EN 模式名正确显示 Test Mode 等，自定义名仍按原文。
  - 修复：**斜杠指令反查回复发三遍**（用户实测）——restartPolling 多次调用后旧轮询循环链未死透，多个并行循环消费同一条指令各回复一次；改轮询代际（循环回调校验代际即退出）。
  - 修复：**Slave 端反向切模式时 Master 的 IM 通知发两遍**（用户实测）——反向推送回声/重复事件二次走 activateMode 二次播报；__rcOnRemoteMode 加幂等短路（已是该模式不再重播，「推送成功」提示照常）。
  - 修复：**i18n 词典 3 条历史遗漏补录**（check-gaps / check-dynamic 审计发现，v1.11.0 文案漏录、EN 模式会露中文）——`App 使用说明书`、`API Key 一致，无需同步`、`本机 API Key 可用，各用各的（未覆盖）`。
  - **实测口径**：本地 mock Telegram/飞书 Bot API + fetch 路由注入跑通全链路——两类推送（「主人指令：」cmd 类挂 `speak()` 出口、「数据变更：」data 类挂情绪滑杆/任务增删/设置保存快照 diff）双平台各达、空白内容丢弃、队列 1 条/秒限速；斜杠指令 `/query /mode /help /nosuch` 本地解析回复正确（0 token 全程无 LLM 调用），空白指令（`/`、空串）忽略、非配置 Chat ID 的消息忽略、飞书按 create_time 水位去重；EN 模式前缀与回复全英文（`Master's Command: ` / `Data Change: `）、模式名按实际设置（自定义名原文、默认名随语言）。浏览器 1920/412 双视口中英验证：设置页第 14 组（表单渲染/回填/测试发送成功与失败反馈/导航 14 组）、激活页第 11 节（状态摘要「已配置：Telegram / 飞书（双向）」、大窗弹出/保存持久/取消关闭/跳过不影响激活完成，大窗 z 70 高于激活层）、EN 扫描设置组/激活页/大窗三处 0 中文泄漏；`check:i18n` 四项全绿。产物抽验：master APK dex 含 `httpFetchAsync`/`getHttpFetchResult`、内嵌 HTML/说明书含 Clawbot 板块，win zip 内 `app-clawbot.js` 与仓库 md5 一致（见 `docs/release-ledger.md` v1.12.0 节）；win-app `npm start` 实机启动正常（启动器窗口 "Master"），改动文件 `node --check` 全过。**已发布 GitHub Release v1.12.1**（Release #409124411，三件素材，title/og:title 纯英文自检过，产物与抽验串见 `docs/release-ledger.md` v1.12.1 节）。真实 Telegram API 实测：getChat('@xxx') 无 is_bot 字段（改 getMe 对比判定 bot 自身用户名）、getUpdates?offset=-1 发现会话、Chat ID 解析链路正确。**待验证项**：① 真实端到端消息收发（bot 会话需用户先发 /start 建立后验证绑定提示/测试消息到达）；② master-app AVD 装包实测未做成——模拟器 PackageManager 服务持续 broken pipe（冷启动、adb 重建均无效，属 AVD 环境损坏），本轮以 assembleRelease 编译打包 + APK 内容抽验 + 浏览器端同源前端全链路验证替代。
- **1.11.0**（2026-10-09）：
  - 移除：**「手机端 Key 优先」单向覆盖废弃**——slave-app 连接后 500ms 无条件 `writeApiKey()` 覆盖 Master 的旧行为删除，替换为下方「API Key 双端同步」的裁决式对齐；设置页「手机端Key优先」提示文案与词典同步改为新同步规则说明。
  - 移除：**激活页不再显示控制按钮 1-10 只读行**——与设置页口径统一，仅渲染 11 号及以后可编辑行，组内留一行「1-10 固定不可修改」提示（词条入 i18n）。
  - 新增：**API Key 双端同步（7506 双向对齐，Slave 统一裁决）**——连接控制台后 Slave 读取 7506 取 Master 侧 Key 并一次裁决；判定口径「可用 = 格式合法（`sk-` 前缀且 ≥16 字符）且无鉴权失败历史」，历史成败由真实 TTS/ASR 调用自动按 Key 哈希落本地标志（401/403 记 fail、成功记 ok，网络类错误不改写；不发探测请求）。同步矩阵：一侧空/失效、另一侧可用 → 以有效方为准（Master→Slave 采纳入库 / Slave→Master 写 7506）；双方可用且相同 → 短路；双方可用但不同 → 各用各的不同步；双方都空/失效 → 不动（不清空）；同一 Key 不重复同步。实现：slave-app（连接后改读 7506 交 `ApiKeyStore.decideSync` 裁决，`lastRemoteApiKey` 去重防回显/重连循环，采用后回调提示「API Key 已从控制端同步」；`MimoAsrClient` 成败落标志）+ master-app（`onDataChanged('apikey')` → `RobotGattServer.sendApiKey` 下发 7506；`onApiKeyReceived` 不再原生直写 SharedPreferences，统一交前端 `_onMimoApiKeySynced` 裁决后经 `Android.setMimoApiKey` 落库）+ win-app（既有 `bt-data-changed`/`bleBridge.on('apikey')` 通道天然支持双向，无需改动）+ www（`syncCurrentStateToNative` 把本机 Key 写进 7506 供 Slave 读取——仅发布可用 Key，自知失效按空发布；保存按钮改完即推；`_onMimoApiKeySynced` 加矩阵守卫：本机可用且不同 → 各用各的不覆盖；`MimoTTSClient._callMimoApi` 包一层成败记录钩子）。旧版 Slave 客户端的无条件写入被 Master 侧前端守卫拦截（本机可用不覆盖），行为安全降级。
  - 新增：**程序坞常驻「App 使用说明书」图标**——`#desktop-dock` 浮窗区新增 `#dock-manual-window` 常驻按钮（tip「App 使用说明书」/「App User Manual」），新绘书本造型内嵌 SVG 图标（金棕渐变 `#b08a3f→#6e5419`，与相邻 dock 彩色渐变方块同风格同尺寸，不复用「关于本机」的 Rt5 LOGO）；点击即应用内打开当前语言版本说明书（`openManualViewer`，复用 PDF 阅读器窗口）；DWM 新增 `dockItemFor()` 按当前文件内容动态解析坞图标（说明书 → manual 图标、PDF → pdf 图标，共用 `pdf-viewer-modal` 实例，`syncDock`/genie 动画/点击聚合全部走动态解析，切换内容不留残点）。
  - 优化：**首次激活页细节（v1.11.0 三项）**——① 十组标题改**居中横幅**（整宽底色带 + 上下细线），大块一眼分隔；② **标题类输入框醒目化**：信息面板链接「名称」列与信息参数「标签」列（如 Series）改更深底色（`rgba(13,26,13,0.85)`）+ 加粗 + 提亮文字，与值输入框明显区分；③ **提示词复用**：图片组补「建议使用9:20比例、带透明通道的图片」（设置页同步补「带透明通道」，词条更新）、模式名称每行下补该模式功能简介（复用设置页 `MODE_DESCRIPTIONS`，EN 随词典整句翻译）、信息面板链接组与信息参数组补设置页同款说明文字。
  - 优化：**Info Panel 条目排版（重点英文）**——`.file-name` 弃 `word-break:break-all`（英文单词拦腰截断）改按词换行（`overflow-wrap:break-word`）+ 两行截断（`-webkit-line-clamp:2`）；条目改顶部对齐（名称换行时右侧按钮列不居中挤压）；「新窗口」按钮列定宽（`min-width:5.2rem`）不再挤名称区。
  - 优化：**说明书补全（中英同步）**——2.5 激活表单补横幅分隔/标题输入框/图片透明通道建议/模式简介/1-10 不显示口径；新增 8.7「API Key 双端同步」章（判定口径与同步矩阵）；5.13 程序坞补说明书常驻图标；英文版 5.10 章改名 **Task Commands**（与 www/win 词典 `'任务指令系统'→'Task Commands'` 同步）；README 中英「使用说明书 / User manual」链接章节（v1.10.0 已建）核验无需改动。
  - 新增：**README 与使用说明书开篇「这套软件是干什么的」**（用户需求：让下载者一眼知道软件用途，写出 ASFR 的反差感）——README.md/README.zh-CN.md 在首屏引用块后新增「Why this exists / 这个软件是干什么的」章节（线下见面缺仪式感 → 物化想象 → 街头点一点「主人指令」直达机器人 → 电脑前编程一动不动的机器 → 「有协议的物化」）；说明书新增**第 0 章**（两版同文、目录同步），README 说明书章节锚点指向它。
  - 优化：**应用内下载入口从夸克网盘改为 GitHub Releases**（用户需求）——浏览器 App 拉起引导「下载 App」与设置页「下载 App」两处 `href` 改指 `https://github.com/rt5r750/Rt5.MaleAndroidControl/releases/latest`；docs 头文档与架构文档同步登记。
  - 修复：**win-app 打包版登录页只有背景图、没有账号密码输入框**（用户实测报告）——根因：`platform-bootstrap.js` 的 `if (isAndroid)` 未排除 win，而 win-app preload 与 master-app 同名暴露 `window.Android`，导致 win 被加上 `android-webview` 类、命中 `app.css` 的 `html.android-webview #login-modal { display:none !important }`，整个登录层（含表单）自首帧起被隐藏，屏上只剩 `#win-page-bg` 背景图。修为 `isAndroid && !isWin` 才加类/注入 android.css；Android 端「无登录页」保证不变，`__rcIsAndroidWebview` 门控口径不变。实测：`npm start` 经启动器 F2 测试模式进控制台，登录表单（账号/密码/记住账号/进入按钮）完整可见，登录进主界面正常。
  - 修复：**激活页底部「开始使用 / 跳过」两按钮被截断**（两层根因）——① 按钮原在 `column-count:2` 的 `.activation-grid` 内，桌面双列下被挤进半列宽；移出网格到滚动容器直下全宽吸底。② `#activation-form` 自带 `.activation-scroll { overflow-y:auto }` 成为按钮的 sticky 参照滚动祖先，而它内容自然高永不滚动，sticky 失效、按钮停在文档流末尾被容器可视区裁掉（实测按钮 bottom 1062 > 容器可视 857）；`.activation-scroll` 改 `overflow:visible`，滚动只发生在外层 `.activation-container`。实测：桌面 1920 与手机 412 视口下按钮均贴底完整可见，全页无任何按钮被裁。
  - 修复：**EN 模式激活页输入框默认值残留中文**——`input.value` 不是文本节点，不在 i18n 文本翻译范围内；界面切英文后控制按钮文本等 input 仍显示中文默认串。新增 `refreshActivationInputDefaults()`：`rc-lang-changed` 时重算激活页「当前值恰为默认」的输入框显示（`displayWithDefault` 对用户自定义值原样返回，手填内容不受影响）；textarea 内容本就随文本翻译自动重写，无需处理。实测 EN 激活页 0 处中文（含输入框值）。
  - **实测口径**：浏览器（1920 桌面 / 412 手机双视口，`http://` 静态服务）验证激活页横幅与标题输入框观感、模式简介中英两态、1-10 不渲染（仅 11/12 两个输入）、底部按钮吸底不裁（DOM 矩形核对）、EN 全页 0 中文残留、Info Panel 英文名按词换行两行截断且按钮列定宽、Task Commands 标题生效、dock 说明书图标常驻且点击打开对应语言说明书（PDF 图标状态随内容切换）；win-app `npm start` 全链路（启动器 → F2 测试模式 → 登录表单完整 → 登录进主界面 → dock 图标在位）；master-app / slave-app `compileDebugKotlin` 通过后 `assembleRelease` 出包。BLE 双端同步矩阵的真实链路需两台实体设备，模拟器无法两侧同跑，本轮以代码路径核查 + 各端编译/启动验证为准（待真机抽验）。
- **1.10.0**（2026-10-09）：
  - 移除：**slave-app 不再跟随控制端界面语言**——删除 7507(UiLang) 的订阅、初读与 `onLangReceived` 语言跟随链路，界面语言只由本机决定；蓝牙对话框新增「语言」手选行（原「胶囊长按切语言」早在 1.5.0 移除，本轮把语言设置入口补回对话框）。服务端特征保留并照常推送/补发（旧版客户端仍订阅）；`BleConstants.CHAR_UI_LANG_UUID` 保留并注明本端不再读写。
  - 新增：**设备语言自动检测（三端 + www 统一口径）**——判定规则统一为「主语言标签 `zh*` → 中文；其余（含 en 在内的所有其他语言）或检测不到 → 英文」；**自动检测结果不落盘**，每次启动重新检测，只有用户手选才持久化，故「设备是中文」与「用户改回英文」不会互相覆盖。链路：www `js/i18n.js` 初始语言按「手选(localStorage `robot_ui_lang`) → 原生桥 `consoleAPI.bootLang`(win-app) → `navigator.languages/language` → 兜底 en」；master-app `ConsoleI18n` 与 slave-app `PhoneI18n` 在无手选标记时按 `Locale.getDefault().toLanguageTag()` 检测；win-app `app/i18n.js` 按「手选 → `app.getLocale()`（未就绪时 Intl / 环境变量兜底）→ 兜底 en」，状态文件改存 `{lang, manual}`（**兼容旧文件**：v1.10.0 前的 `i18n-lang.json` 只有 lang 而无 manual，而旧实现仅在用户手动切换时写入，故一律视为手选，避免升级后把用户的显式选择改回设备语言）。**界面默认语言由中文改为英文**（需求「所有端默认打开均为英文」）。英文默认同时暴露并补齐了历史未译文案（见修复）。
  - 新增：**First Run（首次启动）流程统一**——www 控制台新增 `?firstrun=1` 模式：只渲染激活页、不显示登录层、不进入主界面，表单实现与主控制台只有一份（同一 `#activation-modal` 与十组设置），完成/跳过后派发 `rc-firstrun-done` 并回调宿主（`consoleAPI.firstRunReady(needsForm)` / `firstRunDone`）。
    - **master-app**：Android WebView / 窄屏不再免除激活页——未激活时先显示激活页（原生品牌 PV 本就等 `videoEnded && webReady` 才揭开，故 PV 播完必定先见 First Run），完成/跳过后再 `initApp()` 进入主界面；登录页免除保证不变（**该平台仍无登录界面**）。窄屏浏览器同规则。
    - **win-app**：新增 `createFirstRunWindow()`（1080×860，`app://bundle/<控制台页>?firstrun=1`，与主控制台同 origin 共享 localStorage）——**首次启动时激活窗口先于启动器出现**，完成后经 IPC `firstrun-done` 写 `huancun/activated.json` → 关激活窗口 → 再建启动器继续原流程；窗口保持隐藏直到页面判定**真的需要填表**（已激活用户如从旧版升级、或宿主标记丢失时由 `firstRunReady(false)` 直接收尾回启动器，不闪窗，3s 兜底显示）；用户直接关闭激活窗口视为跳过（不写标记，控制台内激活页仍是兜底），照常进启动器；控制台内完成激活也回写同一标记，两处状态一致、不会二次弹出。
    - **slave-app**：新增原生首启界面（`firstRunContainer` 覆盖主界面，代码构建 UI 与主界面同风格）——语言（默认按设备检测/英文，可改）+ MiMo API Key（可选）+ 「识别引擎调用云端（MiMo ASR）」开关（此前这两项只藏在蓝牙对话框里），按钮「开始使用」/「跳过，保持默认」；标记存 SharedPreferences `first_run_prefs.first_run_done`，完成后不再出现。
  - 新增：**App 使用说明书（中英双版本）**——覆盖全部客户端全部功能的完整手册：客户端分工、安装与首次启动、语言、连接方式（BLE/二维码/USB 进入/协议拉起）、控制台各面板与设置组、信息面板、slave-app 全功能、手表端、浏览器版（缓存/离线/拉起）、故障排查。单一源为 `www/doc/manual/manual.en.md` 与 `manual.zh-CN.md`（仓库内可直接在 GitHub 阅读），构建产物 `manual.{en,zh-CN}.html` 随包入库供应用内阅读；新增无依赖转换器 `tools/manual-build/build.mjs`（受限 Markdown 子集 → 与控制台同风格自包含 HTML，含中/EN 互切链接），并入 `tools/web-build` 的 `npm run build` 链（tailwind → manual → cache-manifest）；`generate-cache-manifest.mjs` 排除 `.md` 源（运行时只 fetch `.html`）。**信息面板新增「App 使用说明书」条目**（`type:'doc'`，与 `action` 一样不进「信息面板链接」可配置列表）：按当前界面语言取对应版本、名称随语言显示（`App 使用说明书` / `App User Manual`），复用 PDF 阅读器弹窗在应用内阅读（Android 也不外抛，保证任何端都读得到），`rc-lang-changed` 时刷新条目名与版本。
  - 新增：**客户端改名（master / slave 体系）**——目录 `android-app/` → **`master-app/`**、`phone-app/` → **`slave-app/`**（`git mv` 等价，全仓引用同步：`.gitignore`、README 双语、docs 全群、Gradle `rootProject.name` 改 `Master`/`Slave`、`win-app/test/titlebar.test.js` 图标源路径）；显示名 master 侧统一 **Master**（master-app `app_name`、win-app `productName` 与启动器标题，与 Slave 对仗；全仓文案/发布素材名同步），slave 侧统一 **Slave**（`app_name`）；**slave-app 图标与 master 同构图、明暗对调**（master 深绿底银圆 ↔ slave 银底深绿圆，`tools/gen-slave-icon.py` 生成；原「深绿→深蓝色相偏移」两版都是深色块、不易分辨，见本条「优化」）以区分两端。**刻意保留不动**：Android 包名（`com.robotcontrol.console` / `.phone`，改包名会让已装用户数据丢失且需卸载重装）、BLE 广播名与扫描前缀（`RobotControl-Console` / `-Win` / `-Phone`，协议冻结）、exe 文件名。
  - 优化：**使用说明书构建并入 www 资源链**——`tools/web-build` 新增 `build:css` / `build:manual` 子脚本，`build` 依次跑 Tailwind → 说明书 → 缓存清单，保证新增文件自动进 SW 预缓存清单（本轮 62 项 14.83 MB，版本 `3e659b53ac94`）。
  - 优化：**slave-app 文案与词条订正**——`机械度` 英文由 `Robotical` 改为项目规范用词 `Robotic`；`750接收端` 词条随显示名更新为 `Slave`；`QrScanActivity` 五条未走词典的中文 Toast（无法打开相机/未找到相机/相机不支持/相机访问失败/无相机权限）收口进 `PhoneI18n`。
  - 优化：**首次激活页版面重构（移动端与桌面端）**——十组表单与存储键不变，只改版面。移动端（≤749px）：整屏平铺列表（去卡片边框/圆角/阴影/磨砂，背景透明，满宽满高），顶部与底部避开系统安全区（`--safe-area-top/bottom`），底栏仍吸底；**删除右上角重复的语言胶囊**（第 1 组「语言」即入口，原按钮在移动端会压住值输入框）；信息参数与信息面板链接的「行号 + 标签 + 值」三列行改两行堆叠（行号列由 6.5rem 固定宽收到 2.4rem，值输入占整行），长标签/长值/长链接改用自适应高度文本框（rAF + 显式字体加载 + `fonts.ready` 三次测量，高度补边框差值；resize 与语言切换时重算），中文长句与英文长术语（`Simulated Genital Number`、`Rt5 A.I. Fictional Liability Company`）在任意宽度下完整可见、不再截断。桌面端（≥1100px）：容器加宽至 `min(1180px, 92vw)`、高 `calc(100vh - 64px)`，十组按两列排布（`column-count`，阅读顺序仍 1→10），标题区压缩为单行（图标+标题+副标题），信息密度显著提高。同批修复：激活页容器缺一个闭合 `</div>` 致通知栈落入模态内（容器被挤到 x=-19.2、左侧标签被切）；节间距原挂在 `.activation-form` 的 `gap`（block 容器上从未生效，十组实际贴在一起），改由各分组 `margin-bottom` 提供。
  - 优化：**信息面板说明书入口移到第一位并与 PDF 并列**——`FILES` 数组把 `app-manual`（`type:'doc'`）移到首位（其余相对顺序不变；全部查找按 id，与顺序无关）；PDF 条目去掉 `file-item-full`，桌面宽度下说明书与 PDF 各占半行同排（`.file-list` 两列 grid），≤768px grid 降为单列、各自整行。手册同步：登记新条目位置与并列排版、激活页版面口径、语言切换表中「激活页右上角胶囊」改为「第 1 组」。
  - 优化：**默认机器人图片 `right.webp` 更换**——三栏「机器人视图2」与设置「恢复默认图片」共用的内骨骼默认图，换为新的镀铬内骨骼 + 红眼渲染图（841×1870，原 1280×3189）；两处引用共用 `www/pic/right.webp` 单一文件（`app-core.js` 的 `DEFAULT_IMAGES` 与 HTML `data-src`），显示处 `object-fit: contain`，宽高比变化不影响布局；`left.webp`（视图1 与「关于本机」配图）未动。**本轮未重新打包**（源码与 www 产物已更新，APK/zip 仍为 v1.10.0 四轮产物）。
  - 修复：**公开简介把「线下控制」误译为 offline、并把玩法说成控制真实机器**——README 中英首段与仓库简介原写 “offline control software for a physical T31-750 male android”，两处含义错位：①「线下」指**面对面/在场**控制，不是离线（offline，另指无网络依赖）；②本体是 ASFR 物化（客体化）Cosplay 玩法的道具与载体，**并非在控制真实机器**。现英文改为 “ASFR-oriented, in-person control suite — an objectification-cosplay prop rather than a real machine”，中文改为「ASFR 向 · 线下控制套件」，并去掉简介中的 T31-750（模型号仅保留在文档与产品内文案）；两版免责声明行同步改写。仓库 description 已用 API 同步更新。
  - 优化：**slave-app 图标改为与 master 明暗对调（原色相偏移两端分不出）**——原来只把 master 的绿色底相旋转成深蓝，两端都是深色方块，缩到启动器/桌面尺寸肉眼无差别（用户实测反馈「图标根本没有任何区别」）。现改为**同构图、颜色互换**：master 深绿底 `#0d1a0d` + 银圆 + 深绿字，slave **银底 `#cfd3cf` + 深绿圆 `#163a1e` + 银字**（绿仍在 master 同一绿色家族内，未引入新色系）；圆盘 alpha 由 213 压为不透明（原在深绿底上无害，换银底会露出深绿块），构图与几何逐档不变。生成脚本 `tools/gen-slave-icon.py`（由 master 图标按亮度分档转换，5 档 mipmap × 方形/圆形 + `res/` 根下两个 72px 历史副本，`--check` 核对几何与主色），可复现。
  - 修复：**激活完成后窄屏/Android 露出登录页**（本次改动引入）——`hideActivationModal()` 原先无条件把登录层恢复可见，而窄屏浏览器与 Android WebView 本无登录界面；改为仅在「确有登录界面（宽度 ≥750 且非 Android WebView）且非 firstrun 模式」时回落登录层。
  - 修复：**slave-app 手选语言对主界面不生效**（本次改动引入）——`PhoneI18n.init()` 排在 `buildContent()` 之后，界面已按默认语言渲染；调换为语言先初始化再构建界面，首启界面与主界面口径一致。实测：AVD Android 16 装 debug 包，首启选中文 → 主界面全部中文且重启保持。
  - 修复：**英文默认后暴露的历史未译文案**——`www` 控制台 HTML 属性与脚本写入串共 8 条补齐词典（激活页密码占位两条、激活页 MiMo Key 占位、设置页 TTS 说明句与「前往 MiMo 开放平台申请 API Key ↗」、设置导航 aria-label、`更新完成` / `系统已成功更新`，另有 TTS 段落尾句含前导句号变体）；**单栏 hero 首行「X的」改为按语言生成**（英文 `X's`），不再固定中文助词。核对工具：全量扫描 HTML 文本节点/属性与 `app-core.js` 等脚本的写入串比对词典（结果：缺失 0）。
  - 修复：**win-app 升级后既不弹激活窗口也无法补齐激活**——首次启动判定原先只认主机 `huancun/activated.json`，而既存用户（旧版本升级、或从 `%APPDATA%` 迁移过来的 profile）只有控制台 localStorage 里的 `robotActivated`；现以页面探测结果为准（`firstRunReady(false)` → 直接写标记回启动器），两条路径都不会漏。
  - 修复：**二轮审计发现的一批缺陷**（首轮出包后按「首次启动 / 语言 / 设置 / 说明书」四线复核，产物已按二轮重出）——
    首次启动：win-app 激活窗口的自绘标题栏按钮原先只作用于 mainWindow（激活阶段尚未创建）导致全部失效、无处可关，改为按「当前活动的无边框窗口」解析；关闭激活窗口不再「跳过但不落库」（每次启动都会再弹、Alt+F4 也甩不掉，与 www/Android、slave 的「跳过即置完成」统一）；页面自身出错时不再把用户卡在显示控制台登录页的窗口里（3s 无就绪信号即关窗进启动器、不写标记，交回控制台内置激活页兜底）；安装目录不可写（Program Files 解压）时由启动器入口前置探测并提示（原先 Chromium 起不来、双击无反应）；slave 首启界面早于 BLE 与权限申请（此前系统蓝牙/相机授权弹窗先盖住设置项）；slave 首启选语言现在立刻作用于主界面（原先主界面要重启才变）并保留尚未保存的 API Key；master-app 触摸跳过品牌 PV 不再露黑屏（原实现直接揭开而页面尚未绘制，实测 98.9% 像素为黑；改为停播保帧、页面就绪后再揭开并留 4s 兜底）；Android ≥750px 不再闪现登录页（原仅靠 JS 在 DOMContentLoaded 隐藏，现由 `html.android-webview` 规则自首帧生效）。
    语言：自检叙述 110 条长句实测 4 条未译出（片段替换遇残余中文即退回原文，故整句入词典）；自检完成弹窗含「总用时」改按语言直出；补 6 条词典键（执行功能／添加了新账号／打开了文件／移除认知偏移／按钮／状态项前缀）；设置导航图标在 EN 下全部退化成齿轮（映射按中文组名、读取的却是已译文本）；启动器设备 ID 占位符与 win-app BLE 宿主缺失提示的词典键与实现不符。
    说明书：修正入口 exe 名（原误写 Master.exe，实际 RobotControl-Console.exe，否则第 2.3 章无法照做）、「Slave 订阅语言通知」与「PDF 之外链接均可改名」两处与代码不符的描述；补 5.10~5.13（任务系统／计时器／调试日志／顶栏与系统菜单）与浏览器强制缓存实情；字体引用改指向真实文件并加 CJK `unicode-range`（原引用不存在的 JetBrainsMono-Regular 必然 404 且 MiSans 会抢走拉丁字形）；阅读器随界面语言切换版本。
    设置输入框默认值随语言（三轮补齐）：设置页与激活页的输入框此前直接显示中文默认源串——界面默认改英文后，英文用户一进设置就是一屏中文（实测全新环境 34 个输入框，跨按钮文本/信息面板链接名/状态项三组）。现按 v1.6.0「整组匹配」的本意补上显示本地化（值等于默认源串时显示当前语言译文）与保存归一化（仍是默认译文时归回中文源串，避免英文用户应用一次设置就把默认内容冻结成自定义，「整组默认→随语言」判定随之失效）；语言切换时重填这三组输入框。实测：英文下 0 处中文值、切中文恢复中文默认、英文下点「应用更改」后三组存储仍为全默认。审计工具 `audit-en-cjk.js` 补扫输入框 value（上一轮只看文本节点与属性，故漏掉此类）。
    设置：「改为默认设置」真正删除已存机器人图片（原仅重置预览，应用更改后图片复活），对话框措辞改为与实现一致的范围说明；信息面板链接组与配置导出提示补齐新条目与漏列项。
    新增回归工具 `tools/i18n-check/check-long-lines.cjs`（真跑 t() 校验中文长句数组；并入 `npm run check:i18n`）。二轮复测：i18n 五项检查全绿，EN 模式激活页/主控制台/设置 0 泄漏，导航图标 13/13 正常；AVD Android 16 实测 slave 首启选中文后主界面即刻中文、无权限弹窗遮挡，master-app 跳过 PV 无黑屏且激活页正常；win-app 抽验内嵌前端为本轮版本。
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
- 更早版本（1.7.1 及以前）的记录已按「只保留最近 5 个版本」的约定清理；追溯用 `git log -p -- docs/reademe.md`。
