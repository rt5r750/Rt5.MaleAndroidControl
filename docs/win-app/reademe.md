# Windows 桌面版控制台（win-app）

## 定位

win-app 是 android-app 控制台的 Windows 桌面版（Electron + HTML/JS + C# BLE 宿主），运行于 Windows：

- 由前置启动器与控制台两部分组成：
  - 启动器（`design/launcher.html`）：标题“男性机器人控制终端”，Acrylic 毛玻璃 USB 前置页，检测/匹配 USB 存储设备后点击进入控制台；
  - 控制台：1440×900 宽屏三栏布局，前端资源为仓库根 `www/` 的构建期同步镜像（`scripts/sync-www.ps1`，npm prestart/predist 自动执行，gitignore；`css/win.css`/`js/win.js` 仅本端按需加载；同步排除 `.mimosa` 等工具状态目录，拷贝后递归清扫目标内同名目录兜底）。
- 蓝牙外设：`ble-host/`（C#，Windows GATT Service Provider）广播 `RobotControl-Win`，phone-app 可扫描或扫码连接，复用 7500 服务协议（Mode/Emotion/Tasks/Voice/Heartbeat/ApiKey/UiLang、分片 0x7E、心跳 5s、0xFF 手动断开、API Key 同步）；`UiLang(7507)`（1.5.0 新增）`READ|NOTIFY` 1 字节（0x00=zh/0x01=en），主进程在宿主就绪与每次广播启动时补推当前语言、`i18n-set-lang` 即时推送——phone 连接后显示语言跟随控制台。**Mode(7501) 1.7.0 起 `Read|Write|Notify` 可写**：phone 反向推送模式经 C# 宿主 `ModeReceived` 事件 → IPC `{"type":"mode","ordinal":n}` → 主进程 `bleBridge.on('mode')` → `window.__rcOnRemoteMode(ordinal)` 切换并高亮对应模式按钮，桌面端同时弹 macOS 风格通知「推送成功」（详见 BLE 协议文档「反向模式推送」）。
- 启动流程：双击 `RobotControl-Console.exe`（无窗口 C# 启动器，拉起 Electron 后立即退出）→ 启动器直接出现（冷启动实测约 0.5s、常规 1.0~1.3s 窗口可见，已移除前序可见加载界面）→（点击设备按钮，立即弹出“正在进入控制台”遮罩）→ 主窗口首帧渲染完成后显示轻量闪屏页（Rt5Open_169.mp4 横屏视频、带声音、无文字，点击/任意按键立即跳过）→ 登录页（进入登录页**无**加载动画）→ 登录成功后登录卡片下半部收缩、原位换入系统加载动画（属于登录界面，约 1.2s，进度起步即挂载主界面）→ 三栏控制台。
- 默认账号 `admin` / `T31750`；登录页标题为「仿人男性机器人控制台」。

## 架构与关键实现

### 打包与启动架构

- 输出类型为 `dir`（非 portable 单文件），Electron 运行时位于 `win-app/runtime/`，入口为根目录 `RobotControl-Console.exe`。
- `RobotControl-Console.exe` 是无窗口 C# 启动器（`splash-loader/Program.cs`）：仅拉起 `runtime/RobotControl-Console-Main.exe` 后立即退出，不显示任何加载界面。启动速度实测：清缓存冷启动约 0.5s、常规启动约 1.0~1.3s 启动器窗口可见；该速度受磁盘与杀软实时扫描影响有限，未来冷启动可维持，因此不再需要前序可见加载器。
- BLE 外设宿主：`ble-host/publish/RobotControl-BleHost.exe`（.NET 8，win-x64 自包含单文件，约 40MB）由 Electron 主进程拉起，经命名管道 `\\.\pipe\robotcontrol-ble-<pid>` 以 JSON 行通信；打包后位于 `runtime/resources/ble-host/`。
- `asar` 已禁用，运行时资源以展开目录形式存放（`runtime/resources/app/`、`runtime/resources/design/`），避免 `app.asar` 被占用导致目录无法删除/更新。
- 打包脚本：`scripts/build-ble-host.ps1` 发布 C# BLE 宿主（dotnet publish，win-x64 自包含）；`scripts/package-with-splash.ps1` 自动编译加载器、调用 `npm run dist`（`predist` 自动发布 BLE 宿主并经 extraResources 复制到 `resources/ble-host/`）、复制 `dist-new/win-unpacked` 到 `runtime/`、生成根目录入口 exe。

### 固定资源协议

- 本地资源经 `registerSchemesAsPrivileged` + `protocol.handle` 固定协议加载，避免随机端口导致 localStorage 失效：
  - `app://design/launcher.html` — 启动器（`design` 目录，开发时为项目根 `design/`，打包后为 `resources/design`）；
  - `app://bundle/splash.html` → `www/芮誊T系列仿人男性机器人控制台V1.1.html` — 主控制台（`bundle` 主机映射 app 根目录，splash 为闪屏页，播毕跳转主页面）。
- `app/protocol-handler.js` + `app/static-responder.js`：静态文件服务（MIME、Range 206、路径穿越防护）。
- localStorage（启动器状态、主控制台账号/任务/TTS Key 等）跨启动稳定持久化；启动器**已保存的 USB 设备规则**另经 IPC 读/写 `huancun/launcher-usb-devices.json` 作为持久源（见”存储位置”），一旦保存永远记住。

### OS 级深链协议与单实例锁（2026-09 架构优化新增）

- `main.js` 在进程早期调用 `app.requestSingleInstanceLock()`：已有实例运行时第二实例静默退出，`second-instance` 回调把主控制台（或启动器）窗口 restore/show/focus——浏览器端点击 `robotcontrol://` 链接时若应用已在运行则聚焦现有窗口而非多开。
- `app.setAsDefaultProtocolClient('robotcontrol')` 注册 OS 级 URL 协议（写 HKCU\Software\Classes\robotcontrol，无需管理员，绿色版可用）：`robotcontrol://console` 由 www 浏览器端拉起引导（`js/app-launch.js`）触发；**开发模式必须显式传 app 路径**（`setAsDefaultProtocolClient(scheme, process.execPath, [appDir])`），否则注册表 command 指向裸 electron.exe 导致拉起失败；打包后自动指向 `runtime/RobotControl-Console-Main.exe`。
- 深链仅承担”拉起/聚焦”，不解析 URL 参数。

### 前置启动器（USB 检测与设备状态机）

