# 功能文档：Clawbot 通知推送与斜杠指令查询（v1.12.0）

## 需求与定性

- master 端（控制台）输入指令等的通知推送（即语音播报的内容）与实时修改的数据推送给 Clawbot；Clawbot 反向用斜杠指令查询当前机器人设置的参数信息（app 参数都可查）。
- **0 token 消耗**：全部收发为纯 IM Bot API 直连、斜杠指令本地解析直接回复，全程不调用任何大模型 / LLM。
- 空白指令不支持输入（空消息、单独 `/` 直接忽略，不产生任何请求与回复）。
- Clawbot 的语言由 master 端语言设置决定（`I18N.getLang()`）；模式等文案由实际设置决定（自定义模式名/型号信息走保护集原样输出）。
- 接收的指令格式为「主人指令：」+实际指令；实时数据修改用另一前缀「数据变更：」（两类分开）。
- 平台：Telegram + 飞书（微信不做）；独立配置、可同时启用、双向都支持。接入形态为**通用 IM Bot 直连**（App 用自己的 bot 收发，不依赖 Clawbot 本体部署；Clawbot 在群里即能收到推送）。
- **运行参数不推送**（与不推给 slave 端同口径），仅**充电状态切换**（开始/停止充电）推一条（`notifyChargingChange`，基线不推）。反查 `/runtime` 照旧可查。
- **首次连接绑定提示**：每平台+会话首条出站消息前先发一条（只发一次，`robotClawbotBoundSent` 记忆）：「（完整型号）已被主人成功绑定，输入/help查看帮助，反查状态需要（主人名称）Master端在线。」——完整型号/主人名称取实际设置值，提示词随界面语言（EN 有独立译文）。

## 推送格式与触发点

| 类别 | 前缀（zh / en） | 触发点 | 取值 |
|---|---|---|---|
| cmd | `主人指令：` / `Master's Command: ` | `speak()` 统一出口（app-core.js）：终端指令、功能按钮、模式切换、暂停/停止、开关机、认知偏移、任务完成/取消、过程窗口与系统通知等全部语音播报 | `displayMsg`（已按当前语言过 I18N、型号/模式名走实际设置值），与语音历史/BLE Voice 7504 完全一致 |
| data | `数据变更：` / `Data Change: ` | 情绪滑杆（点击/拖拽结束，`speak(msg,'data')`）；任务增删（addTask/addTerminalTask）；设置保存（`performSettingsSave` 前后快照 diff 出实际改动项） | 变更内容（旧值 → 新值），类别词随语言 |

- 空白内容不推送；消息超 3500 字符截断（Telegram 上限 4096）。
- 推送队列按平台串行、间隔 ≥1s（防 Telegram/飞书限流），发送失败仅记 console.warn 不重试。
- **轮询代际（v1.12.1）**：`restartPolling` 递增 `_pollGen`，循环链回调处校验代际——否则多次重启（保存设置/大窗保存）残留并行循环会把同一条斜杠指令消费多次、回复发多遍（用户实测三遍的根因）。
- 双平台同时启用时消息双发。

## 平台接入与 API

### Telegram（双向）
- 推送：`POST https://api.telegram.org/bot<token>/sendMessage`，body `{chat_id, text}`。
- 查询：`GET .../getUpdates?timeout=25&offset=N` 长轮询（免公网 IP）；`offset`（=update_id+1）落 localStorage `robotClawbotTgOffset` 防重放。
- 只响应配置 Chat ID 的消息（防他人私聊 bot 查询）；斜杠指令带 `@botname` 后缀会剥离。
- **Chat ID 智能解析（v1.12.1）**：数字直用；`t.me/` 链接、`@用户名`、纯名规范化为 `@xxx` 经 `getChat` 解析数字 ID；解析结果等于 `getMe().id` 判为「bot 自己的用户名」并给指引（Chat 对象无 `is_bot` 字段，实测判定用 getMe 对比）；表单提供「自动获取会话 ID」按钮（`getUpdates?offset=-1&limit=1` 不消费历史，从最近消息发现 `chat.id`）。错误分类提示：chat not found / token 无效 / 网络错误。
- 网络：需设备可达 api.telegram.org（大陆通常需系统代理）。

### 飞书（两种模式）
- **webhook 仅推送**：`POST https://open.feishu.cn/open-apis/bot/v2/hook/<id>`，body `{msg_type:'text', content:{text}}`；不能收消息。
- **自建应用双向**：
  - token：`POST /open-apis/auth/v3/tenant_access_token/internal`（app_id+app_secret），缓存至过期前 60s，401/99991663 清缓存重试一次。
  - 推送：`POST /open-apis/im/v1/messages?receive_id_type=chat_id`。
  - 查询：每 5s 轮询 `GET /open-apis/im/v1/messages?container_id_type=chat&container_id=<chat_id>&sort_type=ByCreateTimeAsc&page_size=20`，按 `create_time` 去重（`robotClawbotFsLast`，首轮=当前-60s），只处理 `msg_type=text` 且 `sender_type=user` 的消息。
