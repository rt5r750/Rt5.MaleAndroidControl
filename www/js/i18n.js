/**
 * i18n runtime overlay (English translation test).
 * Default language is Chinese. Switch to English in Settings.
 * Existing Chinese strings are never modified in source; this module
 * only replaces display text at runtime and restores Chinese on switch-back.
 * Terminology follows the T31-750 English manuals.
 */
(function (global) {
    'use strict';
    var STORAGE_KEY = 'robot_ui_lang';
    var LEGACY_STORAGE_KEY = 'android_ui_lang';
    var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
    var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1 };
    var DICT = {
        '返回': 'Back',
        '全屏': 'Fullscreen',
        '信息': 'Info',
        '软件设置': 'Software Settings',
        '快捷操作': 'Quick Actions',
        'Male_2.png 传输预览': 'Male_2.png Transfer Preview',
        '在新窗口打开': 'Open in New Window',
        '控制台': 'Console',
        '终端': 'Terminal',
        '机器人控制台': 'Android Control Console',
        '情绪与服从度': 'Emotion & Obedience',
        '情绪与服从度面板': 'Emotion & Obedience Panel',
        '任务指令系统': 'Task Command System',
        '运行参数': 'Runtime Parameters',
        '运行参数设置': 'Runtime Parameters Settings',
        '调试日志': 'Debug Log',
        '机器人实时代码': 'Android Live Code',
        '机器人双图': 'Android Dual Image',
        '机器人信息参数': 'Android Info Parameters',
        '仿人男性机器人信息参数': 'Male Android Info Parameters',
        '关于本机': 'About this Android',
        '过程窗口': 'Process Window',
        'PDF 阅读器': 'PDF Reader',
        'PDF 文档查看器': 'PDF Document Viewer',
        'PDF查看器': 'PDF Viewer',
        'PDF 文档': 'PDF Document',
        '关闭': 'Close',
        '最小化': 'Minimize',
        '最大化': 'Maximize',
        '还原': 'Restore',
        '系统菜单': 'System Menu',
        '状态指示': 'Status Indicator',
        '电池': 'Battery',
        '网络': 'Network',
        '机器人模式': 'Android Mode',
        '蓝牙连接': 'Bluetooth Connection',
        '设置': 'Settings',
        '了解机器人': 'About the Android',
        '最小化到程序坞': 'Minimize to Dock',
        '机器人模型1': 'Android Model 1',
        '机器人模型2': 'Android Model 2',
        '机器人视图1': 'Android View 1',
        '机器人视图2': 'Android View 2',
        '机器人': 'Android',
        '已连接至T31-750型仿人男性机器人的内部系统': 'Connected to the internal system of T31-750 Male Android',
        '语音播报系统初始化中...': 'Voice broadcast system initializing...',
        '仿人男性机器人控制台': 'Male Android Control Console',
        '请验证您的身份': 'Please verify your identity',
        '账号': 'Account',
        '密码': 'Password',
        '输入账号': 'Enter account',
        '输入密码': 'Enter password',
        '记住账号': 'Remember account',
        '账号或密码错误': 'Incorrect account or password',
        '进入控制台': 'Enter Console',
        '机器人控制设置': 'Android Control Settings',
        '网页缓存与 App': 'Web Cache & App',
        '缓存控制台把网页资源存到本机：弱网加载更快、离线可打开；更新后可重新缓存（仅浏览器端可用）': 'The cache console stores web assets locally: faster loads on weak networks, offline access; re-cache after updates (browser only)',
        '缓存控制台': 'Cache Console',
        '拉起 App': 'Launch App',
        '下载 App': 'Download App',
        '账号管理': 'Account Management',
        '新账号': 'New Account',
        '输入新账号': 'Enter new account',
        '添加账号': 'Add Account',
        '至少需要保留一个账号': 'At least one account must be kept',
        '机器人图片设置': 'Android Image Settings',
        '选择图片1': 'Select Image 1',
        '选择图片2': 'Select Image 2',
        '图片预览1': 'Image Preview 1',
        '图片预览2': 'Image Preview 2',
        '图片预览': 'Image Preview',
        '选择图片': 'Select Image',
        '恢复默认': 'Restore Defaults',
        '改为默认设置': 'Set to Defaults',
        '建议使用9:20比例的图片': 'Recommended image aspect ratio is 9:20',
        '灵动岛模拟效果': 'Dynamic Island Preview',
        '点击预览连接/充电灵动岛动画（圆点入场→内容放大旋转→底框跑马灯展开）': 'Click to preview connect/charge Dynamic Island animation (dot entry -> content zoom-rotate -> marquee expand)',
        '预览连接灵动岛': 'Preview Connect Island',
        '预览充电灵动岛': 'Preview Charging Island',
        '预览文字通知': 'Preview Text Notification',
        '剩余仿真精液 (单位: mL)': 'Artificial Semen Remaining (unit: mL)',
        '剩余电量': 'Battery Remaining',
        '当前量': 'Current amount',
        '总量': 'Total',
        '百分比': 'Percentage',
        '已使用量': 'Used amount',
        '默认设置（按时间自动判断电量）': 'Default (auto battery by time of day)',
        '默认设置：凌晨1点为0%、早上7点为100%，凌晨1点至7点显示正在充电并逐步充至100%': 'Default: 0% at 1:00, 100% at 7:00; shows charging and fills to 100% between 1:00-7:00',
        '显示充电': 'Show Charging',
        '剩余存储 (单位: EB)': 'Storage Remaining (unit: EB)',
        '存储总量设置后自动计算百分比': 'Percentage is calculated automatically after total storage is set',
        '控制按钮文本设置': 'Control Button Text Settings',
        '添加按钮设置': 'Add Button Setting',
        'TTS 语音引擎': 'TTS Voice Engine',
        '白桦音色': 'Birch Voice',
        '音色设计': 'Voice Design',
        '音色设计为默认引擎。MiMo引擎失败时自动降级到本地语音。同一会话内已生成的语音会缓存复用，无需重复联网。': 'Voice Design is the default engine. If MiMo fails, it falls back to local speech. Audio generated in the same session is cached and reused without repeated network calls.',
        '输入 MiMo API Key（如 sk-xxx）': 'Enter MiMo API Key (e.g. sk-xxx)',
        '保存': 'Save',
        'API Key 也可通过手机端连接时自动同步，手机端Key优先。': 'The API Key can also be synced automatically when connecting via the phone app; the phone key takes priority.',
        'Xiaomi MiMo TTS和ASR可能需要收费，请阅读官网相关文档。': 'Xiaomi MiMo TTS and ASR may incur charges; please read the relevant documentation on the official website.',
        '推送成功': 'Push successful',
        '测试播报': 'Test Broadcast',
        '机器人状态设置': 'Android Status Settings',
        '设置机器人状态项': 'Configure android status items',
        '添加状态项': 'Add Status Item',
        '取消': 'Cancel',
        '应用更改': 'Apply Changes',
        '保存设置': 'Save Settings',
        '确定': 'OK',
        '确认': 'Confirm',
        '提示': 'Notice',
        '语言': 'Language',
        '中文': 'Chinese',
        '英文': 'English',
        'T31-750型仿人男性机器人内部系统面板': 'T31-750 Male Android Internal System Panel',
        'T31-750型仿人男性机器人': 'T31-750 Male Android',
        'T31-750 仿人男性机器人': 'T31-750 Male Android',
        '调试模式': 'Test Mode',
        '忠诚模式': 'Loyalty Mode',
        '暂停': 'Pause',
        '停止': 'Stop',
        '开始': 'Start',
        '重置': 'Reset',
        '关机': 'Shut Down',
        '开机': 'Power On',
        '重启': 'Restart',
        '电量': 'Battery',
        '(正在充电)': '(Charging)',
        '正在充电': 'Charging',
        '仿真性唤起值': 'Sexual Arousal Value',
        '恢复模式': 'Recovery Mode',
        '拟人模式': 'Simulated Human Mode',
        '模式名称设置': 'Mode Name Settings',
        '自定义四大模式的显示名；与默认中文名或英文名完全一致时随界面语言显示对应默认名，自定义名称中英文显示同一文本，留空恢复该模式默认名。应用更改时逐项确认。': 'Customize the display names of the four modes; a set exactly matching the default Chinese or English names is shown per interface language, custom names keep the same text in both languages, leave blank to restore the default name. Changes are confirmed item by item when applying.',
        '是否按以下内容指定模式名称？确定后随本次设置一并保存。': 'Apply the following mode names as specified? They will be saved together with this settings change.',
        /* ===== v1.6.0：型号信息 / 信息面板链接 / 配置导入导出 / 信息参数锁定行 / 激活引导页 ===== */
        '型号信息': 'Model Info',
        '完整型号': 'Full Model',
        '简称': 'Short Name',
        '自定义本机型号信息，界面各处的型号、公司、主人称呼与语音播报读法随之统一；各键与默认值完全一致时随界面语言显示对应语言内容，任意一项自定义则全部按填写原文显示，留空恢复该默认值。': "Customize this unit's model info so the model, company, master and speech reading shown across the interface stay consistent; when every value exactly matches the defaults they follow the interface language, if any value is customized all of them show the entered text as-is, leave blank to restore that default.",
        '默认：T31-750型仿人男性机器人 / T31-750 Male Android': 'Defaults: T31-750型仿人男性机器人 / T31-750 Male Android',
        '默认：T31-750 / T31-750': 'Defaults: T31-750 / T31-750',
        '默认：芮誊智能虚构公司 / Rt5 A.I. Fictional Liability Company': 'Defaults: 芮誊智能虚构公司 / Rt5 A.I. Fictional Liability Company',
        '默认：X / X': 'Defaults: X / X',
        '由上方型号信息设置': 'Set by Model Info above',
        '信息面板链接': 'Info Panel Links',
        '自定义信息面板中各链接的名称与地址；地址需以 http:// 或 https:// 开头，PDF 条目仅名称可改（文件名固定）。名称全部与默认一致时随界面语言显示默认名，任意一项自定义则按填写原文显示。改完点击「应用更改」生效。': 'Customize the names and addresses of the links in the info panel; addresses must start with http:// or https://, the PDF entry allows renaming only (its file name is fixed). When every name matches the default they follow the interface language, if any name is customized all show the entered text as-is. Click "Apply Changes" to take effect.',
        '名称': 'Name',
        '恢复默认链接': 'Restore Default Links',
        '（PDF 文件名含公司名，固定不可改）': '(PDF file name is fixed)',
        '信息面板链接设置无效：链接地址需以 http:// 或 https:// 开头': 'Info panel links are invalid: addresses must start with http:// or https://',
        '[设置] 信息面板链接已恢复默认值，点击"应用更改"后生效': '[Settings] Info panel links restored to defaults; click "Apply Changes" to take effect',
        '配置导入导出': 'Config Import / Export',
        '导出配置': 'Export Config',
        '导入配置': 'Import Config',
        '导出本机全部个性化设置（按钮文本/信息参数/模式名称/型号信息/链接/运行参数/账号/图片/情绪/语言/MiMo Key）为 JSON 文件；文件含登录密码与 API Key 等敏感信息以及可能较大的图片数据，请妥善保管勿外传。导入会覆盖当前设置并自动刷新页面。': 'Export all personalization settings of this machine (button texts / status items / mode names / model info / links / runtime params / accounts / images / emotions / language / MiMo Key) as a JSON file; it contains sensitive data such as the login password and API keys plus possibly large image data — keep it safe and do not share it. Importing overwrites the current settings and refreshes the page automatically.',
        '配置导出失败：': 'Config export failed: ',
        '[设置] 配置已导出（含敏感信息，请妥善保管勿外传）': '[Settings] Config exported (contains sensitive data — keep it safe, do not share)',
        '配置文件无效：请选择本系统导出的 JSON 配置文件': 'Invalid config file: choose a JSON config exported by this system',
        '导入将覆盖当前全部个性化设置并刷新页面（含账号密码与 API Key），确定继续？': 'Importing will overwrite ALL personalization settings (including accounts, passwords and API keys) and refresh the page. Continue?',
        '配置导入失败：': 'Config import failed: ',
        '[设置] 配置已导入，即将刷新页面': '[Settings] Config imported; refreshing the page',
        '激活设置': 'Activation Setup',
        '首次使用，按顺序完成以下初始设置': 'First-time setup — complete the steps below in order',
        '1. 语言 / Language': '1. Language',
        '2. 型号信息（留空使用默认值）': '2. Model Info (leave blank for defaults)',
        '3. 登录密码（admin 账号）': '3. Login Password (admin account)',
        '4. MiMo TTS API Key（留空跳过）': '4. MiMo TTS API Key (leave blank to skip)',
        '完整型号，默认：T31-750型仿人男性机器人': 'Full model, default: T31-750 Male Android',
        '简称，默认：T31-750': 'Short name, default: T31-750',
        '制造公司，默认：芮誊智能虚构公司': 'Manufacturer, default: Rt5 A.I. Fictional Liability Company',
        '主人，默认：X': 'Master, default: X',
        '设置新密码（两项均留空保持默认 admin/admin）': 'Set a new password (leave both blank to keep the default admin/admin)',
        '确认新密码': 'Confirm new password',
        '两次输入的登录密码不一致': 'The two passwords do not match',
        '开始使用': 'Get Started',
        '跳过，保持默认': 'Skip, Keep Defaults',
        '[激活] 初始设置已完成': '[Activation] Initial setup completed',
        /* ===== v1.6.0 追加：语音读法 / 激活页全量 / 侧边导航 / 版权水印 / MiMo 官网链接 ===== */
        '语音播报读法': 'TTS Reading',
        '踢三一七五零型仿人男性机器人': 'T-Three-One-seven-five-0 Male Android',
        '型号的语音念法，默认：踢三一七五零型仿人男性机器人 / T-Three-One-seven-five-0 Male Android': 'How the model name is read aloud in speech; defaults: 踢三一七五零型仿人男性机器人 / T-Three-One-seven-five-0 Male Android',
        '语音播报型号简称时的念法，默认：踢三一七五零 / 踢三一七五零': 'Speech reading of the short model name; defaults: 踢三一七五零 / 踢三一七五零',
        '设置机器人状态项（主人与制造公司由上方「型号信息」设置驱动，此处不显示）': 'Configure android status items (Master and Manufacturer are driven by the Model Info section above and not shown here)',
        '自定义信息面板中各链接的名称与地址；地址需以 http:// 或 https:// 开头，PDF 条目文件名固定不提供修改。名称全部与默认一致时随界面语言显示默认名，任意一项自定义则按填写原文显示。改完点击「应用更改」生效。': 'Customize the names and addresses of the links in the info panel; addresses must start with http:// or https://, the PDF entry has a fixed file name and is not editable. When every name matches the default they follow the interface language, if any name is customized all show the entered text as-is. Click "Apply Changes" to take effect.',
        '默认不提供 TTS API，需自行申请并手动输入；': 'No TTS API by default — apply for one and enter it manually. ',
        '前往 MiMo 开放平台申请 API Key ↗': 'Apply for an API Key on the MiMo Open Platform ↗',
        '© 芮誊智能虚构公司': '© Rt5 A.I. Fictional Liability Company',
        '首次使用，按顺序完成以下全部设置（可留空保持默认）': 'First-time setup — go through ALL settings below in order (leave blank to keep defaults)',
        '语言 / Language': 'Language',
        '信息参数': 'Info Parameters',
        '确认密码': 'Confirm Password',
        '登录密码': 'Login Password',
        '剩余仿真精液 (mL)': 'Simulated Semen Remaining (mL)',
        '剩余存储 (EB)': 'Storage Remaining (EB)',
        '自动（01:00-07:00 充电计划）': 'Auto (01:00-07:00 charging plan)',
        '默认': 'Default',
        '认知偏移已添加：': 'Cognitive offset added: ',
        '认知偏移已移除：': 'Cognitive offset removed: ',
        '指令已移除：': 'Command removed: ',
        '简介：': 'Description: ',
        '（恢复默认）': ' (reset to default)',
        '机器人没有自我意识，需要用户输入控制指令，机器人才会处理并输出反应，没有其他额外指令时，机器人则保持静止的待机状态。此时只是一个人型计算机，只有接受了用户的指令才可退出调试模式。用于调试、测试、修改程序、修改设置等。': 'The android has no self-awareness; it processes and responds only to control commands input by the user, and remains in a static standby state when no further commands are given. At this point it is merely a humanoid computer, and only the user\'s commands can exit Test Mode. Used for debugging, testing, modifying programs and changing settings.',
        '机器人将只会启动BIOS系统，对机器人进行系统编程或修复。此时为防止误触，需要用户同时长按机器人的某些位置进入该模式。只有接受了用户的指令才可退出恢复模式。用于系统损坏的刷机修复。': 'The android boots into the BIOS system only, for system programming or repair. To prevent accidental touches, this mode is entered by long-pressing certain positions on the android simultaneously. Only the user\'s commands can exit Recovery Mode. Used for flashing and repair when the system is damaged.',
        '机器人拥有意识，会自动接收外部信号、处理并输出反应，此时和真人看起来没有区别，但机器人知道自己是机器人且会听从用户的指令，会舍弃掉部分需要模拟人类的行为（例如人类的性行为模式、羞耻、喜好、喜欢），以机器算法呈现机器人行为。用于满足用户对机器人的占有欲，此时就是一个披着人类皮肤、人类等高的、内部却是机器的没有羞耻心的听话玩具，也可用于修改程序、修改设置、修改忠诚模式的人格。': 'The android has consciousness and automatically receives external signals, processes them and outputs reactions, looking no different from a real human — but it knows it is an android and obeys the user\'s commands, discarding behaviors that mimic humans (such as human sexual behavior patterns, shame, and preferences) and presenting its behavior through machine algorithms. Used to satisfy the user\'s possessiveness over the android: an obedient toy wrapped in human skin, human-height, a machine inside, without shame. Also used to modify programs, change settings and edit the Loyalty Mode personality.',
        '机器人拥有“自我意识”，会自动接收外部信号、处理并输出反应。此时和真人几乎没有区别，默认设置下以为自己是人类且听从自己的“想法”，不知道用户的存在。用于日常渗透人类社会。机器人必须在有仿真皮肤的情况下才能运行拟人模式。': 'The android has "self-awareness": it automatically receives external signals, processes them and outputs reactions, being almost indistinguishable from a real human. Under default settings it believes it is human, follows its own "thoughts" and does not know of the user\'s existence. Used for daily infiltration into human society. The android must have simulated skin to run Simulated Human Mode.',
        '0 项任务': '0 tasks',
        '实时监控': 'Live Monitor',
        '剩余仿真精液': 'Artificial Semen Remaining',
        '剩余存储': 'Storage Remaining',
        '内存占用率': 'Memory Usage',
        'CPU占用率': 'CPU Usage',
        'NPU占用率': 'NPU Usage',
        'GPU占用率': 'GPU Usage',
        '读写占用率': 'I/O Usage',
        '(读16PB/s, 写12PB/s)': '(Read 16PB/s, Write 12PB/s)',
        '机内温度': 'Internal Temperature',
        '系统负载': 'System Load',
        '服从度': 'Obedience',
        '羞耻度': 'Shame',
        '愉悦度': 'Pleasure',
        '机械度': 'Robotic',
        '系统已成功完成初始化': 'System initialization completed successfully',
        '已成功连接至主服务器 rrr.Rt5.ai/Server/TRL': 'Successfully connected to main server rrr.Rt5.ai/Server/TRL',
        '语音交互系统已启动并正常运行': 'Voice interaction system started and running normally',
        '表情控制系统已启动并正常运行': 'Expression control system started and running normally',
        '肢体动作系统已启动并正常运行': 'Body motion system started and running normally',
        '环境感知系统已启动并正常运行': 'Environment sensing system started and running normally',
        '检测到电池电量低，正在进行充电': 'Low battery detected, charging in progress',
        '照片显示模块已升级为双图模式': 'Photo display module upgraded to dual-image mode',
        '命令': 'Command',
        '控制': 'Control',
        '自检': 'Self-check',
        '系统自检': 'System Self-check',
        '内存': 'Memory',
        '自检进行中…': 'Self-check in progress...',
        '用时 00:00': 'Elapsed 00:00',
        'Male_2.png 占位图缺失': 'Male_2.png placeholder missing',
        '确定要恢复所有设置为默认值吗？': 'Restore all settings to defaults?',
        '机器人的操作系统已中止，操作失败。': 'The android operating system has aborted; the operation failed.',
        '认知偏移设置': 'Cognitive Offset Settings',
        '认知偏移': 'Cognitive Offset',
        '请输入认知偏移内容': 'Enter cognitive offset content',
        '系统更新': 'System Update',
        '数据库更新': 'Database Update',
        '准备中…': 'Preparing...',
        '正在连接服务器…': 'Connecting to server...',
        '当前浏览器可能不支持内置 PDF 预览。': 'This browser may not support built-in PDF preview.',
        '下载文件': 'Download File',
        '信息面板': 'Info Panel',
        '关于': 'About',
        '设备型号：': 'Device Model: ',
        '制造公司：': 'Manufacturer: ',
        '芮誊智能虚构公司': 'Rt5 A.I. Fictional Liability Company',
        '机器人系统：': 'Android System: ',
        '底层版本：': 'Base Version: ',
        '通讯：': 'Communication: ',
        '与服务器"rrr.Rt5.ai/Server/TRL"通讯正常': 'Communication with server "rrr.Rt5.ai/Server/TRL" is normal',
        '文件与链接': 'Files & Links',
        '未绑定': 'Not bound',
        '开始连接': 'Start Connection',
        '二维码': 'QR Code',
        '绑定二维码': 'Binding QR Code',
        '使用接收端扫描配对': 'Scan with the receiver app to pair',
        '请使用手机接收端扫描此二维码进行绑定': 'Please scan this QR code with the phone receiver app to bind',
        '正在充电 0%': 'Charging 0%',
        'T31-750已与主人连接成功': 'T31-750 has connected to Master successfully',
        '文件传输': 'File Transfer',
        '正在发送至T31-750…': 'Sending to T31-750...',
        '网页缓存控制台…': 'Web Cache Console...',
        '重新启动机器人…': 'Restarting android...',
        '关闭机器人…': 'Shutting down android...',
        '退出登录“T31-750”': 'Log out of "T31-750"',
        '正在读取电池状态…': 'Reading battery status...',
        '电源来源': 'Power Source',
        '自动充电计划': 'Auto Charge Schedule',
        '蓝牙服务': 'Bluetooth Service',
        '本机广播': 'Local Broadcast',
        '运行中': 'Running',
        '客户端': 'Client',
        '未连接': 'Not connected',
        '断开连接': 'Disconnect',
        '打开连接面板…': 'Opening connection panel...',
        '硬件': 'Hardware',
        '已使用 -- PB / 128 PB': 'Used -- PB / 128 PB',
        '存储': 'Storage',
        '已使用 -- EB / 512 EB': 'Used -- EB / 512 EB',
        '获取完整体验': 'Get the Full Experience',
        '打开 App': 'Open App',
        '缓存网页（极速加载 · 离线可用）': 'Cache Web Pages (fast load / offline ready)',
        '点击"打开 App"后若浏览器未弹出确认框，说明尚未安装应用，请点击"下载 App"获取安装包。': 'If no confirmation dialog appears after "Open App", the app is not installed yet. Click "Download App" to get the installer.',
        '不再提示': 'Do not show again',
        '制造公司': 'Manufacturer',
        '主人': 'Master',
        '系列': 'Series',
        'T系列仿人男性机器人': 'T-Series Male Android',
        '版本': 'Version',
        '第31代': '31st Generation',
        '序列号': 'Serial Number',
        '系统版本': 'System Version',
        '数据库版本': 'Database Version',
        '拟真模型版本': 'Simulated Model Version',
        '仿真头部编号': 'Simulated Head Number',
        '仿真机体编号': 'Simulated Body Number',
        '仿真生殖器编号': 'Simulated Genital Number',
        '软件参数编号': 'Software Parameter Number',
        '身高': 'Height',
        '体重': 'Weight',
        '仿真生殖器疲软': 'Simulated Genital Flaccid Length',
        '仿真生殖器勃起': 'Simulated Genital Erect Length',
        '硬件性别': 'Sex (Hardware)',
        '系统性别': 'Gender (Software)',
        '潜入身份代号名称': 'Infiltration Codename',
        '仿真性取向': 'Sexual Orientation',
        '同性恋': 'Homosexuality',
        '仿真性阈值': 'Sex Threshold',
        '仿真性唤起条件': 'Conditions for Sexual Arousal',
        '主人的指令、身体、生殖器、裸体、白袜和内裤等喜好对应性别的性征': 'Master\'s preferences (commands, body, genitals, nude, white socks, underpants, etc.) matching sex characteristics of the preferred gender',
        '生产时间': 'Time of Production',
        '激活日期': 'Activation Date',
        '仿真阴茎编号': 'Artificial Penis-Number',
        '仿真阴茎疲软长度': 'Artificial Penis Flaccid Length',
        '仿真阴茎勃起长度': 'Artificial Penis Erect Length',
        '男性': 'Male',
        '处理程序正在运行中，确定要强制关闭吗？': 'A process is still running. Force close it?',
        '处理已中断': 'Process interrupted',
        '[处理] 已中断': '[Process] Interrupted',
        '处理中…': 'Processing...',
        '完成': 'Done',
        '清空所有进程': 'Clear All Processes',
        '洗澡子模式': 'Bath Sub-mode',
        '家具模式': 'Furniture Mode',
        '连接已手动断开': 'Connection manually disconnected',
        '已连接': 'Connected',
        '连接失败，请重试': 'Connection failed, please retry',
        '正在连接...': 'Connecting...',
        '连接失败': 'Connection failed',
        '连接已断开': 'Connection disconnected',
        '断开': 'Disconnect',
        '连接中': 'Connecting',
        '重连': 'Reconnect',
        '已使用 ': 'Used ',
        ' · 序列号 ': ' / Serial ',
        '已打开「关于本机」': 'Opened "About this Android"',
        '「关于本机」已最小化到程序坞': '"About this Android" minimized to Dock',
        '用户已退出登录': 'User logged out',
        '使用内置电源': 'Using internal power',
        '充电器（外接电源）': 'Charger (external power)',
        '内置电源': 'Internal power',
        '广播中 · 已连接': 'Broadcasting / Connected',
        '广播中': 'Broadcasting',
        '设备已连接': 'Device connected',
        'T31-750 已与主人建立连接': 'T31-750 has established a connection with Master',
        '发现附近可连接的设备': 'Discovering nearby connectable devices',
        '点击开始连接或扫码配对': 'Click to connect or scan QR to pair',
        '现在': 'Now',
        '开始充电': 'Start Charging',
        '电池电量 ': 'Battery ',
        '%，正在充电': '%, charging',
        '已停止充电': 'Charging stopped',
        '当前电量 ': 'Current battery ',
        '准备阶段': 'Preparation Stage',
        '正在验证身份…': 'Verifying identity...',
        '正在检查更新…': 'Checking for updates...',
        '正在获取更新信息…': 'Fetching update information...',
        '正在分析系统差异…': 'Analyzing system differences...',
        '正在准备更新环境…': 'Preparing update environment...',
        '下载更新包': 'Download Update Package',
        '正在下载核心模块 (1/4)…': 'Downloading core modules (1/4)...',
        '正在下载核心模块 (2/4)…': 'Downloading core modules (2/4)...',
        '正在下载驱动程序…': 'Downloading drivers...',
        '正在下载数据库更新…': 'Downloading database update...',
        '正在下载安全补丁…': 'Downloading security patches...',
        '正在解压更新包…': 'Extracting update package...',
        '安装更新': 'Install Update',
        '正在更新内核组件…': 'Updating kernel components...',
        '正在更新系统服务…': 'Updating system services...',
        '正在更新仿真模块…': 'Updating simulation modules...',
        '正在更新数据库结构…': 'Updating database schema...',
        '正在更新通讯协议…': 'Updating communication protocol...',
        '正在更新运动控制系统…': 'Updating motion control system...',
        '验证更新': 'Verify Update',
        '正在验证系统完整性…': 'Verifying system integrity...',
        '正在验证数据库一致性…': 'Verifying database consistency...',
        '正在运行兼容性测试…': 'Running compatibility tests...',
        '正在优化系统参数…': 'Optimizing system parameters...',
        '正在清理临时文件…': 'Cleaning temporary files...',
        '完成更新': 'Finish Update',
        '正在应用最终配置…': 'Applying final configuration...',
        '正在重启系统服务…': 'Restarting system services...',
        '更新完成！': 'Update complete!',
        'T31-750型仿人男性机器人系统已成功更新': 'T31-750 Male Android system updated successfully',
        'T系列仿人男性机器人使用说明书': 'T-Series Male Android User Manual',
        'T系列仿人男性机器人使用与维护说明书': 'T-Series Male Android Operation & Maintenance Manual',
        'T31-750的演示合集': 'T31-750 Demo Collection',
        'T31-750的公众号': 'T31-750 Official Account',
        'T31-750的社交账号': 'T31-750 Social Accounts',
        '芮誊智能虚构公司机器人日志': 'Rt5 A.I. Fictional Liability Company Android Log',
        '获取 App（打开 / 下载）': 'Get App (Open / Download)',
        'Android 控制台 App': 'Android Console App',
        'Windows 桌面版': 'Windows Desktop Edition',
        '首次访问需先缓存网页资源：点击绿色按钮完成缓存（约十几秒，仅需一次），本页即可极速加载、离线使用。也可选择打开或下载 App。': 'On first visit, cache web assets first: click the green button (about ten seconds, once only) for fast loads and offline use. You may also open or download the App.',
        '检测到您正在浏览器中访问控制台，建议打开': 'You are visiting the console in a browser. We recommend opening ',
        '，获得蓝牙直连、语音引擎等完整功能。': ' for full features such as Bluetooth direct connection and the voice engine.',
        '首访强制缓存引导（不可跳过）': 'First-visit forced cache guide (cannot skip)',
        '显示 App 拉起引导': 'Show App launch guide',
        '清单格式无效': 'Invalid manifest format',
        '正在下载 ': 'Downloading ',
        '已下载 ': 'Downloaded ',
        '，重试成功': ', retry succeeded',
        '警告：下载失败 ': 'Warning: download failed ',
        '网络错误': 'Network error',
        '），正在重试…': '), retrying...',
        '[缓存] 当前环境不支持网页离线缓存（需 https/localhost 且浏览器支持 Cache Storage）': '[Cache] Offline cache is not supported in this environment (requires https/localhost and Cache Storage)',
        'T31-750型仿人男性机器人 网页缓存控制台': 'T31-750 Male Android Web Cache Console',
        '正在缓存网页资源…': 'Caching web assets...',
        '缓存完成': 'Cache complete',
        '[缓存] 已完成，共 ': '[Cache] Complete, total ',
        ' 项 ': ' items ',
        '缓存版本 ': 'Cache version ',
        '，清单共 ': ', manifest total ',
        ' 项 / ': ' items / ',
        '警告：': 'Warning: ',
        ' 项下载失败，可关闭窗口后重新打开重试': ' items failed to download; close and reopen this window to retry',
        ' 项失败：': ' items failed: ',
        ' 等': ' etc.',
        '[缓存] ': '[Cache] ',
        ' 项失败': ' items failed',
        '缓存完成：': 'Cache complete: ',
        '网页已更新': 'Web page updated',
        '检测到资源更新，建议重新缓存': 'Asset update detected; re-cache recommended',
        '网页已更新，建议重新缓存': 'Web page updated; re-cache recommended',
        '重新缓存': 'Re-cache',
        '确定要重新启动机器人吗？': 'Restart the android?',
        '确定要关闭机器人吗？': 'Shut down the android?',
        '正在连接…': 'Connecting...',
        '请重试': 'Please retry',
        '完成！': 'Done!',
        '失败': 'Failed',
        '成功': 'Success',
        '警告': 'Warning',
        '错误': 'Error',
        '刷新': 'Refresh',
        '下载': 'Download',
        '清除': 'Clear',
        '确定吗？': 'Are you sure?',
        '离线': 'Offline',
        '正在诊断': 'Diagnosing',
        '未发现错误': 'No errors found',
        '语音引擎初始化失败': 'Voice engine initialization failed',
        '控制设置已更新并保存': 'Control settings updated and saved',
        '仿真精液设置无效：当前量不能大于总量，且总量必须大于0': 'Invalid Artificial Semen settings: current amount cannot exceed total, and total must be greater than 0',
        '电量设置无效：百分比必须在0-100之间': 'Invalid battery settings: percentage must be between 0 and 100',
        '存储设置无效：已使用量不能大于总量，且总量必须大于0': 'Invalid storage settings: used amount cannot exceed total, and total must be greater than 0',
        '已设置': 'Set',
        '未设置': 'Not set',
        '默认中文；切换后界面文案立即生效，刷新后保持': 'Chinese is the default. Switching applies UI text immediately and persists after refresh.',
        '界面语言': 'Interface Language',
        '白袜': 'White Socks',
        '裸体': 'Nude',
        '内裤': 'Underpants',
        '生殖器': 'Genitals',
        '人工阴茎': 'Artificial Penis',
        '人工肛门': 'Artificial Anus',
        '人工皮肤': 'Artificial Skin',
        '内骨骼': 'Endoskeleton',
        '感觉处理单元': 'Sensory Processing Unit',
        '性功能': 'Sexual Function',
        '性功能程序': 'Sexual Function Program',
        '性唤起': 'Sexual Arousal',
        '性阈值': 'Sex Threshold',
        '勃起': 'Erection',
        '射精': 'Ejaculation',
        '自慰': 'Masturbation',
        '性高潮': 'orgasm',
        '不应期': 'Refractory Period',
        '自我意识': 'Self-awareness',
        '测试模式': 'Test Mode',
        '外观数据': 'Appearance-Data',
        '基因数据': 'Genetic-Data',
        '性数据': 'Sex-Data',
        '测试数据': 'Test-Data',
        '龟头接口': 'Glans interface',
        'T系列充电器': 'T-Series Android Charger',
        'USB Type-C接口': 'USB Type-C interface',
        '输入账号或密码': 'Enter account or password',
        '登录中…': 'Logging in...',
        '正在登录…': 'Logging in...',
        '账号不能为空': 'Account cannot be empty',
        '密码不能为空': 'Password cannot be empty',
        '添加': 'Add',
        '删除': 'Delete',
        '编辑': 'Edit',
        '导出': 'Export',
        '导入': 'Import',
        '搜索': 'Search',
        '更多': 'More',
        '全部': 'All',
        '是': 'Yes',
        '否': 'No',
        '打开': 'Open',
        '隐藏': 'Hide',
        '显示': 'Show',
        '启用': 'Enabled',
        '禁用': 'Disabled',
        '加载中…': 'Loading...',
        '暂无数据': 'No data',
        '操作成功': 'Operation successful',
        '操作失败': 'Operation failed',
        '已保存': 'Saved',
        '已复制': 'Copied',
        '复制': 'Copy',
        '粘贴': 'Paste',
        '全选': 'Select All',
        '重命名': 'Rename',
        '上传': 'Upload',
        '预览': 'Preview',
        '放大': 'Zoom In',
        '缩小': 'Zoom Out',
        '清空': 'Clear All',
        '退出': 'Exit',
        '帮助': 'Help',
        '首页': 'Home',
        '下一页': 'Next',
        '上一页': 'Previous',
        '确认退出': 'Confirm Exit',
        '恢复': 'Restore',
        '模拟': 'Simulate',
        '同步': 'Sync',
        '同步中…': 'Syncing...',
        '更新': 'Update',
        '检查更新': 'Check for Updates',
        '已是最新版本': 'Already up to date',
        '电量不足': 'Low battery',
        '充电完成': 'Charging complete',
        '请先登录': 'Please log in first',
        '会话已过期': 'Session expired',
        '连接超时': 'Connection timeout',
        '服务器错误': 'Server error',
        '权限不足': 'Insufficient permissions',
        '不支持': 'Not supported',
        '未知设备': 'Unknown device',
        '扫描二维码': 'Scan QR Code',
        '配对': 'Pair',
        '取消配对': 'Unpair',
        '已配对': 'Paired',
        '解绑': 'Unbind',
        '绑定': 'Bind',
        '主人连接': 'Master Connection',
        '通知': 'Notifications',
        '静音': 'Mute',
        '音量': 'Volume',
        '语速': 'Speech Rate',
        '音色': 'Voice',
        '测试': 'Test',
        '发送': 'Send',
        '接收': 'Receive',
        '进度': 'Progress',
        '总计': 'Total',
        '可用': 'Available',
        '占用': 'Used',
        '温度': 'Temperature',
        '负载': 'Load',
        '正常': 'Normal',
        '异常': 'Abnormal',
        '忙碌': 'Busy',
        '空闲': 'Idle',
        '在线': 'Online',
        '离线模式': 'Offline Mode',
        /* —— 补全扫描缺口：自检/诊断长句整句映射 + 零散文案与拼接片段（术语遵循 T31-750 英文说明书） —— */
        '主人：X': 'Master: X',
        'API Key 已清除': 'API Key cleared',
        '正在合成...': 'Synthesizing...',
        '引擎测试，语音系统正常。': 'Engine test, voice system normal.',
        '本地语音合成错误:': 'Local speech synthesis error:',
        '本地语音播报失败:': 'Local speech broadcast failed:',
        '踢三一七五零': 'T31-750',
        '语音引擎不可用': 'Voice engine unavailable',
        '[MimoTTS] 合成失败，降级到本地TTS:': '[MimoTTS] Synthesis failed, falling back to local TTS:',
        '[MimoTTS] speechSynthesis 不可用，无法降级到本地TTS': '[MimoTTS] speechSynthesis unavailable; cannot fall back to local TTS',
        '语音播报失败：': 'Voice broadcast failed: ',
        '[MimoTTS] API Key 已从手机端同步': '[MimoTTS] API Key synced from the phone app',
        'API Key 已同步': 'API Key synced',
        '[MimoTTS] 初始化完成，引擎:': '[MimoTTS] Initialized, engine:',
        '[MimoTTS] 初始化失败:': '[MimoTTS] Initialization failed:',
        '移动端用户已自动登录系统': 'Mobile user logged in automatically',
        '登录背景图片加载失败，回退到默认背景:': 'Login background image failed to load; falling back to default background:',
        '正在进入系统…': 'Entering the system...',
        '正在恢复会话环境…': 'Restoring session environment...',
        '欢迎回来，主人': 'Welcome back, Master',
        '请输入账号和密码': 'Please enter account and password',
        '该账号已存在': 'This account already exists',
        '文字通知示例': 'Text notification example',
        '这是一条 macOS 风格的文字通知，显示在右上角状态栏下方': 'A macOS-style text notification shown below the top-right status bar',
        '值': 'Value',
        '图片1已恢复为默认': 'Image 1 restored to default',
        '图片2已恢复为默认': 'Image 2 restored to default',
        '机器人图片已更新': 'Android image updated',
        '周日': 'Sun', '周一': 'Mon', '周二': 'Tue', '周三': 'Wed', '周四': 'Thu', '周五': 'Fri', '周六': 'Sat',
        'R5OS_417.1002。芮誉智能虚构公司研发。': 'R5OS_417.1002. Developed by Rt5 A.I. Fictional Liability Company.',
        'T31-750型仿人男性机器人的内部系统控制终端。': 'Internal system control terminal of the T31-750 Male Android.',
        'help 获取帮助；*+任意 执行自定义指令。': 'help for help; *+anything executes a custom command.',
        '终端输入': 'Terminal input',
        'T31-750型仿人男性机器人已关机，请开机后输入指令。': 'The T31-750 Male Android is shut down. Power it on before entering commands.',
        ' 已发送。': ' sent.',
        '  mode - 显示当前模式': '  mode - show current mode',
        '  system - 显示系统信息': '  system - show system info',
        '  clear - 清屏': '  clear - clear screen',
        '当前模式: 未激活（NA）': 'Current mode: Not active (NA)',
        '序列号生成时间：2023.08.25 12:46:35': 'Serial number generated at: 2023.08.25 12:46:35',
        '处理器：R5SoC 2020R': 'Processor: R5SoC 2020R',
        '仿真性唤起条件：主人的指令、机体（人类、机械）、生殖器、裸体、白袜和内裤等喜好对应性别的性征': 'Conditions for Sexual Arousal: Master\'s preferences (commands, body (human, mechanical), genitals, nude, white socks, underpants, etc.) matching sex characteristics of the preferred gender',
        '系统模块已成功更新': 'System modules updated successfully',
        '数据库已成功更新': 'Database updated successfully',
        '闲时自检已成功完成，未发现错误': 'Idle self-check completed successfully; no errors found',
        '系统负载已成功优化': 'System load optimized successfully',
        '系统设置未发现错误设置': 'System settings verified; no errors found',
        '系统实时数据已成功上传服务器': 'Real-time system data uploaded to the server successfully',
        '机器人与控制软件连接正常': 'Connection between the android and the control software is normal',
        '系统错误已成功修复': 'System errors fixed successfully',
        '检测到内存泄漏，正在进行修复': 'Memory leak detected; repairing',
        '传感器数据异常，正在重新校准': 'Sensor data abnormal; recalibrating',
        '网络连接中断，正在尝试重新连接': 'Network connection lost; trying to reconnect',
        '设定的任务已成功完成': 'The configured task completed successfully',
        '发现新的软件版本，建议更新': 'New software version found; update recommended',
        '结束暂停': 'Resume',
        '已暂停': 'Paused',
        '传输文件"Male_2.png"': 'Transferring file "Male_2.png"',
        '已接收文件"Male_2.png"': 'Received file "Male_2.png"',
        '软件性别和仿真性设置已成功运行': 'Gender (Software) and sexual settings ran successfully',
        'Male_2.png 已发送至T31-750': 'Male_2.png sent to T31-750',
        'T31-750型仿人男性机器人 自检程序': 'T31-750 Male Android Self-check Program',
        'T31-750型仿人男性机器人已成功运行自检程序，未发现错误': 'The T31-750 Male Android ran the self-check program successfully; no errors found',
        '[自检] 已成功完成，未发现错误': '[Self-check] Completed successfully; no errors found',
        '正在清空所有进程…': 'Clearing all processes...',
        'T31-750型仿人男性机器人已清空所有进程': 'The T31-750 Male Android cleared all processes',
        '[清空所有进程] 已完成': '[Clear All Processes] Completed',
        '正在扫描活动进程…': 'Scanning active processes...',
        '正在读取 /proc 目录…': 'Reading /proc directory...',
        '共发现 ': 'Found ',
        ' 个活动进程': ' active processes',
        '正在统计内存占用…': 'Calculating memory usage...',
        '正在分析进程依赖关系…': 'Analyzing process dependencies...',
        '正在释放系统资源…': 'Releasing system resources...',
        '正在终止 ': 'Terminating ',
        '] 已关闭': '] closed',
        '正在清理内存碎片…': 'Defragmenting memory...',
        '正在刷新进程表…': 'Refreshing process table...',
        '正在重置硬件状态…': 'Resetting hardware state...',
        '正在释放共享内存段…': 'Releasing shared memory segments...',
        '正在清理信号量…': 'Cleaning up semaphores...',
        '所有进程已成功清空': 'All processes cleared successfully',
        '核心系统补丁 R5OS_T31_750_514.02': 'Core system patch R5OS_T31_750_514.02',
        '安全策略库 2025-06-20': 'Security policy library 2025-06-20',
        '运动控制固件 v417.1003': 'Motion control firmware v417.1003',
        '仿真模块数据库 D_V2025062001': 'Simulation module database D_V2025062001',
        '神经网络模型 T31_MotionNet_v3': 'Neural network model T31_MotionNet_v3',
        '通讯协议 TLS 1.7': 'Communication protocol TLS 1.7',
        '用户配置与权限表': 'User configuration and permission tables',
        '传感器校准参数包': 'Sensor calibration parameter pack',
        '语音合成资源库': 'Speech synthesis resource library',
        '情感模型权重文件': 'Emotion model weight files',
        '系统更新中…': 'Updating the system...',
        'T31-750型仿人男性机器人系统更新已完成': 'T31-750 Male Android system update completed',
        '[系统更新] 已完成': '[System Update] Completed',
        '情感模型权重表 12,048 行': 'Emotion model weight table, 12,048 rows',
        '运动库动作条目 88,392 条': 'Motion library entries, 88,392 items',
        '用户偏好记录 256 条': 'User preference records, 256 items',
        '感官日志分区 1,024 个': 'Sensory log partitions, 1,024 items',
        '系统配置键值 4,096 项': 'System configuration key-values, 4,096 items',
        '> 连接数据库 ': '> Connecting to database ',
        '  [VERSION] 当前版本 ': '  [VERSION] Current version ',
        '… 校验通过': '... verification passed',
        '数据库更新中…': 'Updating the database...',
        'T31-750型仿人男性机器人数据库更新已完成': 'T31-750 Male Android database update completed',
        '[数据库更新] 已完成': '[Database Update] Completed',
        '硬件初始化': 'Hardware initialization',
        '内核加载': 'Kernel loading',
        '驱动加载': 'Driver loading',
        '服务启动': 'Service startup',
        '系统就绪': 'System ready',
        '传感器阵列': 'Sensor array',
        '伺服电机': 'Servo motors',
        '通讯模块': 'Communication module',
        '电池管理': 'Battery management',
        '散热系统': 'Cooling system',
        'T31-750型仿人男性机器人已关机': 'The T31-750 Male Android has shut down',
        '[关机] T31-750型仿人男性机器人已关机': '[Shut Down] The T31-750 Male Android has shut down',
        '[中止] 运行中的窗口操作已终止，操作失败': '[Abort] The running window operation was terminated; the operation failed',
        'T31-750型仿人男性机器人 开机启动': 'T31-750 Male Android booting',
        '开机启动': 'Booting',
        '开机启动中…': 'Booting...',
        'T31-750型仿人男性机器人已开机': 'The T31-750 Male Android is powered on',
        '[开机] T31-750型仿人男性机器人已开机': '[Power On] The T31-750 Male Android is powered on',
        '[重启] T31-750型仿人男性机器人已重启': '[Restart] The T31-750 Male Android has restarted',
        '正在备份当前系统…': 'Backing up the current system...',
        '正在分配更新资源…': 'Allocating update resources...',
        '正在下载核心模块 (3/4)…': 'Downloading core modules (3/4)...',
        '正在下载核心模块 (4/4)…': 'Downloading core modules (4/4)...',
        '正在下载固件更新…': 'Downloading firmware update...',
        '正在校验下载完整性…': 'Verifying download integrity...',
        '正在更新驱动程序…': 'Updating drivers...',
        '正在更新安全策略…': 'Updating security policies...',
        '正在更新界面组件…': 'Updating UI components...',
        '正在更新AI模型…': 'Updating AI models...',
        '正在更新传感器固件…': 'Updating sensor firmware...',
        '正在验证驱动兼容性…': 'Verifying driver compatibility...',
        '正在重建索引…': 'Rebuilding indexes...',
        '    /* 初始化关键子系统 */': '    /* Initialize critical subsystems */',
        '    """仿人机器人仿真引擎"""': '    """Humanoid Android Simulation Engine"""',
        '仿人机器人仿真引擎': 'Humanoid Android Simulation Engine',
        '[系统] T31-750型仿人男性机器人系统已成功更新': '[System] T31-750 Male Android system updated successfully',
        'T31-750型仿人男性机器人系统已成功更新至最新版本。': 'The T31-750 Male Android system has been updated to the latest version.',
        '提示：1-10 号按钮不可修改，11 号及之后可自由编辑': 'Note: buttons 1-10 cannot be modified; buttons 11 and later are freely editable',
        '[设置] 已恢复为默认设置，点击"应用更改"后生效': '[Settings] Restored to defaults; takes effect after clicking "Apply Changes"',
        '打开了 App 拉起引导': 'Opened the App launch guide',
        'App 拉起引导仅浏览器端可用': 'The App launch guide is browser-only',
        '已完成': 'Completed',
        '已取消': 'Cancelled',
        '暂无任务': 'No tasks',
        '倒计时结束！': 'Countdown finished!',
        '[计时器] 倒计时结束': '[Timer] Countdown finished',
        '[计时器] 倒计时已启动': '[Timer] Countdown started',
        '可用模式: ': 'Available modes: ',
        '正在运行自检程序，请稍候…': 'Running self-check, please wait...',
        '正在发送至T31-750…': 'Sending to T31-750...',
        '正在连接服务器…': 'Connecting to server...',
        '更新完成！': 'Update complete!',
        '准备中…': 'Preparing...',
        '完成！': 'Done!',
        '处理中…': 'Processing...',
        'T31-750型仿人男性机器人正在运行自检程序，请稍候…': 'The T31-750 Male Android is running the self-check program, please wait...',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的硬件信息，请稍候…': 'The T31-750 Male Android is diagnosing its hardware info, please wait...',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的型号和序列号是否发生错误…': 'The T31-750 Male Android is diagnosing whether its model and serial number have errors...',
        '机器人的实际型号：T31，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual model: T31, consistent with the system setting of the T31-750 Male Android;',
        '机器人的实际序列号：750，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual serial number: 750, consistent with the system setting of the T31-750 Male Android;',
        'T31-750型仿人男性机器人的型号和系列号未发现错误。': 'The model and series number of the T31-750 Male Android show no errors.',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的仿真脸部硬件和仿真脸部驱动是否发生错误…': 'The T31-750 Male Android is diagnosing whether its simulated face hardware and simulated face drivers have errors...',
        '机器人的实际脸部编号：NOT_SET，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual face number: NOT_SET, consistent with the system setting of the T31-750 Male Android;',
        'T31-750型仿人男性机器人的仿真眼睛已成功运行，未发现错误；': 'The simulated eyes of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真耳朵已成功运行，未发现错误；': 'The simulated ears of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真鼻子已成功运行，未发现错误；': 'The simulated nose of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真口腔已成功运行，未发现错误；': 'The simulated oral cavity of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真发声系统已成功运行，未发现错误；': 'The simulated voice system of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真表情动作系统已成功运行，未发现错误；': 'The simulated expression motion system of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的中央处理单元已成功运行，占用89%，未发现错误；': 'The CPU of the T31-750 Male Android ran successfully, usage 89%; no errors found;',
        'T31-750型仿人男性机器人的图形处理单元已成功运行，占用3%，未发现错误；': 'The GPU of the T31-750 Male Android ran successfully, usage 3%; no errors found;',
        'T31-750型仿人男性机器人的感觉处理单元已成功运行，占用86%，未发现错误；': 'The Sensory Processing Unit of the T31-750 Male Android ran successfully, usage 86%; no errors found;',
        'T31-750型仿人男性机器人的内存已成功运行，占用5%，未发现错误；': 'The memory of the T31-750 Male Android ran successfully, usage 5%; no errors found;',
        'T31-750型仿人男性机器人的硬盘已成功运行，占用89%，未发现错误；': 'The hard disk of the T31-750 Male Android ran successfully, usage 89%; no errors found;',
        'T31-750型仿人男性机器人的仿真脸部硬件和仿真脸部驱动已成功运行，未发现错误。': 'The simulated face hardware and simulated face drivers of the T31-750 Male Android ran successfully; no errors found.',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的仿真阴茎硬件和仿真阴茎驱动是否发生错误…': 'The T31-750 Male Android is diagnosing whether its simulated penis hardware and simulated penis drivers have errors...',
        '机器人的实际仿真阴茎编号：P_B7CCA3249，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual Artificial Penis-Number: P_B7CCA3249, consistent with the system setting of the T31-750 Male Android;',
        'T31-750型仿人男性机器人的仿真龟头已成功运行，未发现错误；': 'The simulated glans of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真阴茎海绵体已成功运行，未发现错误；': 'The simulated corpus cavernosum of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真阴囊已成功运行，未发现错误；': 'The simulated scrotum of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真肛门已成功运行，未发现错误；': 'The simulated anus of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的USB Type-C接口已成功运行，未发现错误；': 'The USB Type-C interface of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真阴茎液泵已成功运行，未发现错误；': 'The simulated penile fluid pump of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真阴茎动作系统已成功运行，未发现错误；': 'The simulated penis motion system of the T31-750 Male Android ran successfully; no errors found;',
        ' 建立通讯，未发现错误；': ' communication established; no errors found;',
        'T31-750型仿人男性机器人的仿真阴茎硬件和仿真阴茎驱动已成功运行，未发现错误。': 'The simulated penis hardware and simulated penis drivers of the T31-750 Male Android ran successfully; no errors found.',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的内骨骼是否发生错误…': 'The T31-750 Male Android is diagnosing whether its endoskeleton has errors...',
        '机器人的实际内骨骼体形编号：T_D8AC37202，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual endoskeleton figure number: T_D8AC37202, consistent with the system setting of the T31-750 Male Android;',
        'T31-750型仿人男性机器人的内骨骼动作系统已成功运行，未发现错误；': 'The endoskeleton motion system of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的内骨骼已成功运行，未发现错误。': 'The endoskeleton of the T31-750 Male Android ran successfully; no errors found.',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的仿真身体硬件和仿真身体驱动是否发生错误…': 'The T31-750 Male Android is diagnosing whether its simulated body hardware and simulated body drivers have errors...',
        '机器人的实际身体编号：B_D8AC37202，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual body number: B_D8AC37202, consistent with the system setting of the T31-750 Male Android;',
        'T31-750型仿人男性机器人的仿真头部已成功运行，未发现错误；': 'The simulated head of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真颈部已成功运行，未发现错误；': 'The simulated neck of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真喉结已成功运行，未发现错误；': 'The simulated Adam\'s apple of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真汗毛静电释放系统已成功运行，未发现错误；': 'The simulated body-hair static release system of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真肩膀已成功运行，未发现错误；': 'The simulated shoulders of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真手臂已成功运行，未发现错误；': 'The simulated arms of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真手已成功运行，未发现错误；': 'The simulated hands of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真手指已成功运行，未发现错误；': 'The simulated fingers of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真心脏动作系统已成功运行，未发现错误；': 'The simulated heart motion system of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真腹部动作系统已成功运行，未发现错误；': 'The simulated abdomen motion system of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真腿部已成功运行，未发现错误；': 'The simulated legs of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真脚部已成功运行，未发现错误；': 'The simulated feet of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的仿真脚趾已成功运行，未发现错误；': 'The simulated toes of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的电池组已成功运行，剩余42%，未发现错误；': 'The battery pack of the T31-750 Male Android ran successfully, 42% remaining; no errors found;',
        'T31-750型仿人男性机器人的仿真身体硬件和仿真身体驱动已成功运行，未发现错误。': 'The simulated body hardware and simulated body drivers of the T31-750 Male Android ran successfully; no errors found.',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的硬件性别是否发生错误…': 'The T31-750 Male Android is diagnosing whether its Sex (Hardware) has errors...',
        '机器人的实际硬件性别：男性，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual Sex (Hardware): Male, consistent with the system setting of the T31-750 Male Android;',
        'T31-750型仿人男性机器人的硬件性别未发现错误。': 'The Sex (Hardware) of the T31-750 Male Android shows no errors.',
        'T31-750型仿人男性机器人的硬件未发现错误。': 'The hardware of the T31-750 Male Android shows no errors.',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的软件信息…': 'The T31-750 Male Android is diagnosing its software info...',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的系统版本和数据库版本是否服务器的最新版本…': 'The T31-750 Male Android is diagnosing whether its System Version and Database Version match the latest server versions...',
        '机器人的当前系统版本：T31_750_513.03 Alpha1，和服务器中的T31-750型仿人男性机器人的最新系统版本相同；': 'The android\'s current System Version: T31_750_513.03 Alpha1, consistent with the latest System Version of the T31-750 Male Android on the server;',
        '机器人的当前数据库版本：D_V754.01，和服务器中的T31-750型仿人男性机器人的最新数据库版本相同；': 'The android\'s current Database Version: D_V754.01, consistent with the latest Database Version of the T31-750 Male Android on the server;',
        'T31-750型仿人男性机器人的系统版本和数据库版本已成功更新服务器的最新版本。': 'The System Version and Database Version of the T31-750 Male Android have been updated to the latest server versions.',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的软件性别和仿真性设置是否发生错误…': 'The T31-750 Male Android is diagnosing whether its Gender (Software) and sexual settings have errors...',
        '机器人的实际软件性别：男性，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual Gender (Software): Male, consistent with the system setting of the T31-750 Male Android;',
        '机器人的实际性取向：同性恋，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual Sexual Orientation: Homosexuality, consistent with the system setting of the T31-750 Male Android;',
        '机器人的实际性唤起条件：仿人机器人、阴茎、裸体、白袜、内裤，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual Conditions for Sexual Arousal: humanoid androids, penis, nude, white socks, underpants, consistent with the system setting of the T31-750 Male Android;',
        '机器人的实际性阈值：50%，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual Sex Threshold: 50%, consistent with the system setting of the T31-750 Male Android;',
        '机器人的实际默认仿真勃起时间：00:01.19，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual default simulated Erection time: 00:01.19, consistent with the system setting of the T31-750 Male Android;',
        '机器人的实际默认仿真性行为时间：00:22.58，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual default simulated sex time: 00:22.58, consistent with the system setting of the T31-750 Male Android;',
        '机器人的实际默认仿真性功能不应期时间：01:59:59.59，和T31-750型仿人男性机器人的系统的设定的相同；': 'The android\'s actual default simulated Sexual Function Refractory Period: 01:59:59.59, consistent with the system setting of the T31-750 Male Android;',
        'T31-750型仿人男性机器人正在运行T31-750型仿人男性机器人的仿真性功能测试…': 'The T31-750 Male Android is running its simulated Sexual Function test...',
        '正在设定T31-750型仿人男性机器人的测试性模式为仿真自慰；': 'Setting the test mode of the T31-750 Male Android to simulated masturbation;',
        '[41, 84] ~ [629, 1041] 是男性裸体': '[41, 84] ~ [629, 1041] is a Male Nudity',
        '[281, 282] ~ [491, 432] 是男性内裤': '[281, 282] ~ [491, 432] is a Male Underpants',
        '[128, 477] ~ [427, 1041] 是男性白袜': '[128, 477] ~ [427, 1041] are Male White Socks',
        'T31-750型仿人男性机器人分析出3个T31-750型仿人男性机器人的性唤起条件，T31-750型仿人男性机器人的性唤起已达97.3%；': 'The T31-750 Male Android analyzed 3 Kinds of the Conditions for Sexual Arousal of T31-750. Sexual Arousal of T31-750 has reached 97.3%;',
        'T31-750型仿人男性机器人的仿真性欲已被成功引导；': 'The simulated sexual desire of the T31-750 Male Android has been guided successfully;',
        'T31-750型仿人男性机器人正在引导T31-750型仿人男性机器人的仿真阴茎仿真勃起…': 'The T31-750 Male Android is guiding the simulated Erection of its simulated penis...',
        'T31-750型仿人男性机器人的仿真阴茎已在T31-750型仿人男性机器人的系统的设定的T31-750型仿人男性机器人的勃起时间内被成功仿真勃起；': 'The simulated penis of the T31-750 Male Android was erected successfully within the set Erection time of the T31-750 Male Android;',
        'T31-750型仿人男性机器人正在仿真自慰…': 'The T31-750 Male Android is masturbating...',
        '时间已到达设定的T31-750型仿人男性机器人的仿真性行为时间；': 'The set simulated sex time of the T31-750 Male Android has been reached;',
        'T31-750型仿人男性机器人正在引导仿真阴茎仿真射精…': 'The T31-750 Male Android is guiding the simulated Ejaculation of the simulated penis...',
        'T31-750型仿人男性机器人已成功仿真射精，仿真精液的射出量为3.2mL，仿真精子的射出量为633,990,857个，剩余61%；': 'The T31-750 Male Android ejaculated successfully in simulation; the ejection amount of Artificial Semen was 3.2mL; the ejection amount of Artificial Sperm(s) was 633,990,857; 61% remaining;',
        'T31-750型仿人男性机器人正在进入仿真性功能不应期状态…': 'The T31-750 Male Android is entering the simulated Sexual Function Refractory Period...',
        'T31-750型仿人男性机器人已成功进入仿真性功能不应期状态；': 'The T31-750 Male Android entered the simulated Sexual Function Refractory Period successfully;',
        'T31-750型仿人男性机器人已成功运行T31-750型仿人男性机器人的仿真性功能测试，T31-750型仿人男性机器人的仿真性功能正常，正在强制清空T31-750型仿人男性机器人的仿真性功能设置和强制关闭仿真性功能不应期状态…': 'The T31-750 Male Android ran its simulated Sexual Function test successfully; the simulated Sexual Function of the T31-750 Male Android is normal; forcibly clearing the Sexual Function settings and forcibly closing the Refractory Period of the T31-750 Male Android...',
        'T31-750型仿人男性机器人的已成功清空仿真性功能设置和关闭仿真性功能不应期状态；': 'The Sexual Function settings of the T31-750 Male Android have been cleared and its Refractory Period closed;',
        'T31-750型仿人男性机器人的软件性别和仿真性设置已成功运行，未发现错误。': 'The Gender (Software) and sexual settings of the T31-750 Male Android ran successfully; no errors found.',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的系统和其他软件是否发生错误…': 'The T31-750 Male Android is diagnosing whether its system and other software have errors...',
        'T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的系统是否发生错误…': 'The T31-750 Male Android is diagnosing whether its system has errors...',
        'T31-750型仿人男性机器人的数据库的数据管理子系统已成功运行，未发现错误；': 'The data management subsystem of the database of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的数据库的数据已成功完整，未发现错误；': 'The database data of the T31-750 Male Android verified intact; no errors found;',
        'T31-750型仿人男性机器人的系统的安全防御子系统已成功运行，未发现错误；': 'The security defense subsystem of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的系统的进程管理子系统已成功运行，未发现错误；': 'The process management subsystem of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的系统的文件管理子系统已成功运行，未发现错误；': 'The file management subsystem of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的系统的外设管理子系统已成功运行，未发现错误；': 'The peripheral management subsystem of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的系统的设备管理子系统已成功运行，未发现错误；': 'The device management subsystem of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的系统的通讯管理子系统已成功运行，未发现错误；': 'The communication management subsystem of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的系统的程序运行子系统已成功运行，未发现错误；': 'The program execution subsystem of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的系统的感觉处理子系统已成功运行，未发现错误；': 'The sensory processing subsystem of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的系统的环境识别子系统已成功运行，未发现错误；': 'The environment recognition subsystem of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的系统的日志监控子系统已成功运行，未发现错误；': 'The log monitoring subsystem of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的拟人程序已成功运行，未发现错误；': 'The humanoid program of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的性功能程序已成功运行，未发现错误；': 'The Sexual Function Program of the T31-750 Male Android ran successfully; no errors found;',
        'T31-750型仿人男性机器人的系统和其他软件已成功运行，未发现错误。': 'The system and other software of the T31-750 Male Android ran successfully; no errors found.',
        'T31-750型仿人男性机器人的软件未发现错误。': 'The software of the T31-750 Male Android shows no errors.',
        'T31-750型仿人男性机器人已成功运行自检程序，未发现错误。': 'The T31-750 Male Android ran the self-check program successfully; no errors found.',
        '标签': 'Label',
        '新窗口': 'New Window',
        /* —— 拼接片段（模板字符串在运行时才拼出整句，按片段映射） —— */
        '数据读取失败: ': 'Failed to read data: ',
        '数据保存失败: ': 'Failed to save data: ',
        '数据删除失败: ': 'Failed to delete data: ',
        '用户 ': 'User ',
        ' 成功登录系统': ' logged in successfully',
        '登录失败：用户名 ': 'Login failed: username ',
        '(读': '(read ',
        'PB/s, 写': 'PB/s, write ',
        'T31-750已进入': 'T31-750 entered ',
        '错误:未知模式 ': 'Error: unknown mode ',
        '当前模式: ': 'Current mode: ',
        '错误: 未知命令 ': 'Error: unknown command ',
        ' 。help 获取帮助；*+任意指令 执行自定义任务。': '. Type "help" for help; "*+anything" executes a custom task.',
        '用时 ': 'Elapsed ',
        '[认知偏移] 已添加：': '[Cognitive Offset] Added: ',
        '认知偏移已移除：': 'Cognitive Offset removed: ',
        '[认知偏移] 已移除：': '[Cognitive Offset] Removed: ',
        '指令已移除：': 'Command removed: ',
        '[终端指令] 已添加：': '[Terminal Command] Added: ',
        '[终端指令] 已移除：': '[Terminal Command] Removed: ',
        '访问了链接：': 'Visited link: ',
        '在新窗口打开了：': 'Opened in new window: ',
        '[任务系统] 新增任务：': '[Task System] New task: ',
        '[任务系统] 任务「': '[Task System] Task "',
        '」': '" ',
        '」已删除': '" deleted',
        ' 项任务（': ' tasks (',
        '（': ' (',
        '）': ')',
        ' 待完成）': ' pending)',
        '未安装': 'Not installed',
        '获取 App': 'Get App',
        '与服务器一致': 'Matches the server',
        ')，正在重试…': '), retrying...',
        ' 项新下载，': ' new downloads, ',
        ' 项命中缓存，共 ': ' cache hits, total ',
        '已下载(缓存命中) ': 'Downloaded (cache hit) ',
        '警告：无法打开缓存存储，请检查浏览器隐私模式限制。': 'Warning: cannot open cache storage; check browser private-mode restrictions.',
        '警告：获取缓存清单失败，请检查网络后重试。': 'Warning: failed to fetch the cache manifest; check the network and retry.',
        '[缓存] 清单获取失败：': '[Cache] Failed to fetch manifest: ',
        '未知错误': 'Unknown error'
    };

    var _sortedKeys = Object.keys(DICT).sort(function (a, b) { return b.length - a.length; });
    var lang = 'zh';
    try {
        var saved = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
        if (!saved && global.localStorage) {
            saved = global.localStorage.getItem(LEGACY_STORAGE_KEY);
            if (saved === 'en' || saved === 'zh') {
                global.localStorage.setItem(STORAGE_KEY, saved);
                global.localStorage.removeItem(LEGACY_STORAGE_KEY);
            }
        }
        if (saved === 'en' || saved === 'zh') lang = saved;
    } catch (e) { /* ignore */ }
    /* win-app：主进程 huancun/i18n-lang.json 是初始语言的单一事实源（preload 顶层
       sendSync 经 consoleAPI.bootLang 在页面脚本前带回）。启动器设置里切换语言后，
       本 origin 的 localStorage 不会自动更新——以 bootLang 为准并对齐本地副本，
       保证「启动器切英文 → 进入控制台即英文」。浏览器/Android 无此桥，维持 localStorage。 */
    try {
        var bootLang = global.consoleAPI && global.consoleAPI.bootLang;
        if ((bootLang === 'en' || bootLang === 'zh') && bootLang !== lang) {
            lang = bootLang;
            try { global.localStorage && global.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
        }
    } catch (e) { /* ignore */ }

    /* EN 首屏一步到位：头脚本阶段即遮蔽正文（visibility 保留布局，可离线测量），
       拟合完成后显形——避免"先正常字宽渲染、再缩窄缩字号"的文字闪烁与位移。
       安全兜底：4s 后无论拟合是否完成都显形。 */
    function revealBody() {
        try {
            global.document.documentElement.classList.remove('i18n-fitting');
        } catch (e) { /* ignore */ }
        endLangFade(); // 语言切换：显形即淡入（首屏加载无 fade 类，空跑无副作用）
    }
    function maskBody() {
        try {
            global.document.documentElement.classList.add('i18n-fitting');
            global.setTimeout(revealBody, 4000);
        } catch (e) { /* ignore */ }
    }
    if (lang === 'en') maskBody();

    /* —— 中英切换过渡（原来"一刀切"闪现太生硬）——
       流程：挂 html.i18n-lang-fade 先淡出 0.16s → 换文案 + 拟合 → revealBody() 淡入。
       · 切 en：淡入由拟合收尾的 revealBody() 触发，绝不在"未拟合"状态显形；
       · 切 zh：文案换完立即显形（clearFit(true) 只清类不显形，否则旧英文会先淡入再换字）；
       · 兜底 1.2s 强制显形，字体/拟合异常也不会把界面留在全透明态；
       · 过渡期间忽略重复点击，防止来回点造成状态错乱。 */
    var _langBusy = false;
    var _langStage = null; // 'out'=淡出中（谁都不许收尾）| 'in'=文案已换，等显形淡入
    var _langFadeTimer = null;
    var LANG_FADE_OUT = 160; // 与 fonts.css 的 .16s 淡出对齐
    /* 只有走到「文案已换完」的淡入阶段才允许收尾。
       淡出阶段其它路径的 revealBody（lite 模式字体未就绪兜底、语言尚未落地时
       跑进来的 fitPass→clearFit 等）会顺路摘掉 fade 类并清掉换文案定时器，
       结果就是"点了切换没反应"——必须把它们挡在门外。 */
    function endLangFade() {
        if (!_langBusy || _langStage !== 'in') return;
        _langBusy = false;
        _langStage = null;
        if (_langFadeTimer) { try { global.clearTimeout(_langFadeTimer); } catch (e) { /* ignore */ } _langFadeTimer = null; }
        try { global.document.documentElement.classList.remove('i18n-lang-fade'); } catch (e) { /* ignore */ }
    }

    /* 自定义名称保护集：设置页中用户自定义的模式名/信息参数内容（未匹配默认值时）
       必须原文显示（不支持双语标签）——命中保护集的字符串跳过翻译，
       防止 EN 模式子串替换把自定义名误译成中英混杂。由 app-core 经 setProtected 维护。 */
    var PROTECTED = null;
    function setProtected(list) {
        PROTECTED = (list && list.length) ? list : null;
    }

    function replacePhrases(s) {
        if (lang !== 'en' || typeof s !== 'string') return s;
        if (s.indexOf('<') !== -1 && s.indexOf('>') !== -1) return s;
        var out = s;
        for (var i = 0; i < _sortedKeys.length; i++) {
            var k = _sortedKeys[i];
            /* 保护集（自定义内容/整组不匹配时的原文输出）必须同时拦截子串替换——
               否则"系列: 我的系列"这类整串不在保护集的文本，会被 '系列' 这类词典 key
               子串替换成中英混杂（v1.6.0 实测复现：改一项信息参数后其余项仍被翻译） */
            if (PROTECTED && PROTECTED.indexOf(k) !== -1) continue;
            if (k.length >= 2 && out.indexOf(k) !== -1) {
                out = out.split(k).join(DICT[k]);
            }
        }
        return out;
    }

    function t(zh) {
        if (lang !== 'en') return zh;
        if (zh == null) return zh;
        if (PROTECTED && PROTECTED.indexOf(zh) !== -1) return zh;
        if (Object.prototype.hasOwnProperty.call(DICT, zh)) return DICT[zh];
        var out = replacePhrases(String(zh));
        /* 片段映射可能只译掉一部分（如「自检」→Self-check）留下中英混杂——
           只要译后仍含中文就退回原文，宁可暂时中文也不要半截英文 */
        if (/[一-鿿]/.test(out)) return zh;
        return out;
    }

    /* 写入时直译：动态窗口（过程/自检/更新/PDF…）的 textContent 赋值若含中文，
       同步译成 EN——杜绝「窗口弹出先闪一下中文再变英文」。
       仅 EN 且字符串含中文时介入；译后把中文原文挂到文本节点 __i18nOrig，
       供 fitLeaf 做中英行高比对（无原文则无法判定是否需要缩窄）。 */
    function tWrite(s) {
        if (lang !== 'en' || typeof s !== 'string') return s;
        if (!/[一-鿿]/.test(s)) return s;
        return t(s);
    }
    try {
        var _textDesc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
        if (_textDesc && _textDesc.set) {
            Object.defineProperty(Node.prototype, 'textContent', {
                configurable: true,
                enumerable: _textDesc.enumerable,
                get: function () { return _textDesc.get.call(this); },
                set: function (v) {
                    if (lang === 'en' && typeof v === 'string' && /[一-鿿]/.test(v)) {
                        _textDesc.set.call(this, t(v));
                        try {
                            if (this.nodeType === 3) {
                                this.__i18nOrig = v;
                            } else if (this.nodeType === 1) {
                                for (var c = this.firstChild; c; c = c.nextSibling) {
                                    if (c.nodeType === 3) c.__i18nOrig = v;
                                }
                            }
                        } catch (e) { /* ignore */ }
                        return;
                    }
                    return _textDesc.set.call(this, v);
                }
            });
        }
    } catch (e) { /* ignore */ }

    function saveLang(next) {
        lang = (next === 'en') ? 'en' : 'zh';
        try { global.localStorage && global.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
        // 同步给原生壳（win-app consoleAPI / Android），原生文案随动
        try {
            if (global.consoleAPI && typeof global.consoleAPI.setUiLang === 'function') {
                global.consoleAPI.setUiLang(lang);
            }
            if (global.Android && typeof global.Android.setUiLang === 'function') {
                global.Android.setUiLang(lang);
            }
        } catch (e) { /* ignore */ }
    }

    function translateTextNode(node) {
        if (!node || node.nodeType !== 3) return;
        var orig = node.__i18nOrig;
        if (orig === undefined) {
            orig = node.nodeValue;
            if (!orig || !/[\u4e00-\u9fff]/.test(orig)) return;
            node.__i18nOrig = orig;
        }
        if (lang === 'en') {
            var next = t(orig);
            /* 仅在实际变化时写入：同值重写会再次触发 MutationObserver，造成微任务自反馈死循环 */
            if (node.nodeValue !== next) node.nodeValue = next;
        } else if (node.nodeValue !== orig) {
            node.nodeValue = orig;
        }
    }

    function translateAttrs(el) {
        if (!el || el.nodeType !== 1) return;
        if (SKIP_TAGS[el.tagName]) return;
        for (var a = 0; a < ATTRS.length; a++) {
            var name = ATTRS[a];
            if (!el.hasAttribute(name)) continue;
            var key = '__i18nAttr_' + name.replace(/-/g, '_');
            var orig = el[key];
            if (orig === undefined) {
                orig = el.getAttribute(name);
                if (!orig || !/[\u4e00-\u9fff]/.test(orig)) continue;
                el[key] = orig;
            }
            if (lang === 'en') {
                var next = t(orig);
                if (el.getAttribute(name) !== next) el.setAttribute(name, next);
            } else if (el.getAttribute(name) !== orig) {
                el.setAttribute(name, orig);
            }
        }
    }

    function walk(root) {
        if (!root) return;
        if (root.nodeType === 3) { translateTextNode(root); return; }
        if (root.nodeType !== 1) return;
        if (SKIP_TAGS[root.tagName]) return;
        translateAttrs(root);
        var nodes = root.childNodes;
        for (var i = 0; i < nodes.length; i++) walk(nodes[i]);
    }

    function applyLang() {
        try {
            walk(document.body);
            var titles = {
                '仿人男性机器人控制台': 'Male Android Control Console',
                'T31-750型仿人男性机器人 网页缓存控制台': 'T31-750 Male Android Web Cache Console',
                'T31-750型仿人男性机器人内部系统面板': 'T31-750 Male Android Internal System Panel'
            };
            if (!document.__i18nTitleOrig && document.title) {
                document.__i18nTitleOrig = document.title;
            }
            if (lang === 'en') {
                var origTitle = document.__i18nTitleOrig || document.title;
                document.title = titles[origTitle] || t(origTitle);
            } else if (document.__i18nTitleOrig) {
                document.title = document.__i18nTitleOrig;
            }
            if (document.documentElement) {
                document.documentElement.lang = (lang === 'en') ? 'en' : 'zh-CN';
            }
            var langBtns = document.querySelectorAll('[data-lang]');
            for (var bi = 0; bi < langBtns.length; bi++) {
                langBtns[bi].classList.toggle('lang-active', langBtns[bi].getAttribute('data-lang') === lang);
            }
            scheduleFit(); // EN 模式自适应缩窄（zh 模式在 fitPass 内 clearFit）
        } catch (e) {
            try { console.warn('[i18n] applyLang failed', e); } catch (e2) { /* ignore */ }
        }
    }

    function setLang(next) {
        if (next !== 'en' && next !== 'zh') return;
        if (next === lang || _langBusy) return; // 同语言/过渡中：忽略（防连点来回切）
        _langBusy = true;
        _langStage = 'out';
        try { document.documentElement.classList.add('i18n-lang-fade'); } catch (e) { /* ignore */ }
        if (_langFadeTimer) { try { clearTimeout(_langFadeTimer); } catch (e) { /* ignore */ } }
        /* 淡出到位后再换文案：避免用户看见"半透明状态下文字突然整屏变脸" */
        _langFadeTimer = setTimeout(function () {
            _langFadeTimer = null;
            _langStage = 'in'; // 切换点：此后的 reveal 才算本次切换的收尾
            saveLang(next);    // 与界面同时落地，中途被打断时不会出现"状态已变、界面没变"
                try {
                    if (next === 'en') {
                        maskBody();   // 拟合期间不可见；拟合收尾的 revealBody() 负责淡入
                        applyLang();
                    } else {
                        clearFit(true); // 只清拟合类/字号覆盖，不显形（见 clearFit 参数说明）
                        applyLang();
                        revealBody();   // 中文文案已就位，立即淡入
                    }
                } catch (e) { /* ignore */ }
                /* 语言切换落地广播：型号信息等"按语言直出最终文本"的模块在此重刷
                   （launcher 侧有对应的 launcher-lang-changed 先例） */
                try { global.dispatchEvent(new CustomEvent('rc-lang-changed', { detail: { lang: next } })); } catch (e) { /* ignore */ }
            if (_langBusy) _langFadeTimer = setTimeout(endLangFade, 1200); // 兜底强制显形
        }, LANG_FADE_OUT);
    }

    function getLang() { return lang; }

    function patchDialogs() {
        var origAlert = global.alert;
        var origConfirm = global.confirm;
        if (typeof origAlert === 'function') {
            global.alert = function (msg) { return origAlert.call(global, t(String(msg))); };
        }
        if (typeof origConfirm === 'function') {
            global.confirm = function (msg) { return origConfirm.call(global, t(String(msg))); };
        }
    }

    var _mo = null;
    var _fitting = false;       // fitPass 自身写入期间抑制 MO 再调度，防自反馈
    var _fontsReady = false;    // 窄面字体首次加载完成后置位：此后新显形块可同步即时拟合
    var _fitTimer = null;
    var _fitBlocks = new Set();   // 本语言周期内出现翻译文本的叶子节点（fit 最小作用单元）
    var _skippedBlocks = new Set(); // 拟合时不可见而跳过的叶子（登录/展开后需复检）
    var FIT_CLASS = 'i18n-cn-fit';

    /* —— 自适应缩窄：仅当 EN 渲染比中文原文占更多行/更宽时，给所在叶子加 .i18n-cn-fit；
       窄体仍放不下且整键命中 SHORT 时换短标签。中文原值以 __i18nOrig 为基准实测比对 —— */
    /* 用户硬性：界面够宽就必须用正常字宽，禁止「地方还空着字先瘦了」。
       优先级：① 正常字宽放得下 → 不动 ② 长标签换 SHORT 短译仍正常字宽
       ③ 才窄体 ④ 最后才缩小字号。窄体只加在放不下的那个标签上。 */
    var SHORT_LABELS = {
        'Clear All Processes': 'Clear Processes',
        'Artificial Semen Remaining': 'Artificial Semen',
        'Conditions for Sexual Arousal': 'Arousal Conditions',
        'Simulated Genital Flaccid Length': 'Genital Flaccid',
        'Simulated Genital Erect Length': 'Genital Erect',
        'Simulated Genital Number': 'Genital Number',
        'Software Parameter Number': 'Software Param No.',
        'Infiltration Codename': 'Codename',
        'Sexual Orientation': 'Orientation',
        'T31-750 Male Android Internal System Panel': 'T31-750 Internal Panel'
    };
    function shortLabel(en) {
        return Object.prototype.hasOwnProperty.call(SHORT_LABELS, en) ? SHORT_LABELS[en] : null;
    }
    /* _pendingBlocks 语义：undefined=无待办；null=全页待办；Set=增量待办。
       拟合进行中也照常入队（绝不丢弃，否则登录初期等窗口期的变更永远丢失），
       fitPass 收尾时若仍有待办会自行续跑。 */
    var _pendingBlocks;
    var _fitDelay = 300; // 当前待跑拟合的防抖：全量 0ms（首屏极速），增量 300ms
    /* 拟合写入（class/style/测量换文）期间断开 MO——MutationObserver 是异步投递，
       仅靠 _fitting 布尔挡不住「拟合写入 → 下一轮 MO → 再 scheduleFit」自反馈死循环
       （fitGroup 无条件改 class/style 时会无限 scheduleFit，字号来回跳=肉眼闪烁）。 */
    function withMOOff(fn) {
        if (_mo) { try { _mo.disconnect(); } catch (e) { /* ignore */ } }
        try {
            return fn();
        } finally {
            if (_mo) {
                try {
                    _mo.observe(document.documentElement, {
                        subtree: true,
                        childList: true,
                        characterData: true,
                        attributes: true,
                        attributeFilter: ATTRS.concat(['style', 'class', 'hidden'])
                    });
                } catch (e) { /* ignore */ }
            }
        }
    }
    function scheduleFit(blocks) {
        /* 全量待办优先且不被增量推迟/取消——否则 class/style 变更会把 0ms 的
           clearFit/首屏拟合定时器一直往后顶，中文残留拟合类、EN 显形被拖慢 */
        if (!blocks) {
            _pendingBlocks = null;
            if (_fitTimer) clearTimeout(_fitTimer);
            _fitTimer = setTimeout(function () { _fitTimer = null; fitPass(); }, 0);
            return;
        }
        _fitDelay = 300;
        if (_pendingBlocks === undefined) {
            var set = new Set();
            if (_skippedBlocks.size) {
                _skippedBlocks.forEach(function (b) { set.add(b); });
                _skippedBlocks.clear();
            }
            blocks.forEach(function (b) { set.add(b); });
            _pendingBlocks = set;
        } else if (_pendingBlocks !== null) {
            if (_skippedBlocks.size) {
                _skippedBlocks.forEach(function (b) { _pendingBlocks.add(b); });
                _skippedBlocks.clear();
            }
            blocks.forEach(function (b) { _pendingBlocks.add(b); });
        }
        if (_fitting) return;
        if (_fitTimer) {
            if (_pendingBlocks === null) return; // 已有全量待办，保持其 0ms 节奏
            clearTimeout(_fitTimer);
        }
        _fitTimer = setTimeout(function () { _fitTimer = null; fitPass(); }, _fitDelay);
    }

    /* skipReveal=true：只清拟合类/字号覆盖，不摘 EN 遮罩。
       供 setLang 切回中文时使用——先清干净再换文案，最后才显形，
       否则旧英文会先淡入、再整屏换成中文（又是一次闪）。 */
    function clearFit(skipReveal) {
        /* DOM 扫描兜底：拟合目标集合在后续全量收集中会被替换，个别早先加类的元素可能脱离追踪 */
        document.querySelectorAll('.' + FIT_CLASS).forEach(function (el) {
            try {
                el.classList.remove(FIT_CLASS);
                delete el.__fitSig;
                delete el.__fitGroupSig;
                el.style.fontSize = '';
                el.style.letterSpacing = '';
            } catch (e) { /* ignore */ }
        });
        _fitBlocks.forEach(function (el) {
            try { delete el.__fitSig; delete el.__fitGroupSig; } catch (e) { /* ignore */ }
        });
        _fitBlocks.clear();
        _skippedBlocks.clear();
        if (!skipReveal) revealBody();
    }

    /* 文本叶子节点 = 直接包含该文本的元素，是 fit 的最小作用单元。
       用户硬性约束：窄体类与字号覆盖只允许落在「直接包含文本的叶子节点」上，
       绝不允许落在 cp-body / grid / 面板 / 页面根等大容器上——
       否则一个溢出文本会把容器内全部文本一起压瘦（整屏英文变窄，正是要修的问题）。
       因此候选块一律由「文本节点的直接父元素」产生，不再向上找块级祖先。 */
    function leafOf(node) {
        var el = node && node.parentElement;
        if (!el || el === document.body || el === document.documentElement) return null;
        return el;
    }

    /* 豁免区（用户硬性）：
       - 终端/日志/代码滚动区：无需对应中文行数，正常字宽
       - 可改窗体大小的窗口（DWM 浮窗/关于/过程/自检/PDF/更新/设置/弹窗）：
         英文侧加宽即可，禁止缩窄缩字
       仅「主界面等不允许改大小」的区域才走 fitLeaf/fitGroup 缩窄。 */
    var FIT_EXCLUDE = [
        '#terminal-output', '#logs-container',
        '.self-check-output', '.self-check-modal', '.self-check-content', '.self-check-alert',
        '.update-code-win', '.update-modal', '.update-modal-content',
        '.code-scroll-container',
        '.app-launch-card', '.app-launch-desc', '.app-launch-fallback',
        '.macos-notification',
        '.about-window', '#about-modal',
        '.pdf-viewer-modal', '.pdf-viewer-container',
        '.settings-content', '.info-modal-content',
        '.bt-modal-card', '.dwm-window'
    ].join(', ');

    function collectFitBlocks() {
        var leaves = new Set();
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        var n;
        while ((n = walker.nextNode())) {
            if (n.__i18nOrig === undefined) continue;
            var l = leafOf(n);
            if (l && !isExcluded(l)) leaves.add(l);
        }
        return leaves;
    }

    /* 子树内全部文本叶子（属性/class 变更导致显隐变化时展开重拟合） */
    function leavesIn(root) {
        var out = [];
        if (!root || root.nodeType !== 1) return out;
        if (root === document.body || root === document.documentElement) {
            collectFitBlocks().forEach(function (l) { out.push(l); });
            return out;
        }
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        var n;
        while ((n = walker.nextNode())) {
            if (n.__i18nOrig === undefined) continue;
            var l = leafOf(n);
            if (l && !isExcluded(l)) out.push(l);
        }
        return out;
    }

    function isExcluded(block) {
        try { return !!(block.closest && block.closest(FIT_EXCLUDE)); } catch (e) { return false; }
    }

    function nodesIn(block) {
        var list = [];
        (function collect(n) {
            for (var c = n.firstChild; c; c = c.nextSibling) {
                if (c.nodeType === 3) { if (c.__i18nOrig !== undefined) list.push(c); }
                else if (c.nodeType === 1 && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') collect(c);
            }
        })(block);
        return list;
    }

    function visible(block) {
        try {
            var cs = getComputedStyle(block);
            if (cs.display === 'none') return false;
            /* 拟合遮罩期间 body 全员 visibility:hidden，但布局仍在——
               不能据此跳过，否则首屏拟合空跑、显形后再补拟合造成闪烁。
               遮罩下只看几何尺寸；平时仍跳过隐藏/透明块（登录前主界面等）。 */
            if (!document.documentElement.classList.contains('i18n-fitting')) {
                if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
            }
            var r = block.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        } catch (e) { return false; }
    }

    function setNodes(nodes, toOrig) {
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].nodeValue = toOrig ? nodes[i].__i18nOrig : nodes[i].__i18nCur;
        }
    }

    function resetFit(el) {
        el.classList.remove(FIT_CLASS);
        el.style.fontSize = '';
        el.style.letterSpacing = '';
    }

    /* 单叶子拟合：以「该叶子自身」的中文渲染为基线，只在英文真的更差时才处理。
       用户硬性优先级（能停在上面就不往下走）：
         ① 正常字宽 + 完整译文   ② SHORT 短译（仍正常字宽）   ③ 窄体   ④ 缩字号（≥0.6 倍）
       窄体类与字号覆盖只落在叶子上，绝不落到容器（否则一个溢出文本会把整屏英文压瘦）。 */
    function fitLeaf(leaf) {
        var nodes = nodesIn(leaf);
        if (!nodes.length) { resetFit(leaf); return; }
        /* 豁免区（终端/日志/代码/浮窗）：摘掉拟合类与字号覆盖后直接返回 */
        if (isExcluded(leaf)) { resetFit(leaf); return; }
        /* 判定按"宽度分桶+原文内容"签名缓存：动态区域（日志/时钟）每次变更都会进入拟合，
           若不缓存，重测时窄体类仍挂在元素上会污染 zh 基线，判定每秒翻转 → 文字抽搐 */
        var sig = Math.round(leaf.clientWidth / 24) + '|' + nodes.map(function (n) { return n.__i18nOrig; }).join('');
        if (leaf.__fitSig === sig) return; // 内容未变：沿用既有判定，不做测量翻转
        leaf.__fitSig = sig;
        // 既有判定失效：先摘窄体类/字号覆盖，取得真实 zh 基线
        resetFit(leaf);
        for (var i = 0; i < nodes.length; i++) nodes[i].__i18nCur = nodes[i].nodeValue;

        /* 浮层叶子（position:absolute/fixed，如 dock 悬停提示）：宽度由内容决定，
           横向越出父盒是设计意图（居中 tooltip 必然越出 60px 图标位），
           若把越界算作「更差」会把 hover 提示压成 6.6px 的不可读字。
           这类叶子只按「行数变多」判定——仍换行才压缩。 */
        var overlay = false;
        try {
            var lpos = getComputedStyle(leaf).position;
            overlay = (lpos === 'absolute' || lpos === 'fixed');
        } catch (e) { /* ignore */ }

        /* 边界容器：叶子之上第一个非行内祖先（nowrap 文本放不下时越出它） */
        var box = overlay ? null : leaf.parentElement;
        while (box && box !== document.body && box !== document.documentElement) {
            var boxDisp = '';
            try { boxDisp = getComputedStyle(box).display; } catch (e) { break; }
            if (boxDisp !== 'inline') break;
            box = box.parentElement;
        }
        if (box === document.body || box === document.documentElement) box = null;

        function measure() {
            var r = leaf.getBoundingClientRect();
            var out = { h: Math.round(r.height), sw: leaf.scrollWidth, cw: leaf.clientWidth, over: false };
            /* 叶子横向越出容器右边界 = 文本溢出（nowrap 场景自身 scrollWidth 测不出来） */
            if (box) out.over = r.right > box.getBoundingClientRect().right + 1;
            return out;
        }
        /* 比中文基线更差 = 行数变多 / 自身横向溢出 / 越出容器边界（浮层不看越界） */
        function worse(cur, base) {
            if (cur.h > base.h + 1) return true;
            if (cur.sw > cur.cw + 1 && cur.sw > base.sw + 1) return true;
            if (cur.over && !base.over) return true;
            return false;
        }
        setNodes(nodes, true);
        var zh = measure();
        setNodes(nodes, false);
        var en = measure();
        if (!worse(en, zh)) return; // ① 正常字宽就放得下：一字不动
        /* ② SHORT 短译：仍用正常字宽（原文留在 __i18nOrig，切中文原样还原） */
        var replaced = null;
        nodes.forEach(function (n) {
            if (replaced) return;
            var cur = n.__i18nCur !== undefined ? n.__i18nCur : n.nodeValue;
            var sh = shortLabel(cur);
            if (!sh) return;
            replaced = { n: n, full: cur };
            n.__i18nCur = sh;
            n.nodeValue = sh;
        });
        if (replaced) {
            if (!worse(measure(), zh)) { _fitBlocks.add(leaf); return; }
            replaced.n.__i18nCur = replaced.full; // SHORT 也不行：还原完整译文再走窄体
            setNodes(nodes, false);
        }

        /* ③ 窄体：只打在叶子上（不缩字号） */
        leaf.classList.add(FIT_CLASS);
        leaf.style.letterSpacing = '-0.02em';
        _fitBlocks.add(leaf);
        if (!worse(measure(), zh)) return;

        /* ④ 仍放不下才分级缩字号（rem：随浏览器/窗口缩放连续跟手，不跳变）
           字号下限 0.6 倍保可读性；-0.03em 字距辅助单行（属"缩窄"范畴） */
        var baseSize = parseFloat(getComputedStyle(leaf).fontSize) || 14;
        var ratios = [0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6];
        for (var r = 0; r < ratios.length; r++) {
            leaf.style.fontSize = (Math.round(baseSize * ratios[r] / 16 * 1000) / 1000) + 'rem';
            leaf.style.letterSpacing = '-0.03em';
            if (!worse(measure(), zh)) return;
        }
        // 0.6 倍仍放不下：保留最小档（尽力而为，不破坏板块布局）
    }

    /* 同容器兄弟块组拟合：以共享父容器（如模式按钮行）的高度为基准，
       整组统一缩窄与字号——取整组都能单行的最大字号，按钮等宽、行高与中文一致。
       字号只作用于各块的文本标签元素（增长者），图标/按钮容器尺寸不变 */
    /* 同容器兄弟块组拟合（确定性计算，无测量循环）：
       组内同 className、2~6 个成员（如 4 个模式按钮）。统一字号 = 最长标签
       在最窄按钮内单行所需的最大档（窄体 0.45em/字，0.6 倍下限钳制），
       按钮等宽、字号均匀、行高与中文一致。字号只作用于标签元素本身。 */
    function fitGroup(parent, blks) {
        /* 豁免守卫：豁免区（终端/日志/代码/浮窗）的兄弟块不参与组拟合 */
        if (blks.some(function (b) { try { return isExcluded(b); } catch (e) { return false; } })) {
            blks.forEach(function (b) {
                try { b.classList.remove(FIT_CLASS); b.style.fontSize = ''; b.style.letterSpacing = ''; } catch (e) { /* ignore */ }
            });
            return;
        }
        var labels = [], texts = [];
        blks.forEach(function (b) {
            nodesIn(b).forEach(function (n) {
                if (labels.indexOf(n.parentElement) === -1) {
                    labels.push(n.parentElement);
                    texts.push(n.__i18nCur !== undefined ? n.__i18nCur : n.nodeValue);
                }
            });
        });
        if (!labels.length) return;
        /* group signature cache: fitGroup always writes class/style; reruns without cache
           re-trigger scheduleFit via style/class watch -> infinite loop (font size flicker).
           Skip when content and container width unchanged. */
        var gsig = Math.round(((parent && parent.clientWidth) || 0) / 24) + '|' + texts.join('\u0001');
        if (parent.__fitGroupSig === gsig) return;
        parent.__fitGroupSig = gsig;
        // 复位到未拟合态
        blks.forEach(function (b) { b.classList.remove(FIT_CLASS); b.style.fontSize = ''; b.style.letterSpacing = ''; });
        labels.forEach(function (l) { l.classList.remove(FIT_CLASS); l.style.fontSize = ''; l.style.letterSpacing = ''; });
        // 可用宽度 = 各块内容宽的最小值
        var availW = Infinity;
        blks.forEach(function (b) {
            var cs = getComputedStyle(b);
            var inner = b.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
            availW = Math.min(availW, inner);
        });
        if (!(availW > 0)) return;
        var maxChars = 1;
        texts.forEach(function (t) { maxChars = Math.max(maxChars, t.length); });
        var baseFs = parseFloat(getComputedStyle(labels[0]).fontSize) || 14;
        /* 组签名已过：按「正常字宽优先」逐标签处理，绝不给放得下的标签上窄体 */
        var oneLine = function (l) {
            var fs = parseFloat(getComputedStyle(l).fontSize) || baseFs;
            return l.getBoundingClientRect().height <= fs * 1.55;
        };
        /* 实测：把标签临时恢复到正常字宽后是否单行 */
        var labelNode = function (l) {
            var found = null;
            nodesIn(l).forEach(function (n) { if (!found) found = n; });
            return found;
        };
        var setLabelText = function (l, s) {
            var n = labelNode(l);
            if (n) {
                if (n.__i18nCur !== undefined) n.__i18nCur = s;
                n.nodeValue = s;
            } else {
                l.textContent = s;
            }
        };
        var fitsNormal = function (l) {
            l.classList.remove(FIT_CLASS);
            l.style.fontSize = '';
            l.style.letterSpacing = '';
            return oneLine(l);
        };
        labels.forEach(function (l, idx) {
            try {
                var full = texts[idx] || l.textContent;
                // ① 正常字宽 + 完整译文：放得下就不动（用户：地方宽就正常显示，禁止乱上窄体）
                if (fitsNormal(l)) {
                    return;
                }
                // ② 长标签换 SHORT 短译，仍用正常字宽（原文在 __i18nOrig，切中文可还原）
                var sh = shortLabel(full);
                if (sh) {
                    setLabelText(l, sh);
                    if (fitsNormal(l)) {
                        _fitBlocks.add(l);
                        return;
                    }
                    setLabelText(l, full);
                }
                // ③ 窄体（不缩字号）
                l.classList.add(FIT_CLASS);
                l.style.letterSpacing = '-0.02em';
                if (oneLine(l)) { _fitBlocks.add(l); return; }
                // ④ 仍不行才缩小字号（rem，缩放跟手）
                var ratios = [0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6];
                for (var ri = 0; ri < ratios.length; ri++) {
                    l.style.fontSize = (Math.round(baseFs * ratios[ri] / 16 * 1000) / 1000) + 'rem';
                    if (oneLine(l)) break;
                }
                _fitBlocks.add(l);
            } catch (e) { /* ignore */ }
        });
        blks.forEach(function (b) { _fitBlocks.add(b); });
        _fitBlocks.add(parent);
    }

    function fitPass() {
        if (lang !== 'en') { clearFit(); return; }
        try {
            var settled = false;
            var go = function () {
                if (settled) return;
                settled = true;
                _fitting = true; // 仅实测/写入期间抑制 MO，等待字体时不挡翻译
                runFit();
            };
            /* 字体已就绪则同步拟合，免一轮 Promise 往返（打开即响应） */
            var readyNow = false;
            try {
                readyNow = document.fonts.check("400 16px 'MonoNarrow'") && document.fonts.check("700 16px 'MonoNarrow'");
            } catch (e) { /* ignore */ }
            if (readyNow) { go(); return; }
            var loads = [];
            try {
                loads = [document.fonts.load("condensed 700 16px 'JetBrains Mono'"),
                         document.fonts.load("400 16px 'MonoNarrow'"),
                         document.fonts.load("700 16px 'MonoNarrow'")];
            } catch (e) { /* ignore */ }
            if (loads.length && Promise && Promise.all) {
                Promise.all(loads).then(go, go);
                /* 字体慢加载兜底：不挂到 4s 安全超时——180ms 内未就绪也先跑一轮
                   （窄体不可用时 runFit 会显形；就绪后经 fonts.ready / rc-full-unlocked 补拟合） */
                setTimeout(go, 180);
            } else {
                go();
            }
        } catch (e) {
            _fitting = false;
            revealBody();
        }
    }

    function runFit() {
                /* 字体加载 await 期间语言可能已切回中文：续跑前必须复检，
                   否则 EN 拟合（类+字号覆盖）会落在 zh 模式页面上 */
                if (lang !== 'en') { _fitting = false; clearFit(); return; }
                _fontsReady = true;
                /* 窄体可用性门控：lite 首访模式无 MonoNarrow 字体，缩字号作用在回退字体上
                   反而破坏排版——此时跳过拟合、立即显形；缓存完成解锁后再全量拟合 */
                var narrowAvail = false;
                try {
                    narrowAvail = document.fonts.check("400 16px 'MonoNarrow'") && document.fonts.check("700 16px 'MonoNarrow'");
                } catch (e) { /* ignore */ }
                if (!narrowAvail) {
                    /* lite / 字体未就绪：先显形保响应；就绪后全量补拟合（避免挂到 4s） */
                    _fitting = false;
                    revealBody();
                    try {
                        if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
                            document.fonts.ready.then(function () {
                                if (lang === 'en') scheduleFit(null);
                            }, function () { /* ignore */ });
                        }
                    } catch (e) { /* ignore */ }
                    return;
                }
                try {
                    var blocks;
                    if (_pendingBlocks === null || _pendingBlocks === undefined) {
                        blocks = collectFitBlocks();
                        blocks.forEach(function (b) { _fitBlocks.add(b); }); // 并集，防追踪丢失
                    } else {
                        blocks = _pendingBlocks;
                    }
                _pendingBlocks = undefined;
                /* 同容器兄弟块成组统一拟合：模式按钮等内容自适应宽度的弹性行，
                   逐块独立拟合会得到参差不齐的按钮宽度/字号——成组后整组统一
                   缩窄与字号（取整组能单行的最大档），行高与中文一致、按钮等宽 */
                /* 模式按钮行需要「整组统一字号/等宽」——按 .mode-btn 归属把同行的按钮收成一组；
                   其余叶子逐个独立拟合（放得下就保持正常字宽，不被最长标签拖累）。 */
                withMOOff(function () {
                var modeRows = new Map(); // 模式按钮行(父容器) → 该行全部 .mode-btn
                var singles = [];
                blocks.forEach(function (b) {
                    try {
                        if (lang !== 'en') return; // 逐块复检（await 后语言可能已变）
                        if (!document.contains(b)) { _fitBlocks.delete(b); return; }
                        if (!visible(b)) { _skippedBlocks.add(b); return; } // 登录/展开后随变更复检
                        _skippedBlocks.delete(b);
                        if (isExcluded(b)) return; // 豁免区（终端/日志/代码/浮窗）
                        if ((getComputedStyle(b).fontFamily || '').indexOf('MiSans Full') !== -1) return; // 标题栏专用字体不参与
                        var mb = b.closest ? b.closest('.mode-btn') : null;
                        if (mb && mb.parentElement) {
                            var row = mb.parentElement;
                            if (!modeRows.has(row)) {
                                var btns = [];
                                for (var c = 0; c < row.children.length; c++) {
                                    var ch = row.children[c];
                                    if (ch.classList && ch.classList.contains('mode-btn')) btns.push(ch);
                                }
                                modeRows.set(row, btns);
                            }
                            return;
                        }
                        singles.push(b);
                    } catch (e) { /* ignore */ }
                });
                modeRows.forEach(function (btns, row) {
                    try { fitGroup(row, btns); btns.forEach(function (b) { _fitBlocks.add(b); }); } catch (e) { /* ignore */ }
                });
                singles.forEach(function (b) { try { fitLeaf(b); _fitBlocks.add(b); } catch (e) { /* ignore */ } });
                });
                } catch (e) { /* ignore */ }
                _fitting = false;
                if (lang !== 'en') { clearFit(); revealBody(); return; }
                /* 豁免区兜底清扫：历史/竞态可能残留窄体类（含误挂 html） */
                try {
                    document.querySelectorAll('.' + FIT_CLASS).forEach(function (el) {
                        if (el === document.documentElement || el === document.body || isExcluded(el)) {
                            el.classList.remove(FIT_CLASS);
                            el.style.fontSize = '';
                            el.style.letterSpacing = '';
                        }
                    });
                } catch (e) { /* ignore */ }
                revealBody(); // 拟合完成，一步到位显形
                // 拟合期间有新变更入队：续跑一轮（增量或全页）
                if (_pendingBlocks !== undefined) scheduleFit(_pendingBlocks);
    }

    function observe() {
        if (_mo || typeof MutationObserver === 'undefined') return;
        _mo = new MutationObserver(function (muts) {
            if (_fitting) return; // 自适应拟合自身的写入不再调度
            var affected = new Set();
            var has = false;
            for (var i = 0; i < muts.length; i++) {
                var m = muts[i];
                if (m.type === 'characterData') {
                    translateTextNode(m.target);
                    var b1 = leafOf(m.target); if (b1) { affected.add(b1); has = true; }
                } else if (m.type === 'childList') {
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        var added = m.addedNodes[j];
                        walk(added);
                        /* 新增子树：展开其内部全部文本叶子（叶子语义，绝不上溯到容器）；
                           新增文本节点：取其直接父元素即叶子 */
                        if (added.nodeType === 1) {
                            leavesIn(added).forEach(function (l) { affected.add(l); has = true; });
                        } else if (added.nodeType === 3) {
                            var b2 = leafOf(added);
                            if (b2) { affected.add(b2); has = true; }
                        }
                    }
                } else if (m.type === 'attributes') {
                    translateAttrs(m.target); // 属性翻译不影响布局
                    /* style/class/hidden 影响显隐与布局（登录后 main-content 显示、.hidden 开关）：
                       必须重拟合子树内全部文本叶子，并合并曾跳过的叶子，否则主界面显形后未拟合再闪一下 */
                    if (m.attributeName === 'style' || m.attributeName === 'class' || m.attributeName === 'hidden') {
                        has = true;
                        try {
                            leavesIn(m.target).forEach(function (l) { affected.add(l); });
                        } catch (e) { /* ignore */ }
                    }
                }
            }
            if (has) {
                /* 解析期（readyState=loading）只翻译不拟合：fitPass 收尾会显形，
                   半截 DOM 拟合后放行会闪；全量拟合由 init/applyLang 统一触发 */
                if (document.readyState === 'loading') return;
                /* 新显形块的同步即时拟合：字体就绪后，登录/主界面挂载等"由隐变显"的块
                   在当前任务内完成拟合（MO 回调属微任务，先于绘制），消除显形后 300ms
                   窗口期的未拟合闪烁；内容变更的已拟合块仍走防抖增量路径 */
                if (_fontsReady && lang === 'en' && !_fitting) {
                    var _na = false;
                    try { _na = document.fonts.check("400 16px 'MonoNarrow'"); } catch (e) { /* ignore */ }
                    if (_na) {
                        _fitting = true; // 同步拟合写入不再回灌 MO
                        try {
                        withMOOff(function () {
                        /* 模式按钮行需「整组统一字号/等宽」——按 .mode-btn 归属收成一组；
                           其余叶子逐个独立拟合（放得下就保持正常字宽，不被最长标签拖累） */
                        var syncModeRows = new Map();
                        var syncSingles = [];
                        var syncCandidates = new Set();
                        affected.forEach(function (l) { syncCandidates.add(l); });
                        /* 曾因 display:none/不可见跳过的叶子（登录后 main-content 显形）一并同步拟合，
                           否则要等 300ms 增量防抖，显形瞬间仍是未拟合态再闪 */
                        _skippedBlocks.forEach(function (l) {
                            if (l && document.contains(l)) syncCandidates.add(l);
                        });
                        _skippedBlocks.clear();
                        syncCandidates.forEach(function (l) {
                            try {
                                if (l.__fitSig !== undefined || !document.contains(l)) return;
                                if (!visible(l) || isExcluded(l)) return;
                                if ((getComputedStyle(l).fontFamily || '').indexOf('MiSans Full') !== -1) return;
                                var mb = l.closest ? l.closest('.mode-btn') : null;
                                if (mb && mb.parentElement) {
                                    var row = mb.parentElement;
                                    if (!syncModeRows.has(row)) {
                                        var btns = [];
                                        for (var c = 0; c < row.children.length; c++) {
                                            var ch = row.children[c];
                                            if (ch.classList && ch.classList.contains('mode-btn')) btns.push(ch);
                                        }
                                        syncModeRows.set(row, btns);
                                    }
                                    return;
                                }
                                syncSingles.push(l);
                            } catch (e) { /* ignore */ }
                        });
                        syncModeRows.forEach(function (btns, row) {
                            try { fitGroup(row, btns); btns.forEach(function (b) { _fitBlocks.add(b); }); } catch (e) { /* ignore */ }
                        });
                        syncSingles.forEach(function (l) { try { fitLeaf(l); _fitBlocks.add(l); } catch (e) { /* ignore */ } });
                        });
                        } finally { _fitting = false; }
                    }
                }
                scheduleFit(affected); // 动态内容更新后增量重拟合
            }
        });
        _mo.observe(document.documentElement, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ATTRS.concat(['style', 'class', 'hidden'])
        });
    }

    /* 语言按钮统一按 data-lang 绑定：登录页右上角缩写切换（ZH/EN）与设置页按钮共用一套，
       新增入口只写 data-lang 即可，不必再改这里。 */
    function bindLangButtons() {
        var btns = document.querySelectorAll('[data-lang]');
        for (var i = 0; i < btns.length; i++) {
            (function (el) {
                var next = el.getAttribute('data-lang');
                if (next !== 'en' && next !== 'zh') return;
                el.addEventListener('click', function () { setLang(next); });
            })(btns[i]);
        }
    }

    function init() {
        patchDialogs();
        bindLangButtons();
        applyLang();
        observe();
        // 窗口尺寸变化影响换行判定：EN 模式下防抖全页重拟合（zh 模式零开销）。
        // 防抖 180ms：连续拖拽缩放时签名缓存会跳过未变块，避免「先宽后窄」抽搐
        var _resizeTimer = null;
        window.addEventListener('resize', function () {
            if (lang !== 'en') return;
            if (_resizeTimer) clearTimeout(_resizeTimer);
            _resizeTimer = setTimeout(function () { _resizeTimer = null; scheduleFit(null); }, 180);
        });
        // 浏览器端缓存完成解锁（lite→full，fonts-face 注入）：EN 模式全量重拟合
        window.addEventListener('rc-full-unlocked', function () { if (lang === 'en') scheduleFit(null); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    /* EN：解析期即增量翻译，首帧前完成中文→英文替换（根治中文闪帧）；
       init 内 observe() 幂等，不重复挂钩 */
    if (lang === 'en') {
        try { observe(); } catch (e) { /* ignore */ }
    }

    global.I18N = {
        t: t,
        setLang: setLang,
        getLang: getLang,
        applyLang: applyLang,
        refit: function () { if (lang === 'en') scheduleFit(null); },
        setProtected: setProtected,
        DICT: DICT,
        replacePhrases: replacePhrases
    };
    if (typeof global.t !== 'function') global.t = t;
})(typeof window !== 'undefined' ? window : this);