- 窗口：无边框（非透明）+ `setBackgroundMaterial('acrylic')` 毛玻璃；Win11 原生 DWM 圆角、阴影与任务栏动画（无需 setShape），可拖拽区为自定义标题栏。
- 标题栏：自绘仿 Win11 按钮（最小化/关闭），经 IPC 调用主进程原生 `minimize()` / `close()`（保留系统动画）；左上角 logo + “男性机器人控制终端”。
- 高分屏适配：加载器进程启用 Per-Monitor V2 DPI 感知；启动器页面使用 MiSans 本地子集 woff2（不联网）。
- USB 检测（`app/usb.js` + `app/usb-watcher.js`）：
  - 持久 PowerShell 进程每约 1s 轮询 WMI：主路径枚举 `Win32_LogicalDisk DriveType=2`（可移动盘），经反向关联 `Win32_LogicalDiskToPartition` + `Win32_DiskDriveToDiskPartition` 反查物理磁盘拿到稳定 `deviceId`、盘符与卷标；兜底枚举其余无盘符 USB 磁盘；JSON 行输出（兼容 PowerShell 5.1 单元素解包）；Node 侧按 `deviceId` 快照 diff 产生 attached/detached 事件；进程异常退出 5s 自动重启；`refresh()` 按需单次查询；
  - 设备名显示：优先显示卷标（VolumeName），无卷标则显示“盘符 + 磁盘型号”；
  - DeviceID 解析：VID/PID 四位十六进制大写，序列号取 `USB\VID_..&PID_..` 后的剩余段，附厂商名/设备名。
- 匹配规则（设置界面配置，支持多设备）：每条至少填写 VID、PID 或设备/磁盘 ID（deviceId）才参与匹配，空字段为通配；VID/PID 忽略 `0x` 前缀与大小写，序列号精确匹配，厂商名为包含匹配；存储设备以 deviceId 精确匹配；无有效规则时不自动连接，接入但未匹配的设备显示 3 秒提示；默认占位规则 RT-5（`0x1234/0x5678`）。已保存的规则持久化到 `huancun/launcher-usb-devices.json`（跨启动永续，详见“存储位置”）。
- 设置面板自动搜索：打开设置即显示“正在扫描 USB 设备…”并每 2s 自动刷新；列表显示卷标（无卷标时“盘符 + 型号”），meta 含盘符/卷标/型号/VID/PID/ID；自动刷新按设备标识保留选中状态；选择“添加选中设备”会写入 name、deviceId（及可用的 VID/PID/卷标/盘符）并**立即保存**到持久源（`saveUsbDevices()`），避免关闭设置/下次进入时遗忘；启动器空闲时每 4s 周期扫描，发现已匹配设备自动连接，未匹配时主界面提示“检测到 USB 设备：T31-750（未匹配，请在设置中添加）”。
- 设置面板「界面语言」组（1.4.0 新增，面板顶部）：中文/English 两按钮、`lang-btn.active` 绿色选中态；点击写 localStorage `robot_ui_lang` + IPC `i18n-set-lang` 持久化 + `LauncherI18N.setLang` 界面即时切换，选中态由 `launcher-lang-changed` 事件统一刷新；语言按钮文字各自保持「中文 / English」不翻译。切换后主控制台进入即跟随（见"主进程与桥接"的 bootLang 链路）。
- **型号信息联动与版权行（1.6.0 新增）**：启动器主标题 `app-title` 跟随主控制台设置——主进程经 `huancun/model-info.json` 持久化控制台推送的生效值（IPC `model-info-get`/`model-info-set`；app://design 与 app://bundle 的 localStorage 不互通，必须走主进程中转），启动器加载时经 `electronAPI.getModelInfo()`（preload-launcher 暴露）读取并刷新标题；EN 由 launcher-i18n 按默认词条翻译，自定义名无词条自动原文显示。副标题下方新增固定版权行「© 芮誊智能虚构公司」（`.app-copyright`，EN「© Rt5 A.I. Fictional Liability Company」）——**固定真公司归属，不读型号信息设置**。
- 设备状态机（`design/launcher-assets/`：huimo 灰模 / color 彩色精灵图，216×504/帧、11 列 56 帧、30fps 无缝循环）：
  - 连接：IDLE（huimo 正面静止）→ CONNECTING（顺时针旋转 + 呼吸缩放）→ 匀速回正 → 短暂停顿（锁定正面第 0 帧）→ MORPH 交叉淡化（期间锁定正面帧，不再推进旋转，避免灰模/彩色切换破绽）→ CONNECTED（正面停顿约 600ms 后再开始 color 无限顺时针旋转）；
  - 断连：color 回正后按连接动画反向执行（MORPH_OUT 期间锁定正面帧 → huimo 自然转回正面后静止），全程匀速连贯。
- 测试模式（F2 或界面按钮）：直接默认连接成功，期间忽略真实 USB 事件；测试标记仅在本次应用启动内有效，跨启动一律不记忆（状态恢复忽略历史测试标记与测试生成的连接记录）。
- 启动纪元判定：主进程生成 `LAUNCH_EPOCH`（启动时间+PID）并经启动器 URL 查询参数 `?launch=<纪元>` 注入；`saveLauncherState` 一并保存纪元，`restoreLauncherState` 仅当保存的纪元与当前一致（同一进程启动）才恢复测试模式，真实设备连接恢复不受纪元限制。
- 进入控制台：点击设备按钮 → 同一帧显示“正在进入控制台”遮罩并立即 IPC `launcher-enter-console`（无 700ms 人为延迟，2.5s 兜底移除遮罩）→ 主窗口 `show:false`，`ready-to-show` 首帧渲染完成后显示黑色闪屏并销毁启动器窗口（关闭其渲染进程并停止 USB 轮询，降低内存占用）；全程不使用窗口半透明，避免 DWM/Acrylic 闪烁。
- 返回启动器：主窗口“返回”按钮 → IPC `win-back-to-launcher` → 主窗口直接隐藏（无关闭动画/黑屏/抽搐），重建启动器并加载（隐藏）；启动器就绪后淡入置顶，随后关闭已隐藏的主窗口；返回时恢复真实连接状态和活动设备，由 USB 扫描校验设备是否仍在位；本次启动内此前处于测试模式则恢复测试模式与已连接状态，跨启动则回到未连接。
- 启动器就绪：主进程在启动器 `did-finish-load` 后写入 `huancun/.launcher-ready`（标记保留，供调试/后续工具使用）；入口为无窗口启动器，不再依赖标记做淡出。
- 交互细节：设备按钮悬停浮起并显示引导提示词。

### 主进程与桥接