- 飞书大陆直连、无需代理；自定义机器人安全设置（关键词等）由用户自行配置，若启用关键词校验需保证推送文本含该关键词。

### 网络出口（三路）
1. 浏览器 / WebView `fetch` 直连优先（Telegram CORS `*` 可用；飞书不可用时回退原生桥）。
2. 原生通用桥 `Android.httpFetchAsync(url, optionsJson, cbId)` + `Android.getHttpFetchResult(cbId)`（仿 mimoFetch 通知+拉取模式，避免大 JSON 转义）：master-app `MainActivity.kt`（HttpURLConnection）与 win-app preload（IPC `http-fetch` → 主进程 `net.fetch`）同名暴露。
3. **白名单**：原生桥只放行 `api.telegram.org` / `open.feishu.cn`（前端 `hostAllowed` 同口径），防特权通道被滥用为任意请求代理。

## 斜杠指令（0 token 本地解析）

| 指令 | 回复内容（数据源） |
|---|---|
| `/help` | 指令列表 |
| `/query` | 全量摘要（以下各项 + 账号数/Key 有无/语言/推送开关） |
| `/mode` | 当前模式（`state.activeMode`）与四模式名（`modeDisplayName`，实际设置值） |
| `/emotion` | `storage.getEmotions()` 四项 |
| `/runtime` | `state.runtimeParams`（液体/电量/存储；自动电量计划按计划文案） |
| `/tasks` | `storage.getTasks()` 名称+状态 |
| `/model` | `getModelInfoSource` 五项 |
| `/status` | `storage.getStatusItems()` 全部标签/值 |
| `/buttons` | `storage.getButtonTexts()` 全部 |
| `/links` | `storage.getInfoLinks()`（null=默认取 `FILES`） |

- 解析：trim → 剥 `@_user_N` / `@botname` 前缀 → 必须以 `/` 开头 → 取首词小写。空串/单独 `/` 返回 null（忽略）；未知指令回帮助文本。
- 回复语言=处理时 `I18N.getLang()`；EN 前缀/模板/类别词为英文。
- **脱敏**：账号密码与 MiMo API Key 只回「已设置/未设置」；Bot Token / App Secret 永不回显。

## 存储键（localStorage）

| 键 | 内容 |
|---|---|
| `robotClawbotConfig` | `{cmdPush, dataPush, queryEnabled, telegram:{enabled,botToken,chatId}, feishu:{enabled,mode:'webhook'\|'app',webhookUrl,appId,appSecret,chatId}}`；已并入配置导入导出（`getConfigExportKeys`）；「改为默认设置」不涉及（与 MiMo Key 同属连接类配置口径） |
| `robotClawbotTgOffset` | Telegram getUpdates offset |
| `robotClawbotFsLast` | 飞书已处理消息的 create_time 水位 |

## UI

- **设置页**新增第 14 组「IM 通知推送」（标题不带 Clawbot，说明文字含教程链接：飞书官方文档 ×2、Telegram 中文/英文教程，以及 iOS 无法侧载 Slave 时的替代用途）（`#clawbot-setting`）：三开关 + Telegram 区 + 飞书区（模式 radio 切换 webhook/app 字段显隐）+ 测试发送按钮 + 说明。表单由 `ClawbotBridge.formHtml('set-')` 渲染进 `#clawbot-settings-body`，随「应用更改」保存（`performSettingsSave` 调 `collectForm('set-')`，校验失败中止保存；表单未渲染跳过不覆盖）；每次打开设置 `fillForm('set-')` 回填。
- **激活页**新增第 11 节「通知推送（Clawbot）」：状态行 `#clawbot-act-status`（未配置/已配置 xx）+「打开设置」按钮 → 弹出 `#clawbot-modal` 大窗（body 直下，`.clawbot-modal` z-index 70，参照 self-check-modal 样式），大窗内为同一套表单（`'act-'` 前缀），保存/取消/关闭均不影响激活完成（非必要项）。`setConfig` 后 `syncActivationStatus()` 刷新状态行。
- 测试发送读当前表单值临时套用后发送、不落库（`setConfigSilent` 恢复原配置）。

## 限制与边界

- 控制台需保持运行（页面开着）才会响应查询；Android WebView 后台可能被系统冻结。
- 推送/回复均为尽力而为：失败不重试不弹窗（仅 console.warn / 测试按钮状态行）。
- 飞书 webhook 模式无查询能力（UI 明示）；微信不做。
- `snapshotSettings` 不含 Clawbot 配置自身（改推送配置不产生 data 推送）。