- `app/main.js`：启动器/主控制台窗口创建、USB watcher、IPC 桥接、MiMo 代理（`net.fetch`）、音频播放回调、外链/PDF 打开、BLE 宿主桥接（`ble-bridge.js` 拉起 C# 宿主并转发状态/数据）、反向模式推送桥接（`bleBridge.on('mode')` → ordinal 校验 0-3 后 `execInMain('__rcOnRemoteMode(n)')`）、QR 生成。
- `app/ble-bridge.js` / `app/ble-protocol.js`：C# 宿主进程管理（spawn、命名管道、崩溃 5s 重启）与 JSON 行协议（下行 `start/stop/data/status`，上行 `ready/device-connected/device-disconnected/manual-disconnect/apikey/mode/error/log`；`handleMessage()` 按 `msg.type` 直接 emit，`mode` 事件 1.7.0 起自动可用、无需额外桥接代码）。
- `app/preload-launcher.js`：启动器 `contextBridge` 暴露 `window.electronAPI`（minimize / close / enterConsole / getUsbDevices / getUsbDevicesConfig / setUsbDevicesConfig / markRendered / onExitFade / onUsbAttached / onUsbDetached / getUiLang / setUiLang）。
- `app/i18n.js`：主进程界面语言覆盖层（1.3.0 新增，中文默认）：启动器/主窗口标题与 BLE 宿主错误文案按表替换，`huancun/i18n-lang.json` 持久；IPC `i18n-get-lang`/`i18n-set-lang` 与 www 设置页语言切换双向同步，另注册 `i18n-get-lang-sync`（sendSync，1.4.0）供 preload 顶层一次性取回初始语言。启动器界面经 `design/launcher-i18n.js` 覆盖层（`electronAPI.getUiLang` 读取，设置面板「界面语言」组可切换），闪屏页标题经 `consoleAPI.getUiLang` 随动；**主控制台初始语言跟随**：`preload.js` 顶层 `sendSync` 经 `consoleAPI.bootLang` 在页面脚本前带回，`www/js/i18n.js` 头脚本以该值为初始语言事实源并对齐 localStorage——启动器切英文后进入控制台即英文，无中文闪帧（1.4.0）。
- `app/preload.js`：主控制台 `contextBridge` 暴露 `window.Android`（与 Android JS Bridge 同名等价）+ `window.consoleAPI`（窗口控制）。
- 外部链接一律交给系统浏览器；PDF 相对路径按 www 根目录解析后交给系统默认程序。**1.8.0 双层接管**：启动器窗口与主控制台窗口的 `setWindowOpenHandler`（`target="_blank"` / `window.open` → `shell.openExternal`，一律 `deny` 壳内窗口）之外，补 `will-navigate` 兜底——无 `target` 的 http(s) 导航同样 `preventDefault()` 后交给系统默认浏览器，避免在 Electron 壳内导航顶掉界面；`app://` 站内导航与 `file://` 不受影响。

### 窗口控制（系统级 Acrylic 深色毛玻璃标题栏）

- 主控制台为无边框窗口，启用窗口级 `backgroundMaterial:'acrylic'`（DWM backdrop type=3，与启动器同一机制）：共享 HTML 检测 `window.consoleAPI` 后添加 `html.win-desktop`，仅在 Win 端启用 `html/body` 透明和 40px 标题栏偏移；网页背景层 `#win-page-bg` 整体下沉到 40px 以下，标题栏区域透出**系统桌面**的 Acrylic 毛玻璃。标题栏条带为深色暗绿渐变（`rgba(6,15,6,0.45)~rgba(4,12,4,0.5)`）+ `blur(22px) saturate(1.25)`，即“深色的系统毛玻璃”。窗口保留深色 `backgroundColor` 作为 Acrylic 不可用时的回退底色。
- 标题栏左侧返回按钮与右侧窗口按钮完全同款：46×40 方形、紧贴窗口左缘（与关闭按钮贴右缘的边距一致）、透明底、悬停白 10%/按压 16%（颜色与最小化/全屏一致）、无圆圈；图标统一加大到 12×12px。
- 标题整行（含 `T31-750` 与中文）使用全字符集 MiSans（`MiSans Full` 12px、常规字重、近白 `#f2f2f2`）。
- 网页内背景图与模糊效果保持原版：登录背景图（`Background.webp` cover）由 `#win-page-bg` 在 40px 以下呈现；`header` 仍为 `backdrop-filter: blur(16px) saturate(1.3)`，仅对网页内容模糊。
- 全屏（F11/全屏按钮）时标题栏隐藏，`#win-page-bg` 铺满全屏，浮层恢复全屏，Esc/F11 退出；全屏时 `body.win-fullscreen` 将 `--header-total` 降回 40px（标题栏隐藏后菜单面板/浮层 top 与 header 重新对齐，不留 40px 空隙）。DWM 浮窗拖动/最大化/视口收拢上界同读该变量（`headerH()` 取 body 计算值）——全屏 40px 与菜单栏下缘对齐，窗口可贴到菜单栏正下方、也可拖至屏幕底部（早前读 `documentElement` 恒为非全屏 80px，全屏下窗口上方恒空 40px 且下移受限，已修复）；非全屏维持 80px 正常钳制。
- 全屏类浮层（登录/自检/更新/PDF 等）在 win-app 桌面端整体下移 40px 让出标题栏区域；动态岛下移至标题栏下方；全屏时标题栏隐藏、浮层恢复全屏。连接/信息/设置三个窗口在桌面尺寸下已改为 macOS 菜单风格下拉面板（见下文“桌面菜单模式（macOS NSMenu 风格窗口）”等条目），不再走全屏浮层链路。
- 最大化时按钮图标自动切换为“还原”（双矩形），还原后切回“最大化”（单方块），状态经 `win-maximized` 事件同步。
- `window.consoleAPI` → IPC `win-minimize` / `win-maximize-toggle` / `win-close` / `win-fullscreen-toggle` / `win-back-to-launcher`；v1.6.0 新增 `setModelInfo(info)` → IPC `model-info-set`（型号信息生效值推送）。
- `app/titlebar-width.js` 保留用于计算窗口控件宽度（无 WCO 时为 0）；`app/titlebar.js` 已删除。

### 界面、动画与衔接（与 android-app 同步）

- 主控制台 `app/www` 已同步 android-app 的精灵图旋转方案（仅动画部分，其余功能保持不变）：新增 `RotationSprite.js` 与 `www/sprites/`（灰模/彩色双精灵 + JSON，216×504、11 列、56 帧、30fps），蓝牙弹窗与灵动岛均改为 Canvas 渲染，状态机与启动器一致（回正/停顿/MORPH 锁正面帧/断连反向）。
- 中文字体使用 `www/webfonts/` 内的 MiSans（Regular/Demibold，仅汉字与中文标点范围），数字/英文保持 JetBrains Mono 等原字体；自绘标题栏整行文字（含 `T31-750`）使用全字符集 MiSans。
- 连接弹窗随窗口高度自适应：桌面菜单模式下面板 `max-height: calc(100vh - var(--header-total) - 96px)` 收缩（预留底部程序坞高度）、精灵图按 `min(56vh, 480px)` 缩放，底部按钮在最小窗口高度下仍完整可见（移动端单栏保留 `calc(100vh - 40px - 12vh)` 旧规则）。
- 三栏布局按列独立分配高度（不再共享行高，各栏互不跟随）：第一栏情绪与服从度面板按内容高度自适应且无留白、永不滚动，终端与机器人控制台对半分配剩余高度；第二栏运行参数窗口始终按内容完整显示，任务指令系统与调试日志按方向感知分配剩余高度——缩矮时优先缩调试日志（最小 1 条）再缩任务系统、之后均匀分配；扩高时优先扩任务系统（到 3 条）再扩调试日志（到 4 条）、之后继续扩任务系统；日志文字缩小、行距收紧、最多显示约 4 行。
- 连接弹窗仅手动打开（点击蓝牙按钮），启动/连接成功均不自动弹出；连接成功时若弹窗已打开则状态只在弹窗内显示，否则隐藏弹窗并播放灵动岛动画。弹窗与灵动岛共用同款柔和渐变绿（`29,62,29`/`23,50,23`/`14,30,14` 系），弹窗背景带 `bt-modal-gradient-shift` 流动动画，灵动岛 `.di-bg`/光斑/粒子统一绿色系（去掉偏蓝观感）。
- 桌面菜单模式（macOS NSMenu 风格窗口）：win-app 与浏览器在 ≥750px 桌面尺寸下（`html.desktop-chrome`，Android WebView 不含此边界），连接/信息/设置窗口由居中全屏遮罩 modal 改为 macOS NSMenu·NSMenuItem 风格下拉面板——深色磨砂材质（`rgba(16,26,16,0.78)` + `blur(30px) saturate(1.7)`）、12px 圆角、发丝高光边框、顶部缩放淡入（130ms）；面板锚定在菜单栏（三栏状态栏）触发图标下方并右对齐（win-app 经 `--header-total`=80px 自动让出原生标题栏，面板 top=88px），同一时刻仅一个 NSMenu 显示（点击下一个上一个即关），点击面板外/Esc 关闭、再次点击同一状态栏图标切换关闭；**Esc 层级**：有菜单面板打开仅收面板，无面板且无 scope 对话框/中止对话框显示时关闭当前激活（z 最高）的 DWM 浮窗（`getActiveWin()`），**复用各窗口红灯（左上角关闭按钮）完全相同的入口代码**（`closeDwmWindowByRedDot`：关于本机→`closeAboutModal()`、过程窗口→`forceCloseProcessConfirm(key)`、PDF→`closePdfViewer()`、更新弹窗→`closeUpdateModal()`），失焦窗口不变；**弹出的窗口（DWM 浮窗）不参与菜单互斥、永不被 NSMenuItem 或其他窗口顶掉**（`about-modal` 已移出 `MENU_PANELS`）；菜单模式下窗口红绿灯与移动端关闭按钮隐藏，`#info-modal` 收窄为 620px、`#settings-modal` 保持 672px 且面板内 `settings-body` 滚动、底部操作按钮固定可见，文件列表行带 NSMenuItem 式悬停高亮，面板内滚动条统一为 macOS 式细滚动条；`#bt-qr-modal` 二维码弹窗保持居中遮罩样式不变。菜单栏触发图标（蓝牙/信息/设置/电池/网络/模式/logo）悬停与面板打开期间均以 `outline` 呈现外扩一圈的**圆角矩形**光标块——全部触发图标统一 6px 圆角（含蓝牙按钮：`.triple-header-bt-btn` 基础样式的 `border-radius:0 !important` 由 desktop-chrome 同优先级规则覆盖为 6px，指示器形状全菜单栏一致；hover 白 16%、打开态 `.menu-trigger-active` 白 22%；不改 padding/margin/box-shadow/transform，无布局跳动与图标缩放），关闭时统一清理（设置红绿灯与取消/遮罩关闭路径已统一走 `closeSettings()`）。共享交互规则见整体架构文档。
- Rt5 系统菜单（`#logo-menu`，macOS Apple 菜单风格）：点击左上角 Rt5 logo 弹出（logo 有 hover/按压/选中态），面板在 logo 下方左对齐锚定，菜单项为「关于本机」─ 分隔线 ─「重新启动机器人…」「关闭机器人…」（机器人级语义：确认对话框后调用 `restartRobot()`/`shutdownRobot()`，中止行为见下方「关机/重启中止」）─ 分隔线 ─「退出登录"T31-750"」（固定型号文案）。
- 关机/重启中止（`shutdownRobot`/`restartRobot` 入口统一生效，桌面与移动端共享）：确认关机/重启后立即 `stopAllSpeech()`（`_ttsClient.stop()` + `speechSynthesis.cancel()` 终止进行中与排队语音，含被中止操作的语音；关机自身「已关机」播报保留）→ `updateStatusBarModeIcon()` 菜单栏模式图标回退感叹号（开机完成后恢复）→ `abortRunningPopups()` 终止**所有弹出窗口**的动画与后续操作——**全部过程窗口实例**运行中的清过程定时器与行输出（`freezeProcessModal(inst)`）、更新弹窗运行中停代码滚动+清进度定时器、打开中或最小化中的 DWM 浮窗（关于本机→停硬件监控 `aboutHwStop()`、PDF 阅读器等）一并终止窗口内操作、`DWM.abortAnimations()` 取消 genie 残留并复位坞浮起；全部被中止的可见窗口内容区压暗+模糊（`.dialog-scope-dim`，标题栏不模糊），中止对话框 `#os-aborted-modal`（「机器人的操作系统已中止，操作失败。」）弹在**其中最上层窗口**上（`winZIndex()` 按 modal 叠放序号排序，容器定位到该窗口矩形、背景透明无全屏模糊，弹出时播放 WebAudio 双音警告音效；scope 注册表使对话框跟随宿主窗口拖动/缩放）；**确定** = 撤对话框并按 genie 动画关闭宿主窗口（其余被中止窗口保持压暗待各自手动处理）；对话框红点/ESC/遮罩点击 = 仅撤对话框与全部压暗（窗口保留不关闭）；中止宿主窗口的黄灯最小化被禁用（防对话框悬空）；ESC 捕获阶段拦截不波及冻结窗口；不自动消失——重新开机也**不顶掉**未手动处理的窗口（开机过程窗口仅清理自身复用窗口的中止态 `clearAbortedStateFor()`，其他窗口压暗+对话框原状保留，开机窗口经 `DWM.resetRect()` 重置为**屏幕居中**并 `bringToFront` 置顶打开——覆盖其上、多窗口并存、按原逻辑正常播放），直至用户手动操作。无被中止窗口则不弹。实时代码窗口同时终止滚动并**清空代码内容**（取消 WAAPI + 清空 `.code-scroll-inner`，窗口仅显示中央浅色半透明感叹号遮罩 `#code-halt-overlay`），开机完成后撤遮罩并从头恢复滚动（`robotCodeStart()` 带 `poweredOff` 守卫防误启动）。
- **关机态 UI 联动**（`shutdownRobot` 施加、`bootRobot` 完成回调解除）：机器人控制台四大模式按钮加 `.os-off` 灰态（新增 CSS：`pointer-events:none`、降透明度+去饱和、无悬停缩放；`activateMode()` 另带 `poweredOff` 守卫拦截终端/菜单等所有入口）；终端输入框 `disabled`（`createPrompt()` 新建提示符同样按 `poweredOff` 置灰）；运行参数占用率归零后**不再跳变**——根因为 `managedSetInterval` 注册表 `managedRegistry` 在页面隐藏→恢复时（`setManagedIntervalsPaused(false)`）会把已被裸 `clearInterval` 清理的定时器复活，修复为新增 `managedClearInterval(id)`（同步移出注册表），`startDynamicParamUpdates`/`shutdownRobot` 的 `state.timers` 清理与过程/更新弹窗 elapsed/progress 定时器清理全部改走该函数。
- 状态栏 NSMenu 三枚（电池/网络/机器人模式）：右上角电池、网络（globe）、机器人模式图标均可点击展开同款 NSMenu 面板（锚定各自图标右对齐、打开时刷新数据、再点图标或点外/Esc 关闭、触发图标选中态同步）——电池菜单含大号电量图形+百分比+充电状态+电源来源+自动充电计划（01:00 – 07:00，低电量红/充电绿跟随状态栏配色；菜单内数字/时间值遵循全局字体栈 JetBrains Mono + MiSans 回退，此前 `.ns-battery-pct` 误写 `'JetBrainsMono'` 导致回退系统等宽字体已修正）；网络菜单显示蓝牙广播与客户端连接状态，并提供「断开连接」（仅已连接时显示，调 `btDisconnect()`）与「打开连接面板…」两个 NSMenuItem；模式菜单为四模式单选列表（当前模式 ✓ 加粗），点击直接切换；**关机/重启中止期间模式图标强制回退感叹号（`updateStatusBarModeIcon` 以 `state.poweredOff` 守卫）且模式项渲染为灰色禁用态（`.ns-menu-item.disabled`，动作委托 `act==='mode'` 同步拦截），开机完成后恢复**。注意：globe/模式图标的 `triple-status-fa` 原有 `pointer-events:none`，desktop-chrome 下已覆盖为 `auto`，否则真实鼠标点击无法命中。
- 窗口无遮罩模糊规则（提示对话框分级）：桌面菜单模式下连接/信息/设置面板、NSMenu 与浮窗（关于本机/过程窗口/PDF 阅读器）的遮罩与窗口本体一律不做背景模糊——遮罩透明化不拦截点击，窗口改近实色深底（`rgba(16,26,16,0.97)`）+ macOS 大投影。提示对话框分级模糊：全局对话框（Rt5 菜单关机/重启/退出登录确认等）保留全屏模糊遮罩（952，可覆盖浮窗 920–939）；窗口级对话框（过程窗口运行中强制关闭确认与完成提示、恢复默认设置确认、关机中止对话框）桌面端经 `applyDialogScope()` 改为容器定位到对应窗口矩形且透明无模糊、仅对应窗口**内容区**压暗+模糊（窗口内叠加 `.dialog-scope-dim`，上缘下移至标题栏底边——窗口控制器栏不被模糊），对话框从窗口中心淡入+缩放浮现（几何瞬切、无全屏漂移），移动端一律维持全屏模糊。**scope 对话框嵌入式作用域**：scope 对话框（窗口级确认框/恢复默认确认/关机中止对话框）弹出时 **DOM 直接移入所属窗口内部**（`scope-embedded`：absolute inset 0、z 61 高于窗口内压暗层）——层级天然只随所属窗口（被更高窗口覆盖时随之被盖，其他窗口置顶/开机窗口打开都不会被其对话框压住）、模糊蒙版被窗口 overflow 裁剪**无论静态还是动画都不超出窗口**、容器点击穿透（`pointer-events:none` + 对话框本体 `auto`——对话框显示中窗口标题栏仍可拖动，对话框随窗口实时贴合，无需 JS 同步）；窗口 genie 最小化/关闭前仍经 `dismissScopedDialogsFor(winEl)` 撤掉 scope 到该窗口的显示中对话框（否则对话框悬空留在原矩形、超出窗口范围）；**关闭两段式**——`hide*()` 先移除 visible 在窗口矩形内淡出，`scheduleClearDialogScope` 320ms 后 `clearDialogScope` 才脱离窗口移回 body 直下（立即清 scope 会让容器瞬间回退全屏黑底蒙版并淡出——「黑色蒙版覆盖整个网页后消失」的根因）。NSMenu/连接/信息/设置面板 945、通知堆栈 948、登录层与浮起的程序坞 950。
- 桌面窗口管理器（`window.DWM`，win-app 与浏览器 desktop-chrome ≥750px 共享）：关于本机 / 过程窗口（自检/清空进程/系统更新/数据库更新/开机启动，**多实例**，见下条）/ PDF 阅读器（`#pdf-viewer-modal`）/ 系统更新弹窗（`#update-modal`，设置面板触发，浮窗化后全屏代码窗与扫描线装饰隐藏）统一 macOS 浮窗化——标题栏任意拖动（最大化时拖动即还原，还原恢复高度自适应窗口的 `h=null` 自适应态）、八向拉伸把手（最小尺寸+视口约束）、黄灯 genie 最小化到程序坞（**先同步坞图标再播动画**——目标即真实图标矩形，窗口从当前位置连贯吸入，弹跳在动画收尾图标就位后播放；WAAPI 0.38s 收拢 / 0.34s 回弹，440ms 兜底防卡顿）、程序坞图标点击 genie 恢复/置顶聚焦/重开（`dockActivate` **按 dockItem 聚合全部实例**：优先恢复最小化实例、否则置顶 z 最高的打开实例）、绿灯最大化（铺满菜单栏以下 `top:var(--header-total)`，菜单栏保留显示，双击标题栏同效；**全屏态 `.dwm-max` 四角直角**，还原回 12px 圆角且随 `.dwm-anim` 过渡；最大化窗口经最小化→坞恢复后**保持全屏态与直角**）、**红灯关闭带 genie 退出动画**（`close(id)` 先显示坞图标再 0.32s 吸入后移除 openCls；**关闭即重置矩形与最大化状态**——再次打开回默认位且**与已打开同位窗口级联错开 28px**（macOS 式层叠）；关闭时经 `window.onAbortedWindowClose(id)` 挂点撤该窗口中止压暗、宿主窗口则收起中止对话框）；`isOpenWin(id)`/`winIds()`/`getActiveWin()`（z 最高可见窗口，Esc 关闭用）公开；Android 与移动端路径不变。
- 过程窗口多实例（`openProcessModal` 泛化）：`options.key` 区分过程（self-check / clear-process / system-update / database-update / boot），每 key 独立 modal 实例（`ensureProcessInstance`：首个非模板 key 经 `#self-check-modal` 克隆创建，克隆体内 id 加 key 前缀防重复、状态/定时器/进度按实例隔离），同 key 重复打开拦截、跨 key 并存互不顶掉；DWM 经 `registerWin(id, def)` 动态注册（dockItem 共用 `dock-process-window`，坞图标显隐与指示点按全部实例聚合）；克隆体红黄绿/遮罩点击在 `bindProcessInstanceEvents` 重新绑定（运行中红灯/遮罩/Esc 先弹强制关闭确认，scope 到该实例）；`bootRobot` 以 key='boot' 打开机窗口（每次 `resetRect` 居中）。
- 自检「Male_2.png 传输」叠加层（win-app 与浏览器 desktop-chrome 共享，Android 与移动端走回退路径）：自检传输行弹出右侧图片浮窗（`#male2-image-modal` DWM 动态注册、固定屏幕右侧、**3:4 竖版**图区、素材 `pic/Male_2.png`）与「正在发送至T31-750」进度对话框（`#male2-transfer-dialog` scope 附着自检过程窗口）；发送进度固定约 1.5s 走完（接收行提前到达则提前补满）、停留 0.5s 淡出，图片窗保留至「软件性别和仿真性设置已成功运行」行显示后 genie 关闭；过程窗口关闭/关机中止连带收起。完整触发时序与实现细节见整体架构文档「自检Male_2.png传输叠加层」条目。
- genie 动画连贯性（DWM）：**三帧关键帧**——吸入坞前 72% 行程窗口保持实体不透明、仅贴合坞图标时收没，从坞放大对称（开头 28% 快速显形后实体飞向窗口位，帧级 easing：位移段 genie 曲线、显形/收没段平缓曲线），从程序坞到窗口、窗口到程序坞全程实体连贯无中途渐隐；**genie 期间程序坞自动浮起**（macOS 语义，`dockPeekShow/BEGIN/End` 计数器管理）——坞自动隐藏时图标矩形在视口外，不浮起窗口会飞出屏幕；浮起采用禁过渡瞬浮一帧（`transition:none` + 强制 reflow）保证 genie 目标矩形按浮起静止位计算（滑出过渡会让起点取到中途位置），动画结束/取消后 660ms（略长于图标弹跳）收回，`abortAnimations()` 一并复位；**动画收尾无闪影**——`finished` 回调按「禁容器过渡 → 移除 openCls → cancel 动画 → 强制 reflow → 恢复过渡」顺序收尾，消除 fill 取消后窗口一帧回位叠加容器 0.16s 淡出的重现闪影；恢复/重开预置首帧 transform（`playGenie(r,false,t0)`）无全尺寸闪帧；窗口点击置顶（焦点序 920–939）；遮罩透明不拦截点击、窗口近实色深底（见无模糊规则）；过程窗口/PDF 浮窗区图标随窗口打开/最小化显隐；Android 与移动端路径不变。
- 关于本机窗口（`#about-modal`，由桌面窗口管理器托管）：macOS About 风格独立浮窗（默认 900×680、近实色深底 + 大投影、标题「关于本机」），**默认打开位置屏幕水平垂直居中**（DWM `defaultRect` 按有效高度 `min(estH, vh−headerH−24)` 垂直居中，拖动/最大化后随窗口管理器状态），标题栏红/黄/绿三灯齐备，沿用「左图右文」布局——**左列**＝顶部居左的主标题「T31-750 仿人男性机器人」与副标题（公司/版本/序列号摘要）+ 下方填充展示的机器人图片1（设置上传，未上传回退 `left.webp`）；**右列**＝状态设置项全量列表（发丝分隔线网格，随窗口宽度自适应 2–4+ 列，最大化自动铺满、超高列内滚动）+ **底部硬件仪表条**＝CPU（R5 SoC 2020）/GPU（WORLD 992）/NPU（HUMAN 905）三张 canvas 自绘任务管理器式迷你性能折线（40 槽历史、细网格+渐变填充+末端亮点，绿/蓝/紫）+ 内存（128 PB）/存储（512 EB）实时进度条（已用量+百分比）；窗口打开时 1s 采样 `state.dynamicParams`/`runtimeParams.storageUsed`（不可见跳过、关机/重启中止期间随窗口一并终止采样并归零），关闭停止。黄灯 genie 式最小化到程序坞 → 浮窗区 Rt5 LOGO 图标弹跳（常驻不隐藏；中止宿主窗口禁用最小化），点击图标 genie 回弹恢复；红灯/Esc 关闭。
- 退出登录：系统菜单「退出登录"T31-750"」→ 确认对话框 → `logout()` 关闭全部面板/窗口、暂停定时器与机器人实时代码、桌面端主界面先整体淡出（0.4s，与进入主界面时登录层淡出对称）再隐藏、复位登录卡片状态（`resetLoginBoot()`）后带简单过渡动画重新显示登录页（`.login-modal.revealing`：整层 0.4s 淡入 + 卡片 0.42s 自上方轻微落下）并禁用程序坞（账号与机器人数据保留）；`initApp()` 幂等守卫保证再次登录直接恢复，不重复初始化。
- 系统加载动画（属于登录界面的一部分，`window.playLoginBoot()` 驱动，默认隐藏纯 JS 控制）：**进入登录页不播放**；登录成功后登录卡片下半部（表单）0.5s 收缩消失（`login-form-collapse`，先行且独占主线程保证连贯），原位换入 macOS 式 4px 细进度条（`#login-boot`，渐进填充+光泽扫过），主标题与机器人图标保持不变，副标题 `#login-subtitle` 切换为加载文案（「正在进入系统…→ 正在恢复会话环境…→ 欢迎回来，主人」，字体遵循全局栈 JetBrains Mono + MiSans 回退），卡片向上收缩并保持居中，背景仍为登录页背景（无全屏遮罩）；进度由 requestAnimationFrame 逐帧驱动约 1.2s（进度条 width 无过渡直写），加载期间登录层 z-index 950 置顶（菜单栏不可见），主界面挂载推迟到进度走完开始淡出时（不与收缩/进度动画抢占主线程），走完后登录层淡出并复位卡片状态；仅 desktop-chrome 且 ≥750px 播放（播放器内含宽度守卫，Android 与移动端同步跳过直接挂载）。原全屏 `#system-boot-overlay` 加载层已删除。
- 桌面程序坞（`#desktop-dock`）macOS 化：登录后在 win-app 与浏览器 ≥750px 显示底部 macOS Dock（移动端 `#mobile-dock` 不受影响）——默认藏于屏幕底缘之下，鼠标触底缘 8px 浮起（280ms 弹性曲线）、离开 Dock 区域 180ms 收回。**图标构成**＝控制台 1 枚（绿）+ 主界面 **9 窗口全量**（终端深绿/机器人控制台青/情绪玫粉/任务指令系统蓝/运行参数琥珀/调试日志灰绿/实时代码靛紫/机器人双图蓝/信息参数沙金，`data-action="win-*"` 映射三栏 `#triple-*` 窗口；item 60px、icon 52px、容器 26px 圆角、`blur(40px) saturate(1.8)` 磨砂+发丝边框+大投影）+ 分隔线 + 浮窗区（过程窗口玫红/PDF 阅读器砖红随窗口显隐；**关于本机常驻分隔线后、图标为 Rt5 LOGO 深色底**）；菜单栏 NSMenuItem（连接/信息/设置）不上程序坞（`MENU_PANELS` 无 `dock` 字段与指示点同步，`flashDock()` 已删除）。**触摸放大为 macOS 挤动式 + rAF 连贯插值**——mousemove 只记录目标光标位置，rAF 常驻循环对 scale/位移/坞宽做指数平滑插值（约 0.32/帧，收敛自停清内联样式）：光标所在图标目标 scale 1.42 上浮，150px 半径内相邻图标按距离衰减缩放并被挤动（进坞快照静止布局、放大期间零布局读取，事件间隔不再丢帧连贯跟手；原 `.dock-mag-smooth` 临时过渡补丁已删除）+ 悬停名称气泡；**弹跳 `dock-bounce` 0.6s 作用于内层 `.dock-icon`**（起跳挤压/腾空/落地回弹）——外层保留放大 transform，两层叠加点击不瞬移。点击行为：控制台 = 收起全部面板并高亮主界面；9 窗口图标 = `scrollIntoView` 定位对应三栏窗口并播放绿色描边脉冲（`.window-highlight`）；浮窗区图标 = `dockActivate` genie 恢复/置顶聚焦/重开；主界面 9 窗口登录后指示点常亮、浮窗打开中带点/最小化无点。**genie 联动浮起**：DWM 浮窗最小化/关闭/恢复动画期间程序坞自动浮起（`dockPeekShow` 禁过渡瞬浮，保证 genie 目标按浮起静止位计算）、结束后 660ms 自动收回，坞隐藏时图标矩形在视口外、窗口 genie 会飞出屏幕。z-index 45，浮起时 950，层级关系：提示 952 > 坞浮起 950 > 通知 948 > 面板 945 > 浮窗 920–939。
- win-app 灵动岛初始圆点从状态栏背面（`top:120px` 减去 `translateY(-80px)` = y:40，正好在裁剪容器边界）飞出，卡片最终位于状态栏下方（`top:120px`）；`#dynamic-island-clip`（`top:40px overflow:hidden`）保证 SVG 描边光晕和弥散跑马灯最多显示到状态栏上边缘，绝不进入窗口标题栏；SVG 描边光晕同时受卡片 `overflow:hidden` 裁剪。
- 灵动岛退场动画：圆点可见地移动到系统菜单栏上边缘处再淡出（退场期间裁剪容器临时提升层级），并带强制复位兜底，不会提前消失或残留。
- 定时器生命周期：页面隐藏时暂停并保留所有 `managedSetInterval` 注册，恢复可见后统一恢复，避免长时间运行后时钟/运行参数永久停摆；主页面隐藏时停止机器人实时代码并清空其 DOM，恢复可见时仅当主界面已显示且宽度达三栏阈值才重新渲染（`robotCodeStart()` 先渲染再判重，代码内容迟到时也能立即补渲染）。
- 最小网页尺寸：宽度 1300px（运行参数文本单行显示的阈值），高度 815px（第一栏/第二栏各自最小高度取大者）；仅作为窗口最小尺寸约束，不改动现有宽高自适应代码。
- 闪屏页带声音：移除 `muted` 并开启 Electron `autoplay-policy=no-user-gesture-required`，横屏闪屏视频正常出声。
- 衔接动画：启动器以“页面内容渲染完成信号（IPC `launcher-rendered`）+ 双 rAF”后再显示；`pre-hide` 暂停态在 `<head>` 内联脚本提前加到 `<html>`（CSS 动画在窗口显示前不会跑完），`launcher-reveal` 显式触发淡入并带强制可见兜底，内容不“无动画闪出”、不出现空窗；主窗口 `show:false` + `ready-to-show` 首帧渲染完成后显示；返回启动器时主窗口直接隐藏、启动器淡入置顶后再关闭已隐藏主窗口；全程不使用 `setOpacity`/透明遮罩，避免 DWM/Acrylic 闪烁、黑屏与抽搐；窗口未显示/隐藏时暂停全部 CSS 动画与精灵循环，降低后台 CPU/耗电。
- 启动器状态持久化：连接状态、测试模式标记（含启动纪元）、活动设备和 USB 列表存入 `rt5_launcher_state`，USB 列表另存 `rt5_detected_usb_devices`；测试模式恢复仅限同一应用启动内（纪元比对，见上），真实设备连接恢复不受纪元限制；**已保存的 USB 设备规则**经 IPC 读/写 `huancun/launcher-usb-devices.json`（持久源，跨启动永续），并在启动时用该文件校准 localStorage 快照（`reconcileUsbDevicesFromFile()`）。
- 设置弹窗新增「灵动岛模拟效果」分组与 `预览灵动岛效果` 按钮（`#preview-island-btn`），点击调用 `showDynamicIsland()` 本地预览动画。
- 电量默认设置与 USB 充电联动：设置弹窗「运行参数设置」剩余电量新增 `#battery-auto`（默认开启）；开启时电量按时间自动计算（凌晨1点0%、早7点100%，1-7点充电线性升至100%，7点至次日1点放电降至0%）。通过 USB 设备进入控制台（非测试模式，启动器 `enterConsole()` 传 `enteredViaUsb/deviceId`）时，默认设置下 USB 在位期间始终显示正在充电：拔掉 USB 退出充电样式、重新插上恢复。主进程 `consoleUsbEntry` 记录进入方式，进入控制台后 USB 轮询不停止（`launcherWindow.on('closed')` 仅在主窗口不存在时停止），设备变化时经 `updateConsoleUsbPresence()`/`pushConsoleUsbState()` 推送 `console-usb-state`；`app/preload.js` 暴露 `window.consoleUSB`（`getState`/`onStateChanged`），前端 `refreshAutoBattery()` 实时跟随；逻辑见 `app/usb-presence.js`（`createUsbEntry`/`computePresence`，含单测 `test/usb-presence.test.js`）。
- 三栏右上角状态栏顺序为电池、网络、机器人模式、蓝牙、信息、设置；图标统一零内边距等高盒子（flex gap 1.625rem，间距一致），圆形图标 16×16，电池为 macOS 菜单栏式横长造型（20×11：外壳 16.5×9.5 细边 1.4 + 端子极耳；SVG `overflow:visible` 防非整数缩放下贴边圆角抗锯齿被视口裁掉），纵向居中与圆形图标视觉平衡；电池/网络/机器人模式图标在桌面菜单模式下可点击展开对应 NSMenu（见上文"状态栏 NSMenu 三枚"）。电池非充电显示电量条（宽度随电量 0-12.8 线性变化）、低电量（<20%）变红、充电时变绿且电量条让位、居中闪电（Bootstrap bolt 0.6 缩放），由 `updateStatusBarBattery()` 驱动。默认机器人图片 `www/pic/right.webp`（机器人视图2/设置恢复默认的内骨骼图）已更换为新版骨架渲染图；「开始充电」灵动岛复用 `#dynamic-island` 容器，卡片尺寸与连接灵动岛一致 146×162px，充电从 false 变 true 自动播放，设置弹窗 `#preview-charging-island-btn` 可模拟预览。
- macOS 风格通知与灵动岛：通知堆栈样式已从 `css/win.css` 迁移至共享主 HTML（`html.desktop-chrome` 边界），**win-app 与浏览器端一致显示**，触发判定由 `isWinAppDesktop()` 放宽为 `isDesktopChrome()`（win-app 定位 `top` 随 `--header-total`=80px 与原 100px 等效，浏览器端 60px）；堆栈 DOM 位于 body 直下（原在 `#dynamic-island-clip` 内，浏览器端该容器隐藏会连带隐藏通知，已移出）。通知卡片为 macOS Big Sur 风格（`rgba(28,28,30,0.78)` 磨砂 + `blur(40px) saturate(180%)`、14px 圆角、App 名+时间+标题+正文、右侧滑入 200ms、hover 显示清除按钮、最多堆叠 3 条、5s 自动消失），支持图标通知（连接成功/开始充电）与文字通知（断开/停止充电等，`showMacosTextNotification`），设置弹窗含「预览文字通知」按钮。灵动岛仍为 win-app 专属：`top:120px / right:12px`，播放时通知下移（`.stack-shifted`）避免遮挡；`#dynamic-island-clip` 顶部 40px 截断，标题栏 `z-index:60` 保持最顶层且不被光效污染；入场/退场圆点 `translateY(-80px)` 完全被 40px 标题栏覆盖后再钻出/收回。
- MiMo TTS：诊断确认服务端与代码均正常，根因是本地 API Key 带引号导致 401；win-app preload `normalizeApiKey()` 已在读取/写入时清洗并回写，`mimo-fetch` 发送前同样清洗。
- 启动器旋转精灵动画在 MORPH_IN/MORPH_OUT 期间锁定正面帧，灰模↔彩色交叉淡化完成后再继续旋转；进入 CONNECTED 后先停顿约 600ms 再旋转，避免切换破绽。

## 桥接映射表

| Android 方法 | Windows 实现 |
|---|---|
| getSafeAreaTop / getSafeAreaBottom / getImeHeight | 返回 0（桌面无安全区/输入法） |
| setModalState | 空实现 |
| onDataChanged | 经 IPC 转发到 C# 宿主，更新 GATT 特征值并 Notify 已连接 phone |
| openExternalUrl | `shell.openExternal`（仅 http/https） |
| openPdfFile | 相对路径按 www 根解析后 `shell.openPath` |
| btGetStatus | 返回主进程缓存的 BLE 状态（0 未绑定/1 已连接/2 断开/3 连接中/4 手动断开） |
| btHasClientBond | 返回 `huancun/ble-state.json` 持久化的绑定标记（首次连接后为 true，unbond 后 false） |
| btStartConnect | 拉起 BLE 宿主并开始广播 `RobotControl-Win`；适配器不支持外设模式时提示并保持未绑定 |
| btUnbond | 宿主向客户端发送 0xFF、停止广播，状态置 4，清除绑定标记 |
| btShowQr | 主进程用宿主真实 MAC 生成 `{"mac","name":"RobotControl-Win","service","role":"console"}` QR data URL |
| btOnPageLoaded | 仅保留兼容入口，不再主动弹出连接/配对弹窗 |
| get/setMimoApiKey、get/setTtsEngine | localStorage 持久化；voiceclone 自动迁移为 voicedesign |
| mimoFetchAsync / getMimoFetchResult | IPC → 主进程 `net.fetch`（无 CORS），结果缓存后回调 |
| playAudioBase64 / stopAudio | Blob + Audio 播放，完成后回调 `__ttsOnComplete` |
| getRotationVideoBgColor | 固定 `29,62,29` |

| 窗口 API | 说明 |
|---|---|
| `window.electronAPI`（启动器） | minimize / close / enterConsole / getUsbDevices / getUsbDevicesConfig / setUsbDevicesConfig / markRendered / onExitFade / onUsbAttached / onUsbDetached |
| `window.consoleAPI`（主控制台） | minimizeWindow / toggleMaximize / closeWindow / toggleFullscreen / backToLauncher / onMaximizedChange / setUiLang / getUiLang / `bootLang`（preload 顶层带回的初始语言，1.4.0） |

## 存储位置

- 运行时数据全部落在代码根目录的 `huancun/`（`win-app/huancun`）：`userData/` 存 localStorage（账号记忆、任务、TTS Key、启动器 USB 规则、启动器状态 `rt5_launcher_state`、检测到的 USB 设备列表 `rt5_detected_usb_devices` 等）、Chromium 缓存、GPU 缓存、崩溃转储，`tmp/` 存进程临时文件；启动器页面使用固定 `app://design` origin，主控制台使用 `app://bundle` origin，跨启动稳定持久化。
- `huancun/ble-state.json` 持久化 BLE 绑定标记（`btHasClientBond`），首次手机连接后写入，unbond 时清除。
- `huancun/launcher-usb-devices.json` 持久化启动器**已保存的 USB 设备规则**（设置界面配置的多设备规则，`usbDevices`）：本地存储优先，另经 IPC 读/写该文件作为持久源，避免便携版解压目录变化导致 localStorage 被遗忘——一旦保存，后续跨启动永远记住。
- 首次启动若检测到旧的 `%APPDATA%\robotcontrol-windows-console`，会自动迁移一次到 `huancun/userData/`。
- 交付产物为展开目录（`RobotControl-Console.exe` + `runtime/`），无需自解压到 `%TEMP%`。

## 构建与测试

```powershell
npm install
npm test        # 核心模块自动化测试（node:test，当前 60 项）
npm start       # 开发模式启动（Electron）
npm run dist    # 打包 unpacked dir（electron-builder --win dir）
```

- 打包使用本地 `electronDist`（`node_modules/electron/dist`），无需联网下载 Electron 二进制。
- `asar` 已禁用，输出为 `dist-new/win-unpacked/`。
- `design/` 目录经 `extraResources` 复制为 `resources/design/`。
- `ble-host/publish/`（`RobotControl-BleHost.exe`）经 `extraResources` 复制为 `resources/ble-host/`；`npm run dist` 前会自动执行 `predist`（`scripts/build-ble-host.ps1`）。
- 执行 `scripts/package-with-splash.ps1` 在 `win-app/` 根目录生成最终产物：`RobotControl-Console.exe` + `runtime/` 目录。

## 体积优化说明

- 前端资源无损压缩：视频重编码为 H.264 CRF27，机器人立绘转 WebP，删除未引用文件；
- 仅保留中英文 locale；
- MiSans 标题字体按需子集化（仅保留标题字符，两份 woff2 合计约 37KB）；
- 体积主体为 Electron 运行时（`runtime/` 约 385MB，含 BLE 宿主约 40MB）。

## 目录结构

- `RobotControl-Console.exe` — 无窗口 C# 启动器入口（编译自 `splash-loader/`）
- `runtime/` — Electron 运行时目录（`RobotControl-Console-Main.exe` + 资源）
- `ble-host/` — C# BLE 外设宿主（`RobotControlBleHost.csproj` + `publish/RobotControl-BleHost.exe`）
- `splash-loader/Program.cs` — 无窗口 C# 启动器源码（拉起主程序后立即退出）
- `scripts/package-with-splash.ps1` / `scripts/build-ble-host.ps1` — 构建产物打包脚本 / BLE 宿主发布脚本
- `app/main.js` — 主进程：静态协议、窗口、USB watcher、IPC 桥接、启动器 USB 设备规则持久化（`launcher-usb-devices.json`）
- `app/ble-bridge.js` / `app/ble-protocol.js` — BLE 宿主进程管理与命名管道 JSON 行协议
- `app/preload.js` / `app/preload-launcher.js` — 主控制台 / 启动器 preload 桥接
- `app/usb.js` / `app/usb-watcher.js` — USB 设备解析、规则匹配、WMI 轮询与热插拔事件
- `app/protocol-handler.js` / `app/static-responder.js` — `app://bundle`、`app://design` 静态服务
- `app/paths.js` / `app/qr.js` / `app/js-utils.js` / `app/titlebar-width.js` — 辅助模块
- `app/splash.html` — 黑色闪屏页
- `app/www/` — 主控制台前端资源（仓库根 `www/` 的同步镜像，含自绘窗口按钮）
- `design/launcher.html` / `design/launcher-assets/` — 启动器页面与精灵图、字体资源
- `test/` — 自动化测试；`tools/` — CDP 调试脚本（不参与打包）
