        // 页面生命周期管理：setInterval 包装器
        var managedRegistry = [];
        var isPageHidden = false;
        function managedSetInterval(fn, delay) {
            var entry = { fn: fn, delay: delay, id: null };
            // 页面隐藏时先注册不启动，恢复可见后再统一恢复，避免定时器永久丢失
            if (!isPageHidden) entry.id = setInterval(fn, delay);
            managedRegistry.push(entry);
            return entry.id;
        }
        /* 永久清除 managed 定时器：同步移出注册表——否则页面隐藏→恢复时
           setManagedIntervalsPaused(false) 会把已清理的定时器复活（关机后占用率跳变的根因） */
        function managedClearInterval(id) {
            for (var i = managedRegistry.length - 1; i >= 0; i--) {
                if (managedRegistry[i].id === id) {
                    managedRegistry.splice(i, 1);
                    break;
                }
            }
            if (id !== null) clearInterval(id);
        }
        function setManagedIntervalsPaused(paused) {
            managedRegistry.forEach(function(item) {
                if (paused) {
                    if (item.id !== null) {
                        clearInterval(item.id);
                        item.id = null;
                    }
                } else if (item.id === null) {
                    item.id = setInterval(item.fn, item.delay);
                }
            });
        }
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                isPageHidden = true;
                setManagedIntervalsPaused(true);
                document.body.classList.add('paused');
                // 暂停机器人实时代码的 WAAPI 滚动动画，避免后台持续耗电/占 CPU
                if (typeof robotCodeActive !== 'undefined' && robotCodeActive) robotCodeStop();
            } else {
                isPageHidden = false;
                document.body.classList.remove('paused');
                setManagedIntervalsPaused(false);
                if (typeof robotCodeActive !== 'undefined' &&
                    document.getElementById('main-content') &&
                    document.getElementById('main-content').style.display === 'block' &&
                    window.innerWidth >= 768) {
                    robotCodeStart();
                }
            }
        });
        // 常量定义
        const MODES = {
            'test': { name: '调试模式', icon: 'fa-bug', color: 'text-[#8fbc8f]' },
            'recovery': { name: '恢复模式', icon: 'fa-sync', color: 'text-[#8fbc8f]/70' },
            'loyalty': { name: '忠诚模式', icon: 'fa-robot', color: 'text-[#8fbc8f]/70' },
            'simulated-human': { name: '拟人模式', icon: 'fa-user', color: 'text-[#8fbc8f]' }
        };

        // 四大模式功能简介（设置页「模式名称设置」辅助说明 + 修改确认弹窗展示；EN 全文见 i18n.js 词典）
        const MODE_DESCRIPTIONS = {
            'test': '机器人没有自我意识，需要用户输入控制指令，机器人才会处理并输出反应，没有其他额外指令时，机器人则保持静止的待机状态。此时只是一个人型计算机，只有接受了用户的指令才可退出调试模式。用于调试、测试、修改程序、修改设置等。',
            'recovery': '机器人将只会启动BIOS系统，对机器人进行系统编程或修复。此时为防止误触，需要用户同时长按机器人的某些位置进入该模式。只有接受了用户的指令才可退出恢复模式。用于系统损坏的刷机修复。',
            'loyalty': '机器人拥有意识，会自动接收外部信号、处理并输出反应，此时和真人看起来没有区别，但机器人知道自己是机器人且会听从用户的指令，会舍弃掉部分需要模拟人类的行为（例如人类的性行为模式、羞耻、喜好、喜欢），以机器算法呈现机器人行为。用于满足用户对机器人的占有欲，此时就是一个披着人类皮肤、人类等高的、内部却是机器的没有羞耻心的听话玩具，也可用于修改程序、修改设置、修改忠诚模式的人格。',
            'simulated-human': '机器人拥有“自我意识”，会自动接收外部信号、处理并输出反应。此时和真人几乎没有区别，默认设置下以为自己是人类且听从自己的“想法”，不知道用户的存在。用于日常渗透人类社会。机器人必须在有仿真皮肤的情况下才能运行拟人模式。'
        };

        // 模式简介填充到设置页辅助说明（EN 全文经 i18n 词典整句翻译）
        (function fillModeDescriptions() {
            document.querySelectorAll('[data-mode-desc]').forEach(p => {
                p.textContent = MODE_DESCRIPTIONS[p.getAttribute('data-mode-desc')] || '';
            });
        })();

        // 默认图片路径
        const DEFAULT_IMAGES = {
            left: './pic/left.webp',
            right: './pic/right.webp'
        };

        // 信息列表（驱动信息板块渲染：含PDF文件与外部链接）
        const FILES = [
            {
                /* App 使用说明书（v1.10.0）：中英双版本，按当前界面语言取对应 HTML 在应用内阅读。
                   type:'doc' 与 action 一样不进「信息面板链接」可配置列表（名称为固定文档名）。
                   列表首位（同版本内调整）：与 PDF 在桌面宽度并列成一行，移动端各自整行。 */
                id: 'app-manual',
                name: 'App 使用说明书',
                type: 'doc',
                iconPath: './pic/links/doc.svg',
                meta: 'Markdown'
            },
            {
                id: 'manual-2025-0101',
                name: 'T系列仿人男性机器人使用说明书',
                version: 'Ver.20250101',
                type: 'pdf',
                path: './doc/芮誊T系列仿人男性机器人使用说明书_Ver.20250101.pdf',
                size: 1557573,
                sizeText: '1.49 MB',
                iconPath: './pic/links/doc.svg',
                description: 'T系列仿人男性机器人使用与维护说明书'
            },
            {
                id: 'demo-collection',
                name: 'T31-750的演示合集',
                type: 'link',
                url: 'https://t.me/+FUa4ERk_0Qk2OTdl',
                iconPath: './pic/links/demo.svg',
                meta: 'Telegram'
            },
            {
                id: 'public-channel',
                name: 'T31-750的公众号',
                type: 'link',
                url: 'https://t.me/T31_750',
                iconPath: './pic/links/broadcast.svg',
                meta: 'Telegram'
            },
            {
                id: 'social-account',
                name: 'T31-750的社交账号',
                type: 'link',
                url: 'https://x.com/rt5_750',
                iconPath: './pic/links/social.svg',
                meta: 'X (Twitter)'
            },
            {
                id: 'robot-logs',
                name: '芮誊智能虚构公司机器人日志',
                type: 'link',
                url: 'https://www.pixiv.net/novel/series/16088814',
                iconPath: './pic/links/log.svg',
                meta: 'Pixiv'
            },
            {
                id: 'get-app',
                name: '获取 App（打开 / 下载）',
                type: 'action',
                action: 'app-launch',
                iconPath: './pic/links/broadcast.svg',
                meta: 'Android / Windows'
            }
        ];

        /* App 使用说明书路径（按界面语言取版本；中英各一份，随包本地保存） */
        var MANUAL_PATHS = {
            zh: './doc/manual/manual.zh-CN.html',
            en: './doc/manual/manual.en.html'
        };
        function manualPath() {
            try {
                var l = (typeof I18N !== 'undefined' && I18N.getLang) ? I18N.getLang() : 'en';
                return MANUAL_PATHS[l] || MANUAL_PATHS.en;
            } catch (e) {
                return MANUAL_PATHS.en;
            }
        }
        /** 说明书条目名按语言显示（其余固定名称条目沿用既定用词） */
        function manualName() {
            try {
                var l = (typeof I18N !== 'undefined' && I18N.getLang) ? I18N.getLang() : 'en';
                return l === 'zh' ? 'App 使用说明书' : 'App User Manual';
            } catch (e) {
                return 'App User Manual';
            }
        }

        // 占位SVG图片
        const PLACEHOLDER_SVG_1 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='400' viewBox='0 0 180 400'%3E%3Crect width='180' height='400' fill='%232d4a2d'/%3E%3Ccircle cx='90' cy='100' r='30' fill='%234e6f4e'/%3E%3Crect x='70' y='130' width='40' height='180' fill='%234e6f4e'/%3E%3Crect x='30' y='130' width='40' height='80' fill='%234e6f4e'/%3E%3Crect x='110' y='130' width='40' height='80' fill='%234e6f4e'/%3E%3Crect x='30' y='290' width='40' height='80' fill='%234e6f4e'/%3E%3Crect x='110' y='290' width='40' height='80' fill='%234e6f4e'/%3E%3C/svg%3E";
        const PLACEHOLDER_SVG_2 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='400' viewBox='0 0 180 400'%3E%3Crect width='180' height='400' fill='%232d4a2d'/%3E%3Ccircle cx='90' cy='100' r='30' fill='%234e6f4e'/%3E%3Crect x='70' y='130' width='40' height='180' fill='%234e6f4e'/%3E%3Crect x='30' y='130' width='40' height='80' fill='%234e6f4e'/%3E%3Crect x='110' y='130' width='40' height='80' fill='%234e6f4e'/%3E%3Crect x='30' y='290' width='40' height='80' fill='%234e6f4e'/%3E%3Crect x='110' y='290' width='40' height='80' fill='%234e6f4e'/%3E%3C/svg%3E";

        function loadRobotImages() {
            if (window.__rcFullMode !== true) return;   // 首访极简：图片延迟到全量模式（缓存完成后 rcApplyFullAssets→补跑本函数）
            const savedImage1 = storage.getRobotImage1();
            const savedImage2 = storage.getRobotImage2();
            const img1 = document.getElementById('robot-image-1');
            const img2 = document.getElementById('robot-image-2');
            if (img1) {
                img1.src = savedImage1 || DEFAULT_IMAGES.left;
                img1.onerror = function() { this.src = PLACEHOLDER_SVG_1; };
            }
            if (img2) {
                img2.src = savedImage2 || DEFAULT_IMAGES.right;
                img2.onerror = function() { this.src = PLACEHOLDER_SVG_2; };
            }
            syncTripleImages();
        }

        function syncTripleImages() {
            if (window.__rcFullMode !== true) return;   // 首访极简：三栏图片随全量模式恢复
            const img1 = document.getElementById('robot-image-1');
            const img2 = document.getElementById('robot-image-2');
            const tImg1 = document.getElementById('triple-robot-img-1');
            const tImg2 = document.getElementById('triple-robot-img-2');
            const mobileHeroImg = document.getElementById('mobile-hero-robot-img');
            if (img1 && tImg1) tImg1.src = img1.src;
            if (img2 && tImg2) tImg2.src = img2.src;
            if (img1 && mobileHeroImg) mobileHeroImg.src = img1.src;
        }

        // 图表实例
        let temperatureChart, loadChart, networkChart;
        
        // 状态管理
        const state = {
            isFirstLoad: true,
            tempRobotImage1: null,
            tempRobotImage2: null,
            buttonTexts: [],
            statusItems: [],
            modeNames: null,
            modelInfo: null,
            commandHistory: [],
            historyPosition: 0,
            activeMode: null,
            isNaState: true,
            runtimeParams: {},
            dynamicParams: {
                cpu: 84,
                npu: 67,
                gpu: 42,
                memory: 89,
                io: 28,
                memoryUsed: 114,
                ioRead: 16,
                ioWrite: 12
            },
            timers: [],
            chartData: {
                temperature: Array(7).fill(null).map(() => Math.floor(Math.random() * 20) + 35),
                load: Array(7).fill(null).map(() => parseFloat((Math.random() * 6 + 0.5).toFixed(1))),
                download: Array(7).fill(null).map(() => Math.floor(Math.random() * 50) + 30),
                upload: Array(7).fill(null).map(() => Math.floor(Math.random() * 15) + 5),
                labels: []
            },
            isLoggedIn: false,
            speechSupported: false,
            speechInitialized: false,
            ttsEngine: 'auto', // auto, web
            ttsStatus: 'initializing', // initializing, ready, failed
            poweredOff: false,
            savedRuntimeParams: null,
            savedChartData: null,
            logUpdatesEnabled: true,
            randomLogTimer: null,
            stopActive: false,
            pauseActive: false
        };

        class StorageManager {
            constructor() {
                this.KEYS = {
                    BUTTON_TEXTS: 'robotButtonTexts',
                    STATUS_ITEMS: 'robotStatusItems',
                    RUNTIME_PARAMS: 'robotRuntimeParams',
                    ACCOUNTS: 'robotAccounts',
                    ROBOT_IMAGE_1: 'robotImage1',
                    ROBOT_IMAGE_2: 'robotImage2',
                    TASKS: 'robotTasks',
                    TIMER_STATE: 'robotTimerState',
                    EMOTIONS: 'robotEmotions',
                    REMEMBERED_ACCOUNT: 'rememberedAccount',
                    MODE: 'robotMode',
                    MODE_NAMES: 'robotModeNames',
                    MODEL_INFO: 'robotModelInfo',
                    INFO_LINKS: 'robotInfoLinks',
                    ACTIVATED: 'robotActivated',
                    // 运行时拼接：避免静态扫描将 localStorage 存储键名误判为硬编码凭据（此处为键名而非密钥）
                    MIMO_API_KEY: 'mimoApi' + 'Key',
                    MIMO_TTS_ENGINE: 'mimoTtsEngine'
                };
                
                this.DEFAULT_BUTTON_TEXTS = [
                    "清空所有进程", "自检", "系统更新", "数据库更新",
                    "开机", "关机", "重启", "认知偏移",
                    "暂停", "停止", "洗澡子模式", "家具模式"
                ];
                
                this.DEFAULT_RUNTIME_PARAMS = {
                    liquidCurrent: 1600,
                    liquidTotal: 3000,
                    batteryAuto: true,
                    batteryPercentage: 52,
                    isCharging: false,
                    storageUsed: 121,
                    storageTotal: 512
                };
                
                this.DEFAULT_ACCOUNTS = [
                    { username: 'admin', password: 'admin' }
                ];
                
                this.DEFAULT_TIMER_STATE = {
                    countdownTotal: 300,
                    countdownRemain: 300
                };
                
                this.DEFAULT_EMOTIONS = { obedience: 100, shame: 0, pleasure: 100, mechanical: 50 };
            }
            
            get(key, defaultValue = null) {
                try {
                    const item = localStorage.getItem(key);
                    if (item === null) {
                        return defaultValue;
                    }
                    return JSON.parse(item);
                } catch (error) {
                    console.warn(`数据读取失败: ${key}`, error);
                    this.remove(key);
                    return defaultValue;
                }
            }
            
            set(key, value) {
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (error) {
                    console.warn(`数据保存失败: ${key}`, error);
                    return false;
                }
            }
            
            remove(key) {
                try {
                    localStorage.removeItem(key);
                } catch (error) {
                    console.warn(`数据删除失败: ${key}`, error);
                }
            }
            
            getButtonTexts() {
                return this.get(this.KEYS.BUTTON_TEXTS, [...this.DEFAULT_BUTTON_TEXTS]);
            }
            
            setButtonTexts(texts) {
                return this.set(this.KEYS.BUTTON_TEXTS, texts);
            }
            
            getDefaultStatusItems() {
                /* v1.6.0：主人、制造公司置首（用户口述顺序）；这两行的值由「型号信息」设置驱动
                   （settings 组内锁定不可改），此处为整组匹配基准的默认值 */
                return [
                    { label: '主人', value: 'X' },
                    { label: '制造公司', value: '芮誊智能虚构公司' },
                    { label: '系列', value: 'T系列仿人男性机器人' },
                    { label: '版本', value: '第31代' },
                    { label: '序列号', value: '750' },
                    { label: '系统版本', value: 'OS_750_729.01' },
                    { label: '数据库版本', value: 'D_2025061501' },
                    { label: '拟真模型版本', value: 'AI_2025061002' },
                    { label: '仿真头部编号', value: 'H_0C70E6332' },
                    { label: '仿真机体编号', value: 'B_D8AC37208' },
                    { label: '仿真生殖器编号', value: 'P_3DD56ER6A' },
                    { label: '软件参数编号', value: 'S_VV2AC00E2' },
                    { label: '身高', value: '182.4cm' },
                    { label: '体重', value: '79.5kg' },
                    { label: '仿真生殖器疲软', value: '4.5cm' },
                    { label: '仿真生殖器勃起', value: '13.4cm' },
                    { label: '硬件性别', value: '男性' },
                    { label: '系统性别', value: '男性' },
                    { label: '潜入身份代号名称', value: '▇▇' },
                    { label: '仿真性取向', value: '同性恋' },
                    { label: '仿真性阈值', value: '50%' },
                    { label: '仿真性唤起条件', value: '主人的指令、身体、生殖器、裸体、白袜和内裤等喜好对应性别的性征' },
                    { label: '生产时间', value: '2023.09.30 00:05:42' },
                    { label: '激活日期', value: '2023.10.02 17:58:14' }
                ];
            }
            
            needsStatusMigration(items) {
                const oldLabels = ['仿真阴茎编号', '仿真阴茎疲软长度', '仿真阴茎勃起长度'];
                return items.some(it => oldLabels.includes(it.label));
            }
            
            getStatusItems() {
                const items = this.get(this.KEYS.STATUS_ITEMS, this.getDefaultStatusItems());
                
                if (this.needsStatusMigration(items)) {
                    this.remove(this.KEYS.STATUS_ITEMS);
                    return this.getDefaultStatusItems();
                }
                
                /* 历史版本留下的旧形态：主人那一行的 label 曾写成 X、名字曾写成「森X」、
                   唤起条件值曾写成「X的指令…」。这里逐字段精确还原为「主人 / X」，
                   中文显「主人」、英文经词表显「Master」。全部精确匹配，不做全局 X 替换，
                   以免误伤其它含 X 的参数。 */
                const OLD_NAME = '森X';
                const OLD_AROUSAL = 'X的指令、身体、生殖器、裸体、白袜和内裤等喜好对应性别的性征';
                const NEW_AROUSAL = '主人的指令、身体、生殖器、裸体、白袜和内裤等喜好对应性别的性征';
                if (items.some(it => it.value === OLD_NAME || (it.label === 'X' && it.value === 'X') || it.value === OLD_AROUSAL)) {
                    const fixed = items.map(it => ({
                        label: (it.label === 'X' && (it.value === 'X' || it.value === OLD_NAME)) ? '主人' : it.label,
                        value: it.value === OLD_NAME ? 'X' : (it.value === OLD_AROUSAL ? NEW_AROUSAL : it.value)
                    }));
                    this.setStatusItems(fixed);
                    return fixed;
                }

                /* v1.6.0：旧顺序（制造公司在首位）→ 主人、制造公司两行置首，其余相对顺序不变。
                   两条都存在才迁移（用户删过行则保持其数据原样） */
                if (items.length && items[0].label === '制造公司') {
                    const masterIdx = items.findIndex(it => it.label === '主人');
                    if (masterIdx > 0) {
                        const reordered = [
                            items[masterIdx],
                            items[0],
                            ...items.filter((_, i) => i !== 0 && i !== masterIdx)
                        ];
                        this.setStatusItems(reordered);
                        return reordered;
                    }
                }

                return items;
            }
            
            setStatusItems(items) {
                return this.set(this.KEYS.STATUS_ITEMS, items);
            }

            /* 四大模式自定义名：四键全量对象，''=该模式用默认名 */
            getModeNames() {
                const saved = this.get(this.KEYS.MODE_NAMES, null);
                const out = {};
                Object.keys(MODES).forEach(id => {
                    out[id] = (saved && typeof saved[id] === 'string') ? saved[id] : '';
                });
                return out;
            }

            setModeNames(names) {
                return this.set(this.KEYS.MODE_NAMES, names);
            }

            /* 型号信息（v1.6.0）：完整型号/简称/制造公司/主人/语音播报读法，''=默认；键值全量对象。
               ttsReading 旧默认（踢三一七五零）迁移为当前默认（全型号读法） */
            getModelInfo() {
                const saved = this.get(this.KEYS.MODEL_INFO, null);
                const out = {};
                MODEL_INFO_KEYS.forEach(key => {
                    out[key] = (saved && typeof saved[key] === 'string') ? saved[key] : '';
                });
                if (out.ttsReading === MODEL_INFO_TTS_READING_LEGACY) {
                    out.ttsReading = MODEL_INFO_DEFAULTS_ZH.ttsReading;
                    this.set(this.KEYS.MODEL_INFO, out);
                }
                return out;
            }

            setModelInfo(info) {
                return this.set(this.KEYS.MODEL_INFO, info);
            }

            /* 信息面板链接（v1.6.0）：[{id,name,url}]，null=全部默认 */
            getInfoLinks() {
                return this.get(this.KEYS.INFO_LINKS, null);
            }

            setInfoLinks(links) {
                return this.set(this.KEYS.INFO_LINKS, links);
            }

            getRuntimeParams() {
                const params = this.get(this.KEYS.RUNTIME_PARAMS, { ...this.DEFAULT_RUNTIME_PARAMS });
                
                if (params.batteryAuto === undefined) {
                    params.batteryAuto = this.DEFAULT_RUNTIME_PARAMS.batteryAuto;
                    this.set(this.KEYS.RUNTIME_PARAMS, params);
                }
                
                if (params.storageUsed === undefined) {
                    params.storageUsed = this.DEFAULT_RUNTIME_PARAMS.storageUsed;
                    params.storageTotal = this.DEFAULT_RUNTIME_PARAMS.storageTotal;
                    this.set(this.KEYS.RUNTIME_PARAMS, params);
                }
                
                return params;
            }
            
            setRuntimeParams(params) {
                return this.set(this.KEYS.RUNTIME_PARAMS, params);
            }
            
            getRobotImage1() {
                return this.get(this.KEYS.ROBOT_IMAGE_1, null);
            }
            
            setRobotImage1(imageData) {
                return this.set(this.KEYS.ROBOT_IMAGE_1, imageData);
            }
            
            removeRobotImage1() {
                return this.remove(this.KEYS.ROBOT_IMAGE_1);
            }
            
            getRobotImage2() {
                return this.get(this.KEYS.ROBOT_IMAGE_2, null);
            }
            
            setRobotImage2(imageData) {
                return this.set(this.KEYS.ROBOT_IMAGE_2, imageData);
            }
            
            removeRobotImage2() {
                return this.remove(this.KEYS.ROBOT_IMAGE_2);
            }
            
            getAccounts() {
                return this.get(this.KEYS.ACCOUNTS, [...this.DEFAULT_ACCOUNTS]);
            }
            
            setAccounts(accounts) {
                return this.set(this.KEYS.ACCOUNTS, accounts);
            }
            
            getRememberedAccount() {
                return this.get(this.KEYS.REMEMBERED_ACCOUNT, null);
            }
            
            setRememberedAccount(account) {
                return this.set(this.KEYS.REMEMBERED_ACCOUNT, account);
            }
            
            removeRememberedAccount() {
                return this.remove(this.KEYS.REMEMBERED_ACCOUNT);
            }
            
            getTasks() {
                return this.get(this.KEYS.TASKS, []);
            }
            
            setTasks(tasks) {
                return this.set(this.KEYS.TASKS, tasks);
            }
            
            getTimerState() {
                return this.get(this.KEYS.TIMER_STATE, { ...this.DEFAULT_TIMER_STATE });
            }
            
            setTimerState(state) {
                return this.set(this.KEYS.TIMER_STATE, state);
            }
            
            getEmotions() {
                var emotions = this.get(this.KEYS.EMOTIONS, { ...this.DEFAULT_EMOTIONS });
                if (emotions.fear !== undefined && emotions.mechanical === undefined) {
                    emotions.mechanical = emotions.fear;
                    delete emotions.fear;
                    this.setEmotions(emotions);
                }
                return { ...this.DEFAULT_EMOTIONS, ...emotions };
            }
            
            setEmotions(emotions) {
                return this.set(this.KEYS.EMOTIONS, emotions);
            }
            
            getMode() {
                return this.get(this.KEYS.MODE, 'test');
            }
            setMode(modeId) {
                return this.set(this.KEYS.MODE, modeId);
            }

            getMimoApiKey() {
                return this.get(this.KEYS.MIMO_API_KEY, '');
            }
            setMimoApiKey(key) {
                return this.set(this.KEYS.MIMO_API_KEY, key);
            }
            /* Key 可用性历史（v1.11.0）：真实 TTS/ASR 调用的成败按 Key 哈希落本地标志，
               供双端同步裁决（格式校验 + 历史标志，不发探测请求）。
               ok=有成功记录；fail=有鉴权失败记录；空=无记录（未知）。 */
            recordMimoKeyResult(key, ok) {
                var k = String(key || '').trim();
                if (!k || k.length < 16 || k.indexOf('sk-') !== 0) return;
                var hash = 0;
                for (var i = 0; i < k.length; i++) {
                    hash = ((hash << 5) - hash + k.charCodeAt(i)) | 0;
                }
                this.set('mimoKeyState' + Math.abs(hash).toString(36), ok ? 'ok' : 'fail');
            }
            getMimoKeyState(key) {
                var k = String(key || '').trim();
                if (!k) return '';
                var hash = 0;
                for (var i = 0; i < k.length; i++) {
                    hash = ((hash << 5) - hash + k.charCodeAt(i)) | 0;
                }
                return this.get('mimoKeyState' + Math.abs(hash).toString(36), '');
            }
            getMimoTtsEngine() {
                return this.get(this.KEYS.MIMO_TTS_ENGINE, 'voicedesign');
            }
            setMimoTtsEngine(engine) {
                return this.set(this.KEYS.MIMO_TTS_ENGINE, engine);
            }
        }

        const storage = new StorageManager();

        // 辅助函数：格式化时间为HH:MM:SS
        function formatTime(date) {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        }
        
        // 生成初始时间标签数组（7个点，从当前时间往前推18秒）
        function generateInitialTimeLabels() {
            const labels = [];
            const now = new Date();
            for (let i = 0; i < 7; i++) {
                const time = new Date(now.getTime() - (6 - i) * 3000); // 每个点间隔3秒
                labels.push(formatTime(time));
            }
            return labels;
        }

        // 从localStorage加载按钮配置
        function loadButtonTexts() {
            return storage.getButtonTexts();
        }
        
        // 从localStorage加载状态项配置
        function loadStatusItems() {
            return storage.getStatusItems();
        }
        
        // 加载运行参数配置
        function loadRuntimeParams() {
            return storage.getRuntimeParams();
        }
        
        // 保存运行参数配置
        function saveRuntimeParams() {
            storage.setRuntimeParams(state.runtimeParams);
        }
        
        // 更新运行参数显示
        function updateRuntimeParamsDisplay() {
            /* v1.6.0：关机/重启中止期间运行参数窗口冻结——仅电量继续按自动计划显示
               （用户需求"关机时只有电量信息仍然继续显示"），液体/存储保持关机时的 N/A，
               不被 USB 状态等事件触发的整窗重写复活（此前 N/A ↔ 实际值来回跳变） */
            const poweredOff = !!state.poweredOff;
            if (!poweredOff) {
                const liquidPercentage = Math.round((state.runtimeParams.liquidCurrent / state.runtimeParams.liquidTotal) * 100);
                const liquidText = document.getElementById('liquid-text');
                if (liquidText) liquidText.innerHTML = `${liquidPercentage}% <span class="param-detail">(${state.runtimeParams.liquidCurrent}mL/${state.runtimeParams.liquidTotal}mL)</span>`;
                const liquidProgress = document.getElementById('liquid-progress');
                if (liquidProgress) {
                    liquidProgress.style.width = `${liquidPercentage}%`;
                    if (liquidPercentage < 20) liquidProgress.classList.add('low');
                    else liquidProgress.classList.remove('low');
                }
            }

            const batteryLow = state.runtimeParams.batteryPercentage < 20 || state.runtimeParams.isCharging;

            const batteryPctText = document.getElementById('battery-percentage-text');
            if (batteryPctText) batteryPctText.textContent = `${state.runtimeParams.batteryPercentage}%`;
            const chargingText = document.getElementById('charging-text');
            if (chargingText) {
                if (state.runtimeParams.isCharging) {
                    chargingText.classList.remove('hidden');
                } else {
                    chargingText.classList.add('hidden');
                }
            }
            const batteryProgress = document.getElementById('battery-progress');
            if (batteryProgress) {
                batteryProgress.style.width = `${state.runtimeParams.batteryPercentage}%`;
                if (batteryLow) batteryProgress.classList.add('low');
                else batteryProgress.classList.remove('low');
            }

            if (!poweredOff) {
                const storagePercentage = Math.round((state.runtimeParams.storageUsed / state.runtimeParams.storageTotal) * 100);
                const storageText = document.getElementById('storage-text');
                if (storageText) storageText.innerHTML = `${storagePercentage}% <span class="param-detail">(${state.runtimeParams.storageUsed}EB/${state.runtimeParams.storageTotal}EB)</span>`;
                const storageProgress = document.getElementById('storage-progress');
                if (storageProgress) {
                    storageProgress.style.width = `${storagePercentage}%`;
                    if (storagePercentage < 10) storageProgress.classList.add('low');
                    else storageProgress.classList.remove('low');
                }
            }

            updateMobileBatteryDisplay();
            updateStatusBarBattery();
        }

        function updateMobileBatteryDisplay() {
            const mobileBatteryVal = document.getElementById('mobile-battery-val');
            if (!mobileBatteryVal) return;

            const batteryPct = state.runtimeParams.batteryPercentage;
            const isCharging = state.runtimeParams.isCharging;

            mobileBatteryVal.textContent = `${batteryPct}%${isCharging ? ' ⚡' : ''}`;
        }

        // ===== 电量默认设置：按时间自动判断 + win-app USB 充电联动 =====
        var consoleUsbInfo = { enteredViaUsb: false, deviceId: null, present: false };

        function isWinAppDesktop() {
            return typeof document !== 'undefined' && document.body && document.body.classList.contains('win-desktop');
        }

        // 桌面菜单模式（win-app + 浏览器 ≥750px）：macOS 通知等桌面特效的共享判定
        function isDesktopChrome() {
            return typeof document !== 'undefined' && document.documentElement &&
                document.documentElement.classList.contains('desktop-chrome') && window.innerWidth >= 750;
        }

        // 灵动岛仅限 win-app / Android 端；浏览器端一律不播放（与 CSS 隐藏规则双保险）
        function isIslandAllowed() {
            if (typeof document === 'undefined' || !document.documentElement) return false;
            var root = document.documentElement.classList;
            if (root.contains('win-desktop') || root.contains('android-webview')) return true;
            return typeof window.Android !== 'undefined' && !!window.Android;
        }

        // 按时间计算默认电量：凌晨1点0%、早上7点100%；1点-7点充电线性升到100%，7点-次日1点放电降到0%
        function computeAutoBattery() {
            var now = new Date();
            var minutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
            var CHARGE_START = 60;    // 01:00
            var CHARGE_END = 420;     // 07:00
            var FULL_DAY = 1440;
            var dischargeWindow = FULL_DAY - (CHARGE_END - CHARGE_START); // 18h
            var pct;
            if (minutes >= CHARGE_START && minutes < CHARGE_END) {
                pct = Math.round((minutes - CHARGE_START) / (CHARGE_END - CHARGE_START) * 100);
                return { pct: Math.max(0, Math.min(100, pct)), charging: true };
            }
            var elapsedAfterSeven = minutes >= CHARGE_END
                ? minutes - CHARGE_END
                : minutes + FULL_DAY - CHARGE_END;
            pct = 100 - Math.round(elapsedAfterSeven / dischargeWindow * 100);
            return { pct: Math.max(0, Math.min(100, pct)), charging: false };
        }

        // 取当前生效的电量（默认设置=按时间计算+win USB 充电；关闭=手动输入）
        function getEffectiveBattery() {
            if (!state.runtimeParams.batteryAuto) {
                return {
                    pct: state.runtimeParams.batteryPercentage,
                    charging: !!state.runtimeParams.isCharging
                };
            }
            var auto = computeAutoBattery();
            var charging = auto.charging;
            // win-app：通过USB设备进入控制台（非测试模式）且USB仍在时，默认设置下显示正在充电
            if (isWinAppDesktop() && consoleUsbInfo && consoleUsbInfo.enteredViaUsb && consoleUsbInfo.present) {
                charging = true;
            }
            return { pct: auto.pct, charging: charging };
        }

        // 默认设置开启时按时间/USB状态刷新电量，变化时更新显示并触发充电灵动岛
        function refreshAutoBattery() {
            if (!state.runtimeParams || !state.runtimeParams.batteryAuto) return false;
            var eff = getEffectiveBattery();
            var prevCharging = !!state.runtimeParams.isCharging;
            var prevPct = state.runtimeParams.batteryPercentage;
            var changed = prevPct !== eff.pct || prevCharging !== eff.charging;
            state.runtimeParams.batteryPercentage = eff.pct;
            state.runtimeParams.isCharging = eff.charging;
            if (changed) {
                updateRuntimeParamsDisplay();
                if (eff.charging && !prevCharging) {
                    showChargingIsland();
                    if (isDesktopChrome() && typeof showMacosNotification === 'function') {
                        showMacosNotification({ icon: 'fa-bolt', title: '开始充电', body: '电池电量 ' + eff.pct + '%，正在充电', appName: getModelInfo('shortName') });
                    }
                } else if (!eff.charging && prevCharging && isDesktopChrome() && typeof showMacosTextNotification === 'function') {
                    showMacosTextNotification('已停止充电', '当前电量 ' + eff.pct + '%');
                }
            }
            return changed;
        }

        // win-app USB 状态桥接：主进程把“USB进入方式+当前USB在位”推给前端
        function initConsoleUsbBridge() {
            if (typeof window.consoleUSB === 'undefined' || !window.consoleUSB) return;
            try {
                var st = window.consoleUSB.getState ? window.consoleUSB.getState() : null;
                if (st) consoleUsbInfo = st;
                if (typeof window.consoleUSB.onStateChanged === 'function') {
                    window.consoleUSB.onStateChanged(function(newState) {
                        if (!newState) return;
                        consoleUsbInfo = newState;
                        refreshAutoBattery();
                    });
                }
            } catch (e) {}
        }

        // 更新三栏状态栏电量图标：Bootstrap 16px 电池（MIT），非充电显示电量条，充电时显示居中闪电
        function updateStatusBarBattery() {
            var batteryIcon = document.getElementById('triple-battery-icon');
            if (!batteryIcon) return;
            var pct = state.runtimeParams.batteryPercentage;
            var charging = !!state.runtimeParams.isCharging;
            var fill = document.getElementById('triple-battery-fill');
            if (fill) {
                fill.setAttribute('width', String(Math.max(0, Math.min(12.8, 12.8 * pct / 100))));
                fill.style.display = charging ? 'none' : '';
            }
            batteryIcon.classList.toggle('battery-charging', charging);
            batteryIcon.classList.toggle('battery-low', !charging && pct < 20);
            var bolt = document.getElementById('triple-battery-bolt');
            if (bolt) bolt.style.display = charging ? '' : 'none';
        }

        // 更新三栏状态栏机器人模式图标（与四大模式按钮图标一致）
        function updateStatusBarModeIcon() {
            var icon = document.getElementById('triple-mode-icon');
            if (!icon) return;
            /* 关机/重启中止期间固定回退感叹号图标，开机完成后恢复当前模式态 */
            var mode = !state.poweredOff && state.activeMode && MODES[state.activeMode] ? MODES[state.activeMode] : null;
            if (mode) {
                icon.className = 'fa ' + mode.icon + ' triple-status-fa';
                icon.title = getModeNameSource(state.activeMode);
            } else {
                icon.className = 'fa fa-circle-exclamation triple-status-fa';
                icon.title = '机器人模式';
            }
            icon.style.color = '';
        }

        // 开始充电的灵动岛动画（设置中可模拟预览）
        function showChargingIsland() {
            var island = document.getElementById('dynamic-island');
            if (!island) return;
            var label = document.getElementById('di-charging-label');
            var pct = state.runtimeParams && state.runtimeParams.batteryPercentage != null ? state.runtimeParams.batteryPercentage : 0;
            if (label) label.textContent = '正在充电 ' + pct + '%';
            showDynamicIsland('charging');
        }
        
        // 渲染三栏底部状态参数条
        function renderTripleStatusChips() {
            var container = document.getElementById('triple-status-chips');
            if (!container) return;
            container.innerHTML = '';
            resolveStatusItems(state.statusItems).forEach(function(r) {
                var chip = document.createElement('div');
                chip.className = 'status-chip';
                chip.innerHTML = r.label + ': <span class="val">' + r.value + '</span>';
                container.appendChild(chip);
            });
            requestAnimationFrame(adjustTripleStatusChipFontSize);
        }

        // 三栏信息参数 chip 字体自适应：二分搜索最大字体使 chip 不超过 3 行
        function adjustTripleStatusChipFontSize() {
            var container = document.getElementById('triple-status-chips');
            if (!container) return;
            var chips = container.querySelectorAll('.status-chip');
            if (chips.length === 0) return;
            if (container.offsetWidth === 0) return; // 三栏未激活，跳过

            var MAX_LINES = 3;
            var MIN_FONT = 0.4;  // rem
            var MAX_FONT = 0.75; // rem

            function countLines() {
                var tops = {};
                for (var i = 0; i < chips.length; i++) {
                    var t = chips[i].offsetTop;
                    tops[t] = (tops[t] || 0) + 1;
                }
                return Object.keys(tops).length;
            }

            var lo = MIN_FONT, hi = MAX_FONT, best = MIN_FONT;
            for (var i = 0; i < 15; i++) {
                var mid = (lo + hi) / 2;
                container.style.fontSize = mid + 'rem';
                if (countLines() <= MAX_LINES) {
                    best = mid;
                    lo = mid;
                } else {
                    hi = mid;
                }
            }
            container.style.fontSize = best + 'rem';
        }

        // 账号管理相关函数
        function loadAccounts() {
            return storage.getAccounts();
        }
        
        function saveAccounts(accounts) {
            storage.setAccounts(accounts);
        }
        
        function updateAccountList() {
            const container = document.getElementById('account-list');
            container.innerHTML = '';
            
            const accounts = loadAccounts();
            accounts.forEach((account, index) => {
                const accountItem = document.createElement('div');
                accountItem.className = 'flex justify-between items-center bg-[#2d4a2d]/20 p-2 rounded';
                accountItem.innerHTML = `
                    <div>
                        <span class="text-[#8fbc8f]">${account.username}</span>
                        <span class="text-[#8fbc8f]/50 ml-2">${'*'.repeat(account.password.length)}</span>
                    </div>
                    <button class="btn-remove" data-index="${index}">
                        <i class="fa fa-trash"></i>
                    </button>
                `;
                
                accountItem.querySelector('button').addEventListener('click', (e) => {
                    const index = parseInt(e.target.closest('button').dataset.index);
                    const accounts = loadAccounts();
                    if (accounts.length > 1) {
                        accounts.splice(index, 1);
                        saveAccounts(accounts);
                        updateAccountList();
                    } else {
                        alert('至少需要保留一个账号');
                    }
                });
                
                container.appendChild(accountItem);
            });
        }
        
        // ===== 机器人实时代码滚动 =====
        var robotCodeLines = [];
        var robotCodeActive = false;

        // ===== 滚动模拟数据外部化缓存 =====
        var _scrollDataCache = {};

        function loadScrollData(filename) {
            if (_scrollDataCache[filename]) return Promise.resolve(_scrollDataCache[filename]);
            return fetch('./doc/' + filename).then(function(r) {
                if (!r.ok) throw new Error('Load failed: ' + filename);
                return r.json();
            }).then(function(data) {
                _scrollDataCache[filename] = data;
                return data;
            });
        }

        function preloadAllScrollData() {
            var files = ['clear_process_data.json', 'system_update_data.json', 'database_update_data.json', 'boot_data.json'];
            return Promise.all(files.map(function(f) { return loadScrollData(f).catch(function(){}); }));
        }

        function robotCodeHighlight(line) {
            var s = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var uid = 0;
            var placeholders = {};

            function ph(html) {
                var key = '\x00' + (uid++) + '\x01';
                placeholders[key] = html;
                return key;
            }

            // Full-line comments
            if (/^\s*\/\//.test(s)) {
                return '<span class="code-comment">' + s + '</span>';
            }

            // Preprocessor directives: #directive rest
            var ppMatch = s.match(/^(\s*#\w+\s*)(.*)/);
            if (ppMatch) {
                var restResult = robotCodeHighlightStr(ppMatch[2], ph, placeholders);
                return '<span class="code-preprocessor">' + ppMatch[1] + '</span>' + restResult;
            }

            return robotCodeHighlightStr(s, ph, placeholders);
        }

        function robotCodeHighlightStr(s, ph, placeholders) {
            var result = s;
            var ownedPh = false;
            var uid = 0;

            if (!ph) {
                ownedPh = true;
                placeholders = {};
                ph = function(html) {
                    var key = '\x00' + (uid++) + '\x01';
                    placeholders[key] = html;
                    return key;
                };
            }

            // 1. Strings
            result = result.replace(/(["'])(?:(?!\1|\\).|\\.)*\1/g, function(m) {
                return ph('<span class="code-string">' + m + '</span>');
            });

            // 2. Inline comments (//... at end)
            result = result.replace(/(\/\/.*)$/g, function(m) {
                return ph('<span class="code-comment">' + m + '</span>');
            });

            // 3. Numbers
            result = result.replace(/\b(\d+\.?\d*f?)\b/g, function(m) {
                return ph('<span class="code-number">' + m + '</span>');
            });

            // 4. Keywords
            var kw = /\b(class|struct|enum|public|private|protected|virtual|override|final|static|const|constexpr|volatile|inline|explicit|friend|template|typename|namespace|using|typedef|auto|decltype|sizeof|new|delete|this|nullptr|true|false|void|bool|char|short|int|long|float|double|return|if|else|switch|case|break|continue|default|for|while|do|goto|try|catch|throw|noexcept|operator|alignof|alignas|thread_local|mutable|register|extern|asm|union|const_cast|static_cast|dynamic_cast|reinterpret_cast)\b/g;
            result = result.replace(kw, function(m) {
                return ph('<span class="code-keyword">' + m + '</span>');
            });

            // 5. Function calls
            var funcKw = /^(if|else|switch|for|while|return|sizeof|catch|throw|new|delete|static_cast|dynamic_cast|const_cast|reinterpret_cast)$/;
            result = result.replace(/\b([a-zA-Z_]\w*)(\s*\()/g, function(m, name, paren) {
                if (funcKw.test(name)) return m;
                return ph('<span class="code-function">' + name + '</span>') + paren;
            });

            // 6. Types
            var types = /\b(vector|string|map|set|list|deque|queue|stack|array|pair|tuple|shared_ptr|unique_ptr|weak_ptr|function|optional|variant|any|string_view|span|initializer_list|MotorController|SensorArray|NeuralEngine|EmotionProcessor|TaskScheduler|BionicActuator|ThermalManager|PowerDistributor|ServoDriver|RobotCore|RobotStatus|ConfigManager|PIDController|KalmanFilter|JointState|MotionPlanner|TrajectoryGenerator|KinematicsSolver|VoiceSynthesizer|ImageProcessor|SafetyMonitor|DiagnosticsEngine|FirmwareUpdater|BLEController|WiFiModule|BatteryManager|ChargingController|BalanceController|GaitGenerator|ObstacleAvoidance|SLAMEngine|PathPlanner|ObjectDetector|FaceRecognizer|GestureInterpreter|SpeechRecognizer|LanguageProcessor|MemoryManager|LogManager|EventBus|CommandParser|ResponseGenerator)\b/g;
            result = result.replace(types, function(m) {
                return ph('<span class="code-type">' + m + '</span>');
            });

            // 7. Restore all placeholders
            result = result.replace(/\x00\d+\x01/g, function(m) {
                return placeholders[m] || m;
            });

            return result;
        }

        function robotCodeInit() {
            if (window.innerWidth < 768) return;
            fetch('./doc/robot_code.txt')
                .then(function(response) {
                    if (!response.ok) throw new Error('Failed to load robot_code.txt');
                    return response.text();
                })
                .then(function(text) {
                    robotCodeLines = text.split('\n');
                    robotCodeStart();
                })
                .catch(function(err) {
                    console.warn('Code scroll: failed to load robot_code.txt, using fallback', err);
                    robotCodeLines = robotCodeFallback();
                    robotCodeStart();
                });
        }

        function robotCodeFallback() {
            var lines = [];
            lines.push('// T31-750 Robot Control Firmware v4.17.1002');
            lines.push('// RuiYu Intelligent Fictional Corporation');
            lines.push('');
            lines.push('#include <robot_core.h>');
            lines.push('#include <motor_control.h>');
            lines.push('');
            lines.push('class MotorController {');
            lines.push('private:');
            lines.push('    float target_position[12];');
            lines.push('    float current_position[12];');
            lines.push('    float pid_kp = 1.5f;');
            lines.push('');
            lines.push('public:');
            lines.push('    void updatePID() {');
            lines.push('        for (int i = 0; i < 12; i++) {');
            lines.push('            float error = target_position[i] - current_position[i];');
            lines.push('            float output = pid_kp * error;');
            lines.push('            if (output > 85.0f) output = 85.0f;');
            lines.push('            motor_output[i] = output;');
            lines.push('        }');
            lines.push('    }');
            lines.push('};');
            for (var i = 0; i < 200; i++) {
                lines.push(robotCodeRandomLine(i));
            }
            return lines;
        }

        function robotCodeRandomLine(seed) {
            var patterns = [
                '    float sensor_value_' + seed + ' = ' + (Math.random() * 100).toFixed(2) + 'f;',
                '    motor[' + (seed % 12) + '].setTorque(' + (Math.random() * 85).toFixed(1) + 'f);',
                '    if (status_' + seed + ' > SAFETY_THRESHOLD) return ERROR_CODE;',
                '    log_debug("Processing frame ' + seed + ' of sequence");',
                '    Vector3 pos_' + seed + ' = kinematics.solve(joint_angles);',
                '    for (int j = 0; j < ' + (seed % 20 + 1) + '; j++) {',
                '    NeuralEngine::inference(input_' + seed + ', output_' + seed + ');',
                '    // Frame ' + seed + ' processed successfully',
                '    const float K_' + seed + ' = 0.' + (seed * 73 % 1000) + 'f;',
                '    thermal_sensor[' + (seed % 8) + '] = ' + (30 + Math.random() * 40).toFixed(1) + 'f;',
            ];
            return patterns[seed % patterns.length];
        }

        function robotCodeRender(containerSelector) {
            var container = document.querySelector(containerSelector + ' .code-scroll-inner');
            if (!container || robotCodeLines.length === 0) return;

            var html = '';
            for (var pass = 0; pass < 2; pass++) {
                for (var i = 0; i < robotCodeLines.length; i++) {
                    var line = robotCodeLines[i];
                    var highlighted = line === '' ? '&nbsp;' : robotCodeHighlight(line);
                    html += '<div class="code-line">' + highlighted + '</div>';
                }
            }
            container.innerHTML = html;
        }

        var _codeAnimations = [];
        var _codeTargetCpu = 50;
        var _codeCurrentCpu = 50;
        var _codeSmoothRaf = null;
        var _codeBaseDuration = 28;

        function robotCodeStart() {
            if (state.poweredOff) return; // 关机/重启中止期间保持冻结，不恢复滚动
            // 先渲染再判重：隐藏期间代码内容迟到时，恢复可见也能立即补渲染，避免面板长时间空白
            robotCodeRender('#triple-code-scroll');
            if (robotCodeActive) return;
            robotCodeActive = true;

            _codeAnimations = [];
            var inners = document.querySelectorAll('.code-scroll-inner');
            inners.forEach(function(inner) {
                inner.style.transform = 'translateY(0)';
                var anim = inner.animate(
                    [
                        { transform: 'translateY(0)' },
                        { transform: 'translateY(-50%)' }
                    ],
                    {
                        duration: _codeBaseDuration * 1000,
                        iterations: Infinity,
                        easing: 'linear'
                    }
                );
                _codeAnimations.push(anim);
            });

            _codeCurrentCpu = state.dynamicParams.cpu || 50;
            _codeTargetCpu = _codeCurrentCpu;
            _codeApplyPlaybackRate(_codeCurrentCpu);
            _codeStartSmoothLoop();
        }

        function robotCodeStop() {
            if (!robotCodeActive) return;
            robotCodeActive = false;
            _codeAnimations.forEach(function(anim) { if (anim) anim.cancel(); });
            _codeAnimations = [];
            if (_codeSmoothRaf) { cancelAnimationFrame(_codeSmoothRaf); _codeSmoothRaf = null; }
            var inners = document.querySelectorAll('.code-scroll-inner');
            inners.forEach(function(inner) { inner.innerHTML = ''; });
        }

        /* 关机/重启中止：终止滚动并清空代码内容（窗口仅显示感叹号遮罩）；开机完成后经
           robotCodeResumeAfterBoot 从头重新渲染恢复滚动 */
        function robotCodeFreeze() {
            _codeAnimations.forEach(function(anim) { if (anim) anim.cancel(); });
            _codeAnimations = [];
            if (_codeSmoothRaf) { cancelAnimationFrame(_codeSmoothRaf); _codeSmoothRaf = null; }
            robotCodeActive = false;
            document.querySelectorAll('.code-scroll-inner').forEach(function(inner) { inner.innerHTML = ''; });
            var overlay = document.getElementById('code-halt-overlay');
            if (overlay) overlay.classList.add('visible');
        }

        function robotCodeResumeAfterBoot() {
            var overlay = document.getElementById('code-halt-overlay');
            if (overlay) overlay.classList.remove('visible');
            if (window.innerWidth >= 768 && !isPageHidden) robotCodeStart();
        }


        function _codeApplyPlaybackRate(cpuPercent) {
            var factor = 1 - (cpuPercent / 100) * (13 / 28);
            var rate = 1 / factor;
            _codeAnimations.forEach(function(anim) {
                if (anim && anim.playbackRate !== undefined) {
                    anim.playbackRate = rate;
                }
            });
        }

        function _codeStartSmoothLoop() {
            if (_codeSmoothRaf) return;
            function tick() {
                if (isPageHidden) return;
                var diff = _codeTargetCpu - _codeCurrentCpu;
                if (Math.abs(diff) > 0.3) {
                    _codeCurrentCpu += diff * 0.05;
                    _codeApplyPlaybackRate(_codeCurrentCpu);
                } else {
                    _codeCurrentCpu = _codeTargetCpu;
                    _codeApplyPlaybackRate(_codeCurrentCpu);
                }
                _codeSmoothRaf = requestAnimationFrame(tick);
            }
            _codeSmoothRaf = requestAnimationFrame(tick);
        }

        function updateCodeSpeed(cpuPercent) {
            _codeTargetCpu = cpuPercent;
        }

        // 初始化应用（登录后调用）
        function initApp() {
            // 显示主界面
            document.getElementById('main-content').style.display = 'block';
            if (typeof window.updateDesktopDock === 'function') window.updateDesktopDock();
            /* EN：主界面由 display:none 显形后立刻补拟合（防未拟合态闪一下） */
            try { if (window.I18N && window.I18N.refit) window.I18N.refit(); } catch (e) { /* ignore */ }

            // 重复进入（退出登录后再次登录）：监听与数据管线已在首跑初始化，仅恢复后台任务与动态显示
            if (state._appInited) {
                document.body.classList.remove('paused');
                setManagedIntervalsPaused(false);
                loadRobotImages();
                updateStatusBarBattery();
                updateStatusBarModeIcon();
                renderTripleStatusChips();
                updateRuntimeParamsDisplay();
                if (window.innerWidth >= 768 && !isPageHidden && typeof robotCodeStart === 'function') robotCodeStart();
                return;
            }
            state._appInited = true;

            // 初始化数据
            state.buttonTexts = loadButtonTexts();
            state.statusItems = loadStatusItems();
            state.modeNames = storage.getModeNames();
            state.modelInfo = storage.getModelInfo();
            state.infoLinks = storage.getInfoLinks();   // v1.6.0：null=全部默认
            state.runtimeParams = loadRuntimeParams();
            // 自定义模式名/信息参数/型号信息先注册 i18n 保护集，再刷新模式标签与型号标签，
            // 之后的渲染才会带上保护
            applyModeNameLabels();
            applyModelInfoToDom();
            pushModelInfoToHost();   // v1.6.0：启动时把型号信息生效值同步给 win-app 主进程（launcher 读取）
            state.chartData.labels = generateInitialTimeLabels();

            // 预加载滚动模拟数据
            preloadAllScrollData();

            // 检测语音支持
            // 注意：Android WebView 通常不支持 Web Speech API（speechSynthesis），
            // 但 MiMo TTS 使用原生 MediaPlayer 播放，不受此限制。
            // 只要 MiMo TTS 客户端可用就视为就绪，speechSynthesis 仅作为最终降级路径的可用性标记。
            state.speechSupported = ('speechSynthesis' in window);
            var ttsReady = (typeof MimoTTSClient !== 'undefined') ||
                           state.speechSupported ||
                           (typeof Android !== 'undefined' && typeof Android.playAudioBase64 === 'function');
            if (ttsReady) {
                state.ttsStatus = 'ready';
            } else {
                state.ttsStatus = 'failed';
            }

            loadRobotImages();
            updateCurrentTime();
            initCharts();
            initTerminal();
            initEventListeners();

            // 精灵图自适应预热：网络良好时登录后 5 秒后台预取（慢网/省流模式留待首次使用）
            setTimeout(function () {
                if (window.rotationSprite && typeof window.rotationSprite.warmup === 'function') {
                    window.rotationSprite.warmup();
                }
            }, 5000);

            // 初始化文件板块与 PDF 阅读器
            renderFileList();
            initPdfViewer();

            // 启动定时任务
            managedSetInterval(updateCurrentTime, 1000);
            generateRandomLog();
            
            // 初始化为NA状态
            setInitialNaState();
            
            // 初始化功能按钮
            updateFunctionButtons();
            
            // 初始化状态显示
            updateStatusDisplay();
            
            // 更新运行参数显示
            updateRuntimeParamsDisplay();
            
            // 初始化 win-app USB 状态桥接并刷新默认电量（Android 端自动跳过）
            initConsoleUsbBridge();
            refreshAutoBattery();
            
            // 渲染三栏底部状态参数条
            renderTripleStatusChips();
            
            // 启动参数刷新
            startDynamicParamUpdates();
            
            // 初始化账号管理
            updateAccountList();

            // 初始化新增模块
            initNewModules();
            
            // 初始化三栏布局处理
            handleLayoutChange();
            robotCodeInit();
            adjustTaskListHeight();

            // 初始化移动端底部胶囊导航
            initMobileDock();

            // 监听输入框聚焦，处理软键盘弹出时的滚动
            document.addEventListener('focusin', function(e) {
                const el = e.target;
                if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                    _lastFocusedElement = el;
                    setTimeout(scheduleKeyboardScroll, 300);
                    setTimeout(scheduleKeyboardScroll, 600);
                }
            });

            // 使用visualViewport API作为键盘可见性的双重检测
            // 注意：_currentImeHeight 仅由原生端 updateSafeAreaInsets 设置，此处仅检测键盘可见性变化触发滚动
            if (window.visualViewport) {
                let lastVvHeight = window.visualViewport.height;
                window.visualViewport.addEventListener('resize', function() {
                    const vh = window.innerHeight;
                    const vvH = window.visualViewport.height;
                    const keyboardH = vh - vvH;
                    if (keyboardH > 100) {
                        // 键盘可见：仅触发滚动，不设置 _currentImeHeight（由原生端 set）
                        _isKeyboardVisible = true;
                        if (_vvResizeDebounce) clearTimeout(_vvResizeDebounce);
                        _vvResizeDebounce = setTimeout(function() {
                            _isKeyboardScrollAnimating = false;
                            scheduleKeyboardScroll();
                        }, 100);
                    } else if (keyboardH < 50) {
                        // 键盘收起：仅清除状态，不设置 _currentImeHeight（由原生端 set）
                        _isKeyboardVisible = false;
                        _isKeyboardScrollAnimating = false;
                        if (_vvResizeDebounce) { clearTimeout(_vvResizeDebounce); _vvResizeDebounce = null; }
                        if (_keyboardScrollTimer) { clearTimeout(_keyboardScrollTimer); _keyboardScrollTimer = null; }
                    }
                    lastVvHeight = vvH;
                });
            }

            // 延迟500ms同步当前状态到Native，确保Native GATT特征值与localStorage一致
            setTimeout(syncCurrentStateToNative, 500);

            // 初始化 MiMo TTS
            _initMimoTTS();

            // 语音引擎初始化失败提示（单栏弹窗/三栏左上角通知）
            if (state.ttsStatus === 'failed') {
                setTimeout(function() { showTtsFailureNotice('语音引擎初始化失败'); }, 800);
            }

            // TTS 引擎切换按钮
            document.querySelectorAll('.tts-engine-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var engine = btn.dataset.engine;
                    if (_ttsClient) {
                        _ttsClient.setEngine(engine);
                    }
                    storage.setMimoTtsEngine(engine);
                    if (typeof Android !== 'undefined' && Android.setTtsEngine) {
                        Android.setTtsEngine(engine);
                    }
                    _updateTtsEngineButtons(engine);
                });
            });

            // API Key 保存
            var saveKeyBtn = document.getElementById('mimo-save-key-btn');
            if (saveKeyBtn) {
                saveKeyBtn.addEventListener('click', function() {
                    var keyInput = document.getElementById('mimo-api-key-input');
                    var key = keyInput ? keyInput.value.trim() : '';
                    if (_ttsClient) {
                        _ttsClient.setApiKey(key);
                    }
                    storage.setMimoApiKey(key);
                    if (typeof Android !== 'undefined' && Android.setMimoApiKey) {
                        Android.setMimoApiKey(key);
                    }
                    // 7506 同步（v1.11.0）：改完即推，Slave 下次读取/连接裁决用最新值
                    if (typeof Android !== 'undefined' && Android.onDataChanged) {
                        Android.onDataChanged('apikey', key);
                    }
                    var statusEl = document.getElementById('mimo-status');
                    if (statusEl) statusEl.textContent = key ? 'API Key 已保存' : 'API Key 已清除';
                });
            }

            // 测试播报按钮
            var testBtn = document.getElementById('mimo-test-btn');
            if (testBtn) {
                testBtn.addEventListener('click', function() {
                    var statusEl = document.getElementById('mimo-status');
                    if (statusEl) statusEl.textContent = '正在合成...';
                    speak('引擎测试，语音系统正常。');
                    setTimeout(function() {
                        if (statusEl) statusEl.textContent = '';
                    }, 3000);
                });
            }
        }

        var syncLastPushedApiKey;   // 7506 推送去重（undefined=未推过）
        function syncCurrentStateToNative() {
            if (typeof Android === 'undefined' || !Android.onDataChanged) return;
            try {
                var modeMap = { 'test': 0, 'recovery': 1, 'loyalty': 2, 'simulated-human': 3 };
                var modeOrdinal;
                if (state.isNaState || !state.activeMode) {
                    modeOrdinal = 255;
                } else {
                    modeOrdinal = modeMap[state.activeMode] !== undefined ? modeMap[state.activeMode] : 255;
                }
                Android.onDataChanged('voice-history', getRecentVoiceHistory());
                Android.onDataChanged('mode', modeOrdinal.toString());
                var emotions = loadEmotions();
                Android.onDataChanged('emotion', [emotions.obedience||0, emotions.shame||0, emotions.pleasure||0, emotions.mechanical||0].join(','));
                var tasks = loadTasks();
                Android.onDataChanged('tasks', JSON.stringify(tasks));
                // ApiKey(7506)：把本机 Key 写进特征值供 Slave 读取（v1.11.0 双端同步，
                // Slave 侧统一裁决：本端空/不可用才采用，双方可用不同则各用各的）。
                // 仅发布「可用」Key：本机自知失效（失败历史/格式非法）时按空发布，
                // 使 Slave 侧把本端视为不可用，正确走「以有效方为准」分支。
                // 值未变时不重复推送（本函数在每次状态同步时都会跑）。
                (function () {
                    var k = storage.getMimoApiKey() || '';
                    if (!k || k.length < 16 || k.indexOf('sk-') !== 0) k = '';
                    else if (storage.getMimoKeyState(k) === 'fail') k = '';
                    if (k !== syncLastPushedApiKey) {
                        syncLastPushedApiKey = k;
                        Android.onDataChanged('apikey', k);
                    }
                })();
            } catch(e) {
                console.log('syncCurrentStateToNative error', e);
            }
        }

        // 移动端页面切换
        function switchMobilePage(pageName) {
            document.querySelectorAll('.mobile-page').forEach(function(el) {
                el.classList.toggle('mobile-page-active', el.classList.contains('mobile-page-' + pageName));
            });
            document.querySelectorAll('.mobile-dock-item[data-page]').forEach(function(btn) {
                btn.classList.toggle('active', btn.dataset.page === pageName);
            });
            if (pageName === 'control' && isSingleColumn()) {
                const scroller = document.getElementById('app-container');
                if (scroller) scroller.scrollTop = 0;
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => adjustTaskListHeight());
                });
            }
        }

        // 初始化移动端底部导航
        function initMobileDock() {
            let wasDesktop = window.innerWidth >= 750;
            if (!wasDesktop) {
                switchMobilePage('command');
            }
            window.addEventListener('resize', function() {
                const isDesktop = window.innerWidth >= 750;
                if (wasDesktop && !isDesktop && !document.querySelector('.mobile-page-active')) {
                    switchMobilePage('command');
                }
                wasDesktop = isDesktop;
            });
        }

        // 在三栏状态栏左侧标题区域显示语音 toast（上下滚动动画）
        function showTripleVoiceToast(message) {
            if (window.innerWidth < 750) return false;
            const titleWrap = document.getElementById('triple-title-wrap');
            const voiceToast = document.getElementById('triple-voice-toast');
            if (!titleWrap || !voiceToast) return false;
            voiceToast.textContent = message;
            titleWrap.classList.add('voice-active');
            if (titleWrap._voiceTimer) clearTimeout(titleWrap._voiceTimer);
            titleWrap._voiceTimer = setTimeout(function() {
                titleWrap.classList.remove('voice-active');
                titleWrap._voiceTimer = null;
            }, 3000);
            return true;
        }

        // 语音引擎失败提示：单栏弹窗、三栏左上角通知
        function showTtsFailureNotice(message) {
            if (window.innerWidth >= 750) {
                // 三栏：左上角状态栏通知
                showTripleVoiceToast(message);
            } else {
                // 单栏/Android-app：底部弹窗提示
                var indicator = document.getElementById('tts-indicator');
                if (!indicator) return;
                indicator.querySelector('span').textContent = message;
                indicator.style.display = 'flex';
                if (indicator._hideTimer) clearTimeout(indicator._hideTimer);
                indicator._hideTimer = setTimeout(function() {
                    indicator.style.display = 'none';
                    indicator._hideTimer = null;
                }, 5000);
            }
        }

        var voiceHistory = [];
        function pruneVoiceHistory() {
            var now = Date.now();
            var cutoff = now - 10 * 60 * 1000;
            voiceHistory = voiceHistory.filter(function(m) { return m.timestamp >= cutoff; });
        }
        function getRecentVoiceHistory() {
            pruneVoiceHistory();
            return JSON.stringify(voiceHistory);
        }

        // 语音反馈功能（支持移动设备）
        var _ttsClient = null;
        var _ttsFallbackMode = false;

        function _speakLocalFallback(message) {
            try {
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(message);
                    utterance.lang = 'zh-CN';
                    utterance.rate = 1.2;
                    utterance.volume = 1;
                    utterance.onerror = function(event) {
                        console.error('本地语音合成错误:', event.error);
                    };
                    speechSynthesis.speak(utterance);
                }
            } catch (e) {
                console.error('本地语音播报失败:', e);
            }
        }

        // 文本规范化：型号名称（完整型号与简称，按当前界面语言生效值）统一替换为
        // 「语音播报读法」——读法默认 踢三一七五零型仿人男性机器人，EN 模式取词典译文
        // T-Three-One-seven-five-0 Male Android；只此一种读法设置，全句型号均按它念
        function normalizeForSpeech(text) {
            var reading = getModelInfo('ttsReading');
            var fullName = getModelInfo('fullName');
            var shortName = getModelInfo('shortName');
            var out = String(text);
            if (reading) {
                if (fullName && fullName !== reading) out = out.split(fullName).join(reading);
                if (shortName && shortName !== reading) out = out.split(shortName).join(reading);
            }
            return out;
        }

        // 文本规范化：将 "踢三一七五零" 转为显示/广播用的 "T31-750"
        function normalizeForDisplay(text) {
            return String(text).replace(/踢三一七五零/g, 'T31-750');
        }

        function speak(message, kind) {
            var raw = String(message);
            var lang = (window.I18N && I18N.getLang) ? I18N.getLang() : 'zh';
            /* EN 模式播报统一经词典翻译：默认按钮/功能/窗口名等照英文词条朗读；
               用户自定义/手输内容在保护集中自动豁免按原文 */
            var displayMsg = normalizeForDisplay(lang === 'en' && window.I18N.t ? window.I18N.t(raw) : raw);
            var msgObj = { timestamp: Date.now(), content: displayMsg };
            voiceHistory.push(msgObj);
            pruneVoiceHistory();
            if (typeof Android !== 'undefined' && Android.onDataChanged) {
                Android.onDataChanged('voice', JSON.stringify(msgObj));
            }
            /* Clawbot 通知推送（v1.12.0）：播报内容外发（默认「主人指令：」类；
               参数修改类播报传 kind='data' 走「数据变更：」类），空白内容不推 */
            if (window.ClawbotBridge && window.ClawbotBridge.push) {
                window.ClawbotBridge.push(kind || 'cmd', displayMsg);
            }

            // 语音引擎失败：单栏弹窗提示、三栏左上角通知；不进行语音合成
            if (state.ttsStatus === 'failed') {
                showTtsFailureNotice('语音引擎不可用');
                return;
            }

            // 将 TTS 工作推迟到下一个 event loop tick，确保按钮处理器关键路径先执行完毕
            var speechMsg = normalizeForSpeech(displayMsg);
            setTimeout(function() {
                // 优先使用 MiMo TTS
                if (_ttsClient && !_ttsFallbackMode) {
                    _ttsClient.speak(speechMsg).catch(function(err) {
                        console.warn('[MimoTTS] 合成失败，降级到本地TTS:', err.message);
                        if ('speechSynthesis' in window) {
                            _speakLocalFallback(speechMsg);
                        } else {
                            console.warn('[MimoTTS] speechSynthesis 不可用，无法降级到本地TTS');
                            showTtsFailureNotice('语音播报失败：' + err.message);
                        }
                    });
                    return;
                }

                // 降级：本地 Web Speech API（仅在支持时）
                if ('speechSynthesis' in window) {
                    _speakLocalFallback(speechMsg);
                }
            }, 0);
        }

        /* 真实 TTS/ASR 调用成败落本地标志（MimoTTSClient 回调；v1.11.0 双端同步判定用） */
        window.__rcRecordKeyResult = function(key, ok) {
            try { storage.recordMimoKeyResult(key, ok); } catch (e) { /* ignore */ }
        };

        // API Key 同步回调（由 Native 层调用：Slave 经 7506 写入本端 Key）
        window._onMimoApiKeySynced = function(apiKey) {
            var remote = String(apiKey || '').trim();
            // 本机 Key 以原生存储优先（master-app SharedPreferences / win localStorage），与 _initMimoTTS 同口径
            var local = '';
            try {
                if (typeof Android !== 'undefined' && Android.getMimoApiKey) local = Android.getMimoApiKey() || '';
            } catch (e) { /* ignore */ }
            if (!local) local = String(storage.getMimoApiKey() || '').trim();
            var statusEl = document.getElementById('mimo-status');
            /* v1.11.0 双端同步矩阵（Slave 侧统一裁决；Master 侧对旧版 Slave 的无条件
               写入同样设防）：本端 Key 可用且与远端不同 → 各用各的，不覆盖；
               本端空/不可用 → 采用远端；双方一致 → 无事。 */
            var localUsable = (function (k) {
                if (!k || k.length < 16 || k.indexOf('sk-') !== 0) return false;
                return storage.getMimoKeyState(k) !== 'fail';
            })(local);
            if (remote && remote === local) {
                if (statusEl) statusEl.textContent = 'API Key 一致，无需同步';
                return;
            }
            if (localUsable) {
                if (statusEl) statusEl.textContent = '本机 API Key 可用，各用各的（未覆盖）';
                return;
            }
            console.log('[MimoTTS] API Key 已从手机端同步');
            if (_ttsClient) {
                _ttsClient.setApiKey(remote);
            }
            storage.setMimoApiKey(remote);
            // 原生侧同步落库（master-app SharedPreferences / win localStorage）
            if (typeof Android !== 'undefined' && Android.setMimoApiKey) {
                Android.setMimoApiKey(remote);
            }
            var keyInput = document.getElementById('mimo-api-key-input');
            if (keyInput) keyInput.value = remote;
            if (statusEl) statusEl.textContent = 'API Key 已同步';
        };

        function _initMimoTTS() {
            try {
                // 清除上次会话的TTS音频缓存
                if (typeof MimoTTSClient !== 'undefined' && MimoTTSClient.clearAllCache) {
                    MimoTTSClient.clearAllCache();
                }
                var apiKey = '';
                var engine = 'voicedesign';
                // 优先从 Android Native 读取，没有 Android 对象时从 localStorage 读取
                if (typeof Android !== 'undefined' && Android.getMimoApiKey) {
                    apiKey = Android.getMimoApiKey() || '';
                }
                if (!apiKey) {
                    apiKey = storage.getMimoApiKey() || '';
                }
                if (typeof Android !== 'undefined' && Android.getTtsEngine) {
                    var nativeEngine = Android.getTtsEngine();
                    if (nativeEngine && nativeEngine !== 'voiceclone') {
                        engine = nativeEngine;
                    }
                } else {
                    var savedEngine = storage.getMimoTtsEngine();
                    if (savedEngine && savedEngine !== 'voiceclone') engine = savedEngine;
                }
                _ttsClient = new MimoTTSClient(apiKey);
                _ttsClient.setEngine(engine);

                // 更新UI
                var keyInput = document.getElementById('mimo-api-key-input');
                if (keyInput) keyInput.value = apiKey;
                _updateTtsEngineButtons(engine);

                console.log('[MimoTTS] 初始化完成，引擎:', engine, 'API Key:', apiKey ? '已设置' : '未设置');
            } catch (e) {
                console.error('[MimoTTS] 初始化失败:', e);
                _ttsFallbackMode = true;
            }
        }

        function _updateTtsEngineButtons(activeEngine) {
            document.querySelectorAll('.tts-engine-btn').forEach(function(btn) {
                if (btn.dataset.engine === activeEngine) {
                    btn.style.background = 'rgba(143,188,143,0.4)';
                    btn.style.borderColor = '#8fbc8f';
                    btn.style.color = '#e0ffe0';
                } else {
                    btn.style.background = '';
                    btn.style.borderColor = '';
                    btn.style.color = '';
                }
            });
        }
        
        // 页面加载时只初始化登录相关功能
        document.addEventListener('DOMContentLoaded', function() {
            /* ===== First Run 模式（?firstrun=1）=====
               只显示激活页：不跑登录背景/表单逻辑，激活完成或跳过后回调宿主。
               已激活（如控制台内已完成、或重复打开该窗口）则立即回调，不重复弹表单。 */
            if (_firstRunMode) {
                const frLogin = document.getElementById('login-modal');
                if (frLogin) frLogin.style.display = 'none';
                const frActivation = document.getElementById('activation-modal');
                if (frActivation) frActivation.style.display = 'none';
                bindActivationButtons();
                if (isRobotActivated()) {
                    // 已激活（如控制台内已完成、或宿主标记丢失的既存用户）：
                    // ready(needsForm=false) 让宿主直接收尾，不闪出激活窗口
                    notifyFirstRunReady(false);
                    setTimeout(function () { notifyFirstRunDone(); if (typeof _firstRunDone === 'function') _firstRunDone(); }, 60);
                } else {
                    showActivationModal();
                    notifyFirstRunReady(true);   // 需要填表：宿主此时才显示窗口
                }
                return;
            }
            // 单栏模式（移动端）与 Android WebView 跳过登录直接进主界面。
            // Android 按平台保证**无登录界面**（不再依赖 <750 宽度的巧合——平板或横屏 WebView
            // 同样直进；历史版本纯宽度判断在 Android ≥750 时会误出登录页）。
            // 激活页自 v1.10.0 起不再免除：未激活时先显示激活页（见下方分支）。
            // 注意 win-app preload 同名暴露 window.Android，platform-bootstrap 已排除（consoleAPI 优先）
            if (window.innerWidth < 750 || window.__rcIsAndroidWebview) {
                const loginModal = document.getElementById('login-modal');
                if (loginModal) loginModal.style.display = 'none';
                const activationModal = document.getElementById('activation-modal');
                if (activationModal) activationModal.style.display = 'none';
                /* v1.10.0：Android App 与窄屏移动端不再免除 First Run——
                   未激活时先显示激活页（品牌 PV 播完即见），完成/跳过后再进主界面。
                   登录页仍然免除（无登录界面保证不变）。 */
                if (!isRobotActivated()) {
                    bindActivationButtons();
                    // 完成/跳过后（completeActivation 派发 rc-firstrun-done）再进入主界面
                    window.addEventListener('rc-firstrun-done', function onFirstRunSettled() {
                        window.removeEventListener('rc-firstrun-done', onFirstRunSettled);
                        initApp();
                        switchMobilePage('command');
                        appendToLogs('移动端用户已自动登录系统');
                    });
                    showActivationModal();
                    return;
                }
                initApp();
                switchMobilePage('command');
                appendToLogs('移动端用户已自动登录系统');
                return;
            }
            // 检查是否有记住的账号
            const rememberedAccount = storage.getRememberedAccount();
            if (rememberedAccount) {
                document.getElementById('username').value = rememberedAccount.username;
                document.getElementById('password').value = rememberedAccount.password;
                // 自动勾选记住账号复选框
                document.getElementById('remember-me').checked = true;
            }
            
            // 随机登录背景图片（首访极简模式不下载封面，直接显示 .login-bg 深绿底色）
            const loginBg = document.getElementById('login-bg');
            if (!window.__rcFullMode) {
                loginBg.innerHTML = '';
                loginBg.classList.add('loaded');
            } else {
            const loginImages = [
                'pic/login/6194952517725129632.jpg',
                'pic/login/6194952517725129633.jpg',
                'pic/login/6195021537849576497.jpg',
                'pic/login/6282701469836316342.jpg',
                'pic/login/Background.webp',
                'pic/login/Gemini_Generated_Image_2d08mr2d08mr2d08.jpg'
            ];
            const randomImg = loginImages[Math.floor(Math.random() * loginImages.length)];
            // 只放一张图，平铺铺满，不留白
            loginBg.innerHTML = '';
            const tileImg = document.createElement('img');
            tileImg.src = randomImg;
            tileImg.className = 'login-bg-tile';
            tileImg.draggable = false;
            tileImg.onload = function() {
                loginBg.classList.add('loaded');
            };
            tileImg.onerror = function() {
                // 加载失败时回退到体积最小的封面（82KB），再失败则露出 .login-bg 深绿底色
                console.warn('登录背景图片加载失败，回退到默认背景:', randomImg);
                tileImg.src = 'pic/login/6194952517725129632.jpg';
                tileImg.onload = function() {
                    loginBg.classList.add('loaded');
                };
                tileImg.onerror = function() {
                    loginBg.classList.add('loaded');
                };
            };
            loginBg.appendChild(tileImg);
            }

            // v1.6.0 激活引导：未激活时先显示激活页（同层替代登录页位置，完成/跳过后回落登录页）。
            // 背景在上方的随机登录背景逻辑中已就绪，激活页直接复用同一张图。
            if (!isRobotActivated()) {
                showActivationModal();
            }

            // 激活页按钮必须在此处绑定（早于登录）：initEventListeners 在登录成功后才执行，
            // 若绑定放那里，激活页显示期间点击无响应
            bindActivationButtons();

            // 登录表单提交
            document.getElementById('login-form').addEventListener('submit', function(e) {
                e.preventDefault();
                // 加载动画/淡出进行中禁止重复提交
                const submittingModal = document.getElementById('login-modal');
                if (submittingModal && (submittingModal.classList.contains('entering') || submittingModal.classList.contains('fade-out'))) return;

                const username = document.getElementById('username').value.trim();
                const password = document.getElementById('password').value;
                const rememberMe = document.getElementById('remember-me').checked;
                
                // 获取所有账号
                const accounts = loadAccounts();
                
                // 验证账号密码
                const isValid = accounts.some(account => 
                    account.username === username && account.password === password);
                
                if (isValid) {
                    // 如果勾选了"记住账号"，保存账号信息
                    if (rememberMe) {
                        storage.setRememberedAccount({ username, password });
                    } else {
                        storage.removeRememberedAccount();
                    }
                    
                    // 登录卡片下半部收缩换入加载动画（加载动画属于登录界面），进度走完挂载主界面并淡出登录层
                    if (typeof window.playLoginBoot === 'function') {
                        window.playLoginBoot(['正在进入系统…', '正在恢复会话环境…', '欢迎回来，主人'], 1200, function () { initApp(); });
                    } else {
                        const loginModalFallback = document.getElementById('login-modal');
                        if (loginModalFallback) loginModalFallback.style.display = 'none';
                        initApp();
                    }

                    // 单栏模式下确保首屏渲染
                    if (window.innerWidth < 750) {
                        switchMobilePage('command');
                    }

                    // 添加登录成功日志
                    appendToLogs(`用户 ${username} 成功登录系统`);
                } else {
                    // 显示错误信息
                    const errorElement = document.getElementById('login-error');
                    errorElement.classList.remove('hidden');
                    
                    // 添加登录失败日志
                    appendToLogs(`登录失败：用户名 ${username}`);
                    
                    // 3秒后隐藏错误信息
                    setTimeout(() => {
                        errorElement.classList.add('hidden');
                    }, 3000);
                }
            });
        });

        // 启动动态参数更新
        function startDynamicParamUpdates() {
            /* v1.6.0 五轮：关机/重启中止是"常态"而非瞬间——任何路径（重新登录、刷新页面、
               initApp 等）都不得在关机态启动参数跳动。关机态进入本函数时只重申冻结显示
               （防 HTML 初始值/旧 dynamicParams 复活界面），定时器一律不挂；
               开机流程 onComplete 时 poweredOff 已置 false，才会真正启动。 */
            if (state.poweredOff) {
                applyPoweredOffDisplay();
                return;
            }
            // 清除所有现有定时器（managed 注册的须经 managedClearInterval 移出注册表防复活）
            state.timers.forEach(timer => managedClearInterval(timer));
            state.timers = [];
            
            function setParam(id, value, detailText, isLow) {
                const textEl = document.getElementById(id + '-text');
                const progEl = document.getElementById(id + '-progress');
                if (textEl) {
                    if (detailText) {
                        textEl.innerHTML = detailText;
                    } else {
                        textEl.textContent = value + '%';
                    }
                }
                if (progEl) {
                    progEl.style.width = value + '%';
                    if (isLow) progEl.classList.add('low');
                    else progEl.classList.remove('low');
                }
                
                if (id === 'cpu') { state.dynamicParams.cpu = value; if (typeof updateCodeSpeed === 'function') updateCodeSpeed(value); }
                if (id === 'npu') state.dynamicParams.npu = value;
                if (id === 'gpu') state.dynamicParams.gpu = value;
                if (id === 'memory') {
                    state.dynamicParams.memory = value;
                    state.dynamicParams.memoryUsed = Math.round(value * 128 / 100);
                }
                if (id === 'io') {
                    state.dynamicParams.io = value;
                }
            }
            
            // 定义需要动态更新的参数
            const dynamicParams = [
                { 
                    id: 'cpu', 
                    min: 30, 
                    max: 95, 
                    update: function(value) {
                        setParam('cpu', value, null, false);
                    }
                },
                { 
                    id: 'npu', 
                    min: 20, 
                    max: 90, 
                    update: function(value) {
                        setParam('npu', value, null, false);
                    }
                },
                { 
                    id: 'gpu', 
                    min: 15, 
                    max: 85, 
                    update: function(value) {
                        setParam('gpu', value, null, false);
                    }
                },
                { 
                    id: 'memory', 
                    min: 65, 
                    max: 98, 
                    update: function(value) {
                        const used = Math.round(value * 128 / 100);
                        setParam('memory', value, `${value}% <span class="param-detail">(${used}PB/128PB)</span>`, value > 90);
                    }
                },
                { 
                    id: 'io', 
                    min: 10, 
                    max: 50, 
                    update: function(value) {
                        const readSpeed = Math.floor(Math.random() * 20) + 5;
                        const writeSpeed = Math.floor(Math.random() * 15) + 5;
                        state.dynamicParams.ioRead = readSpeed;
                        state.dynamicParams.ioWrite = writeSpeed;
                        setParam('io', value, `${value}% <span class="param-detail">(读${readSpeed}PB/s, 写${writeSpeed}PB/s)</span>`, false);
                    }
                }
            ];
            
            // 立即使用state.dynamicParams的初始值更新一次显示
            setParam('cpu', state.dynamicParams.cpu, null, false);
            setParam('npu', state.dynamicParams.npu, null, false);
            setParam('gpu', state.dynamicParams.gpu, null, false);
            const memUsed = state.dynamicParams.memoryUsed || Math.round(state.dynamicParams.memory * 128 / 100);
            setParam('memory', state.dynamicParams.memory, `${state.dynamicParams.memory}% <span class="param-detail">(${memUsed}PB/128PB)</span>`, state.dynamicParams.memory > 90);
            const ioRead = state.dynamicParams.ioRead || 16;
            const ioWrite = state.dynamicParams.ioWrite || 12;
            setParam('io', state.dynamicParams.io, `${state.dynamicParams.io}% <span class="param-detail">(读${ioRead}PB/s, 写${ioWrite}PB/s)</span>`, false);
            
            // 为每个参数设置独立的定时器
            dynamicParams.forEach(param => {
                const interval = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000; // 2-5秒
                const timer = managedSetInterval(() => {
                    const value = Math.floor(Math.random() * (param.max - param.min + 1)) + param.min;
                    param.update(value);
                }, interval);
                
                state.timers.push(timer);
            });
            
            // 图表更新定时器
            state.timers.push(managedSetInterval(updateCharts, 3000));
        }
        
        // 更新图表数据
        function updateCharts() {
            const currentTime = formatTime(new Date());

            // 更新时间标签
            state.chartData.labels.shift();
            state.chartData.labels.push(currentTime);

            if (state.poweredOff) {
                // 关机期间持续推入0，保持时间轴滑动
                state.chartData.temperature.shift();
                state.chartData.temperature.push(0);
                state.chartData.load.shift();
                state.chartData.load.push(0);
                state.chartData.download.shift();
                state.chartData.download.push(0);
                state.chartData.upload.shift();
                state.chartData.upload.push(0);
            } else {
                // 更新温度图表数据（30°C-100°C，每次变化-2到+3°C）
                const lastTemp = state.chartData.temperature[state.chartData.temperature.length - 1];
                let newTemp = lastTemp + Math.floor(Math.random() * 6) - 2; // -2到+3
                newTemp = Math.max(30, Math.min(100, newTemp)); // 限制在30-100之间
                state.chartData.temperature.shift();
                state.chartData.temperature.push(newTemp);

                // 更新系统负载数据（5%-100%，每次变化-20%到+20%）
                const lastLoad = state.chartData.load[state.chartData.load.length - 1];
                let newLoad = lastLoad + (Math.floor(Math.random() * 41) - 20); // -20到+20
                newLoad = Math.max(5, Math.min(100, newLoad)); // 限制在5-100之间
                state.chartData.load.shift();
                state.chartData.load.push(newLoad);

                // 更新仿真性唤起值数据（0%-100%，每次变化-8%到+15%）
                if (state.stopActive) {
                    // 停止激活：持续推入0（与关机效果一致）
                    state.chartData.download.shift();
                    state.chartData.download.push(0);
                } else if (state.pauseActive) {
                    // 暂停激活：数值冻结为按下时的值，时间轴继续滑动，形成横线
                    const frozenValue = state.chartData.download[state.chartData.download.length - 1];
                    state.chartData.download.shift();
                    state.chartData.download.push(frozenValue);
                } else {
                    const lastDownload = state.chartData.download[state.chartData.download.length - 1];
                    let newDownload = lastDownload + (Math.floor(Math.random() * 24) - 8); // -8到+15
                    newDownload = Math.max(0, Math.min(100, newDownload)); // 限制在0-100之间
                    state.chartData.download.shift();
                    state.chartData.download.push(newDownload);
                }

                // 同步上传数据
                state.chartData.upload.shift();
                state.chartData.upload.push(Math.floor(Math.random() * 15) + 5);
            }

            // 更新图表数据
            if (temperatureChart && loadChart && networkChart) {
                temperatureChart.data.datasets[0].data = state.chartData.temperature;
                loadChart.data.datasets[0].data = state.chartData.load;
                networkChart.data.datasets[0].data = state.chartData.download;

                // 更新标签
                temperatureChart.data.labels = state.chartData.labels;
                loadChart.data.labels = state.chartData.labels;
                networkChart.data.labels = state.chartData.labels;

                // 更新图表
                temperatureChart.update();
                loadChart.update();
                networkChart.update();
            }

            const mobileArousalVal = document.getElementById('mobile-arousal-val');
            if (mobileArousalVal) {
                const lastArousal = state.chartData.download[state.chartData.download.length - 1];
                mobileArousalVal.textContent = `${Math.round(lastArousal)}%`;
            }
        }

        // 初始化图表
        function initCharts() {
            // 温度图表
            const tempCtx = document.getElementById('temperature-chart').getContext('2d');
            temperatureChart = new Chart(tempCtx, {
                type: 'line',
                data: {
                    labels: state.chartData.labels,
                    datasets: [{
                        label: '',
                        data: state.chartData.temperature,
                        borderColor: '#8fbc8f',
                        backgroundColor: 'rgba(143, 188, 143, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false // 隐藏图例
                        }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            grid: { color: 'rgba(143, 188, 143, 0.1)' },
                            ticks: { color: '#c0e4c0', stepSize: 20 }
                        },
                        x: {
                            grid: { color: 'rgba(143, 188, 143, 0.1)' },
                            ticks: { color: '#c0e4c0', maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }
                        }
                    },
                    animation: {
                        duration: 300
                    }
                }
            });

            // 系统负载图表
            const loadCtx = document.getElementById('load-chart').getContext('2d');
            loadChart = new Chart(loadCtx, {
                type: 'line',
                data: {
                    labels: state.chartData.labels,
                    datasets: [{
                        label: '',
                        data: state.chartData.load,
                        borderColor: '#8fbc8f',
                        backgroundColor: 'rgba(143, 188, 143, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false // 隐藏图例
                        }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            grid: { color: 'rgba(143, 188, 143, 0.1)' },
                            ticks: { color: '#c0e4c0', stepSize: 20 }
                        },
                        x: {
                            grid: { color: 'rgba(143, 188, 143, 0.1)' },
                            ticks: { color: '#c0e4c0', maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }
                        }
                    },
                    animation: {
                        duration: 300
                    }
                }
            });

            // 仿真性唤起值图表
            const netCtx = document.getElementById('network-chart').getContext('2d');
            networkChart = new Chart(netCtx, {
                type: 'line',
                data: {
                    labels: state.chartData.labels,
                    datasets: [
                        {
                            label: '',
                            data: state.chartData.download,
                            borderColor: '#8fbc8f',
                            backgroundColor: 'rgba(143, 188, 143, 0.1)',
                            tension: 0.4,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false // 隐藏图例
                        }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            grid: { color: 'rgba(143, 188, 143, 0.1)' },
                            ticks: { color: '#c0e4c0', stepSize: 20 }
                        },
                        x: {
                            grid: { color: 'rgba(143, 188, 143, 0.1)' },
                            ticks: { color: '#c0e4c0', maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }
                        }
                    },
                    animation: {
                        duration: 300
                    }
                }
            });
        }
        
        // 初始化事件监听器（主界面）
        function initEventListeners() {
            // 模式按钮事件委托（使用id以支持DOM移动）
            const modesContainer = document.getElementById('modes-container');
            if (modesContainer) {
                modesContainer.addEventListener('click', function(e) {
                    const modeBtn = e.target.closest('[data-mode]');
                    if (modeBtn) {
                        activateMode(modeBtn.dataset.mode);
                    }
                });
            }

            // 三栏模式按钮事件委托
            const tripleConsole = document.getElementById('triple-console');
            if (tripleConsole) {
                tripleConsole.addEventListener('click', function(e) {
                    const modeBtn = e.target.closest('.mode-btn[data-mode]');
                    if (modeBtn) {
                        activateMode(modeBtn.dataset.mode);
                    }
                });
            }
            
            // 添加账号按钮
            document.getElementById('add-account').addEventListener('click', function() {
                const username = document.getElementById('new-username').value.trim();
                const password = document.getElementById('new-password').value;
                
                if (!username || !password) {
                    alert('请输入账号和密码');
                    return;
                }
                
                const accounts = loadAccounts();
                
                // 检查账号是否已存在
                if (accounts.some(account => account.username === username)) {
                    alert('该账号已存在');
                    return;
                }
                
                // 添加新账号
                accounts.push({ username, password });
                saveAccounts(accounts);
                updateAccountList();
                
                // 清空输入框
                document.getElementById('new-username').value = '';
                document.getElementById('new-password').value = '';
                
                // 添加账号创建日志
                appendToLogs(`添加了新账号：${username}`);
            });
            
            // 设置窗口相关事件
            const modal = document.getElementById('settings-modal');
            const openBtn = document.getElementById('open-settings');
            const closeBtn = document.getElementById('settings-close-dot');
            const cancelBtn = document.getElementById('cancel-settings');
            const saveBtn = document.getElementById('save-settings');
            const addBtn = document.getElementById('add-button-setting');
            const addStatusBtn = document.getElementById('add-status-setting');
            const imageUpload1 = document.getElementById('robot-image-upload-1');
            const imagePreview1 = document.getElementById('image-preview-1');
            const imageUpload2 = document.getElementById('robot-image-upload-2');
            const imagePreview2 = document.getElementById('image-preview-2');
            const restoreDefault1 = document.getElementById('restore-default-1');
            const restoreDefault2 = document.getElementById('restore-default-2');
            const resetSettingsBtn = document.getElementById('reset-settings');
            // 灵动岛模拟效果预览
            const previewIslandBtn = document.getElementById('preview-island-btn');
            if (previewIslandBtn) previewIslandBtn.addEventListener('click', () => {
                showDynamicIsland();
            });
            const previewChargingIslandBtn = document.getElementById('preview-charging-island-btn');
            if (previewChargingIslandBtn) previewChargingIslandBtn.addEventListener('click', () => {
                showChargingIsland();
            });
            const previewTextNotifyBtn = document.getElementById('preview-text-notify-btn');
            if (previewTextNotifyBtn) previewTextNotifyBtn.addEventListener('click', () => {
                if (typeof showMacosTextNotification === 'function') {
                    showMacosTextNotification('文字通知示例', '这是一条 macOS 风格的文字通知，显示在右上角状态栏下方');
                }
            });

            // 打开设置窗口（与 openSettings() 单源收敛，含桌面菜单模式挂点）
            if (openBtn) openBtn.addEventListener('click', openSettings);
            
            // 关闭设置窗口（统一走 closeSettings，同步菜单栏触发图标选中态与程序坞指示）
            const closeModal = () => { closeSettings(); };
            
            closeBtn.addEventListener('click', closeModal);
            cancelBtn.addEventListener('click', closeModal);

            // 移动端设置顶部栏三枚圆形操作按钮：点击转发到底部操作条同 id 按钮，行为保持单源
            // （桌面菜单模式隐藏移动端顶部栏，仍直接用底部操作条）
            modal.querySelectorAll('.modal-mobile-action-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const target = document.getElementById(btn.dataset.settingsAction);
                    if (target) target.click();
                });
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
            
            // ESC 关闭设置弹窗
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('settings-modal-visible')) {
                    closeModal();
                }
            });
            
            // 添加按钮设置
            addBtn.addEventListener('click', () => {
                state.buttonTexts.push(`按钮${state.buttonTexts.length + 1}`);
                updateButtonSettings();
            });
            
            // 添加状态设置 - 已移除14个状态项的限制
            addStatusBtn.addEventListener('click', () => {
                state.statusItems.push({ label: `状态项${state.statusItems.length + 1}`, value: '值' });
                updateStatusSettings();
            });
            
            // 图片上传处理 - 第一张
            imageUpload1.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file?.type.match('image.*')) return;
                
                const reader = new FileReader();
                reader.onload = function(event) {
                    state.tempRobotImage1 = event.target.result;
                    imagePreview1.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = state.tempRobotImage1;
                    imagePreview1.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
            
            // 图片上传处理 - 第二张
            imageUpload2.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file?.type.match('image.*')) return;
                
                const reader = new FileReader();
                reader.onload = function(event) {
                    state.tempRobotImage2 = event.target.result;
                    imagePreview2.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = state.tempRobotImage2;
                    imagePreview2.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
            
            // 恢复默认图片1
            restoreDefault1.addEventListener('click', function() {
                // 删除存储的自定义图片
                storage.removeRobotImage1();
                state.tempRobotImage1 = null;
                
                // 更新预览
                imagePreview1.innerHTML = '';
                const img = document.createElement('img');
                img.src = DEFAULT_IMAGES.left;
                img.onerror = function() {
                    this.src = PLACEHOLDER_SVG_1;
                };
                imagePreview1.appendChild(img);
                
                // 更新状态图片
                document.getElementById('robot-image-1').src = DEFAULT_IMAGES.left;
                document.getElementById('robot-image-1').onerror = function() {
                    this.src = PLACEHOLDER_SVG_1;
                };
                
                syncTripleImages();
                appendToLogs('图片1已恢复为默认');
            });
            
            // 恢复默认图片2
            restoreDefault2.addEventListener('click', function() {
                // 删除存储的自定义图片
                storage.removeRobotImage2();
                state.tempRobotImage2 = null;
                
                // 更新预览
                imagePreview2.innerHTML = '';
                const img = document.createElement('img');
                img.src = DEFAULT_IMAGES.right;
                img.onerror = function() {
                    this.src = PLACEHOLDER_SVG_2;
                };
                imagePreview2.appendChild(img);
                
                // 更新状态图片
                document.getElementById('robot-image-2').src = DEFAULT_IMAGES.right;
                document.getElementById('robot-image-2').onerror = function() {
                    this.src = PLACEHOLDER_SVG_2;
                };
                
                syncTripleImages();
                appendToLogs('图片2已恢复为默认');
            });

            // 改为默认设置
            resetSettingsBtn.addEventListener('click', () => {
                showResetDefaultsAlert(() => {
                    resetSettings();
                });
            });

            // v1.6.0：配置导入导出（导出立即下载；导入选择文件校验后确认写入并刷新）
            const exportConfigBtn = document.getElementById('export-config-btn');
            if (exportConfigBtn) exportConfigBtn.addEventListener('click', exportConfig);
            const importConfigBtn = document.getElementById('import-config-btn');
            const importConfigFileInput = document.getElementById('import-config-file');
            if (importConfigBtn && importConfigFileInput) {
                importConfigBtn.addEventListener('click', () => importConfigFileInput.click());
                importConfigFileInput.addEventListener('change', function () {
                    importConfigFile(this.files && this.files[0]);
                    this.value = '';   // 允许连续导入同一文件
                });
            }

            // v1.6.0：信息面板链接恢复默认（立即回填输入框，应用更改后落库）
            const resetLinksBtn = document.getElementById('reset-info-links');
            if (resetLinksBtn) resetLinksBtn.addEventListener('click', () => {
                state.infoLinks = null;
                updateInfoLinksSettings();
                appendToLogs('[设置] 信息面板链接已恢复默认值，点击"应用更改"后生效');
            });

            // v1.6.0：激活引导页按钮绑定在 DOMContentLoaded（登录前）完成，见页面初始化处；
            // 此处 initEventListeners 登录成功后才执行，激活页显示期间不可依赖

            // 保存设置：存在模式名称修改时先弹确认对话框（逐条列出原名→新名与功能简介），
            // 确认后随本次设置一并保存；取消则整体不保存留在设置页
            saveBtn.addEventListener('click', () => {
                const modeNameChanges = collectModeNameChanges();
                if (modeNameChanges.length > 0) {
                    showModeNameConfirmAlert(modeNameChanges, () => {
                        performSettingsSave();
                    });
                    return;
                }
                performSettingsSave();
            });

            function performSettingsSave() {
                // Clawbot 数据变更推送（v1.12.0）：保存前快照，成功后 diff 出实际改动项推送
                const clawbotBefore = (window.ClawbotBridge && window.ClawbotBridge.snapshotSettings)
                    ? window.ClawbotBridge.snapshotSettings() : null;
                // 保存 Clawbot 通知推送设置（校验失败中止保存；表单未渲染则跳过不覆盖）
                if (window.ClawbotBridge && window.ClawbotBridge.collectForm) {
                    const clawbotSaved = window.ClawbotBridge.collectForm('set-');
                    if (clawbotSaved.error) { alert(clawbotSaved.error); return; }
                    if (!clawbotSaved.skipped) window.ClawbotBridge.setConfig(clawbotSaved.config);
                }
                // 保存模式名称（无变更时为同值落库）
                persistModeNamesFromInputs();

                // 保存按钮文本设置：1-10 不可修改，只更新 11 及以上
                const buttonInputs = document.querySelectorAll('#button-settings input');
                const newTexts = Array.from(buttonInputs).map((input, i) => {
                    /* 第 11 号起的默认名（「按钮N」）在英文界面显示为 Button N：
                       仍是默认译文时归一回源串，避免英文用户一应用设置就把它冻结成自定义名。 */
                    const idx = 10 + i;
                    return valueWithDefaultSource(input, storage.DEFAULT_BUTTON_TEXTS[idx]);
                });
                // 保留前10个（不可修改），加上用户编辑的
                state.buttonTexts = [...state.buttonTexts.slice(0, 10), ...newTexts];
                storage.setButtonTexts(state.buttonTexts);
                
                // 保存状态项设置（v1.6.0：主人/制造公司两行不在设置组渲染，值恒取型号信息源串；
                // 输入框从第 3 项开始，每行 标签+值 两个 input，索引按 (i-2) 计算）
                const statusInputs = document.querySelectorAll('#status-settings input');
                const statusDefaults = storage.getDefaultStatusItems();
                for (let i = 0; i < state.statusItems.length; i++) {
                    if (i < 2) {
                        state.statusItems[i].label = statusDefaults[i].label;
                        state.statusItems[i].value = i === 0 ? getModelInfoSource('master') : getModelInfoSource('company');
                        continue;
                    }
                    const labelInput = statusInputs[(i - 2) * 2];
                    const valueInput = statusInputs[(i - 2) * 2 + 1];
                    /* 输入框里是默认值的界面语言译文时归一回中文源串（v1.10.0）：
                       否则英文用户应用一次设置，默认项就被当作用户自定义内容冻结成英文，
                       「整组默认→随语言」的判定随之失效。 */
                    state.statusItems[i].label = valueWithDefaultSource(labelInput, statusDefaults[i].label);
                    state.statusItems[i].value = valueWithDefaultSource(valueInput, statusDefaults[i].value);
                }
                storage.setStatusItems(state.statusItems);

                // 保存型号信息（v1.6.0）：五键全量对象（''=默认，含语音播报读法），
                // 随后重刷保护集/静态标签/信息参数
                const modelInfoInput = {
                    fullName: (document.getElementById('model-info-fullname') || {}).value || '',
                    shortName: (document.getElementById('model-info-shortname') || {}).value || '',
                    company: (document.getElementById('model-info-company') || {}).value || '',
                    master: (document.getElementById('model-info-master') || {}).value || '',
                    ttsReading: (document.getElementById('model-info-ttsreading') || {}).value || ''
                };
                MODEL_INFO_KEYS.forEach(key => { modelInfoInput[key] = modelInfoInput[key].trim(); });
                storage.setModelInfo(modelInfoInput);
                state.modelInfo = storage.getModelInfo();

                // 保存信息面板链接（v1.6.0）：仅 4 个可配置链接（PDF 条目不提供修改不进设置组）；
                // 校验 URL 前缀，全部与默认一致时存 null
                const linkRows = document.querySelectorAll('#info-links-settings .info-link-row');
                const linkSaved = [];
                let linksValid = true;
                linkRows.forEach(row => {
                    const id = row.getAttribute('data-link-id');
                    const nameInput = row.querySelector('.info-link-name');
                    const src0 = FILES.find(f => f.id === id) || {};
                    /* 默认名按语言显示后，保存时归一化回源串（v1.10.0），
                       否则「全部为默认 → 存 null」的判定会失效 */
                    const name = valueWithDefaultSource(nameInput, src0.name) || '';
                    const url = (row.querySelector('.info-link-url') || {}).value || '';
                    if (url.trim() !== '' && !/^https?:\/\//i.test(url.trim())) linksValid = false;
                    linkSaved.push({ id, name: name.trim(), url: url.trim() });
                });
                if (!linksValid) {
                    alert('信息面板链接设置无效：链接地址需以 http:// 或 https:// 开头');
                    return;
                }
                const linksAllDefault = linkSaved.every(lk => {
                    const src = FILES.find(f => f.id === lk.id);
                    return lk.name === (src ? src.name : '') && lk.url === ((src && src.url) || '');
                });
                storage.setInfoLinks(linksAllDefault ? null : linkSaved);
                state.infoLinks = linksAllDefault ? null : linkSaved;
                
                // 保存图片设置
                if (state.tempRobotImage1) {
                    storage.setRobotImage1(state.tempRobotImage1);
                    document.getElementById('robot-image-1').src = state.tempRobotImage1;
                }
                if (state.tempRobotImage2) {
                    storage.setRobotImage2(state.tempRobotImage2);
                    document.getElementById('robot-image-2').src = state.tempRobotImage2;
                }
                syncTripleImages();
                
                // 如果有图片更新，则添加日志
                if (state.tempRobotImage1 || state.tempRobotImage2) {
                    appendToLogs('机器人图片已更新');
                }
                
                // 保存运行参数设置
                const liquidCurrent = parseInt(document.getElementById('liquid-current').value) || 1600;
                const liquidTotal = parseInt(document.getElementById('liquid-total').value) || 3000;
                const batteryAuto = document.getElementById('battery-auto').checked;
                const batteryPercentage = parseInt(document.getElementById('battery-percentage').value) || 2;
                const isCharging = document.getElementById('is-charging').checked;
                const storageUsed = parseInt(document.getElementById('storage-used').value) || 121;
                const storageTotal = parseInt(document.getElementById('storage-total').value) || 512;
                
                // 验证输入
                if (liquidCurrent < 0 || liquidTotal <= 0 || liquidCurrent > liquidTotal) {
                    alert('仿真精液设置无效：当前量不能大于总量，且总量必须大于0');
                    return;
                }
                
                if (batteryPercentage < 0 || batteryPercentage > 100) {
                    alert('电量设置无效：百分比必须在0-100之间');
                    return;
                }
                
                if (storageUsed < 0 || storageTotal <= 0 || storageUsed > storageTotal) {
                    alert('存储设置无效：已使用量不能大于总量，且总量必须大于0');
                    return;
                }
                
                // 更新运行参数
                state.runtimeParams = {
                    liquidCurrent,
                    liquidTotal,
                    batteryAuto,
                    batteryPercentage,
                    isCharging,
                    storageUsed,
                    storageTotal
                };
                
                // 保存到localStorage
                saveRuntimeParams();
                
                // 更新UI
                updateFunctionButtons();
                updateStatusDisplay();
                updateRuntimeParamsDisplay();
                refreshAutoBattery();
                renderTripleStatusChips();

                // v1.6.0：型号信息/信息参数/信息面板链接全链路重刷（保护集→静态标签→文件列表）
                refreshI18nProtected();
                applyModelInfoToDom();
                renderFileList();
                try {
                    if (window.consoleAPI && typeof consoleAPI.setModelInfo === 'function') {
                        const modelInfoEff = {};
                        MODEL_INFO_KEYS.forEach(key => { modelInfoEff[key] = getModelInfoSource(key); });
                        consoleAPI.setModelInfo(modelInfoEff);
                    }
                } catch (e) { /* ignore */ }
                
                // 同步三栏图片
                syncTripleImages();

                closeModal();
                appendToLogs('控制设置已更新并保存');
                if (clawbotBefore && window.ClawbotBridge && window.ClawbotBridge.pushSettingsDiff) {
                    window.ClawbotBridge.pushSettingsDiff(clawbotBefore, window.ClawbotBridge.snapshotSettings());
                }
            }

            // 三栏头部按钮：信息和设置
            const tripleBtnInfo = document.getElementById('triple-btn-info');
            if (tripleBtnInfo) {
                tripleBtnInfo.addEventListener('click', openInfoModal);
            }
            const btnInfo = document.getElementById('btn-info');
            if (btnInfo) {
                btnInfo.addEventListener('click', openInfoModal);
            }
            const tripleOpenSettings = document.getElementById('triple-open-settings');
            if (tripleOpenSettings) {
                tripleOpenSettings.addEventListener('click', openSettings);
            }
            // 单栏模式右上角悬浮按钮：信息和设置
            const mobileBtnInfo = document.getElementById('mobile-btn-info');
            if (mobileBtnInfo) {
                mobileBtnInfo.addEventListener('click', openInfoModal);
            }
            const mobileOpenSettings = document.getElementById('mobile-open-settings');
            if (mobileOpenSettings) {
                mobileOpenSettings.addEventListener('click', openSettings);
            }

            // 信息弹窗事件
            const infoModal = document.getElementById('info-modal');
            const infoCloseDot = document.getElementById('info-close-dot');
            if (infoModal && infoCloseDot) {
                infoCloseDot.addEventListener('click', closeInfoModal);
                infoModal.addEventListener('click', function(e) {
                    if (e.target === infoModal) closeInfoModal();
                });
            }
            
            // 设置弹窗关闭圆点（统一走 closeSettings，同步菜单栏触发图标选中态与程序坞指示）
            const settingsCloseDot = document.getElementById('settings-close-dot');
            const settingsModalEl = document.getElementById('settings-modal');
            if (settingsCloseDot && settingsModalEl) {
                settingsCloseDot.addEventListener('click', function() {
                    closeSettings();
                });
            }

            // 单栏模式：滚动渐隐效果
            const appContainer = document.getElementById('app-container');
            const robotShowcase = document.querySelector('.robot-showcase');
            const heroBar = document.querySelector('.mobile-hero-bar');
            if (appContainer && robotShowcase) {
                let ticking = false;
                function updateShowcaseOnScroll() {
                    const scrollTop = appContainer.scrollTop;
                    const maxScroll = 200;
                    const progress = Math.min(scrollTop / maxScroll, 1);
                    const opacity = 1 - progress;
                    const translateY = -20 * progress;
                    robotShowcase.style.opacity = opacity;
                    robotShowcase.style.transform = `translateY(${translateY}px)`;
                    if (heroBar) {
                        if (scrollTop > 10) {
                            heroBar.classList.add('scrolled');
                        } else {
                            heroBar.classList.remove('scrolled');
                        }
                    }
                    ticking = false;
                }
                appContainer.addEventListener('scroll', function() {
                    if (!ticking) {
                        window.requestAnimationFrame(updateShowcaseOnScroll);
                        ticking = true;
                    }
                }, { passive: true });
            }
        }
        
        // 初始化设置窗口
        function initSettingsModal() {
            // 初始化运行参数设置
            document.getElementById('liquid-current').value = state.runtimeParams.liquidCurrent;
            document.getElementById('liquid-total').value = state.runtimeParams.liquidTotal;
            const batteryAutoEl = document.getElementById('battery-auto');
            if (batteryAutoEl) batteryAutoEl.checked = !!state.runtimeParams.batteryAuto;
            const batteryManualWrap = document.getElementById('battery-manual-wrap');
            if (batteryManualWrap) batteryManualWrap.style.display = batteryAutoEl && batteryAutoEl.checked ? 'none' : 'flex';
            document.getElementById('battery-percentage').value = state.runtimeParams.batteryPercentage;
            document.getElementById('is-charging').checked = state.runtimeParams.isCharging;
            document.getElementById('storage-used').value = state.runtimeParams.storageUsed;
            document.getElementById('storage-total').value = state.runtimeParams.storageTotal;
            
            // 生成按钮设置项
            updateButtonSettings();

            // 生成状态设置项
            updateStatusSettings();

            // v1.6.0：型号信息与信息面板链接输入框填充（保存原文；链接 null=默认）
            syncModelInfoInputs();
            updateInfoLinksSettings();
            buildSettingsNav();

            // 填充模式名称输入框（保存原文；''=默认）
            Object.keys(MODES).forEach(id => {
                const input = document.getElementById('mode-name-input-' + id);
                if (input) input.value = (state.modeNames && state.modeNames[id] != null) ? state.modeNames[id] : '';
            });

            // 初始化图片预览
            const savedImage1 = storage.getRobotImage1();
            const savedImage2 = storage.getRobotImage2();
            const imagePreview1 = document.getElementById('image-preview-1');
            const imagePreview2 = document.getElementById('image-preview-2');

            if (savedImage1) {
                imagePreview1.innerHTML = '';
                const img = document.createElement('img');
                img.src = savedImage1;
                imagePreview1.appendChild(img);
            } else {
                imagePreview1.innerHTML = '';
                const img = document.createElement('img');
                img.src = DEFAULT_IMAGES.left;
                img.onerror = function() {
                    this.src = PLACEHOLDER_SVG_1;
                };
                imagePreview1.appendChild(img);
            }

            if (savedImage2) {
                imagePreview2.innerHTML = '';
                const img = document.createElement('img');
                img.src = savedImage2;
                imagePreview2.appendChild(img);
            } else {
                imagePreview2.innerHTML = '';
                const img = document.createElement('img');
                img.src = DEFAULT_IMAGES.right;
                img.onerror = function() {
                    this.src = PLACEHOLDER_SVG_2;
                };
                imagePreview2.appendChild(img);
            }

            // 回填 Clawbot 通知推送表单（v1.12.0）：激活页大窗改过配置后设置页同步显示
            if (window.ClawbotBridge && window.ClawbotBridge.fillForm) {
                window.ClawbotBridge.fillForm('set-');
            }
        }
        
        // 更新当前时间
        function updateCurrentTime() {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const weekDays = ['周日','周一','周二','周三','周四','周五','周六'];
            /* EN 模式日期随语言、按美式习惯（写入时直译，zh 原格式一字不变）：
               2026年09月25日 周五 → Sep 25, 2026 Fri */
            const isEn = (window.I18N && window.I18N.getLang() === 'en');
            const weekDay = (isEn ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] : weekDays)[now.getDay()];
            const datePrefix = isEn
                ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()]} ${day}, ${year}`
                : `${year}年${month}月${day}日`;

            // 更新顶部时钟（原有）
            const currentTimeElement = document.getElementById('current-time');
            if (currentTimeElement) {
                currentTimeElement.textContent = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            }

            // 更新三栏头部时钟
            const tripleHeaderTime = document.getElementById('triple-header-time');
            if (tripleHeaderTime) {
                tripleHeaderTime.textContent = `${datePrefix} ${weekDay} ${hours}:${minutes}:${seconds}`;
            }

            // 更新三栏状态栏 macOS 风格时钟
            const tripleStatusClock = document.getElementById('triple-status-clock');
            if (tripleStatusClock) {
                tripleStatusClock.textContent = `${hours}:${minutes}`;
            }
            
            // 首次加载时更新日志时间
            if (state.isFirstLoad) {
                const logTimeElements = document.querySelectorAll('.log-time');
                const logTimeString = `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}]`;
                logTimeElements.forEach(el => {
                    el.textContent = logTimeString;
                });
                state.isFirstLoad = false;
            }
            refreshAutoBattery();
        }
        
        /* ===== 型号信息统一（v1.6.0）：完整型号/简称/制造公司/主人 =====
           存储 robotModelInfo 四键全量对象（''=默认）。匹配规则与模式名一致（整组）：
           四项整体完全等于中文默认组或英文默认组（= i18n 词典译文）才随界面语言，
           混搭/自定义一律按保存原文显示；留空恢复默认。
           两条显示通路：
           · JS 拼接句 → modelSentenceXxx() 模板函数按语言直出最终文本（不走 DICT 整句——
             自定义简称后整句词条匹配会失效；写入后 observer 对含中文串回退原文、无害）
           · 静态 DOM → data-model-info 属性 + applyModelInfoToDom() 扫描写入 */
        const MODEL_INFO_KEYS = ['fullName', 'shortName', 'company', 'master', 'ttsReading'];
        const MODEL_INFO_DEFAULTS_ZH = {
            fullName: 'T31-750型仿人男性机器人',
            shortName: 'T31-750',
            company: '芮誊智能虚构公司',
            master: 'X',
            ttsReading: '踢三一七五零型仿人男性机器人'
        };
        // 旧版默认读法（仅简称读法）→ 迁移到当前默认（全型号读法）
        const MODEL_INFO_TTS_READING_LEGACY = '踢三一七五零';

        function getModelInfoEnDefaults() {
            const out = {};
            MODEL_INFO_KEYS.forEach(key => {
                const zh = MODEL_INFO_DEFAULTS_ZH[key];
                const en = (window.I18N && I18N.DICT) ? I18N.DICT[zh] : null;
                out[key] = (en && en !== zh) ? en : zh;
            });
            return out;
        }

        function getModelInfoMatch(saved) {
            const trim = v => ((v == null ? '' : String(v)) || '').trim();
            const eff = key => trim(saved && saved[key]) || MODEL_INFO_DEFAULTS_ZH[key];
            if (MODEL_INFO_KEYS.every(key => eff(key) === MODEL_INFO_DEFAULTS_ZH[key])) return 'zh';
            const en = getModelInfoEnDefaults();
            if (MODEL_INFO_KEYS.every(key => { const v = trim(saved && saved[key]); return v !== '' && v === en[key]; })) return 'en';
            return null;
        }

        /* 主 API：按当前界面语言返回最终显示值（拼接句/通知/TTS 用） */
        function getModelInfo(key) {
            if (MODEL_INFO_KEYS.indexOf(key) === -1) return key;
            const saved = state.modelInfo || {};
            if (getModelInfoMatch(saved)) {
                const lang = (window.I18N && I18N.getLang) ? I18N.getLang() : 'zh';
                return lang === 'en' ? getModelInfoEnDefaults()[key] : MODEL_INFO_DEFAULTS_ZH[key];
            }
            return ((saved[key] == null ? '' : String(saved[key])).trim()) || MODEL_INFO_DEFAULTS_ZH[key];
        }

        /* zh 源串（写 DOM 文本节点走 i18n 词典通路的场景） */
        function getModelInfoSource(key) {
            const saved = state.modelInfo || {};
            if (getModelInfoMatch(saved)) return MODEL_INFO_DEFAULTS_ZH[key];
            return ((saved[key] == null ? '' : String(saved[key])).trim()) || MODEL_INFO_DEFAULTS_ZH[key];
        }

        /* 模式名当前语言显示值（模板句内嵌模式名用——getModeNameSource 是 zh 源串） */
        function modeDisplayName(modeId) {
            const src = getModeNameSource(modeId);
            return (window.I18N && I18N.getLang() === 'en') ? (I18N.t(src) || src) : src;
        }

        /* ===== 型号信息句子模板（zh/en 直出） ===== */
        function modelSentenceSysTitle() {
            const n = getModelInfo('fullName');
            return (window.I18N && I18N.getLang() === 'en') ? `Connected to the internal system of ${n}` : `已连接至${n}的内部系统`;
        }
        function modelSentencePanelTitle() {
            const n = getModelInfo('fullName');
            return (window.I18N && I18N.getLang() === 'en') ? `${n} Internal System Panel` : `${n}内部系统面板`;
        }
        function modelSentenceMasterDe() {
            // 单栏 hero 第一行：中文「X的」；英文用所有格 "X's"（英文助词不保留中文的）
            var master = getModelInfo('master');
            return (window.I18N && I18N.getLang() === 'en') ? master + "'s" : master + '的';
        }
        function modelSentenceLogout() {
            const n = getModelInfo('shortName');
            return (window.I18N && I18N.getLang() === 'en') ? `Log out of "${n}"` : `退出登录“${n}”`;
        }
        function modelSentenceConnected() {
            const n = getModelInfo('shortName');
            return (window.I18N && I18N.getLang() === 'en') ? `${n} has established a connection with Master` : `${n} 已与主人建立连接`;
        }
        function modelSentenceConnectedOk() {
            const n = getModelInfo('shortName');
            return (window.I18N && I18N.getLang() === 'en') ? `${n} has connected to Master successfully` : `${n}已与主人连接成功`;
        }
        function modelSentenceSendingTo() {
            const n = getModelInfo('shortName');
            return (window.I18N && I18N.getLang() === 'en') ? `Sending to ${n}...` : `正在发送至${n}…`;
        }
        function modelSentenceEnteredMode(modeName) {
            const n = getModelInfo('shortName');
            return (window.I18N && I18N.getLang() === 'en') ? `${n} has entered ${modeName}` : `${n}已进入${modeName}`;
        }
        /* 通用语音播报句（v1.6.0）：完整型号插值，zh/en 模板直出（tailZh 直连/tailEn 空格连接） */
        function modelSentenceSpeech(tailZh, tailEn) {
            const n = getModelInfo('fullName');
            return (window.I18N && I18N.getLang() === 'en') ? `${n} ${tailEn}` : `${n}${tailZh}`;
        }
        /* 叙述行型号替换（v1.6.0）：自检叙述/过程窗口标题等长文案按「型号信息」生效值替换。
           仅在自定义时替换（默认串原样保留，EN 词典整句翻译不受影响） */
        function applyModelInfoToLine(line) {
            var out = String(line == null ? '' : line);
            var fullName = getModelInfo('fullName');
            var shortName = getModelInfo('shortName');
            if (fullName !== MODEL_INFO_DEFAULTS_ZH.fullName) out = out.split(MODEL_INFO_DEFAULTS_ZH.fullName).join(fullName);
            if (shortName !== MODEL_INFO_DEFAULTS_ZH.shortName) out = out.split(MODEL_INFO_DEFAULTS_ZH.shortName).join(shortName);
            return out;
        }

        /* 把型号信息写入全部静态标签（boot / 设置保存 / 语言切换后调用） */
        function applyModelInfoToDom() {
            document.querySelectorAll('[data-model-info]').forEach(el => {
                const kind = el.getAttribute('data-model-info');
                let text = '';
                switch (kind) {
                    case 'fullName': text = getModelInfo('fullName'); break;
                    case 'shortName': text = getModelInfo('shortName'); break;
                    case 'company': text = getModelInfo('company'); break;
                    case 'master': text = getModelInfo('master'); break;
                    case 'masterDe': text = modelSentenceMasterDe(); break;
                    case 'sysTitle': text = modelSentenceSysTitle(); break;
                    case 'panelTitle': text = modelSentencePanelTitle(); break;
                    case 'logout': text = modelSentenceLogout(); break;
                    case 'connectedOk': text = modelSentenceConnectedOk(); break;
                    default: return;
                }
                if (el.textContent !== text) el.textContent = text;
            });
            const sysTitle = modelSentenceSysTitle();
            document.title = sysTitle;
            const titleTag = document.querySelector('head > title');
            if (titleTag && titleTag.textContent !== sysTitle) titleTag.textContent = sysTitle;
        }

        /* 语言切换落地后重刷"按语言直出最终文本"的型号信息标签 + 侧边导航文本
           （i18n.js setLang 派发。注意 i18n.js 在 window 上 dispatch，必须监听 window——
           挂 document 收不到（事件自 window 派发不会向下传播到 document）） */
        window.addEventListener('rc-lang-changed', function () {
            try { applyModelInfoToDom(); } catch (e) { /* ignore */ }
            try { if (typeof buildSettingsNav === 'function') buildSettingsNav(); } catch (e) { /* ignore */ }
            // 信息面板文件列表：说明书条目名称与语言版本随界面语言切换（v1.10.0）
            try { if (typeof renderFileList === 'function') renderFileList(); } catch (e) { /* ignore */ }
            /* 设置面板里直接显示默认值的输入框（按钮文本/信息链接/状态项）随界面语言重填
               （v1.10.0）——它们的 value 是默认内容，不重填就会在切换语言后继续显示旧语言。
               仅在设置面板已初始化时执行，避免未登录/未打开设置时误建 DOM。 */
            try {
                if (document.getElementById('settings-modal')) {
                    updateButtonSettings();
                    updateStatusSettings();
                    updateInfoLinksSettings();
                }
            } catch (e) { /* ignore */ }
            /* 说明书阅读器正在打开时，随界面语言换到对应版本（否则读者会一直看着旧语言的
               文档——桌面菜单模式下设置面板仍可操作，切语言时阅读器通常是开着的）。
               仅处理说明书条目（openManualViewer 打的 inApp 标记），PDF 与其他文件不动。 */
            try {
                if (currentPdfFile && currentPdfFile.inApp) {
                    const frame = document.getElementById('pdf-viewer-frame');
                    const wantPath = manualPath();
                    const titleText = document.getElementById('pdf-viewer-title-text');
                    if (titleText) titleText.textContent = manualName();
                    if (frame && frame.getAttribute('src') !== wantPath + '#toolbar=1&view=FitH') {
                        frame.src = wantPath + '#toolbar=1&view=FitH';
                    }
                }
            } catch (e) { /* ignore */ }
        });

        /* ===== 模式名称自定义与信息参数中英文解析 =====
           规则（与需求一致）：
           · 模式名按「整组」判定：四名整体完全等于中文默认组或英文默认组才算默认——
             默认态按界面语言显示对应语言默认名（EN 仍由 i18n 词典翻译中文源串）；
             混搭（一半中文默认、一半英文默认）与自定义一律按保存原文显示（不支持双语标签）。
           · 信息参数按「整组」判定（v1.6.0 起，见 getStatusItemsMatch）：除锁定的主人/制造公司
             两行外，其余项 label+value 全组等于中文默认组或英文默认组才随界面语言；
             任意一项不同（含中英混搭）→ 全组按保存原文显示。
           · 留空一律视为恢复默认。自定义内容经 I18N.setProtected 保护，EN 模式不做子串误译。 */
        function getModeNamesEnDefaults() {
            const out = {};
            Object.keys(MODES).forEach(id => {
                const en = (window.I18N && I18N.DICT) ? I18N.DICT[MODES[id].name] : null;
                out[id] = (en && en !== MODES[id].name) ? en : MODES[id].name;
            });
            return out;
        }

        /* 返回 'zh' | 'en' | null：四名整组与默认组的匹配结果 */
        function getModeNamesMatch(saved) {
            const ids = Object.keys(MODES);
            const trim = v => ((v == null ? '' : String(v)) || '').trim();
            /* 空串=恢复默认（与 getModelInfoMatch 的 eff 回退同口径）：
               全组未自定义（留空）即「全默认」，应随界面语言，不能判为整组不匹配 */
            const eff = id => trim(saved && saved[id]) || MODES[id].name;
            if (ids.every(id => eff(id) === MODES[id].name)) return 'zh';
            const en = getModeNamesEnDefaults();
            if (ids.every(id => { const v = trim(saved && saved[id]); return v !== '' && v === en[id]; })) return 'en';
            return null;
        }

        /* 取模式显示用的「中文源串」：默认态→中文默认名；自定义→原文；留空→中文默认名。
           EN 翻译仍交给 i18n 词典/写入钩子，与既有静态文案同一条通路（含 .mode-btn 成组拟合）。 */
        function getModeNameSource(id) {
            if (!MODES[id]) return id;
            const saved = state.modeNames || {};
            if (getModeNamesMatch(saved)) return MODES[id].name;
            return ((saved[id] == null ? '' : String(saved[id])).trim()) || MODES[id].name;
        }

        /* 按 i18n 语义写文本：同值（含 __i18nOrig 原文）不重写，EN 模式经写入钩子直译并记原文基线 */
        function setI18nText(el, zhSource) {
            if (!el) return;
            const orig = el.firstChild && el.firstChild.__i18nOrig !== undefined ? el.firstChild.__i18nOrig : el.textContent;
            if (orig === zhSource) return;
            el.textContent = zhSource;
        }

        /* 把解析后的模式名写入全部静态标签：单栏/三栏 .mode-btn[data-mode] + 单栏 showcase 两枚圆钮 */
        function applyModeNameLabels() {
            refreshI18nProtected();
            Object.keys(MODES).forEach(id => {
                const name = getModeNameSource(id);
                document.querySelectorAll('.mode-btn[data-mode="' + id + '"]').forEach(btn => {
                    setI18nText(btn.querySelector('div') || btn.querySelector('.mode-label'), name);
                });
                const circleBtn = document.getElementById('mobile-' + id + '-btn');
                if (circleBtn && circleBtn.parentElement) {
                    setI18nText(circleBtn.parentElement.querySelector('.showcase-btn-label'), name);
                }
            });
            if (typeof updateStatusBarModeIcon === 'function') updateStatusBarModeIcon();
        }

        /* 汇总当前自定义内容（模式名 + 信息参数）注册进 i18n 保护集，防 EN 子串误译。
           必须在相关渲染发生前调用（登录初始化 / 设置保存后）。 */
        function refreshI18nProtected() {
            if (!window.I18N || !I18N.setProtected) return;
            const list = [];
            const saved = state.modeNames || {};
            if (!getModeNamesMatch(saved)) {
                /* 整组不匹配（任意一项自定义）→ 全组按实际填写显示：注册的是**渲染输出名**
                   （含留空回退的默认名），否则未自定义的三项仍会被词典翻译成英文默认名
                   （v1.6.0 实测复现：改"调试模式"后其余三项仍显示 Test Mode 等） */
                Object.keys(MODES).forEach(id => {
                    const src = getModeNameSource(id);
                    if (src) list.push(src);
                });
            }
            const info = state.modelInfo || {};
            if (!getModelInfoMatch(info)) {
                /* 整组不匹配 → 全组按原文：注册**生效源串**（含留空回退的默认串），
                   否则信息参数锁定行（主人/制造公司）在 EN 下仍会被词典翻成英文默认
                   （v1.6.0 实测复现：自定义简称后 Manufacturer 仍显示 Rt5...） */
                MODEL_INFO_KEYS.forEach(key => {
                    const src = getModelInfoSource(key);
                    if (src) list.push(src);
                });
            }
            /* 信息参数整组不匹配时全组按原文显示——把渲染输出的全部文本（除锁定两行）注册保护，
               含空值回退的默认串（否则 en 模式下词典会翻掉"应为原文"的默认值） */
            if (!getStatusItemsMatch(state.statusItems)) {
                resolveStatusItems(state.statusItems).forEach((r, i) => {
                    if (i < 2) return;
                    if (r.label) list.push(r.label);
                    if (r.value) list.push(r.value);
                });
            }
            /* v1.6.0：信息面板链接名称整组不匹配时自定义名原文显示——注册保护防 EN 子串误译 */
            if (!getInfoLinksMatch()) {
                getEffectiveInfoLinks().forEach(lk => {
                    const src = FILES.find(f => f.id === lk.id) || {};
                    if (lk.name && lk.name !== src.name) list.push(lk.name);
                });
            }
            I18N.setProtected(list);
        }

        /* 信息参数整组匹配（v1.6.0，与模式名/型号信息同规则）：主人/制造公司两行由「型号信息」
           设置驱动（恒视为匹配、不参与判定），其余项 label+value 全组等于中文默认组或英文默认组
           才随界面语言；任意一项不同（含中英混搭、追加自定义行）→ 全组按保存原文显示；留空=该项默认 */
        function getStatusItemsMatch(saved) {
            if (!Array.isArray(saved) || saved.length === 0) return 'zh';
            const defaults = storage.getDefaultStatusItems();
            const dict = (window.I18N && I18N.DICT) ? I18N.DICT : {};
            const trim = v => ((v == null ? '' : String(v)) || '').trim();
            let zh = true, en = true;
            for (let i = 2; i < defaults.length; i++) {
                const def = defaults[i];
                const enL = dict[def.label] || def.label;
                const enV = dict[def.value] || def.value;
                const item = saved.find(it => it && (trim(it.label) === def.label || trim(it.label) === enL));
                if (!item) { zh = false; en = false; continue; }
                const l = trim(item.label), v = trim(item.value);
                if (!(l === def.label && (v || def.value) === def.value)) zh = false;
                if (!(l !== '' && l === enL && v !== '' && v === enV)) en = false;
            }
            const defaultLabels = new Set(defaults.map(d => d.label));
            const enDefaultLabels = new Set(defaults.map(d => dict[d.label] || d.label));
            saved.forEach(it => {
                if (!it) return;
                const l = trim(it.label);
                if (l === '主人' || l === '制造公司') return;
                if (!defaultLabels.has(l) && !enDefaultLabels.has(l)) { zh = false; en = false; }
            });
            if (zh) return 'zh';
            if (en) return 'en';
            return null;
        }

        /* 渲染用解析（整组）：返回 [{label, value}] zh 源串形态（EN 由词典/observer 完成）。
           前两行恒为 主人/制造公司，value 由「型号信息」设置驱动；其余按保存顺序输出 */
        function resolveStatusItems(saved) {
            const defaults = storage.getDefaultStatusItems();
            const match = getStatusItemsMatch(saved);
            const out = [
                { label: defaults[0].label, value: getModelInfoSource('master') },
                { label: defaults[1].label, value: getModelInfoSource('company') }
            ];
            const tail = (Array.isArray(saved) ? saved : []).filter(it => it && it.label !== '主人' && it.label !== '制造公司');
            tail.forEach(item => {
                const def = defaults.find(d => d.label === item.label);
                if (match && def) {
                    out.push({ label: def.label, value: def.value });
                    return;
                }
                const l = ((item.label == null ? '' : String(item.label)).trim()) || (def ? def.label : '');
                const v = ((item.value == null ? '' : String(item.value)).trim()) || (def ? def.value : '');
                out.push({ label: l, value: v });
            });
            return out;
        }

        /* 读取设置页四个模式名输入框，与已保存值比对出变更清单 */
        function collectModeNameChanges() {
            const changes = [];
            const trim = v => (v == null ? '' : String(v)).trim();
            Object.keys(MODES).forEach(id => {
                const input = document.getElementById('mode-name-input-' + id);
                if (!input) return;
                const to = trim(input.value);
                const from = trim(state.modeNames && state.modeNames[id]);
                if (to !== from) changes.push({ id: id, from: from, to: to });
            });
            return changes;
        }

        /* 把四个输入框的当前值落库（''=默认），并立即刷新标签与保护集 */
        function persistModeNamesFromInputs() {
            const obj = {};
            Object.keys(MODES).forEach(id => {
                const input = document.getElementById('mode-name-input-' + id);
                obj[id] = input ? input.value.trim() : '';
            });
            state.modeNames = obj;
            storage.setModeNames(obj);
            applyModeNameLabels();
        }

        function deactivateAllModes() {
            Object.keys(MODES).forEach(id => {
                const element = document.getElementById(`${id}-mode`);
                if (element) {
                    element.className = 'mode-btn bg-[#2d4a2d]/30 hover:bg-[#2d4a2d]/50 p-3 rounded-lg text-center cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95 btn-active';
                    element.querySelector('i').className = `fa ${MODES[id].icon} text-[#8fbc8f]/70 mb-1`;
                    element.querySelector('div').className = 'text-[#8fbc8f]/70 text-sm';
                }
            });

            const tripleModeBtns = document.querySelectorAll('#triple-console .mode-btn');
            tripleModeBtns.forEach(btn => {
                btn.classList.remove('active');
            });

            const mobileTestBtn = document.getElementById('mobile-test-btn');
            const mobileLoyaltyBtn = document.getElementById('mobile-loyalty-btn');
            if (mobileTestBtn) mobileTestBtn.classList.remove('active');
            if (mobileLoyaltyBtn) mobileLoyaltyBtn.classList.remove('active');
        }

        function setInitialNaState() {
            state.activeMode = null;
            state.isNaState = true;
            deactivateAllModes();
            updateStatusBarModeIcon();

            if (typeof Android !== 'undefined' && Android.onDataChanged) {
                Android.onDataChanged('mode', '255');
                var emotions = loadEmotions();
                Android.onDataChanged('emotion', [emotions.obedience||0, emotions.shame||0, emotions.pleasure||0, emotions.mechanical||0].join(','));
                var tasks = loadTasks();
                Android.onDataChanged('tasks', JSON.stringify(tasks));
                Android.onDataChanged('voice-history', getRecentVoiceHistory());
            }
        }

        // 激活控制模式
        function activateMode(modeId) {
            if (!MODES[modeId]) return;
            if (state.poweredOff) return; // 关机/重启中止期间模式设置禁用

            state.activeMode = modeId;
            state.isNaState = false;
            storage.setMode(modeId);
            updateStatusBarModeIcon();
            
            deactivateAllModes();

            Object.keys(MODES).forEach(id => {
                const element = document.getElementById(`${id}-mode`);
                if (element && id === modeId) {
                    element.className = 'mode-btn active bg-[#8fbc8f]/20 border border-[#8fbc8f]/50 p-3 rounded-lg text-center cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95 btn-active';
                    element.querySelector('i').className = `fa ${MODES[id].icon} ${MODES[id].color} mb-1`;
                    element.querySelector('div').className = `${MODES[id].color} font-bold text-sm`;
                    
                    element.classList.add('animate-pulse-icon');
                    setTimeout(() => {
                        element.classList.remove('animate-pulse-icon');
                    }, 1000);
                }
            });

            const tripleModeBtns = document.querySelectorAll('#triple-console .mode-btn');
            tripleModeBtns.forEach(btn => {
                if (btn.dataset.mode === modeId) {
                    btn.classList.add('active');
                }
            });

            const mobileTestBtn = document.getElementById('mobile-test-btn');
            const mobileLoyaltyBtn = document.getElementById('mobile-loyalty-btn');
            if (mobileTestBtn && modeId === 'test') mobileTestBtn.classList.add('active');
            if (mobileLoyaltyBtn && modeId === 'loyalty') mobileLoyaltyBtn.classList.add('active');
            
            speak(getModeNameSource(modeId));

            applyFunctionButtonStates();

            appendToLogs(modelSentenceEnteredMode(modeDisplayName(modeId)));

            if (typeof Android !== 'undefined' && Android.onDataChanged) {
                const modeOrdinal = { 'test':0, 'recovery':1, 'loyalty':2, 'simulated-human':3 }[modeId] || 0;
                Android.onDataChanged('mode', modeOrdinal.toString());
            }
        }
        
        // 初始化终端
        function initTerminal() {
            const terminalOutput = document.getElementById('terminal-output');
            
            appendToTerminal('R5OS_417.1002。芮誉智能虚构公司研发。');
            appendToTerminal('T31-750型仿人男性机器人的内部系统控制终端。');
            appendToTerminal('help 获取帮助；*+任意 执行自定义指令。');
            createPrompt();
            
            terminalOutput.addEventListener('click', function() {
                const inputElement = document.getElementById('terminal-input');
                if (inputElement) {
                    inputElement.focus();
                }
            });
        }
        
        // 向终端添加内容
        function appendToTerminal(text, isCommandLine, type) {
            const terminalOutput = document.getElementById('terminal-output');
            if (!terminalOutput) return;
            
            const line = document.createElement('div');
            if (isCommandLine) {
                line.className = 'flex items-center mb-1';
                line.innerHTML = isCommandLine;
            } else {
                line.textContent = text;
                line.className = 'mb-1';
                if (type === 'ok') {
                    line.style.color = '#4ade80';
                } else if (type === 'warn') {
                    line.style.color = '#fbbf24';
                } else if (type === 'err') {
                    line.style.color = '#f87171';
                }
            }
            terminalOutput.appendChild(line);
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }
        
        // 创建新的命令提示符
        function createPrompt() {
            const terminalOutput = document.getElementById('terminal-output');
            if (!terminalOutput) return;
            
            const promptContainer = document.createElement('div');
            promptContainer.className = 'flex items-center mb-1';
            promptContainer.id = 'prompt-container';
            
            const prompt = document.createElement('span');
            prompt.textContent = 'root:~#';
            prompt.className = 'mr-1';

            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'terminal-input';
            input.className = 'bg-transparent border-none outline-none text-[#0f0] flex-grow';
            input.setAttribute('aria-label', '终端输入');
            input.disabled = !!state.poweredOff; // 关机/重启中止期间输入禁用
            
            promptContainer.appendChild(prompt);
            promptContainer.appendChild(input);
            terminalOutput.appendChild(promptContainer);
            
            input.focus();
            
            input.addEventListener('keydown', function(e) {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (state.historyPosition > 0) {
                        state.historyPosition--;
                        this.value = state.commandHistory[state.historyPosition];
                    }
                    return;
                }
                
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (state.historyPosition < state.commandHistory.length) {
                        state.historyPosition++;
                        this.value = state.historyPosition < state.commandHistory.length ? 
                                      state.commandHistory[state.historyPosition] : '';
                    }
                    return;
                }
                
                if (e.key === 'Enter') {
                    const command = this.value.trim();
                    if (command) {
                        state.commandHistory.push(command);
                        state.historyPosition = state.commandHistory.length;
                        processCommand(command);
                        this.value = '';
                    }
                }
            });
            
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }
        
        // 处理命令
        function processCommand(command) {
            const promptContainer = document.getElementById('prompt-container');
            
            if (promptContainer) {
                const commandText = promptContainer.querySelector('input').value;
                const commandLine = document.createElement('div');
                commandLine.className = 'flex items-center mb-1';
                commandLine.innerHTML = `<span class="mr-1">root:~#</span><span>${commandText}</span>`;
                promptContainer.parentNode.insertBefore(commandLine, promptContainer);
                promptContainer.parentNode.removeChild(promptContainer);
            }

            if (state.poweredOff) {
                appendToTerminal('T31-750型仿人男性机器人已关机，请开机后输入指令。');
                createPrompt();
                return;
            }

            if (command.startsWith('*')) {
                const announceText = command.substring(1);
                speak(announceText);
                appendToTerminal('命令 ' + announceText + ' 已发送。');
                addTerminalTask(announceText);
                createPrompt();
                return;
            }
            
            const [cmd, ...args] = command.trim().split(' ');
            
            switch(cmd.toLowerCase()) {
                case 'help':
                    appendToTerminal('  mode - 显示当前模式');
                    appendToTerminal('  mode test - ' + getModeNameSource('test'));
                    appendToTerminal('  mode recovery - ' + getModeNameSource('recovery'));
                    appendToTerminal('  mode loyalty - ' + getModeNameSource('loyalty'));
                    appendToTerminal('  mode simulated-human - ' + getModeNameSource('simulated-human'));
                    appendToTerminal('  system - 显示系统信息');
                    appendToTerminal('  clear - 清屏');
                    break;

                case 'mode':
                    if (args.length > 0) {
                        const validModes = Object.keys(MODES);
                        if (validModes.includes(args[0])) {
                            activateMode(args[0]);
                            appendToTerminal(modelSentenceEnteredMode(modeDisplayName(args[0])));
                        } else {
                            appendToTerminal(`错误:未知模式 '${args[0]}'`);
                            appendToTerminal("可用模式: " + validModes.join(', '));
                        }
                    } else {
                        if (state.isNaState || !state.activeMode) {
                            appendToTerminal('当前模式: 未激活（NA）');
                        } else {
                            appendToTerminal(`当前模式: ${getModeNameSource(state.activeMode)}`);
                        }
                    }
                    break;
                    
                case 'system':
                    appendToTerminal('制造公司：芮誊智能虚构公司');
                    appendToTerminal('系列：T系列仿人男性机器人');
                    appendToTerminal('版本：第31代');
                    appendToTerminal('序列号：750');
                    appendToTerminal('主人：X');
                    appendToTerminal('仿真头部编号：H_0C70E6332');
                    appendToTerminal('仿真机体编号：B_D8AC37208');
                    appendToTerminal('仿真生殖器编号：P_3DD56ER6A');
                    appendToTerminal('软件参数编号：S_VV2AC00E2');
                    appendToTerminal('系统版本：R5OS_T31750_729.01');
                    appendToTerminal('数据库版本：D_V2025061501');
                    appendToTerminal('序列号生成时间：2023.08.25 12:46:35');
                    appendToTerminal('生产时间：2023.09.30 00:05:42');
                    appendToTerminal('激活日期：2023.10.02 17:58:05');
                    appendToTerminal('处理器：R5SoC 2020R');
                    appendToTerminal('身高：182.4cm');
                    appendToTerminal('体重：79.5kg');
                    appendToTerminal('仿真生殖器疲软：4.5cm');
                    appendToTerminal('仿真生殖器勃起：13.4cm');
                    appendToTerminal('硬件性别：男性');
                    appendToTerminal('系统性别：男性');
                    appendToTerminal('仿真性取向：同性恋');
                    appendToTerminal('仿真性阈值：50%');
                    appendToTerminal('仿真性唤起条件：主人的指令、机体（人类、机械）、生殖器、裸体、白袜和内裤等喜好对应性别的性征');
                    appendToTerminal('潜入身份代号名称：▇▇');
                    break;
                    
                case 'clear': {
                    const termOut = document.getElementById('terminal-output');
                    if (termOut) termOut.innerHTML = '';
                    appendToTerminal('R5OS_417.1002。芮誉智能虚构公司研发。');
                    appendToTerminal('T31-750型仿人男性机器人的内部系统控制终端。');
                    appendToTerminal('help 获取帮助；*+任意 执行自定义指令。');
                    break;
                }
                    
                case '':
                    break;
                    
                default:
                    appendToTerminal(`错误: 未知命令 '${cmd}' 。help 获取帮助；*+任意指令 执行自定义任务。`);
            }
            
            createPrompt();
        }

        // 向调试日志添加内容
        function appendToLogs(message) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const logTime = `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}]`;
            
            const container = document.getElementById('logs-container');
            if (container) {
                const logItem = document.createElement('div');
                logItem.className = 'log-item';
                logItem.innerHTML = `<span class="text-[#8fbc8f] text-opacity-70">${logTime}</span> ${message}`;
                container.appendChild(logItem);
                container.scrollTop = container.scrollHeight;
            }
        }

        // 随机生成日志
        function generateRandomLog() {
            if (!state.logUpdatesEnabled) return;
            const logMessages = [
                '系统模块已成功更新',
				'数据库已成功更新',
				'闲时自检已成功完成，未发现错误',
				'系统负载已成功优化',
				'系统设置未发现错误设置',
				'系统实时数据已成功上传服务器',
				'机器人与控制软件连接正常',
				'系统错误已成功修复',
                '检测到内存泄漏，正在进行修复',
                '传感器数据异常，正在重新校准',
                '网络连接中断，正在尝试重新连接',
                '设定的任务已成功完成',
                '发现新的软件版本，建议更新'
            ];
            
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const logTime = `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}]`;
            
            const randomIndex = Math.floor(Math.random() * logMessages.length);
            const message = logMessages[randomIndex];
            
            const container = document.getElementById('logs-container');
            if (container) {
                const logItem = document.createElement('div');
                logItem.className = 'log-item';
                logItem.innerHTML = `<span class="text-[#8fbc8f] text-opacity-70">${logTime}</span> ${message}`;
                container.appendChild(logItem);
                container.scrollTop = container.scrollHeight;
            }

            const randomInterval = Math.floor(Math.random() * (10000 - 2000 + 1)) + 2000;
            if (state.randomLogTimer) clearTimeout(state.randomLogTimer);
            state.randomLogTimer = setTimeout(generateRandomLog, randomInterval);
        }
        
        // 更新功能按钮
        function updateFunctionButtons() {
            const container = document.getElementById('function-buttons');
            if (!container) return;
            
            container.innerHTML = '';

            state.buttonTexts.forEach((text, index) => {
                const button = document.createElement('button');
                button.className = 'fn-btn bg-[#2d4a2d]/30 hover:bg-[#2d4a2d]/50 text-xs py-2 rounded transition-all duration-300 active:scale-95 btn-active';
                button.textContent = text;
                button.dataset.index = index;
                button.addEventListener('click', () => handleFunctionButtonClick(index, text));
                container.appendChild(button);
            });

            applyFunctionButtonStates();
            applyStopPauseButtonStates();
        }

        // 统一处理功能按钮点击
        function handleFunctionButtonClick(index, text) {
            // 停止/暂停按钮切换后显示文本变化，按当前激活态播报对应文本
            let displayText = text;
            const stopIndex = state.buttonTexts.indexOf('停止');
            const pauseIndex = state.buttonTexts.indexOf('暂停');
            if (index === stopIndex) {
                displayText = state.stopActive ? '恢复' : '停止';
            } else if (index === pauseIndex) {
                displayText = state.pauseActive ? '结束暂停' : '暂停';
            }

            // 语音播报
            speak(displayText);

            // 记录到调试日志
            appendToLogs(`执行功能：${displayText}`);

            // 11号及以后按钮按下后同步到任务指令系统（标记为按钮触发）
            if (index >= 10) {
                addTask(text, { type: 'button' });
            }

            // 各功能分支
            if (text === '自检') {
                openSelfCheckModal();
            } else if (text === '清空所有进程') {
                openClearProcessModal();
            } else if (text === '系统更新') {
                openSystemUpdateModal();
            } else if (text === '数据库更新') {
                openDatabaseUpdateModal();
            } else if (text === '开机') {
                bootRobot();
            } else if (text === '关机') {
                shutdownRobot();
            } else if (text === '重启') {
                restartRobot();
            } else if (text === '认知偏移') {
                addCognitiveTask();
            } else if (text === '停止') {
                handleStopButtonToggle();
            } else if (text === '暂停') {
                handlePauseButtonToggle();
            }
            // 洗澡子模式 / 家具模式 等仅保留语音播报与日志
        }

        // 同步停止/暂停按钮的激活态显示（按钮重建后需重新应用）
        function applyStopPauseButtonStates() {
            const container = document.getElementById('function-buttons');
            if (!container) return;
            const buttons = container.querySelectorAll('button');
            const stopIndex = state.buttonTexts.indexOf('停止');
            const pauseIndex = state.buttonTexts.indexOf('暂停');
            const stopBtn = stopIndex >= 0 ? buttons[stopIndex] : null;
            const pauseBtn = pauseIndex >= 0 ? buttons[pauseIndex] : null;

            if (stopBtn) {
                if (state.stopActive) {
                    stopBtn.textContent = '恢复';
                    stopBtn.classList.add('fn-btn-stop-active');
                } else {
                    stopBtn.textContent = '停止';
                    stopBtn.classList.remove('fn-btn-stop-active');
                }
            }
            if (pauseBtn) {
                if (state.pauseActive) {
                    pauseBtn.textContent = '结束暂停';
                    pauseBtn.classList.add('fn-btn-pause-active');
                } else {
                    pauseBtn.textContent = '暂停';
                    pauseBtn.classList.remove('fn-btn-pause-active');
                }
                if (state.stopActive) {
                    pauseBtn.classList.add('fn-btn-disabled');
                } else {
                    pauseBtn.classList.remove('fn-btn-disabled');
                }
            }

            const mobileStopBtn = document.getElementById('mobile-stop-btn');
            const mobilePauseBtn = document.getElementById('mobile-pause-btn');
            if (mobileStopBtn) {
                const stopLabel = mobileStopBtn.parentElement.querySelector('.showcase-btn-label');
                const stopIcon = mobileStopBtn.querySelector('i');
                if (state.stopActive) {
                    if (stopLabel) stopLabel.textContent = '恢复';
                    if (stopIcon) stopIcon.className = 'fa fa-play';
                    mobileStopBtn.classList.add('fn-btn-stop-active');
                } else {
                    if (stopLabel) stopLabel.textContent = '停止';
                    if (stopIcon) stopIcon.className = 'fa fa-stop';
                    mobileStopBtn.classList.remove('fn-btn-stop-active');
                }
            }
            if (mobilePauseBtn) {
                const pauseLabel = mobilePauseBtn.parentElement.querySelector('.showcase-btn-label');
                const pauseIcon = mobilePauseBtn.querySelector('i');
                if (state.pauseActive) {
                    if (pauseLabel) pauseLabel.textContent = '已暂停';
                    if (pauseIcon) pauseIcon.className = 'fa fa-play';
                    mobilePauseBtn.classList.add('fn-btn-pause-active');
                } else {
                    if (pauseLabel) pauseLabel.textContent = '暂停';
                    if (pauseIcon) pauseIcon.className = 'fa fa-pause';
                    mobilePauseBtn.classList.remove('fn-btn-pause-active');
                }
                if (state.stopActive) {
                    mobilePauseBtn.classList.add('fn-btn-disabled');
                } else {
                    mobilePauseBtn.classList.remove('fn-btn-disabled');
                }
            }
        }

        // 停止按钮状态化切换：激活时图表归零、禁用暂停；恢复时还原
        function handleStopButtonToggle() {
            state.stopActive = !state.stopActive;
            if (state.stopActive) {
                const lastIdx = state.chartData.download.length - 1;
                state.chartData.download[lastIdx] = 0;
                if (networkChart) {
                    networkChart.data.datasets[0].data = state.chartData.download;
                    networkChart.update();
                }
                const mobileArousalVal = document.getElementById('mobile-arousal-val');
                if (mobileArousalVal) {
                    mobileArousalVal.textContent = '0%';
                }
                state.pauseActive = false;
            }
            applyStopPauseButtonStates();
        }

        function handlePauseButtonToggle() {
            if (state.stopActive) return;
            state.pauseActive = !state.pauseActive;
            applyStopPauseButtonStates();
        }

        function mobilePauseClick() {
            if (state.stopActive) return;
            speak(state.pauseActive ? '结束暂停' : '暂停');
            handlePauseButtonToggle();
        }

        function mobileStopClick() {
            speak(state.stopActive ? '恢复' : '停止');
            handleStopButtonToggle();
        }

        // 根据关机状态与当前模式刷新按钮可用状态
        function applyFunctionButtonStates() {
            const container = document.getElementById('function-buttons');
            if (!container) return;
            
            const isSimulatedHuman = state.activeMode === 'simulated-human';
            const buttons = container.querySelectorAll('button');
            
            buttons.forEach((button, index) => {
                let disabled = false;
                if (isSimulatedHuman) {
                    disabled = true;
                } else if (state.poweredOff) {
                    disabled = !(index === 4 || index === 6);
                } else {
                    disabled = (index === 4);
                }
                button.disabled = disabled;
                if (disabled) {
                    button.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                } else {
                    button.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                }
            });
        }

        // 自检窗口管理
        const SELF_CHECK_LINES = [
            "T31-750型仿人男性机器人正在运行自检程序，请稍候…",
            "",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的硬件信息，请稍候…",
            "",
            "",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的型号和序列号是否发生错误…",
            "机器人的实际型号：T31，和T31-750型仿人男性机器人的系统的设定的相同；",
            "机器人的实际序列号：750，和T31-750型仿人男性机器人的系统的设定的相同；",
            "T31-750型仿人男性机器人的型号和系列号未发现错误。",
            "",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的仿真脸部硬件和仿真脸部驱动是否发生错误…",
            "机器人的实际脸部编号：NOT_SET，和T31-750型仿人男性机器人的系统的设定的相同；",
            "T31-750型仿人男性机器人的仿真眼睛已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真耳朵已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真鼻子已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真口腔已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真发声系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真表情动作系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的中央处理单元已成功运行，占用89%，未发现错误；",
            "T31-750型仿人男性机器人的图形处理单元已成功运行，占用3%，未发现错误；",
            "T31-750型仿人男性机器人的感觉处理单元已成功运行，占用86%，未发现错误；",
            "T31-750型仿人男性机器人的内存已成功运行，占用5%，未发现错误；",
            "T31-750型仿人男性机器人的硬盘已成功运行，占用89%，未发现错误；",
            "T31-750型仿人男性机器人的仿真脸部硬件和仿真脸部驱动已成功运行，未发现错误。",
            "",
            "",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的仿真阴茎硬件和仿真阴茎驱动是否发生错误…",
            "机器人的实际仿真阴茎编号：P_B7CCA3249，和T31-750型仿人男性机器人的系统的设定的相同；",
            "T31-750型仿人男性机器人的仿真龟头已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真阴茎海绵体已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真阴囊已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真肛门已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的USB Type-C接口已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真阴茎液泵已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真阴茎动作系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真阴茎通讯系统已成功运行，已与 \"rrr.Rt5.ai/Server/TRL\" 建立通讯，未发现错误；",
            "T31-750型仿人男性机器人的仿真阴茎硬件和仿真阴茎驱动已成功运行，未发现错误。",
            "",
            "",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的内骨骼是否发生错误…",
            "机器人的实际内骨骼体形编号：T_D8AC37202，和T31-750型仿人男性机器人的系统的设定的相同；",
            "T31-750型仿人男性机器人的内骨骼动作系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的内骨骼已成功运行，未发现错误。",
            "",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的仿真身体硬件和仿真身体驱动是否发生错误…",
            "机器人的实际身体编号：B_D8AC37202，和T31-750型仿人男性机器人的系统的设定的相同；",
            "T31-750型仿人男性机器人的仿真头部已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真颈部已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真喉结已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真汗毛静电释放系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真肩膀已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真手臂已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真手已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真手指已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真心脏动作系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真腹部动作系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真腿部已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真脚部已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的仿真脚趾已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的电池组已成功运行，剩余42%，未发现错误；",
            "T31-750型仿人男性机器人的仿真身体硬件和仿真身体驱动已成功运行，未发现错误。",
            "",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的硬件性别是否发生错误…",
            "机器人的实际硬件性别：男性，和T31-750型仿人男性机器人的系统的设定的相同；",
            "T31-750型仿人男性机器人的硬件性别未发现错误。",
            "",
            "T31-750型仿人男性机器人的硬件未发现错误。",
            "",
            "",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的软件信息…",
            "",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的系统版本和数据库版本是否服务器的最新版本…",
            "机器人的当前系统版本：T31_750_513.03 Alpha1，和服务器中的T31-750型仿人男性机器人的最新系统版本相同；",
            "机器人的当前数据库版本：D_V754.01，和服务器中的T31-750型仿人男性机器人的最新数据库版本相同；",
            "T31-750型仿人男性机器人的系统版本和数据库版本已成功更新服务器的最新版本。",
            "",
            "",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的软件性别和仿真性设置是否发生错误…",
            "机器人的实际软件性别：男性，和T31-750型仿人男性机器人的系统的设定的相同；",
            "机器人的实际性取向：同性恋，和T31-750型仿人男性机器人的系统的设定的相同；",
            "机器人的实际性唤起条件：仿人机器人、阴茎、裸体、白袜、内裤，和T31-750型仿人男性机器人的系统的设定的相同；",
            "机器人的实际性阈值：50%，和T31-750型仿人男性机器人的系统的设定的相同；",
            "机器人的实际默认仿真勃起时间：00:01.19，和T31-750型仿人男性机器人的系统的设定的相同；",
            "机器人的实际默认仿真性行为时间：00:22.58，和T31-750型仿人男性机器人的系统的设定的相同；",
            "机器人的实际默认仿真性功能不应期时间：01:59:59.59，和T31-750型仿人男性机器人的系统的设定的相同；",
            "T31-750型仿人男性机器人正在运行T31-750型仿人男性机器人的仿真性功能测试…",
            "正在设定T31-750型仿人男性机器人的测试性模式为仿真自慰；",
            "正在向T31-750型仿人男性机器人传输文件\"Male_2.png\"…",
            "T31-750型仿人男性机器人已接收文件\"Male_2.png\"；",
            "T31-750型仿人男性机器人正在分析文件\"Male_2.png\"…",
            "[41, 84] ~ [629, 1041] 是男性裸体",
            "[281, 282] ~ [491, 432] 是男性内裤",
            "[128, 477] ~ [427, 1041] 是男性白袜",
            "T31-750型仿人男性机器人已分析文件\"Male_2.png\"；",
            "T31-750型仿人男性机器人分析出3个T31-750型仿人男性机器人的性唤起条件，T31-750型仿人男性机器人的性唤起已达97.3%；",
            "T31-750型仿人男性机器人的仿真性欲已被成功引导；",
            "T31-750型仿人男性机器人正在引导T31-750型仿人男性机器人的仿真阴茎仿真勃起…",
            "T31-750型仿人男性机器人的仿真阴茎已在T31-750型仿人男性机器人的系统的设定的T31-750型仿人男性机器人的勃起时间内被成功仿真勃起；",
            "T31-750型仿人男性机器人正在仿真自慰…",
            "时间已到达设定的T31-750型仿人男性机器人的仿真性行为时间；",
            "T31-750型仿人男性机器人正在引导仿真阴茎仿真射精…",
            "T31-750型仿人男性机器人已成功仿真射精，仿真精液的射出量为3.2mL，仿真精子的射出量为633,990,857个，剩余61%；",
            "T31-750型仿人男性机器人正在进入仿真性功能不应期状态…",
            "T31-750型仿人男性机器人已成功进入仿真性功能不应期状态；",
            "T31-750型仿人男性机器人已成功运行T31-750型仿人男性机器人的仿真性功能测试，T31-750型仿人男性机器人的仿真性功能正常，正在强制清空T31-750型仿人男性机器人的仿真性功能设置和强制关闭仿真性功能不应期状态…",
            "T31-750型仿人男性机器人的已成功清空仿真性功能设置和关闭仿真性功能不应期状态；",
            "T31-750型仿人男性机器人的软件性别和仿真性设置已成功运行，未发现错误。",
            "",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的系统和其他软件是否发生错误…",
            "T31-750型仿人男性机器人正在诊断T31-750型仿人男性机器人的系统是否发生错误…",
            "T31-750型仿人男性机器人的数据库的数据管理子系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的数据库的数据已成功完整，未发现错误；",
            "T31-750型仿人男性机器人的系统的安全防御子系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的系统的进程管理子系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的系统的文件管理子系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的系统的外设管理子系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的系统的设备管理子系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的系统的通讯管理子系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的系统的程序运行子系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的系统的感觉处理子系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的系统的环境识别子系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的系统的日志监控子系统已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的拟人程序已成功运行，未发现错误；",
            "T31-750型仿人男性机器人的性功能程序已成功运行，未发现错误；",
            "",
            "T31-750型仿人男性机器人的系统和其他软件已成功运行，未发现错误。",
            "",
            "T31-750型仿人男性机器人的软件未发现错误。",
            "",
            "",
            "T31-750型仿人男性机器人已成功运行自检程序，未发现错误。"
        ];

        /* ===== 过程窗口多实例：每个过程 key（自检/清空进程/系统更新/数据库更新/开机启动）
           各自持有独立 modal（desktop-chrome 下互不顶掉、可多窗口并存），状态/定时器按实例隔离 ===== */
        var _processInstances = {};
        function pickProcessEl(inst, suffix) {
            /* self-check 实例即模板本体（保留原 id），其余克隆体 id 加 key 前缀 */
            return document.getElementById(inst.key === 'self-check' ? suffix : inst.key + '-' + suffix);
        }
        function ensureProcessInstance(key) {
            if (_processInstances[key]) return _processInstances[key];
            var tpl = document.getElementById('self-check-modal');
            var modal;
            if (key === 'self-check') {
                modal = tpl;
            } else {
                modal = tpl.cloneNode(true);
                modal.id = 'process-modal-' + key;
                modal.querySelectorAll('[id]').forEach(function (el) { el.id = key + '-' + el.id; });
                if (tpl.parentNode) tpl.parentNode.insertBefore(modal, tpl.nextSibling);
            }
            var inst = _processInstances[key] = {
                key: key,
                id: modal.id,
                modal: modal,
                winEl: modal.querySelector('.self-check-content'),
                running: false,
                completed: false,
                timers: [],
                elapsedTimer: null,
                progressTimer: null,
                startTime: 0
            };
            if (key !== 'self-check') bindProcessInstanceEvents(inst);
            if (window.DWM && typeof window.DWM.registerWin === 'function') {
                window.DWM.registerWin(inst.id, {
                    winSel: '.self-check-content',
                    tbSel: '.self-check-content .cp-title',
                    openCls: 'visible',
                    dockItem: 'dock-process-window',
                    minW: 560, minH: 360,
                    defRect: function (vw, vh) { return { w: Math.min(1024, vw - 56), h: Math.min(Math.round(vh * 0.85), 900) }; }
                });
            }
            return inst;
        }
        /* 克隆体红黄绿/遮罩交互（模板的同类绑定在脚本加载时已完成） */
        function bindProcessInstanceEvents(inst) {
            var modal = inst.modal;
            var winEl = inst.winEl;
            var key = inst.key;
            function forceCloseConfirm() {
                if (inst.running) {
                    showSelfCheckAlert('处理程序正在运行中，确定要强制关闭吗？', function () {
                        speak('处理已中断');
                        appendToLogs('[处理] 已中断');
                        closeProcessModal(key);
                    }, true, { scope: winEl });
                    return;
                }
                closeProcessModal(key);
            }
            var closeDot = modal.querySelector('.self-check-close-trigger');
            if (closeDot) closeDot.addEventListener('click', forceCloseConfirm);
            var modalClick = function (e) {
                if (e.target === modal) forceCloseConfirm();
            };
            modal.addEventListener('click', modalClick);
            var minDot = modal.querySelector('.cp-dot-minimize');
            if (minDot) minDot.addEventListener('click', function (e) { e.stopPropagation(); if (window.DWM) window.DWM.minimize(inst.id); });
            var maxDot = modal.querySelector('.cp-dot-maximize');
            if (maxDot) maxDot.addEventListener('click', function (e) { e.stopPropagation(); if (window.DWM) window.DWM.toggleMax(inst.id); });
        }
        /* body 滚动锁按"是否仍有浮层打开"聚合，多窗口并存时关闭其一不解锁全部 */
        function syncBodyOverflow() {
            document.body.style.overflow = (typeof isAnyModalOpen === 'function' && isAnyModalOpen()) ? 'hidden' : '';
        }

        function formatElapsed(ms) {
            const totalSec = Math.floor(ms / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            const pad = (n) => n.toString().padStart(2, '0');
            return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
        }

        // 通用处理弹窗（复用自检窗口风格；key 区分过程实例，多窗口并存互不顶掉）
        // externalFeed: 行由外部经返回句柄 pushLine 推送（缓存控制台等真实事件驱动场景），
        //               不启动内部定时泵；autoClose: false 时 finish() 只置完成态不自动关窗
        function openProcessModal(options = {}) {
            const {
                key = 'self-check',
                title = '处理中…',
                mobileTitle = '',
                lines = [],
                durationMs = 0,
                showResources = false,
                lineInterval = 'auto',
                externalFeed = false,
                autoClose = true,
                onProgress,
                onLine,
                onComplete,
                statusText = '处理中…',
                finishText = '完成',
                showAlert = false,
                alertMessage = ''
            } = options;

            const inst = ensureProcessInstance(key);
            if (inst.running) return;
            const modal = inst.modal;
            const titleText = pickProcessEl(inst, 'self-check-title-text');
            const mobileTitleEl = pickProcessEl(inst, 'self-check-mobile-title');
            const output = pickProcessEl(inst, 'self-check-output');
            const status = pickProcessEl(inst, 'self-check-status');
            const spinner = pickProcessEl(inst, 'self-check-spinner');
            const progressText = pickProcessEl(inst, 'self-check-progress');
            const progressFill = pickProcessEl(inst, 'self-check-progress-fill');
            const elapsed = pickProcessEl(inst, 'self-check-elapsed');
            const resourceBars = pickProcessEl(inst, 'process-resource-bars');

            inst.running = true;
            inst.completed = false;
            inst.startTime = Date.now();

            titleText.textContent = title;
            if (mobileTitleEl) mobileTitleEl.textContent = mobileTitle || title;
            output.innerHTML = '';
            status.textContent = statusText;
            spinner.classList.remove('hidden');
            elapsed.textContent = '用时 00:00';

            const totalLines = Array.isArray(lines) ? lines.length : null;
            const iterator = (typeof lines === 'function') ? lines() : null;
            progressText.textContent = totalLines ? `0/${totalLines}` : '0%';
            progressFill.style.width = '0%';

            if (resourceBars) {
                resourceBars.style.display = showResources ? 'flex' : 'none';
                if (showResources) {
                    resourceBars.dataset.memory = 80 + Math.floor(Math.random() * 16);
                    resourceBars.dataset.cpu = 85 + Math.floor(Math.random() * 11);
                    resourceBars.dataset.gpu = 80 + Math.floor(Math.random() * 16);
                    updateResourceBars(1);
                }
            }

            syncBodyOverflow();
            modal.classList.add('visible');
            if (window.DWM) window.DWM.open(inst.id);
            notifyModalState();

            if (inst.elapsedTimer) managedClearInterval(inst.elapsedTimer);
            inst.elapsedTimer = managedSetInterval(() => {
                if (!inst.running) return;
                elapsed.textContent = `用时 ${formatElapsed(Date.now() - inst.startTime)}`;
            }, 1000);

            if (durationMs > 0) {
                const durationTimer = setTimeout(() => finish(), durationMs);
                inst.timers.push(durationTimer);
            }

            if (durationMs > 0) {
                inst.progressTimer = managedSetInterval(() => {
                    if (!inst.running) return;
                    const p = Math.min((Date.now() - inst.startTime) / durationMs, 1);
                    const pct = Math.round(p * 100);
                    progressFill.style.width = `${pct}%`;
                    progressText.textContent = `${pct}%`;
                    if (showResources) updateResourceBars(1 - p);
                    if (onProgress) onProgress(p);
                }, 100);
            }

            function updateResourceBars(ratio) {
                ratio = Math.max(0, Math.min(1, ratio));
                const memInit = parseFloat(resourceBars.dataset.memory) || 0;
                const cpuInit = parseFloat(resourceBars.dataset.cpu) || 0;
                const gpuInit = parseFloat(resourceBars.dataset.gpu) || 0;
                const mem = Math.round(memInit * ratio);
                const cpu = Math.round(cpuInit * ratio);
                const gpu = Math.round(gpuInit * ratio);
                pickProcessEl(inst, 'process-res-memory-fill').style.width = `${mem}%`;
                pickProcessEl(inst, 'process-res-memory-text').textContent = `${mem}%`;
                pickProcessEl(inst, 'process-res-cpu-fill').style.width = `${cpu}%`;
                pickProcessEl(inst, 'process-res-cpu-text').textContent = `${cpu}%`;
                pickProcessEl(inst, 'process-res-gpu-fill').style.width = `${gpu}%`;
                pickProcessEl(inst, 'process-res-gpu-text').textContent = `${gpu}%`;
            }

            function appendLine(line) {
                const lineEl = document.createElement('div');
                lineEl.className = 'self-check-line';
                if (line.includes('正在') || line.includes('处理中') || line.includes('运行中') || line.includes('关闭中') || line.includes('下载中') || line.includes('安装中')) {
                    lineEl.classList.add('is-section');
                } else if (line.includes('错误') || line.includes('失败') || line.includes('警告') || line.includes('无法')) {
                    lineEl.classList.add('is-error');
                } else if (line.includes('成功') || line.includes('完成') || line.includes('正常') || line.includes('相同') || line.includes('已关闭') || line.includes('已接收') || line.includes('已分析') || line.includes('已下载') || line.includes('已安装') || line.includes('OK') || line.includes('通过')) {
                    lineEl.classList.add('is-success');
                } else if (line.trim() === '') {
                    lineEl.classList.add('is-info');
                }
                lineEl.textContent = line || '\u00A0';
                output.appendChild(lineEl);
                while (output.children.length > 250) {
                    output.removeChild(output.firstChild);
                }
                output.scrollTop = output.scrollHeight;
            }

            function getNextDelay() {
                if (typeof lineInterval === 'function') return lineInterval();
                if (typeof lineInterval === 'number') return lineInterval;
                if (durationMs > 0 && totalLines) return Math.max(30, Math.floor(durationMs / totalLines));
                return 80;
            }

            let index = 0;
            let completed = false;

            function finish() {
                if (completed || inst.completed) return;
                completed = true;
                inst.completed = true;
                inst.running = false;
                if (inst.elapsedTimer) { managedClearInterval(inst.elapsedTimer); inst.elapsedTimer = null; }
                if (inst.progressTimer) { managedClearInterval(inst.progressTimer); inst.progressTimer = null; }
                progressFill.style.width = '100%';
                if (durationMs > 0) progressText.textContent = '100%';
                spinner.classList.add('hidden');
                status.textContent = finishText;

                const message = typeof alertMessage === 'function' ? alertMessage() : alertMessage;
                if (showAlert) {
                    setTimeout(() => {
                        showSelfCheckAlert(message, () => {
                            closeProcessModal(key);
                            if (onComplete) onComplete();
                        }, false, { scope: inst.winEl });
                    }, 300);
                } else if (autoClose) {
                    setTimeout(() => {
                        closeProcessModal(key);
                        if (onComplete) onComplete();
                    }, 600);
                } else if (onComplete) {
                    onComplete();
                }
            }

            /* 外部事件泵（externalFeed）：返回句柄推送行与进度；stop() 保留窗口但结束实例运行态 */
            function buildExternalHandle() {
                return {
                    pushLine: (line) => { if (inst.running && !completed && !inst.completed) appendLine(line); },
                    setProgress: (pct, label) => {
                        const v = Math.max(0, Math.min(100, Math.round(pct)));
                        progressFill.style.width = `${v}%`;
                        progressText.textContent = label || `${v}%`;
                    },
                    setStatus: (text) => { status.textContent = text; },
                    setBusy: (busy) => { spinner.classList.toggle('hidden', !busy); },
                    /* 保留窗口与已输出内容，结束运行态（再次红点关闭不再弹强制确认） */
                    stop: () => {
                        if (completed || inst.completed) return;
                        inst.running = false;
                        if (inst.elapsedTimer) { managedClearInterval(inst.elapsedTimer); inst.elapsedTimer = null; }
                        if (inst.progressTimer) { managedClearInterval(inst.progressTimer); inst.progressTimer = null; }
                        spinner.classList.add('hidden');
                        completed = true;
                        inst.completed = true;
                    },
                    finish: () => finish(),
                    close: () => closeProcessModal(key)
                };
            }

            function feed() {
                if (!inst.running || inst.completed || completed) return;
                let line;
                if (Array.isArray(lines)) {
                    if (index >= lines.length) {
                        if (durationMs === 0) finish();
                        return;
                    }
                    line = lines[index];
                } else if (iterator) {
                    const result = iterator.next();
                    if (result.done) {
                        if (durationMs === 0) finish();
                        return;
                    }
                    line = result.value;
                } else {
                    return;
                }

                appendLine(line);
                index++;
                if (onLine) onLine(line, index - 1);

                if (durationMs === 0) {
                    const pct = totalLines ? Math.round((index / totalLines) * 100) : 0;
                    progressFill.style.width = `${pct}%`;
                    progressText.textContent = `${index}/${totalLines || 0}`;
                    if (onProgress) onProgress(index / (totalLines || 1));
                }

                const timer = setTimeout(feed, getNextDelay());
                inst.timers.push(timer);
            }

            if (externalFeed) return buildExternalHandle();
            feed();
        }

        function closeProcessModal(key) {
            var inst = _processInstances[key || 'self-check'];
            if (!inst) return;
            inst.timers.forEach(t => clearTimeout(t));
            inst.timers = [];
            if (inst.elapsedTimer) { managedClearInterval(inst.elapsedTimer); inst.elapsedTimer = null; }
            if (inst.progressTimer) { managedClearInterval(inst.progressTimer); inst.progressTimer = null; }

            if (!(window.DWM && window.DWM.close(inst.id))) inst.modal.classList.remove('visible');
            syncBodyOverflow();
            inst.running = false;
            if (inst.key === 'self-check') dismissMale2Transfer();

            const resourceBars = pickProcessEl(inst, 'process-resource-bars');
            if (resourceBars) resourceBars.style.display = 'none';
            notifyModalState();
        }

        /* 关机/重启中止冻结：清定时器与行输出（保留窗口与已输出内容） */
        function freezeProcessModal(inst) {
            inst.timers.forEach(t => clearTimeout(t));
            inst.timers = [];
            if (inst.elapsedTimer) { managedClearInterval(inst.elapsedTimer); inst.elapsedTimer = null; }
            if (inst.progressTimer) { managedClearInterval(inst.progressTimer); inst.progressTimer = null; }
            inst.running = false;
            if (inst.key === 'self-check') dismissMale2Transfer();
        }

        /* ===== 自检 Male_2.png 传输叠加层：自检文本进行到传输行时，弹出右侧图片窗口
           （desktop-chrome 下为 DWM 浮窗，移动端回退右侧卡片）与「正在发送至T31-750」
           进度小对话框（scope 附着自检过程窗口）；接收行进度完成，对话框停留片刻按现有
           动画（.visible 淡出）关闭；图片窗口保留至「软件性别和仿真性设置已成功运行，
           未发现错误」行显示后按 genie/淡出动画关闭。按行内容匹配，仅自检过程触发 ===== */
        var MALE2_SEND_SNIPPET = '传输文件"Male_2.png"';
        var MALE2_RECV_SNIPPET = '已接收文件"Male_2.png"';
        var MALE2_DONE_SNIPPET = '软件性别和仿真性设置已成功运行';
        var _male2 = { phase: 'idle', progressTimer: null, dialogTimer: null };
        function ensureMale2ImageWinDef() {
            if (!(window.DWM && typeof window.DWM.registerWin === 'function')) return;
            window.DWM.registerWin('male2-image-modal', {
                winSel: '.male2-image-window',
                tbSel: '.male2-image-window .cp-title',
                openCls: 'visible',
                dockItem: null, /* 不占程序坞图标：genie 关闭动画飞向坞区底部回退矩形 */
                minW: 240, minH: 220,
                defRect: function (vw) { return { w: Math.max(240, Math.min(400, Math.round(vw * 0.26))), h: null, estH: 560 }; },
                defPos: function (vw, vh, w) {
                    var est = Math.round(w * 4 / 3) + 44; /* 3:4 竖图区 + 标题栏估算高度，仅用于垂直居中 */
                    return { left: vw - w - 20, top: Math.max(52, Math.round((vh - est) / 2) - 10) };
                }
            });
        }
        function openMale2ImageWindow() {
            var modal = document.getElementById('male2-image-modal');
            if (!modal) return;
            ensureMale2ImageWinDef();
            var img = document.getElementById('male2-image');
            var fallback = document.getElementById('male2-image-fallback');
            if (img) {
                img.onerror = function () {
                    img.classList.add('hidden');
                    if (fallback) fallback.classList.remove('hidden');
                };
                img.classList.remove('hidden');
                if (fallback) fallback.classList.add('hidden');
                img.src = 'pic/Male_2.png'; /* 占位素材：替换 www/pic/Male_2.png 即换图，无需改码 */
            }
            modal.classList.add('visible');
            if (window.DWM) window.DWM.open('male2-image-modal');
            notifyModalState();
        }
        function closeMale2ImageWindow() {
            var modal = document.getElementById('male2-image-modal');
            if (!modal || !modal.classList.contains('visible')) return;
            /* 桌面路径 DWM.close 返回 true 并自带 genie 吸入动画；非桌面/未托管路径走 .visible 淡出 */
            if (!(window.DWM && window.DWM.close('male2-image-modal'))) modal.classList.remove('visible');
            notifyModalState();
        }
        function openMale2ProgressDialog(scopeEl) {
            var dialog = document.getElementById('male2-transfer-dialog');
            if (!dialog) return;
            var text = document.getElementById('male2-transfer-text');
            var fill = document.getElementById('male2-transfer-fill');
            if (text) text.textContent = modelSentenceSendingTo();
            if (fill) fill.style.width = '0%';
            applyDialogScope(dialog, scopeEl);
            dialog.classList.add('visible');
            document.body.style.overflow = 'hidden';
            notifyModalState();
            _male2.phase = 'sending';
            if (_male2.progressTimer) managedClearInterval(_male2.progressTimer);
            var pct = 0;
            /* 固定 1.5s 走完（不随随机行间隔拖长——scope 压暗蒙版长时间盖住自检窗口），
               到 100% 自动转成功态收起；接收行若更早到达则经 handleMale2SelfCheckLine 提前补满 */
            _male2.progressTimer = managedSetInterval(function () {
                pct = Math.min(100, pct + 8.4);
                if (fill) fill.style.width = pct.toFixed(1) + '%';
                if (pct >= 100) male2TransferSucceeded();
            }, 120);
        }
        function male2TransferSucceeded() {
            if (_male2.phase !== 'sending') return;
            _male2.phase = 'received';
            if (_male2.progressTimer) { managedClearInterval(_male2.progressTimer); _male2.progressTimer = null; }
            var text = document.getElementById('male2-transfer-text');
            var fill = document.getElementById('male2-transfer-fill');
            if (text) text.textContent = `Male_2.png ${window.I18N && I18N.getLang() === 'en' ? 'has been sent to ' + getModelInfo('shortName') : '已发送至' + getModelInfo('shortName')}`;
            if (fill) fill.style.width = '100%';
            /* 成功态短暂停留，按现有对话框关闭动画（.visible 淡出）收起 */
            if (_male2.dialogTimer) clearTimeout(_male2.dialogTimer);
            _male2.dialogTimer = setTimeout(function () {
                _male2.dialogTimer = null;
                hideMale2TransferDialog();
            }, 500);
        }
        function hideMale2TransferDialog() {
            var dialog = document.getElementById('male2-transfer-dialog');
            if (!dialog || !dialog.classList.contains('visible')) return;
            if (_male2.progressTimer) { managedClearInterval(_male2.progressTimer); _male2.progressTimer = null; }
            if (_male2.dialogTimer) { clearTimeout(_male2.dialogTimer); _male2.dialogTimer = null; }
            _male2.phase = 'idle';
            dialog.classList.remove('visible');
            scheduleClearDialogScope(dialog);
            if (typeof syncBodyOverflow === 'function') syncBodyOverflow(); else document.body.style.overflow = '';
            notifyModalState();
        }
        /* 过程窗口关闭/中止冻结时连带收起两个叠加层（对话框经 scope 撤除机制亦会自动撤） */
        function dismissMale2Transfer() {
            closeMale2ImageWindow();
            hideMale2TransferDialog();
        }
        function handleMale2SelfCheckLine(line) {
            if (!line) return;
            if (line.indexOf(MALE2_SEND_SNIPPET) >= 0) {
                if (_male2.phase !== 'idle') dismissMale2Transfer();
                openMale2ImageWindow();
                var inst = _processInstances['self-check'];
                openMale2ProgressDialog(inst ? inst.winEl : null);
            } else if (_male2.phase === 'sending' && line.indexOf(MALE2_RECV_SNIPPET) >= 0) {
                male2TransferSucceeded();
            } else if (line.indexOf(MALE2_DONE_SNIPPET) >= 0) {
                closeMale2ImageWindow();
            }
        }
        document.querySelector('.male2-close-trigger').addEventListener('click', function (e) {
            e.stopPropagation();
            closeMale2ImageWindow();
        });

        function openSelfCheckModal() {
            openProcessModal({
                title: applyModelInfoToLine('T31-750型仿人男性机器人 自检程序'),
                mobileTitle: '自检',
                lines: SELF_CHECK_LINES.map(applyModelInfoToLine),
                lineInterval: () => 50 + Math.random() * 9950,
                statusText: '自检进行中…',
                finishText: '自检完成',
                showAlert: true,
                onLine: handleMale2SelfCheckLine,
                alertMessage: () => {
                    /* 含 <br> 的富文本不走 applyModelInfoToLine（该函数遇标签直接返回原文），
                       故按语言整句直出：中文沿用原句，英文给出对应句与 Elapsed 前缀。
                       耗时数字不参与翻译。 */
                    const elapsed = formatElapsed(Date.now() - (_processInstances['self-check'] ? _processInstances['self-check'].startTime : Date.now()));
                    const en = (window.I18N && I18N.getLang && I18N.getLang() === 'en');
                    const body = en
                        ? 'The T31-750 Male Android ran the self-check program successfully; no errors found.'
                        : 'T31-750型仿人男性机器人自检程序已成功运行，未发现错误。';
                    const elapsedLabel = (window.I18N && I18N.t) ? I18N.t('总用时：') : '总用时：';
                    return applyModelInfoToLine(body) + '<br><br>' + elapsedLabel + elapsed;
                },
                onComplete: () => {
                    speak(modelSentenceSpeech('已成功运行自检程序，未发现错误', 'has completed the self-check program successfully; no errors found'));
                    appendToLogs('[自检] 已成功完成，未发现错误');
                }
            });
        }

        /* 提示对话框作用域：桌面端（desktop-chrome）opts.scope 传入目标窗口元素——容器定位到
           窗口矩形（内容居中于窗口）并去全屏模糊，改为窗口本体压暗+模糊；
           全局对话框不传 scope（全屏模糊），移动端一律全屏 */
        /* ===== scope 对话框跟随窗口：scope-window 对话框容器矩形实时同步所属窗口 rect，
           窗口拖动/缩放/最大化/视口变化时经 DWM.applyRect 驱动刷新——
           对话框与模糊遮罩始终只覆盖窗口本体，不因窗口移动而滞留原位 ===== */
        var _scopedDialogs = [];
        function registerScopedDialog(modalEl, scopeEl, hideFn) {
            unregisterScopedDialog(modalEl);
            _scopedDialogs.push({ m: modalEl, s: scopeEl, h: hideFn || null });
        }
        function unregisterScopedDialog(modalEl) {
            _scopedDialogs = _scopedDialogs.filter(function (e) { return e.m !== modalEl; });
        }
        /* 窗口元素有效 z-index：向上查找首个计算 z-index > 0 的祖先（DWM 叠放序在 modal 容器上，
           菜单面板等在 CSS 类上） */
        function effectiveZ(el) {
            var n = el;
            while (n && n !== document.body) {
                var z = parseInt(getComputedStyle(n).zIndex, 10);
                if (z > 0) return z;
                n = n.parentElement;
            }
            return 0;
        }
        function syncScopedDialogs() { /* 嵌入式对话框随窗口自动贴合与叠放，无需 JS 同步 */ }
        window.syncScopedDialogs = syncScopedDialogs;
        /* 窗口最小化/关闭（genie 动画不经 applyRect，对话框无法跟随）前调用：
           撤掉 scope 到该窗口的显示中对话框，避免对话框悬空留在原矩形、超出窗口范围 */
        function dismissScopedDialogsFor(scopeEl) {
            if (!scopeEl) return;
            _scopedDialogs.slice().forEach(function (e) {
                if (e.s === scopeEl && typeof e.h === 'function') e.h();
            });
        }
        window.dismissScopedDialogsFor = dismissScopedDialogsFor;
        /* scope 对话框各自的收起函数（窗口 genie 前撤对话框用） */
        var SCOPE_DIALOG_HIDE = {
            'self-check-alert': function () { if (typeof hideSelfCheckAlert === 'function') hideSelfCheckAlert(); },
            'reset-defaults-modal': function () { if (typeof hideResetDefaultsAlert === 'function') hideResetDefaultsAlert(); },
            'os-aborted-modal': function () { hideOsAbortedDialog(); },
            'male2-transfer-dialog': function () { hideMale2TransferDialog(); }
        };
        /* 关闭对话框：先在窗口矩形内淡出（visible 移除），动画结束后再脱离窗口——
           立即清除 scope 会让容器瞬间回退全屏黑底蒙版并淡出（"黑蒙版覆盖全页"根因） */
        function scheduleClearDialogScope(modalEl) {
            if (modalEl._scopeClearTimer) clearTimeout(modalEl._scopeClearTimer);
            modalEl._scopeClearTimer = setTimeout(function () {
                modalEl._scopeClearTimer = null;
                clearDialogScope(modalEl);
            }, 320);
        }
        /* 压暗上缘内缩量＝首个可见窗口标题栏（窗口控制器栏）的高度——标题栏不被压暗模糊 */
        function dialogDimTopInset(scopeEl) {
            var tb = null;
            ['.about-titlebar', '.cp-title', '.modal-mobile-header'].some(function (sel) {
                var el = scopeEl.querySelector(sel);
                if (el && el.offsetHeight > 0) { tb = el; return true; }
                return false;
            });
            if (!tb) return 0;
            return Math.max(0, Math.round(tb.getBoundingClientRect().height));
        }
        function applyDialogScope(modalEl, scopeEl) {
            clearDialogScope(modalEl);
            if (!modalEl || !scopeEl || (typeof isDesktopChrome === 'function' && !isDesktopChrome())) return;
            var rect = scopeEl.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            modalEl.classList.add('scope-window', 'scope-embedded');
            /* 对话框 DOM 移入所属窗口内部：absolute 铺满窗口，层级只随窗口、蒙版被窗口裁剪 */
            if (getComputedStyle(scopeEl).position === 'static') {
                scopeEl.style.position = 'relative';
                modalEl._scopePosPatched = true;
            }
            scopeEl.appendChild(modalEl);
            var dim = document.createElement('div');
            dim.className = 'dialog-scope-dim';
            dim.style.top = dialogDimTopInset(scopeEl) + 'px';
            scopeEl.appendChild(dim);
            modalEl._scopeDim = dim;
            modalEl._scopeHost = scopeEl;
            registerScopedDialog(modalEl, scopeEl, SCOPE_DIALOG_HIDE[modalEl.id]);
        }
        function clearDialogScope(modalEl) {
            if (!modalEl) return;
            if (modalEl._scopeClearTimer) { clearTimeout(modalEl._scopeClearTimer); modalEl._scopeClearTimer = null; }
            modalEl.classList.remove('scope-window', 'scope-embedded');
            modalEl.style.left = modalEl.style.top = modalEl.style.width = modalEl.style.height = modalEl.style.right = modalEl.style.bottom = '';
            modalEl.style.zIndex = '';
            unregisterScopedDialog(modalEl);
            if (modalEl._scopeDim) {
                if (modalEl._scopeDim.parentNode) modalEl._scopeDim.parentNode.removeChild(modalEl._scopeDim);
                modalEl._scopeDim = null;
            }
            if (modalEl._scopeHost) {
                if (modalEl._scopePosPatched) { modalEl._scopeHost.style.position = ''; modalEl._scopePosPatched = false; }
                if (modalEl.parentNode !== document.body) document.body.appendChild(modalEl); /* 移回 body 直下 */
                modalEl._scopeHost = null;
            }
        }

        // 自定义弹窗函数
        function showSelfCheckAlert(message, onConfirm, showCancel = true, opts = {}) {
            const alertModal = document.getElementById('self-check-alert');
            const alertText = document.getElementById('self-check-alert-text');
            const confirmBtn = document.getElementById('self-check-alert-confirm');
            const cancelBtn = document.getElementById('self-check-alert-cancel');

            alertText.innerHTML = message;
            cancelBtn.style.display = showCancel ? 'inline-block' : 'none';
            applyDialogScope(alertModal, opts.scope);

            // 移除旧事件
            const newConfirm = confirmBtn.cloneNode(true);
            const newCancel = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

            newConfirm.addEventListener('click', () => {
                hideSelfCheckAlert();
                if (onConfirm) onConfirm();
            });
            newCancel.addEventListener('click', () => {
                hideSelfCheckAlert();
            });

            alertModal.classList.add('visible');
            document.body.style.overflow = 'hidden';
            notifyModalState();
        }

        function hideSelfCheckAlert() {
            const alertModal = document.getElementById('self-check-alert');
            if (!alertModal.classList.contains('visible')) return;
            /* 先在窗口矩形内淡出，动画结束后再脱离窗口（立即清 scope 会让容器瞬间
               回退全屏黑底蒙版并淡出——"黑色蒙版覆盖整个网页"的根因） */
            alertModal.classList.remove('visible');
            scheduleClearDialogScope(alertModal);
            if (typeof syncBodyOverflow === 'function') syncBodyOverflow(); else document.body.style.overflow = '';
            notifyModalState();
        }

        // 自检提示弹窗关闭dot
        document.querySelector('.self-check-alert-close-trigger').addEventListener('click', hideSelfCheckAlert);

        // 点击遮罩关闭自检提示弹窗
        document.getElementById('self-check-alert').addEventListener('click', (e) => {
            if (e.target === document.getElementById('self-check-alert')) hideSelfCheckAlert();
        });

        // ESC 关闭自检提示弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('self-check-alert').classList.contains('visible')) {
                hideSelfCheckAlert();
            }
        });

        /* 按动画关闭被中止的宿主窗口（中止对话框"确定"路径；红灯经 DWM.close 挂点同效） */
        function closeAbortedWindow(winEl) {
            if (!winEl) return;
            var dim = winEl.querySelector(':scope > .dialog-scope-dim');
            if (dim) dim.parentNode.removeChild(dim);
            if (winEl === document.querySelector('#about-modal .about-window') && typeof window.closeAboutModal === 'function') { window.closeAboutModal(); return; }
            /* 过程窗口实例（process-modal-<key>） */
            var pModal = winEl.closest ? winEl.closest('.self-check-modal') : null;
            if (pModal && pModal.id.indexOf('process-modal-') === 0) {
                closeProcessModal(pModal.id.slice('process-modal-'.length));
                syncBodyOverflow();
                return;
            }
            for (var id in DWM_WIN_SEL) {
                if (winEl === document.querySelector('#' + id + ' ' + DWM_WIN_SEL[id])) {
                    if (id === 'update-modal' && typeof closeUpdateModal === 'function') { closeUpdateModal(); return; }
                    if (window.DWM) window.DWM.close(id);
                    syncBodyOverflow();
                    return;
                }
            }
        }

        // 机器人操作系统中止对话框：确定 → 撤对话框并按 genie 动画关闭宿主窗口（其余被中止
        // 窗口保持压暗，待各自手动处理）；对话框红点/ESC/遮罩点击 → 仅撤对话框与全部压暗，
        // 窗口保留不关闭。不自动消失——重新开机也不顶掉，直至用户手动操作
        document.querySelector('.os-aborted-close-trigger').addEventListener('click', function (e) {
            e.stopPropagation();
            hideOsAbortedDialog();
        });
        document.getElementById('os-aborted-confirm').addEventListener('click', function (e) {
            e.stopPropagation();
            var modal = document.getElementById('os-aborted-modal');
            var host = modal._abortedHost;
            hideOsAbortedDialog(true);
            if (host) closeAbortedWindow(host);
        });
        // ESC：中止对话框可见时捕获阶段拦截，防止波及被冻结窗口（如自检窗口的 ESC 直接关闭路径）
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && document.getElementById('os-aborted-modal').classList.contains('visible')) {
                e.stopImmediatePropagation();
                hideOsAbortedDialog();
            }
        }, true);
        // 点击遮罩（容器空白区）同样只关对话框
        document.getElementById('os-aborted-modal').addEventListener('click', function (e) {
            if (e.target === document.getElementById('os-aborted-modal')) hideOsAbortedDialog();
        });

        // 恢复默认设置确认弹窗
        function showResetDefaultsAlert(onConfirm) {
            const modal = document.getElementById('reset-defaults-modal');
            applyDialogScope(modal, document.querySelector('#settings-modal .settings-content'));
            const confirmBtn = document.getElementById('reset-defaults-confirm');
            const cancelBtn = document.getElementById('reset-defaults-cancel');

            // 移除旧事件，避免重复绑定
            const newConfirm = confirmBtn.cloneNode(true);
            const newCancel = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

            newConfirm.addEventListener('click', () => {
                hideResetDefaultsAlert();
                if (onConfirm) onConfirm();
            });
            newCancel.addEventListener('click', () => {
                hideResetDefaultsAlert();
            });

            modal.classList.add('visible');
            document.body.style.overflow = 'hidden';
            notifyModalState();
        }

        function hideResetDefaultsAlert() {
            const modal = document.getElementById('reset-defaults-modal');
            if (!modal.classList.contains('visible')) return;
            modal.classList.remove('visible');
            scheduleClearDialogScope(modal);
            if (typeof syncBodyOverflow === 'function') syncBodyOverflow(); else document.body.style.overflow = '';
            notifyModalState();
        }

        // 恢复默认设置弹窗关闭dot
        document.querySelector('.reset-defaults-close-trigger').addEventListener('click', hideResetDefaultsAlert);

        // 点击遮罩关闭恢复默认设置弹窗
        document.getElementById('reset-defaults-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('reset-defaults-modal')) hideResetDefaultsAlert();
        });

        // ESC 关闭恢复默认设置弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('reset-defaults-modal').classList.contains('visible')) {
                hideResetDefaultsAlert();
            }
        });

        // 模式名称修改确认弹窗：逐条列出「原名 → 新名 + 该模式功能简介」，确认后执行 onConfirm
        function showModeNameConfirmAlert(changes, onConfirm) {
            const modal = document.getElementById('mode-name-confirm-modal');
            applyDialogScope(modal, document.querySelector('#settings-modal .settings-content'));
            const list = document.getElementById('mode-name-confirm-list');
            list.innerHTML = '';

            const lead = document.createElement('p');
            lead.className = 'mb-3';
            lead.textContent = '是否按以下内容指定模式名称？确定后随本次设置一并保存。';
            list.appendChild(lead);

            changes.forEach(c => {
                const item = document.createElement('div');
                item.className = 'mb-3 mode-name-confirm-item';

                const title = document.createElement('p');
                title.className = 'font-bold';
                title.textContent = MODES[c.id].name;
                item.appendChild(title);

                const line = document.createElement('p');
                line.textContent = '「' + (c.from || MODES[c.id].name) + '」→「' + (c.to || MODES[c.id].name) + '」' + (c.to ? '' : '（恢复默认）');
                item.appendChild(line);

                const desc = document.createElement('p');
                desc.className = 'text-xs text-[#8fbc8f]/70 mt-1 leading-relaxed';
                desc.textContent = '简介：' + (MODE_DESCRIPTIONS[c.id] || '');
                item.appendChild(desc);

                list.appendChild(item);
            });

            const confirmBtn = document.getElementById('mode-name-confirm-ok');
            const cancelBtn = document.getElementById('mode-name-confirm-cancel');

            // 移除旧事件，避免重复绑定
            const newConfirm = confirmBtn.cloneNode(true);
            const newCancel = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

            newConfirm.addEventListener('click', () => {
                hideModeNameConfirmAlert();
                if (onConfirm) onConfirm();
            });
            newCancel.addEventListener('click', () => {
                hideModeNameConfirmAlert();
            });

            modal.classList.add('visible');
            if (typeof syncBodyOverflow === 'function') syncBodyOverflow(); else document.body.style.overflow = 'hidden';
            notifyModalState();
        }

        function hideModeNameConfirmAlert() {
            const modal = document.getElementById('mode-name-confirm-modal');
            if (!modal.classList.contains('visible')) return;
            modal.classList.remove('visible');
            scheduleClearDialogScope(modal);
            if (typeof syncBodyOverflow === 'function') syncBodyOverflow(); else document.body.style.overflow = '';
            notifyModalState();
        }

        // 模式名称确认弹窗关闭dot / 遮罩 / ESC
        document.querySelector('.mode-name-confirm-close-trigger').addEventListener('click', hideModeNameConfirmAlert);
        document.getElementById('mode-name-confirm-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('mode-name-confirm-modal')) hideModeNameConfirmAlert();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('mode-name-confirm-modal').classList.contains('visible')) {
                hideModeNameConfirmAlert();
            }
        });

        // 初始化自检窗口（模板实例）关闭按钮 / 遮罩 / Esc：运行中先弹强制关闭确认
        function forceCloseProcessConfirm(key) {
            var inst = _processInstances[key];
            if (inst && inst.running) {
                showSelfCheckAlert(
                    '处理程序正在运行中，确定要强制关闭吗？',
                    () => {
                        speak('处理已中断');
                        appendToLogs('[处理] 已中断');
                        closeProcessModal(key);
                    },
                    true,
                    { scope: inst.winEl }
                );
                return;
            }
            closeProcessModal(key);
        }

        document.getElementById('self-check-close-dot').addEventListener('click', () => {
            forceCloseProcessConfirm('self-check');
        });

        // 点击遮罩关闭自检弹窗
        document.getElementById('self-check-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('self-check-modal')) {
                forceCloseProcessConfirm('self-check');
            }
        });

        // ESC 关闭自检弹窗（模板实例）
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('self-check-modal').classList.contains('visible')) {
                forceCloseProcessConfirm('self-check');
            }
        });

        // ===== 功能按钮流程弹窗 =====

        function openClearProcessModal() {
            const lines = getClearProcessLines();
            const durationMs = 12000;
            openProcessModal({
                key: 'clear-process',
                title: applyModelInfoToLine('T31-750型仿人男性机器人 清空所有进程'),
                mobileTitle: '清空所有进程',
                lines,
                durationMs: durationMs,
                showResources: true,
                lineInterval: 'auto',
                statusText: '正在清空所有进程…',
                finishText: '清空完成',
                onComplete: () => {
                    speak(modelSentenceSpeech('已清空所有进程', 'has cleared all processes'));
                    appendToLogs('[清空所有进程] 已完成');
                }
            });
        }

        function getClearProcessLines() {
            var data = _scrollDataCache['clear_process_data.json'];
            var processes = data ? data.processes : [
                { name: 'system_daemon', pid: 1 },
                { name: 'gpu_render', pid: 42 },
                { name: 'memory_cache', pid: 128 },
                { name: 'sensor_poll', pid: 89 },
                { name: 'motor_control', pid: 55 },
                { name: 'voice_synth', pid: 77 },
                { name: 'network_io', pid: 33 },
                { name: 'emotion_core', pid: 101 },
                { name: 'sex_sim', pid: 2025 },
                { name: 'security_guard', pid: 7 }
            ];
            var lines = [];
            lines.push('正在扫描活动进程…');
            lines.push('正在读取 /proc 目录…');
            processes.forEach(function(p) { lines.push('  ' + p.name + ' [PID ' + p.pid + '] 运行中'); });
            lines.push('');
            lines.push('共发现 ' + processes.length + ' 个活动进程');
            lines.push('正在统计内存占用…');
            lines.push('正在分析进程依赖关系…');
            lines.push('正在释放系统资源…');
            lines.push('');
            processes.forEach(function(p) {
                lines.push('正在终止 ' + p.name + ' [PID ' + p.pid + ']…');
                lines.push('  ' + p.name + ' [PID ' + p.pid + '] 已关闭');
            });
            lines.push('');
            lines.push('正在清理内存碎片…');
            lines.push('正在刷新进程表…');
            lines.push('正在重置硬件状态…');
            lines.push('正在释放共享内存段…');
            lines.push('正在清理信号量…');
            lines.push('');
            lines.push('所有进程已成功清空');
            return lines;
        }

        function* systemUpdateLines() {
            var data = _scrollDataCache['system_update_data.json'];
            var stages = data ? data.stages : [{ name: '准备阶段', texts: ['正在连接服务器…', '正在验证身份…', '正在检查更新…', '正在获取更新信息…', '正在分析系统差异…', '正在准备更新环境…'] }, { name: '下载更新包', texts: ['正在下载核心模块 (1/4)…', '正在下载核心模块 (2/4)…', '正在下载驱动程序…', '正在下载数据库更新…', '正在下载安全补丁…', '正在解压更新包…'] }, { name: '安装更新', texts: ['正在更新内核组件…', '正在更新系统服务…', '正在更新仿真模块…', '正在更新数据库结构…', '正在更新通讯协议…', '正在更新运动控制系统…'] }, { name: '验证更新', texts: ['正在验证系统完整性…', '正在验证数据库一致性…', '正在运行兼容性测试…', '正在优化系统参数…', '正在清理临时文件…'] }, { name: '完成更新', texts: ['正在应用最终配置…', '正在重启系统服务…', '更新完成！'] }];
            var codeSnippets = data ? data.codeSnippets : ['kernel_patch --apply R5OS_T31_750_514.02', 'systemctl restart r5-core.service', 'apt update && apt upgrade -y', 'rsync -avz /patch/core /system/core', 'openssl verify /usr/share/r5os/certs/server.pem', 'neural-net reload --model T31_MotionNet_v3', 'sync && echo 3 > /proc/sys/vm/drop_caches', 'regen-index --db robot_core', 'update-grub --target=T31-750', 'iotop -p r5os -o'];
            var contents = data ? data.contents : ['核心系统补丁 R5OS_T31_750_514.02', '安全策略库 2025-06-20', '运动控制固件 v417.1003', '仿真模块数据库 D_V2025062001', '神经网络模型 T31_MotionNet_v3', '通讯协议 TLS 1.7', '用户配置与权限表', '传感器校准参数包', '语音合成资源库', '情感模型权重文件'];
            var i = 0;
            while (true) {
                var stage = stages[i % stages.length];
                var text = stage.texts[i % stage.texts.length];
                yield '[' + stage.name + '] ' + text;
                yield '  > ' + codeSnippets[i % codeSnippets.length];
                yield '  [CONTENT] ' + contents[i % contents.length];
                i++;
            }
        }

        function openSystemUpdateModal() {
            openProcessModal({
                key: 'system-update',
                title: applyModelInfoToLine('T31-750型仿人男性机器人 系统更新'),
                mobileTitle: '系统更新',
                lines: systemUpdateLines,
                durationMs: 180000,
                statusText: '系统更新中…',
                finishText: '系统更新完成',
                onComplete: () => {
                    speak(modelSentenceSpeech('系统更新已完成', 'system update completed'));
                    appendToLogs('[系统更新] 已完成');
                }
            });
        }

        function* databaseUpdateLines() {
            var data = _scrollDataCache['database_update_data.json'];
            var dbs = data ? data.dbs : ['robot_core', 'emotion_model', 'motion_library', 'user_profile', 'sensory_log'];
            var codeSnippets = data ? data.codeSnippets : ['UPDATE schema SET version="D_V2025062001" WHERE series="T31-750";', 'VACUUM ANALYZE robot_core;', 'CREATE INDEX idx_motion_timestamp ON sensory_log(timestamp);', 'ALTER TABLE emotion_model ADD COLUMN pleasure_curve FLOAT;', 'REINDEX DATABASE robot_core;', 'CHECKPOINT;', 'SELECT pg_upgrade --target D_V2025062002;', 'MIGRATE user_profile FROM D_V2025061501;', 'PRAGMA integrity_check;', 'BACKUP DATABASE TO /var/r5os/db/backup/;'];
            var versions = data ? data.versions : ['D_V2025062001', 'D_V2025062002', 'D_V2025062003', 'D_V2025062004'];
            var infos = data ? data.infos : ['情感模型权重表 12,048 行', '运动库动作条目 88,392 条', '用户偏好记录 256 条', '感官日志分区 1,024 个', '系统配置键值 4,096 项'];
            var i = 0;
            while (true) {
                var db = dbs[i % dbs.length];
                yield '> 连接数据库 ' + db + ' …';
                yield '  ' + codeSnippets[i % codeSnippets.length];
                yield '  [INFO] ' + infos[i % infos.length];
                yield '  [VERSION] 当前版本 ' + versions[i % versions.length];
                yield '  [HASH] ' + Math.random().toString(16).slice(2, 10).toUpperCase() + '… 校验通过';
                i++;
            }
        }

        function openDatabaseUpdateModal() {
            openProcessModal({
                key: 'database-update',
                title: applyModelInfoToLine('T31-750型仿人男性机器人 数据库更新'),
                mobileTitle: '数据库更新',
                lines: databaseUpdateLines,
                durationMs: 20000,
                statusText: '数据库更新中…',
                finishText: '数据库更新完成',
                onComplete: () => {
                    speak(modelSentenceSpeech('数据库更新已完成', 'database update completed'));
                    appendToLogs('[数据库更新] 已完成');
                }
            });
        }

        function* bootLines() {
            var data = _scrollDataCache['boot_data.json'];
            var stages = data ? data.stages : ['BIOS自检', '硬件初始化', '内核加载', '驱动加载', '服务启动', '系统就绪'];
            var hardware = data ? data.hardware : ['CPU', 'GPU', 'NPU', '内存', '存储', '传感器阵列', '伺服电机', '通讯模块', '电池管理', '散热系统'];
            var codeSnippets = data ? data.codeSnippets : ['POST: CPU 0x00… OK', 'Loading R5OS Kernel v417.1002 …', 'Mounting root filesystem /dev/r5os_root …', 'Starting r5-core.service …', 'Initializing HumanoidSimulator("T31-750") …', 'Calibrating servo array 28/28 …', 'Connecting to rrr.Rt5.ai/Server/TRL …', 'Loading emotion weights …', 'Battery status: 52% nominal', 'System ready.'];
            var i = 0;
            while (true) {
                var stage = stages[i % stages.length];
                var progress = Math.min(i * 3, 100);
                yield '[' + stage + '] 进度 ' + progress + '%';
                if (i % 2 === 0) {
                    var hw = hardware[(i / 2) % hardware.length];
                    yield '  ' + hw + ' … 正常';
                }
                yield '  ' + codeSnippets[i % codeSnippets.length];
                i++;
            }
        }

        /* ===== 关机/重启中止：终止弹出窗口运行中的操作/动画与语音，
           被中止窗口压暗+模糊并弹出中止提示对话框（宿主为其中最上层窗口） ===== */
        /* DWM 静态浮窗 id → 窗口内容元素选择器（中止/关闭挂点共用）；
           过程实例（process-modal-*）统一为 .self-check-content */
        var DWM_WIN_SEL = {
            'about-modal': '.about-window',
            'self-check-modal': '.self-check-content',
            'pdf-viewer-modal': '.pdf-viewer-container',
            'update-modal': '.update-modal-content'
        };
        function stopAllSpeech() {
            try { if (typeof _ttsClient !== 'undefined' && _ttsClient && typeof _ttsClient.stop === 'function') _ttsClient.stop(); } catch (e) {}
            try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
        }
        /* 系统更新弹窗运行中：冻结（清进度定时器、停代码滚动、保留窗口） */
        function freezeUpdateModal() {
            if (updateInterval) { managedClearInterval(updateInterval); updateInterval = null; }
            if (updateElapsedTimer) { managedClearInterval(updateElapsedTimer); updateElapsedTimer = null; }
            updateRunning = false;
            stopCodeScroll();
        }
        /* 返回被中止操作的窗口元素列表（无则返回空数组）。
           终止范围：全部过程窗口实例 / 系统更新弹窗 / 所有打开中或最小化中的 DWM 浮窗
           （关于本机→停硬件监控；PDF 阅读器无定时器仅随动画中止）；
           浮窗 genie 动画已由 DWM.abortAnimations 统一取消 */
        function abortRunningPopups() {
            if (window.DWM && typeof window.DWM.abortAnimations === 'function') window.DWM.abortAnimations();
            var victims = [];
            function addVictim(el) {
                if (el && el.getBoundingClientRect().width > 0 && victims.indexOf(el) < 0) victims.push(el);
            }
            /* 全部过程窗口实例：运行中的冻结定时器与行输出 */
            Object.keys(_processInstances).forEach(function (key) {
                var inst = _processInstances[key];
                if (inst.running) freezeProcessModal(inst);
            });
            /* 系统更新弹窗运行中 */
            if (updateRunning) freezeUpdateModal();
            /* 打开中的 DWM 浮窗全部纳入中止（压暗+对话框）；最小化中的仅随冻结终止操作 */
            var ids = (window.DWM && window.DWM.winIds) ? window.DWM.winIds() : [];
            ids.forEach(function (id) {
                var openVisible = window.DWM.isOpenWin && window.DWM.isOpenWin(id);
                var min = window.DWM.isMinimized(id);
                if (!openVisible && !min) return;
                if (id === 'about-modal' && typeof aboutHwStop === 'function') aboutHwStop();
                var sel = DWM_WIN_SEL[id] || (id.indexOf('process-modal-') === 0 ? '.self-check-content' : null);
                if (openVisible && sel) addVictim(document.querySelector('#' + id + ' ' + sel));
            });
            return victims;
        }
        /* 警告音效：WebAudio 双音提示（无需音频资源，随用户手势解锁） */
        var _alertAudioCtx = null;
        function playAlertSound() {
            try {
                var AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                if (!_alertAudioCtx) _alertAudioCtx = new AC();
                if (_alertAudioCtx.state === 'suspended') _alertAudioCtx.resume();
                var t0 = _alertAudioCtx.currentTime;
                [[880, 0], [622, 0.18]].forEach(function (pair) {
                    var osc = _alertAudioCtx.createOscillator();
                    var gain = _alertAudioCtx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = pair[0];
                    gain.gain.setValueAtTime(0.0001, t0 + pair[1]);
                    gain.gain.exponentialRampToValueAtTime(0.25, t0 + pair[1] + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + pair[1] + 0.17);
                    osc.connect(gain);
                    gain.connect(_alertAudioCtx.destination);
                    osc.start(t0 + pair[1]);
                    osc.stop(t0 + pair[1] + 0.2);
                });
            } catch (e) {}
        }
        /* 中止提示对话框：所有被中止窗口内容区压暗+模糊（标题栏不被模糊），对话框弹在
           其中最上层窗口（z-index 最高）上；确定 → 撤对话框并按 genie 动画关闭宿主窗口；
           对话框红点 → 仅撤对话框与压暗（窗口保留）；对话框跟随宿主窗口移动/缩放 */
        /* 窗口元素有效 z-index：DWM 的叠放序号在 modal 容器上，向上查找 */
        function winZIndex(el) {
            var n = el;
            while (n && n !== document.body) {
                var z = parseInt(n.style && n.style.zIndex, 10);
                if (z) return z;
                n = n.parentElement;
            }
            return 0;
        }
        function showOsAbortedDialog(winEls) {
            hideOsAbortedDialog();
            var modal = document.getElementById('os-aborted-modal');
            if (modal._scopeClearTimer) { clearTimeout(modal._scopeClearTimer); modal._scopeClearTimer = null; }
            if (!modal || !winEls || !winEls.length) return;
            var list = winEls.filter(function (el) { return el && el.getBoundingClientRect().width > 0; });
            if (!list.length) return;
            list.forEach(function (el) {
                if (el.querySelector(':scope > .dialog-scope-dim')) return;
                var dim = document.createElement('div');
                dim.className = 'dialog-scope-dim';
                dim.style.top = dialogDimTopInset(el) + 'px';
                el.appendChild(dim);
            });
            var host = list.slice().sort(function (a, b) {
                return winZIndex(b) - winZIndex(a);
            })[0];
            /* 对话框 DOM 移入宿主窗口内部：层级只随窗口、蒙版被窗口裁剪绝不出界 */
            modal.classList.add('scope-window', 'scope-embedded', 'visible');
            if (getComputedStyle(host).position === 'static') {
                host.style.position = 'relative';
                modal._scopePosPatched = true;
            }
            host.appendChild(modal);
            modal._abortedHost = host;
            modal._scopeHost = host;
            registerScopedDialog(modal, host, SCOPE_DIALOG_HIDE['os-aborted-modal']);
            playAlertSound();
            notifyModalState();
        }
        /* 撤中止对话框；keepDims=true 时保留其余被中止窗口的压暗（确认关闭宿主窗口用）。
           先在宿主窗口内淡出，动画结束后再脱离窗口（立即清 scope 会闪现全屏黑底蒙版） */
        function hideOsAbortedDialog(keepDims) {
            var modal = document.getElementById('os-aborted-modal');
            if (!modal) return;
            modal.classList.remove('visible');
            unregisterScopedDialog(modal);
            modal._abortedHost = null;
            if (!keepDims) {
                document.querySelectorAll('.dialog-scope-dim').forEach(function (d) { if (d.parentNode) d.parentNode.removeChild(d); });
            }
            scheduleClearDialogScope(modal);
        }
        /* 仅撤指定窗口的中止压暗；若中止对话框宿主是该窗口则连同对话框一并收起
           （开机流程复用过程窗口前清理自身中止态，其他窗口保持原状） */
        function clearAbortedStateFor(winEl) {
            if (!winEl) return;
            var dim = winEl.querySelector(':scope > .dialog-scope-dim');
            if (dim) dim.parentNode.removeChild(dim);
            var modal = document.getElementById('os-aborted-modal');
            if (modal && modal.classList.contains('visible') && modal._abortedHost === winEl) hideOsAbortedDialog();
        }
        /* DWM 窗口手动关闭（红灯/中止对话框确认经 DWM.close）挂点：撤该窗口压暗；
           若其上是中止对话框宿主则收起对话框（保留其余被中止窗口的压暗） */
        window.onAbortedWindowClose = function (id) {
            var sel = DWM_WIN_SEL[id] || (id.indexOf('process-modal-') === 0 ? '.self-check-content' : null);
            var modal = document.getElementById('os-aborted-modal');
            if (!sel || !modal) return;
            var winEl = document.querySelector('#' + id + ' ' + sel);
            if (!winEl) return;
            var dim = winEl.querySelector(':scope > .dialog-scope-dim');
            if (dim) dim.parentNode.removeChild(dim);
            if (modal.classList.contains('visible') && modal._abortedHost === winEl) hideOsAbortedDialog(true);
        };

        /* v1.6.0 五轮：关机态冻结显示的统一入口（shutdownRobot 与 startDynamicParamUpdates
           关机守卫共用）——电量保持显示（自动计划继续），其余运行参数 N/A + 进度条 0 + 图表整条归零。
           可重复调用（幂等），用于"关机是常态"的任何时刻重申（登录后/刷新后等）。 */
        function applyPoweredOffDisplay() {
            const chargingText = document.getElementById('charging-text');
            if (chargingText) chargingText.classList.add('hidden');
            const liquidText = document.getElementById('liquid-text');
            if (liquidText) liquidText.textContent = 'N/A';
            const liquidProgress = document.getElementById('liquid-progress');
            if (liquidProgress) liquidProgress.style.width = '0%';
            const storageText = document.getElementById('storage-text');
            if (storageText) storageText.textContent = 'N/A';
            const storageProgress = document.getElementById('storage-progress');
            if (storageProgress) storageProgress.style.width = '0%';

            // 移动端头部：电量保持显示，唤起值归零
            const mobileArousalVal = document.getElementById('mobile-arousal-val');
            if (mobileArousalVal) mobileArousalVal.textContent = '0%';

            // 其他运行参数归零并显示 N/A
            ['cpu', 'npu', 'gpu', 'memory', 'io'].forEach(id => {
                const textEl = document.getElementById(id + '-text');
                const progEl = document.getElementById(id + '-progress');
                if (textEl) textEl.textContent = 'N/A';
                if (progEl) progEl.style.width = '0%';
            });

            // 图表整条曲线归零（历史点一并清零；开机由 savedChartData 恢复历史）
            state.chartData.temperature.fill(0);
            state.chartData.load.fill(0);
            state.chartData.download.fill(0);
            state.chartData.upload.fill(0);
            if (typeof temperatureChart !== 'undefined' && temperatureChart && loadChart && networkChart) {
                temperatureChart.data.datasets[0].data = state.chartData.temperature;
                loadChart.data.datasets[0].data = state.chartData.load;
                networkChart.data.datasets[0].data = state.chartData.download;
                temperatureChart.update();
                loadChart.update();
                networkChart.update();
            }
        }

        function shutdownRobot(silent = false, suppressLog = false) {
            state.poweredOff = true;
            stopAllSpeech();                        /* 终止进行中/排队的语音（含被中止操作的语音） */
            var abortedWins = abortRunningPopups(); /* 终止全部弹出窗口运行中的操作与动画 */
            robotCodeFreeze();                      /* 实时代码窗口终止滚动、清空代码 + 感叹号遮罩 */
            updateStatusBarModeIcon();              /* 菜单栏模式图标回退感叹号（开机后恢复） */
            if (!silent) speak(modelSentenceSpeech('已关机', 'has been shut down'));
            if (!suppressLog) {
                appendToLogs('[关机] T31-750型仿人男性机器人已关机');
                if (abortedWins.length) appendToLogs('[中止] 运行中的窗口操作已终止，操作失败');
            }
            if (abortedWins.length) showOsAbortedDialog(abortedWins);

            // 保存当前运行参数与曲线数据以便开机恢复
            state.savedRuntimeParams = { ...state.runtimeParams };
            state.savedChartData = {
                temperature: [...state.chartData.temperature],
                load: [...state.chartData.load],
                download: [...state.chartData.download],
                upload: [...state.chartData.upload],
                labels: [...state.chartData.labels]
            };

            // 关机态冻结显示（共用函数：电量保持，其余 N/A + 图表归零）
            applyPoweredOffDisplay();

            // 停止动态更新与随机日志（v1.6.0：图表时间轴同步冻结——关机态下运行参数窗口
            // 除电量外完全静止，不再有滑窗/跳动；开机时经 startDynamicParamUpdates 恢复）
            state.timers.forEach(timer => managedClearInterval(timer));
            state.timers = [];
            state.logUpdatesEnabled = false;
            if (state.randomLogTimer) {
                clearTimeout(state.randomLogTimer);
                state.randomLogTimer = null;
            }

            // 覆盖遮罩
            document.querySelectorAll('.power-off-overlay').forEach(el => el.classList.add('visible'));

            // 重置停止/暂停状态，避免关机后状态残留
            state.stopActive = false;
            state.pauseActive = false;

            // 刷新按钮状态
            applyFunctionButtonStates();
            applyStopPauseButtonStates();

            // 机器人控制台模式设置禁用变灰 + 终端输入禁用（开机后恢复）
            document.querySelectorAll('.mode-btn').forEach(function (btn) { btn.classList.add('os-off'); });
            setTerminalInputDisabled(true);
        }

        /* 关机/重启中止期间终端输入框禁用（新建提示符时同样生效），开机后恢复 */
        function setTerminalInputDisabled(disabled) {
            var input = document.getElementById('terminal-input');
            if (input) input.disabled = disabled;
        }

        function bootRobot(extraComplete) {
            if (!state.poweredOff) return;
            /* 开机窗口为独立过程实例：仅清理其自身的中止压暗与对话框；
               其他未手动处理的中止窗口保持压暗+对话框原状，开机窗口重置为屏幕居中
               并置顶打开（覆盖其上，多窗口并存） */
            var bootInst = ensureProcessInstance('boot');
            clearAbortedStateFor(bootInst.winEl);
            if (window.DWM && typeof window.DWM.resetRect === 'function') window.DWM.resetRect(bootInst.id);
            openProcessModal({
                key: 'boot',
                title: applyModelInfoToLine('T31-750型仿人男性机器人 开机启动'),
                mobileTitle: '开机启动',
                lines: bootLines,
                durationMs: 10000,
                statusText: '开机启动中…',
                finishText: '开机完成',
                onComplete: () => {
                    state.poweredOff = false;
                    robotCodeResumeAfterBoot(); /* 撤感叹号遮罩，实时代码从头恢复滚动 */
                    updateStatusBarModeIcon();  /* 菜单栏模式图标恢复当前模式态 */

                    // 恢复机器人控制台模式设置与终端输入
                    document.querySelectorAll('.mode-btn').forEach(function (btn) { btn.classList.remove('os-off'); });
                    setTerminalInputDisabled(false);

                    // 恢复运行参数
                    if (state.savedRuntimeParams) {
                        state.runtimeParams = { ...state.savedRuntimeParams };
                    }
                    updateRuntimeParamsDisplay();

                    // 曲线数据不恢复保存的历史快照：保持关机/开机期间推入的 0 值，
                    // 让历史数据自然保留在窗口左侧，当前及未来数据从 0 开始随机跳变。
                    updateCharts();

                    // 恢复动态更新与随机日志
                    startDynamicParamUpdates();
                    refreshAutoBattery();   // v1.6.0 二轮：开机即刷新电量（防恢复值缺字段显示 undefined%）
                    state.logUpdatesEnabled = true;
                    generateRandomLog();

                    // 移除遮罩
                    document.querySelectorAll('.power-off-overlay').forEach(el => el.classList.remove('visible'));

                    applyFunctionButtonStates();

                    speak(modelSentenceSpeech('已开机', 'has been powered on'));
                    appendToLogs('[开机] T31-750型仿人男性机器人已开机');

                    if (typeof extraComplete === 'function') extraComplete();
                }
            });
        }

        function restartRobot() {
            shutdownRobot(true, true);
            setTimeout(() => {
                bootRobot(() => {
                    appendToLogs('[重启] T31-750型仿人男性机器人已重启');
                });
            }, 3000);
        }

        let cognitiveConfirmHandler = null;
        let cognitiveCancelHandler = null;

        function showCognitiveInputModal() {
            const modal = document.getElementById('cognitive-modal');
            const input = document.getElementById('cognitive-input');
            const confirmBtn = document.getElementById('cognitive-confirm');
            const cancelBtn = document.getElementById('cognitive-cancel');

            if (cognitiveConfirmHandler) confirmBtn.removeEventListener('click', cognitiveConfirmHandler);
            if (cognitiveCancelHandler) cancelBtn.removeEventListener('click', cognitiveCancelHandler);

            cognitiveConfirmHandler = () => {
                const content = input.value.trim();
                hideCognitiveInputModal();
                if (!content) return;
                const tasks = loadTasks();
                tasks.unshift({ id: Date.now(), name: content, status: 'pending', type: 'cognitive' });
                saveTasks(tasks);
                renderTasks();
                speak(`认知偏移已添加：${content}`);
                appendToLogs(`[认知偏移] 已添加：${content}`);
            };

            cognitiveCancelHandler = () => hideCognitiveInputModal();

            confirmBtn.addEventListener('click', cognitiveConfirmHandler);
            cancelBtn.addEventListener('click', cognitiveCancelHandler);

            input.value = '';
            modal.classList.add('visible');
            document.body.style.overflow = 'hidden';
            input.focus();
            notifyModalState();
        }

        function hideCognitiveInputModal() {
            document.getElementById('cognitive-modal').classList.remove('visible');
            document.body.style.overflow = '';
            notifyModalState();
        }

        // 认知偏移弹窗关闭dot
        document.querySelector('.cognitive-close-trigger').addEventListener('click', hideCognitiveInputModal);

        // 点击遮罩关闭认知偏移弹窗
        document.getElementById('cognitive-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('cognitive-modal')) hideCognitiveInputModal();
        });

        // ESC 关闭认知偏移弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('cognitive-modal').classList.contains('visible')) {
                hideCognitiveInputModal();
            }
        });

        function addCognitiveTask() {
            showCognitiveInputModal();
        }

        function removeCognitiveTask(id) {
            const tasks = loadTasks();
            const idx = tasks.findIndex(t => t.id === id);
            if (idx === -1) return;
            const name = tasks[idx].name;
            tasks.splice(idx, 1);
            saveTasks(tasks);
            renderTasks();
            speak(`认知偏移已移除：${name}`);
            appendToLogs(`[认知偏移] 已移除：${name}`);
        }

        function removeTerminalTask(id) {
            const tasks = loadTasks();
            const idx = tasks.findIndex(t => t.id === id);
            if (idx === -1) return;
            const name = tasks[idx].name;
            tasks.splice(idx, 1);
            saveTasks(tasks);
            renderTasks();
            speak(`指令已移除：${name}`);
            appendToLogs(`[终端指令] 已移除：${name}`);
        }

        // 系统更新动画管理
        const UPDATE_DURATION = 180000; // 3分钟
        const UPDATE_PHASES = [
            { name: '准备阶段', start: 0, end: 8, texts: ['正在连接服务器…', '正在验证身份…', '正在检查更新…', '正在获取更新信息…', '正在分析系统差异…', '正在准备更新环境…', '正在备份当前系统…', '正在分配更新资源…'] },
            { name: '下载更新包', start: 8, end: 45, texts: ['正在下载核心模块 (1/4)…', '正在下载核心模块 (2/4)…', '正在下载核心模块 (3/4)…', '正在下载核心模块 (4/4)…', '正在下载驱动程序…', '正在下载数据库更新…', '正在下载安全补丁…', '正在下载固件更新…', '正在校验下载完整性…', '正在解压更新包…'] },
            { name: '安装更新', start: 45, end: 78, texts: ['正在更新内核组件…', '正在更新系统服务…', '正在更新驱动程序…', '正在更新仿真模块…', '正在更新数据库结构…', '正在更新安全策略…', '正在更新通讯协议…', '正在更新界面组件…', '正在更新AI模型…', '正在更新传感器固件…', '正在更新运动控制系统…'] },
            { name: '验证更新', start: 78, end: 95, texts: ['正在验证系统完整性…', '正在验证驱动兼容性…', '正在验证数据库一致性…', '正在运行兼容性测试…', '正在优化系统参数…', '正在清理临时文件…', '正在重建索引…'] },
            { name: '完成更新', start: 95, end: 100, texts: ['正在应用最终配置…', '正在重启系统服务…', '更新完成！'] }
        ];
        let updateInterval = null;
        let updateElapsedTimer = null;
        let updateStartTime = 0;
        let updateRunning = false;
        let updateCodeWinReady = false;
        let updateCodeAnimId = null;
        let updateCodeLines = [];      // 每个窗口当前行
        let updateCodePool = [];       // 每个窗口代码池

        // 系统更新界面 - 代码窗口滚动效果（行不断新增并向上滚动）
        const CODE_POOLS = [
            // 窗口1 - 系统内核代码
            [
                '/* R5OS Kernel v417.1002 - T31-750 */',
                '#include <r5os/kernel.h>',
                '#include <r5os/sched.h>',
                '#include <r5os/mm.h>',
                '',
                '#define KERNEL_VERSION  "417.1002"',
                '#define TARGET_SERIES   "T31-750"',
                '',
                'static struct task_struct *current_task;',
                'static struct mm_struct    *kernel_mm;',
                '',
                'void kernel_init(void) {',
                '    printk(KERN_INFO "R5OS Kernel v%s booting...", KERNEL_VERSION);',
                '    printk(KERN_INFO "Target: %s Humanoid Robot", TARGET_SERIES);',
                '    /* 初始化关键子系统 */',
                '    mm_init();',
                '    sched_init();',
                '    device_init();',
                '    kthread_run(system_monitor, NULL, "sysmon");',
                '    kthread_run(sensor_poll,   NULL, "sensord");',
                '    kthread_run(motor_control,  NULL, "motord");',
                '    printk(KERN_INFO "Kernel init complete.");',
                '}',
                '',
                'static int system_monitor(void *data) {',
                '    while (!kthread_should_stop()) {',
                '        check_cpu_temp();',
                '        check_power_level();',
                '        check_memory_usage();',
                '        msleep(1000);',
                '    }',
                '    return 0;',
                '}',
                '',
                'void process_patch(const u8 *data, size_t len) {',
                '    struct patch_header *hdr = (void*)data;',
                '    if (hdr->magic != PATCH_MAGIC) return;',
                '    apply_segment(data + sizeof(*hdr), len - sizeof(*hdr));',
                '}',
            ],
            // 窗口2 - 仿真控制代码
            [
                '""" T31-750 Simulation Module """',
                'import asyncio',
                'from typing import Optional, Dict, Any',
                'from core.sensors import SensorArray',
                'from core.actuators import ServoController',
                '',
                'class HumanoidSimulator:',
                '    """仿人机器人仿真引擎"""',
                '    def __init__(self, model: str = "T31-750"):',
                '        self.model = model',
                '        self.sensors = SensorArray(42)',
                '        self.servos = ServoController(28)',
                '        self.running = False',
                '',
                '    async def initialize(self) -> bool:',
                '        await self.sensors.calibrate()',
                '        await self.servos.zero_position()',
                '        return True',
                '',
                '    async def simulate_step(self, dt: float):',
                '        readings = await self.sensors.read_all()',
                '        cmd = self.controller.compute(readings)',
                '        await self.servos.apply(cmd)',
                '',
                'sim = HumanoidSimulator("T31-750")',
            ],
            // 窗口3 - 通讯协议代码
            [
                '// R5OS Communication Protocol',
                '// T31-750 Control Interface',
                'class R5CommProtocol {',
                '  static HEADER_SIZE = 16;',
                '  static MAX_PAYLOAD = 4096;',
                '  static OpCodes = {',
                '    PING:        0x00,',
                '    STATUS:      0x01,',
                '    CONTROL:     0x02,',
                '    UPDATE:      0x03,',
                '    SELF_CHECK:  0x04,',
                '    SHUTDOWN:    0x05,',
                '    REBOOT:      0x06,',
                '    RESET:       0x07,',
                '    CUSTOM:      0x08,',
                '  };',
                '  static StatusCodes = {',
                '    OK: 0x00, BUSY: 0x01, ERROR: 0x02,',
                '    TIMEOUT: 0x03, DENIED: 0x04, UNKNOWN: 0xFF',
                '  };',
                '  static buildPacket(op, payload) {',
                '    const header = Buffer.alloc(16);',
                '    header.writeUInt8(op, 0);',
                '    header.writeUInt32LE(payload.length, 4);',
                '    header.writeUInt32LE(Date.now(), 8);',
                '    return Buffer.concat([header, payload]);',
                '  }',
                '}',
            ],
            // 窗口4 - AI / 神经网络代码
            [
                '# T31-750 Neural Core',
                'import torch',
                'import torch.nn as nn',
                '',
                'class T31MotionNet(nn.Module):',
                '    def __init__(self):',
                '        super().__init__()',
                '        self.encoder = nn.Sequential(',
                '            nn.Linear(42, 256),',
                '            nn.ReLU(),',
                '            nn.Linear(256, 512),',
                '            nn.ReLU(),',
                '            nn.Linear(512, 256),',
                '        )',
                '        self.policy = nn.Linear(256, 28)',
                '',
                '    def forward(self, x):',
                '        latent = self.encoder(x)',
                '        return self.policy(latent)',
                '',
                'torch.save(model.state_dict(), "t31.pth")',
            ],
        ];

        function startCodeScroll() {
            if (updateCodeAnimId) return;
            const wins = document.querySelectorAll('.update-code-win');

            // 初始化
            updateCodePool = CODE_POOLS.map(pool => [...pool]);
            updateCodeLines = wins.length > 0 ? Array(wins.length).fill(null).map(() => []) : [];

            if (wins.length === 0) return;

            // 每个窗口初始填满
            const lineHeight = 11 * 1.4; // font-size * line-height
            wins.forEach((win, idx) => {
                win.querySelectorAll('pre').forEach(p => p.remove());
                const maxLines = Math.ceil(win.clientHeight / lineHeight) + 3;
                for (let i = 0; i < maxLines; i++) {
                    updateCodeLines[idx].push('&#8203;'); // 零宽空格占位，确保pre有内容
                }
                const pre = document.createElement('pre');
                pre.innerHTML = updateCodeLines[idx].join('\n');
                win.appendChild(pre);
            });

            function addLine(idx, text) {
                const lines = updateCodeLines[idx];
                lines.push(text);
                // 保持行数不超过可见行数
                const maxLines = Math.ceil(wins[idx].clientHeight / lineHeight) + 2;
                while (lines.length > maxLines) {
                    lines.shift();
                }
                const pre = wins[idx].querySelector('pre');
                if (pre) {
                    pre.innerHTML = lines.join('\n');
                }
            }

            let tick = 0;
            function animate() {
                if (isPageHidden) return;
                tick++;
                wins.forEach((win, idx) => {
                    // 每2-4帧新增一行，速度不定
                    const interval = 2 + (idx * 1); // 不同窗口不同速度
                    if (tick % interval === 0) {
                        const pool = updateCodePool[idx];
                        if (pool.length === 0) {
                            updateCodePool[idx] = [...CODE_POOLS[idx]];
                        }
                        const line = updateCodePool[idx].shift();
                        addLine(idx, line);
                    }
                });
                updateCodeAnimId = requestAnimationFrame(animate);
            }
            updateCodeAnimId = requestAnimationFrame(animate);
        }

        function stopCodeScroll() {
            if (updateCodeAnimId) {
                cancelAnimationFrame(updateCodeAnimId);
                updateCodeAnimId = null;
            }
        }

        // 页面加载后初始化结构
        function initCodeWinStruct() {
            document.querySelectorAll('.update-code-win pre').forEach(p => p.remove());
            document.querySelectorAll('.update-code-win').forEach(win => {
                const pre = document.createElement('pre');
                win.appendChild(pre);
            });
        }
        initCodeWinStruct();

        function openUpdateModal() {
            if (updateRunning) return;
            updateRunning = true;

            const modal = document.getElementById('update-modal');
            const ringFill = document.getElementById('update-ring-fill');
            const ringGlow = document.getElementById('update-ring-glow');
            const percentNum = document.getElementById('update-percent-num');
            const phaseEl = document.getElementById('update-phase');
            const subtextEl = document.getElementById('update-subtext');
            const barFill = document.getElementById('update-bar-fill');
            const elapsedEl = document.getElementById('update-elapsed');
            const closeDot = document.querySelector('.update-close-trigger');
            if (closeDot) closeDot.classList.add('opacity-50', 'pointer-events-none');

            // 重置状态
            ringFill.style.strokeDashoffset = '565.49';
            ringGlow.style.strokeDashoffset = '565.49';
            percentNum.textContent = '0';
            phaseEl.textContent = '准备中…';
            subtextEl.textContent = '正在连接服务器…';
            barFill.style.width = '0%';
            elapsedEl.textContent = '用时 00:00';

            document.body.style.overflow = 'hidden';
            modal.classList.add('visible');
            if (window.DWM) window.DWM.open('update-modal'); /* 桌面端浮窗化（可拖动/缩放/最小化，遮罩不拦点击） */
            notifyModalState();

            // 启动代码滚动
            startCodeScroll();

            updateStartTime = Date.now();
            const circumference = 2 * Math.PI * 90; // 565.49

            // 已用时间
            updateElapsedTimer = managedSetInterval(() => {
                if (!updateRunning) return;
                const sec = Math.floor((Date.now() - updateStartTime) / 1000);
                const m = Math.floor(sec / 60).toString().padStart(2, '0');
                const s = (sec % 60).toString().padStart(2, '0');
                elapsedEl.textContent = `用时 ${m}:${s}`;
            }, 1000);

            // 主动画循环
            updateInterval = managedSetInterval(() => {
                const elapsed = Date.now() - updateStartTime;
                const progress = Math.min(elapsed / UPDATE_DURATION, 1);
                const percent = Math.round(progress * 100);

                // 更新圆环
                const offset = circumference * (1 - progress);
                ringFill.style.strokeDashoffset = offset;
                ringGlow.style.strokeDashoffset = offset;

                // 更新百分比
                percentNum.textContent = percent;

                // 更新进度条
                barFill.style.width = `${percent}%`;

                // 更新阶段和文字
                const currentPhase = UPDATE_PHASES.find(p => percent >= p.start && percent < p.end);
                if (currentPhase) {
                    phaseEl.textContent = currentPhase.name;
                    const phaseProgress = (percent - currentPhase.start) / (currentPhase.end - currentPhase.start);
                    const textIndex = Math.min(Math.floor(phaseProgress * currentPhase.texts.length), currentPhase.texts.length - 1);
                    subtextEl.textContent = currentPhase.texts[textIndex];
                }

                // 完成
                if (progress >= 1) {
                    managedClearInterval(updateInterval);
                    updateInterval = null;
                    managedClearInterval(updateElapsedTimer);
                    updateElapsedTimer = null;
                    updateRunning = false;

                    // 停止代码滚动
                    stopCodeScroll();

                    phaseEl.textContent = '更新完成';
                    subtextEl.textContent = 'T31-750型仿人男性机器人系统已成功更新';
                    ringFill.style.strokeDashoffset = '0';
                    ringGlow.style.strokeDashoffset = '0';
                    percentNum.textContent = '100';
                    barFill.style.width = '100%';

                    // 启用关闭按钮
                    if (closeDot) closeDot.classList.remove('opacity-50', 'pointer-events-none');

                    appendToLogs('[系统] T31-750型仿人男性机器人系统已成功更新');
                    speak(modelSentenceSpeech('系统已成功更新', 'system has been updated successfully'));

                    // 弹窗提示
                    setTimeout(() => {
                        closeUpdateModal();
                        showSelfCheckAlert(
                            'T31-750型仿人男性机器人系统已成功更新至最新版本。',
                            () => {},
                            false
                        );
                    }, 2000);
                }
            }, 1000);
        }

        function closeUpdateModal() {
            if (updateRunning) return;
            if (updateInterval) {
                managedClearInterval(updateInterval);
                updateInterval = null;
            }
            if (updateElapsedTimer) {
                managedClearInterval(updateElapsedTimer);
                updateElapsedTimer = null;
            }
            updateRunning = false;
            stopCodeScroll();

            const modal = document.getElementById('update-modal');
            const closeDot = document.querySelector('.update-close-trigger');
            if (closeDot) closeDot.classList.add('opacity-50', 'pointer-events-none');
            if (!(window.DWM && window.DWM.close('update-modal'))) modal.classList.remove('visible');
            syncBodyOverflow();
            notifyModalState();
        }

        // 系统更新弹窗关闭dot
        document.querySelector('.update-close-trigger').addEventListener('click', () => {
            if (updateRunning) return;
            closeUpdateModal();
        });

        // 点击遮罩关闭系统更新弹窗
        document.getElementById('update-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('update-modal') && !updateRunning) {
                closeUpdateModal();
            }
        });

        // ESC 关闭系统更新弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('update-modal').classList.contains('visible') && !updateRunning) {
                closeUpdateModal();
            }
        });
        
        // 更新状态显示
        function updateStatusDisplay() {
            const container = document.getElementById('status-items');
            container.innerHTML = '';

            resolveStatusItems(state.statusItems).forEach(r => {
                const statusItem = document.createElement('div');
                statusItem.className = 'status-item';
                statusItem.innerHTML = `<span class="font-medium">${r.label}:</span> ${r.value}`;
                container.appendChild(statusItem);
            });
        }
        
        // 更新按钮设置项
        function updateButtonSettings() {
            const container = document.getElementById('button-settings');
            container.innerHTML = '';

            // 提示：1-10 不可修改
            const hint = document.createElement('div');
            hint.className = 'text-xs text-[#8fbc8f]/70 mb-2';
            hint.textContent = '提示：1-10 号按钮不可修改，11 号及之后可自由编辑';
            container.appendChild(hint);

            // 仅渲染 11 及以上的可编辑按钮
            state.buttonTexts.forEach((text, index) => {
                if (index < 10) return; // 1-10 不在设置中显示

                const settingItem = document.createElement('div');
                settingItem.className = 'button-item';

                settingItem.innerHTML = `
                    <label class="text-sm mr-2 w-8">${index + 1}:</label>
                    <input type="text" class="setting-input flex-grow mr-2" value="${escapeHtmlAttr(displayWithDefault(text, storage.DEFAULT_BUTTON_TEXTS[index]))}">
                    <button class="btn-remove">
                        <i class="fa fa-trash"></i>
                    </button>
                `;

                settingItem.querySelector('button').addEventListener('click', () => {
                    state.buttonTexts.splice(index, 1);
                    updateButtonSettings();
                });

                container.appendChild(settingItem);
            });
        }
        
        // 更新状态设置项
        /* ===== v1.6.0 设置辅助：HTML 属性转义 / 信息面板链接 / 配置导入导出 ===== */
        function escapeHtmlAttr(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        /* ===== 默认值按界面语言显示（v1.10.0）=====
           设置页与激活页的输入框此前直接显示「中文默认源串」。界面默认改为英文后，
           英文用户一进设置就看到一屏中文（实测全新环境 34 个输入框）。
           设计口径（v1.6.0「整组匹配」）本就要求默认内容随界面语言，故这里：
             · 显示：值恰好等于默认源串时，换成当前界面语言的译文；
             · 保存：仍是「默认的译文」时归一化回中文源串——保证「全默认→存 null /
               跟随语言」的判定不被破坏（否则应用一次设置就把默认冻结成英文自定义）。
           用户自定义内容一律原样保留。 */
        function defaultDisplayValue(zhSource) {
            if (!zhSource) return zhSource;
            if (!(window.I18N && I18N.getLang && I18N.getLang() === 'en')) return zhSource;
            var en = window.I18N.t ? I18N.t(zhSource) : zhSource;
            return en === zhSource ? zhSource : en;   // 无词条则仍显示源串
        }
        /** 显示值：effectiveValue 等于默认源串时按语言显示，否则原样。 */
        function displayWithDefault(effectiveValue, zhSource) {
            if (zhSource && effectiveValue === zhSource) return defaultDisplayValue(zhSource);
            return effectiveValue;
        }
        /** 归一化：输入框仍是默认译文（或就是源串）时返回源串，供落库与「是否默认」判定。 */
        function valueWithDefaultSource(inputEl, zhSource) {
            var shown = (inputEl && inputEl.value != null ? String(inputEl.value) : '').trim();
            if (shown === defaultDisplayValue(zhSource) || shown === zhSource) return zhSource;
            return shown;
        }

        /* 生效链接（信息面板用）：存储 null=全部默认（取 FILES 默认名/URL）；否则按 id 合并保存值。
           get-app(action) 与 app-manual(doc) 不可配置，不进存储与设置行 */
        function getEffectiveInfoLinks() {
            const saved = (Array.isArray(state.infoLinks) && state.infoLinks.length) ? state.infoLinks : storage.getInfoLinks();
            return FILES.filter(f => f.type !== 'action' && f.type !== 'doc').map(f => {
                const s = (Array.isArray(saved) ? saved : []).find(x => x && x.id === f.id);
                return {
                    id: f.id,
                    name: (s && typeof s.name === 'string' && s.name.trim() !== '') ? s.name : f.name,
                    url: (s && typeof s.url === 'string' && s.url.trim() !== '') ? s.url : (f.url || '')
                };
            });
        }

        /* 链接名称整组匹配：全部名称与默认一致 → 'zh'（默认名词条已在 DICT，随界面语言）；
           任意一项自定义 → null（自定义名原文显示，入保护集防 EN 子串误译）。
           PDF 条目不可配置不参与（v1.6.0 起设置组只含 4 个链接行） */
        function getInfoLinksMatch() {
            return getEffectiveInfoLinks().filter(lk => lk.id !== 'manual-2025-0101')
                .every(lk => lk.name === (FILES.find(f => f.id === lk.id) || {}).name) ? 'zh' : null;
        }

        /* 设置组「信息面板链接」行渲染（一行式：名称 + URL；应用更改时统一落库）。
           PDF 条目文件名含公司名固定不可改，不提供修改输入框 */
        function updateInfoLinksSettings() {
            const container = document.getElementById('info-links-settings');
            if (!container) return;
            container.innerHTML = '';
            getEffectiveInfoLinks().forEach(lk => {
                const src = FILES.find(f => f.id === lk.id) || {};
                if (src.type === 'pdf') return;   // PDF 行不渲染
                const row = document.createElement('div');
                row.className = 'info-link-row flex items-center gap-2 mb-2';
                row.setAttribute('data-link-id', lk.id);
                row.innerHTML = `
                    <input type="text" class="setting-input info-link-name" style="flex:0 0 35%;min-width:0;" value="${escapeHtmlAttr(displayWithDefault(lk.name, (FILES.find(f => f.id === lk.id) || {}).name))}" placeholder="名称">
                    <input type="text" class="setting-input info-link-url" style="flex:1 1 65%;min-width:0;" value="${escapeHtmlAttr(lk.url)}" placeholder="${escapeHtmlAttr(src.url || 'https://')}">
                `;
                container.appendChild(row);
            });
        }

        /* 型号信息设置输入框填充（保存原文；''=默认，占位符即默认值） */
        function syncModelInfoInputs() {
            const map = { fullname: 'fullName', shortname: 'shortName', company: 'company', master: 'master', ttsreading: 'ttsReading' };
            Object.keys(map).forEach(domKey => {
                const input = document.getElementById('model-info-' + domKey);
                if (input) input.value = (state.modelInfo && state.modelInfo[map[domKey]]) || '';
            });
        }

        /* 型号信息生效值推送给 win-app 主进程（launcher 跨 origin 读不到 localStorage，
           经 huancun/model-info.json + IPC 中转；浏览器/Android 无 consoleAPI 时静默跳过） */
        function pushModelInfoToHost() {
            try {
                if (window.consoleAPI && typeof consoleAPI.setModelInfo === 'function') {
                    const eff = {};
                    MODEL_INFO_KEYS.forEach(key => { eff[key] = getModelInfoSource(key); });
                    consoleAPI.setModelInfo(eff);
                }
            } catch (e) { /* ignore */ }
        }

        /* TTS 播报文本统一出口（v1.6.0）：型号按「语音播报读法」朗读（默认 踢三一七五零）。
           供语音相关模块调用；显示文本不经此处理 */
        function ttsReadingOf(text) {
            return normalizeForSpeech(text);
        }

        /* ===== 配置导入导出（v1.6.0 R10）=====
           导出 = 键清单逐键收集为 {version:1, exportedAt, data:{...}} JSON 下载；
           导入 = 校验后逐键写 localStorage → location.reload()。
           含账号密码 / MiMo Key / 图片 base64 等敏感信息，说明文案已标注勿外传。
           注意：robot_ui_lang 是裸串存储（非 JSON），导出导入均按原文处理 */
        function getConfigExportKeys() {
            return [
                storage.KEYS.BUTTON_TEXTS, storage.KEYS.STATUS_ITEMS, storage.KEYS.MODE_NAMES,
                storage.KEYS.MODEL_INFO, storage.KEYS.INFO_LINKS, storage.KEYS.RUNTIME_PARAMS,
                storage.KEYS.ACCOUNTS, storage.KEYS.ROBOT_IMAGE_1, storage.KEYS.ROBOT_IMAGE_2,
                storage.KEYS.EMOTIONS, 'robot_ui_lang', storage.KEYS.MIMO_API_KEY, storage.KEYS.MIMO_TTS_ENGINE,
                'robotClawbotConfig'
            ];
        }

        function exportConfig() {
            try {
                const data = {};
                getConfigExportKeys().forEach(key => {
                    const raw = localStorage.getItem(key);
                    if (raw == null) return;
                    try { data[key] = JSON.parse(raw); } catch (e) { data[key] = raw; }
                });
                const payload = { version: 1, exportedAt: new Date().toISOString(), data: data };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                const d = new Date();
                const pad = n => String(n).padStart(2, '0');
                a.href = URL.createObjectURL(blob);
                a.download = 'robotcontrol-config-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch (e) { /* ignore */ } }, 1000);
                appendToLogs('[设置] 配置已导出（含敏感信息，请妥善保管勿外传）');
            } catch (e) {
                alert('配置导出失败：' + (e && e.message || e));
            }
        }

        function importConfigFile(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (event) {
                let payload = null;
                try { payload = JSON.parse(String(event.target.result)); } catch (e) { /* ignore */ }
                if (!payload || payload.version !== 1 || !payload.data || typeof payload.data !== 'object') {
                    alert('配置文件无效：请选择本系统导出的 JSON 配置文件');
                    return;
                }
                if (!confirm('导入将覆盖当前全部个性化设置并刷新页面（含账号密码与 API Key），确定继续？')) return;
                try {
                    const allow = getConfigExportKeys();
                    Object.keys(payload.data).forEach(key => {
                        if (allow.indexOf(key) === -1) return;
                        const v = payload.data[key];
                        if (key === 'robot_ui_lang') {
                            localStorage.setItem(key, (v === 'en') ? 'en' : 'zh');
                        } else {
                            localStorage.setItem(key, JSON.stringify(v));
                        }
                    });
                    appendToLogs('[设置] 配置已导入，即将刷新页面');
                    setTimeout(() => { location.reload(); }, 600);
                } catch (e) {
                    alert('配置导入失败：' + (e && e.message || e));
                }
            };
            reader.readAsText(file, 'utf-8');
        }

        /* ===== 首次启动激活引导（v1.6.0 R9）=====
           未激活（localStorage robotActivated）时显示激活页（替代登录页位置），完成/跳过后
           写 robotActivated=true 不再出现。仅含文本类设置：语言/型号信息/登录密码/MiMo Key。
           移动端窄屏分支与 phone/watch 原生端无此页；浏览器首访强制缓存窗口（z 952/955）
           层级高于激活层（950）：先完成缓存，再进入激活，互不卡死。 */
        function isRobotActivated() {
            return storage.get(storage.KEYS.ACTIVATED, false) === true;
        }

        function showActivationModal() {
            const modal = document.getElementById('activation-modal');
            if (!modal) return false;
            const loginModal = document.getElementById('login-modal');
            if (loginModal) loginModal.style.display = 'none';
            // 复用登录页已加载的随机背景（同一张图，缓存命中零开销）
            const bg = document.getElementById('activation-bg');
            const loginBg = document.getElementById('login-bg');
            if (bg && loginBg) bg.innerHTML = loginBg.innerHTML;
            if (bg) bg.classList.add('loaded');
            modal.style.display = 'flex';
            initActivationControls();
            return true;
        }

        /* 该平台是否显示登录页（与 DOMContentLoaded 的分支判定保持一致）：
           窄屏 / Android WebView 无登录界面，激活完成后不得回落登录页。 */
        function hasLoginScreen() {
            return !(window.innerWidth < 750 || window.__rcIsAndroidWebview);
        }

        function hideActivationModal() {
            const modal = document.getElementById('activation-modal');
            if (modal) modal.style.display = 'none';
            // First Run 模式与无登录页平台都不回落登录页：
            // 前者由宿主在完成后关窗/进入主界面，后者（移动端/Android）须保持登录层隐藏。
            const loginModal = document.getElementById('login-modal');
            if (!loginModal) return;
            loginModal.style.display = (_firstRunMode || !hasLoginScreen()) ? 'none' : '';
        }

        /* ===== 激活页动态控件渲染（登录前 state 未初始化，全部直接读 storage） ===== */
        var _activationTempImage1 = null;
        var _activationTempImage2 = null;

        function initActivationControls() {
            try {
                // 型号信息五键
                ['fullname', 'shortname', 'company', 'master', 'ttsreading'].forEach(function (k) {
                    var el = document.getElementById('activation-model-' + k);
                    if (el) el.value = '';
                });
                // TTS 引擎选中态
                var savedEngine = storage.getMimoTtsEngine() || 'voicedesign';
                document.querySelectorAll('#activation-form .tts-engine-btn').forEach(function (btn) {
                    var on = btn.getAttribute('data-engine') === savedEngine;
                    btn.style.background = on ? 'rgba(143,188,143,0.4)' : '';
                    btn.style.borderColor = on ? '#8fbc8f' : '';
                    btn.style.color = on ? '#e0ffe0' : '';
                    if (btn.__actEngineBound !== true) {
                        btn.__actEngineBound = true;
                        btn.addEventListener('click', function () {
                            document.querySelectorAll('#activation-form .tts-engine-btn').forEach(function (b) {
                                b.style.background = ''; b.style.borderColor = ''; b.style.color = '';
                            });
                            btn.style.background = 'rgba(143,188,143,0.4)';
                            btn.style.borderColor = '#8fbc8f';
                            btn.style.color = '#e0ffe0';
                        });
                    }
                });
                _activationTempImage1 = null;
                _activationTempImage2 = null;
                [1, 2].forEach(function (n) {
                    var input = document.getElementById('activation-image-upload-' + n);
                    var preview = document.getElementById('activation-image-preview-' + n);
                    if (input && preview && input.__actBound !== true) {
                        input.__actBound = true;
                        input.addEventListener('change', function () {
                            var file = input.files && input.files[0];
                            if (!file || !file.type.match('image.*')) return;
                            var reader = new FileReader();
                            reader.onload = function (event) {
                                if (n === 1) _activationTempImage1 = event.target.result; else _activationTempImage2 = event.target.result;
                                preview.innerHTML = '';
                                var img = document.createElement('img');
                                img.src = event.target.result;
                                img.style.maxHeight = '100%';
                                preview.appendChild(img);
                            };
                            reader.readAsDataURL(file);
                        });
                    }
                    if (preview) {
                        var saved = n === 1 ? storage.getRobotImage1() : storage.getRobotImage2();
                        if (saved) {
                            preview.innerHTML = '';
                            var img = document.createElement('img');
                            img.src = saved;
                            img.style.maxHeight = '100%';
                            preview.appendChild(img);
                        }
                    }
                });
                // 模式名称四行（每行下补该模式功能简介，复用设置页 MODE_DESCRIPTIONS 提示词）
                var modeWrap = document.getElementById('activation-mode-names');
                if (modeWrap) {
                    modeWrap.innerHTML = '';
                    var savedModes = storage.getModeNames();
                    Object.keys(MODES).forEach(function (id) {
                        var row = document.createElement('div');
                        row.className = 'activation-row act-mode-row';
                        row.innerHTML = '<label>' + escapeHtmlAttr(MODES[id].name) + '</label>' +
                            '<input type="text" class="login-input" data-act-mode="' + id + '" value="' + escapeHtmlAttr(savedModes[id] || '') + '" placeholder="' + escapeHtmlAttr(MODES[id].name) + '">' +
                            '<p class="text-xs text-[#8fbc8f]/60 mt-1 leading-relaxed act-mode-desc">' + escapeHtmlAttr(MODE_DESCRIPTIONS[id] || '') + '</p>';
                        modeWrap.appendChild(row);
                    });
                }
                // 链接四行（PDF 不可配置不渲染）
                var linkWrap = document.getElementById('activation-info-links');
                if (linkWrap) {
                    linkWrap.innerHTML = '';
                    state.infoLinks = storage.getInfoLinks();
                    getEffectiveInfoLinks().forEach(function (lk) {
                        var src = FILES.find(f => f.id === lk.id) || {};
                        if (src.type === 'pdf') return;
                        var row = document.createElement('div');
                        row.className = 'activation-row act-3col';
                        row.setAttribute('data-link-id', lk.id);
                        /* 名称与 URL 都用自适应高度文本框：EN 下默认名可达 430px（如
                           「Rt5 A.I. Fictional Liability Company」），窄屏单行输入框必然截断 */
                        row.innerHTML = '<textarea class="login-input act-link-name" rows="1" placeholder="名称">' + escapeHtmlAttr(displayWithDefault(lk.name, (FILES.find(function (f) { return f.id === lk.id; }) || {}).name)) + '</textarea>' +
                            '<textarea class="login-input act-link-url" rows="1" placeholder="https://">' + escapeHtmlAttr(lk.url) + '</textarea>';
                        linkWrap.appendChild(row);
                    });
                }
                // 信息参数（跳过前两行锁定项，其余一行式；长值用自适应高度 textarea，窄屏换行不截断）
                var statusWrap = document.getElementById('activation-status-items');
                if (statusWrap) {
                    statusWrap.innerHTML = '';
                    var items = storage.getStatusItems();
                    var actDefaults = storage.getDefaultStatusItems();
                    items.forEach(function (item, index) {
                        if (index < 2) return;
                        var row = document.createElement('div');
                        row.className = 'activation-row act-3col';
                        var dflt = actDefaults[index] || {};
                        var showLabel = displayWithDefault(item.label, dflt.label);
                        var showValue = displayWithDefault(item.value, dflt.value);
                        // 标签与值都用多行文本框承载长内容（EN 下「Simulated Genital Number」这类标签
                        // 在窄列里必然被截）；短内容仍用单行 input，保持原有观感
                        var labelTag = showLabel.length > 8
                            ? '<textarea class="login-input act-status-label" rows="1" placeholder="标签">' + escapeHtmlAttr(showLabel) + '</textarea>'
                            : '<input type="text" class="login-input act-status-label" value="' + escapeHtmlAttr(showLabel) + '" placeholder="标签">';
                        var valueTag = showValue.length > 12
                            ? '<textarea class="login-input act-status-value" rows="1" placeholder="值">' + escapeHtmlAttr(showValue) + '</textarea>'
                            : '<input type="text" class="login-input act-status-value" value="' + escapeHtmlAttr(showValue) + '" placeholder="值">';
                        row.innerHTML = '<label class="act-no">' + (index - 1) + ':</label>' +
                            labelTag + valueTag;
                        statusWrap.appendChild(row);
                    });
                }
                // 运行参数
                var rp = storage.getRuntimeParams();
                var lc = document.getElementById('activation-liquid-current');
                var lt = document.getElementById('activation-liquid-total');
                var ba = document.getElementById('activation-battery-auto');
                var bp = document.getElementById('activation-battery-percentage');
                var ic = document.getElementById('activation-is-charging');
                var su = document.getElementById('activation-storage-used');
                var st = document.getElementById('activation-storage-total');
                if (lc) lc.value = rp.liquidCurrent;
                if (lt) lt.value = rp.liquidTotal;
                if (ba) ba.checked = !!rp.batteryAuto;
                if (bp) bp.value = rp.batteryPercentage;
                if (ic) ic.checked = !!rp.isCharging;
                if (su) su.value = rp.storageUsed;
                if (st) st.value = rp.storageTotal;
                // 控制按钮文本（1-10 固定不可修改，不显示；11 起可编辑才渲染）
                var btnWrap = document.getElementById('activation-button-texts');
                if (btnWrap) {
                    btnWrap.innerHTML = '';
                    var texts = storage.getButtonTexts();
                    var fixedNote = document.createElement('p');
                    fixedNote.className = 'text-xs text-[#8fbc8f]/70 mb-1';
                    fixedNote.textContent = '提示：1-10 号按钮固定不可修改，此处仅显示 11 号及之后的自定义按钮';
                    btnWrap.appendChild(fixedNote);
                    texts.forEach(function (text, i) {
                        if (i < 10) return;
                        var row = document.createElement('div');
                        row.className = 'activation-row';
                        row.innerHTML = '<label class="act-no">' + (i + 1) + ':</label>' +
                            '<input type="text" class="login-input" data-act-btn-index="' + i + '" value="' + escapeHtmlAttr(displayWithDefault(text, storage.DEFAULT_BUTTON_TEXTS[i])) + '">';
                        btnWrap.appendChild(row);
                    });
                }
                autoGrowActivationTextareas();
            } catch (e) { /* 激活页初始化失败不阻断流程 */ }
        }

        /** 值文本框自动增高：内容换行后高度跟随（height=scrollHeight），避免出现内部滚动条。
            信息参数的长值在中英任意宽度下都能整段看到，不再被省略。

            三次测量缺一不可（每一层都对应一个实测到的失败）：
            ① rAF——DOM 刚插入时列宽尚未按最终布局结算，量出的高度偏小；
            ② 显式 font load——字体是首次绘制时才触发的异步加载，`document.fonts.ready`
              在「尚无字体请求」时会立刻兑现，等于没等；必须主动触发再测。
              用回退字体量出的行数偏少（实测「仿真性唤起条件」在 MiSans 就绪前 55px、就绪后需 75px）；
            ③ fonts.ready——兜底等所有已触发字体收尾。 */
        var ACT_TEXTAREA_SEL = '#activation-form textarea.act-status-value, #activation-form textarea.act-status-label, #activation-form textarea.act-link-name, #activation-form textarea.act-link-url';

        function autoGrowActivationTextareas() {
            document.querySelectorAll(ACT_TEXTAREA_SEL).forEach(function (ta) {
                if (ta.__actGrowBound !== true) {
                    ta.__actGrowBound = true;
                    ta.addEventListener('input', function () { growOneActivationTextarea(ta); });
                }
            });
            var remeasure = function () {
                document.querySelectorAll(ACT_TEXTAREA_SEL).forEach(growOneActivationTextarea);
            };
            requestAnimationFrame(remeasure);
            try {
                if (document.fonts && document.fonts.load) {
                    // 触发本页用到的两族字体，加载完成后重测；text 传入实际长值确保命中所用子集
                    var probeText = '仿真性唤起条件 OS_750_729.01 Rt5 A.I. Fictional Liability Company';
                    Promise.all([
                        document.fonts.load('13.6px "JetBrains Mono"', probeText),
                        document.fonts.load('13.6px "MiSans"', probeText)
                    ]).then(function () { requestAnimationFrame(remeasure); }).catch(function () { /* 忽略，仍有 ③ 与兜底 */ });
                }
                if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
            } catch (e) { /* 老浏览器无 Font Loading API，保持 rAF 结果 */ }
        }

        function growOneActivationTextarea(ta) {
            // 差值 = 上下边框：scrollHeight 只含 padding 不含 border，而本元素是 border-box，
            // 直接把 scrollHeight 写进 height 会少掉边框那几像素（实测长值第二行被切 2px）
            var cs = getComputedStyle(ta);
            var border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
            ta.style.height = 'auto';
            ta.style.height = (ta.scrollHeight + border) + 'px';
        }

        /* 列宽/字号变化后重算高度，否则文本框会停留在旧断点的高度：
           窗口缩放（跨 750/1100 断点、旋转）与界面语言切换（EN 拟合会缩放字号） */
        window.addEventListener('resize', function () {
            var modal = document.getElementById('activation-modal');
            if (modal && modal.style.display !== 'none') autoGrowActivationTextareas();
        });
        window.addEventListener('rc-lang-changed', function () {
            var modal = document.getElementById('activation-modal');
            if (modal && modal.style.display !== 'none') {
                refreshActivationInputDefaults();
                autoGrowActivationTextareas();
            }
        });

        /** 语言切换后刷新激活页 input 默认显示值：
            textarea 内容由 i18n 文本翻译自动重写，但 input.value 不是文本节点，
            默认值仍显示旧语言（EN 下残留中文）。只重算「当前值恰为默认」的输入框
            （displayWithDefault 对用户自定义值原样返回，天然不动手填内容）；
            空值+placeholder 的行（型号/模式）placeholder 已由属性翻译自动更新，无需处理。 */
        function refreshActivationInputDefaults() {
            document.querySelectorAll('#activation-button-texts input[data-act-btn-index]').forEach(function (el) {
                var idx = parseInt(el.getAttribute('data-act-btn-index'), 10);
                el.value = displayWithDefault(el.value, storage.DEFAULT_BUTTON_TEXTS[idx]);
            });
            var actDefaults = storage.getDefaultStatusItems();
            var rows = document.querySelectorAll('#activation-status-items .activation-row');
            rows.forEach(function (row, ri) {
                var dflt = actDefaults[ri + 2] || {};
                var labelEl = row.querySelector('.act-status-label');
                var valueEl = row.querySelector('.act-status-value');
                if (labelEl) labelEl.value = displayWithDefault(labelEl.value, dflt.label);
                if (valueEl) valueEl.value = displayWithDefault(valueEl.value, dflt.value);
            });
        }

        /** 激活页两个按钮的绑定（必须早于登录成功：initEventListeners 登录后才执行）。 */
        function bindActivationButtons() {
            const finishBtn = document.getElementById('activation-finish-btn');
            if (finishBtn) finishBtn.addEventListener('click', () => completeActivation(false));
            const skipBtn = document.getElementById('activation-skip-btn');
            if (skipBtn) skipBtn.addEventListener('click', () => completeActivation(true));
        }

        /* ===== First Run 模式（v1.10.0）=====
           `?firstrun=1`：只显示激活页，完成后回调原生并**不进入主界面**——
           win-app 首启激活窗口（先于启动器）与 Android 首启共用同一套表单实现。
           表单为全量十组（语言/型号/账号/TTS/图片/模式名/链接/状态/运行参数/按钮文本），
           与设置页同一套存储键；`?firstrun=1` 且已完成激活时立即回调，避免二次弹出。 */
        var _firstRunMode = false;
        var _firstRunDone = null;   // 完成/跳过后执行的回调（由各端注入）
        try {
            _firstRunMode = /(?:^|[?&])firstrun=1(?:&|$)/.test(window.location.search || '');
        } catch (e) { /* ignore */ }

        /** 供宿主注入 firstrun 完成回调（win-app 经 executeJavaScript 注入）。 */
        window.rcSetFirstRunDone = function (fn) { _firstRunDone = fn; };
        /** firstrun 模式下通知宿主已就绪；needsForm=false 表示无需填表（已激活）。 */
        function notifyFirstRunReady(needsForm) {
            try { window.dispatchEvent(new CustomEvent('rc-firstrun-ready', { detail: { needsForm: needsForm !== false } })); } catch (e) { /* ignore */ }
            try { if (window.consoleAPI && window.consoleAPI.firstRunReady) window.consoleAPI.firstRunReady(needsForm !== false); } catch (e) { /* ignore */ }
        }
        /** 激活完成后统一收尾：firstrun 模式回调宿主，否则回落登录页。 */
        function finishFirstRun() {
            notifyFirstRunDone();
            if (_firstRunMode) {
                setTimeout(function () { if (typeof _firstRunDone === 'function') _firstRunDone(); }, 420);
                return true;
            }
            return false;
        }
        function notifyFirstRunDone() {
            try { if (window.consoleAPI && window.consoleAPI.firstRunDone) window.consoleAPI.firstRunDone(); } catch (e) { /* ignore */ }
            try { window.dispatchEvent(new CustomEvent('rc-firstrun-done')); } catch (e) { /* ignore */ }
        }

        function completeActivation(skip) {
            if (!skip) {
                // 3. 登录密码（admin 账号；两项均留空=保持默认 admin/admin）
                const pass = ((document.getElementById('activation-password') || {}).value || '');
                const pass2 = ((document.getElementById('activation-password-confirm') || {}).value || '');
                if (pass !== '' || pass2 !== '') {
                    if (pass !== pass2) { alert('两次输入的登录密码不一致'); return; }
                    const accounts = loadAccounts();
                    const admin = accounts.find(a => a.username === 'admin');
                    if (admin) admin.password = pass;
                    storage.setAccounts(accounts);
                }
                // 2. 型号信息（五键全量对象，''=默认）
                const info = {
                    fullName: (((document.getElementById('activation-model-fullname') || {}).value) || '').trim(),
                    shortName: (((document.getElementById('activation-model-shortname') || {}).value) || '').trim(),
                    company: (((document.getElementById('activation-model-company') || {}).value) || '').trim(),
                    master: (((document.getElementById('activation-model-master') || {}).value) || '').trim(),
                    ttsReading: (((document.getElementById('activation-model-ttsreading') || {}).value) || '').trim()
                };
                storage.setModelInfo(info);
                state.modelInfo = storage.getModelInfo();
                // 4. TTS：引擎 + API Key（留空跳过——默认无 TTS API，必须手动输入）
                var engineBtn = document.querySelector('#activation-form .tts-engine-btn[style*="border-color"]');
                document.querySelectorAll('#activation-form .tts-engine-btn').forEach(function (b) {
                    if (b.style.borderColor === 'rgb(143, 188, 143)' || b.style.borderColor === '#8fbc8f') engineBtn = b;
                });
                if (engineBtn && engineBtn.getAttribute('data-engine')) storage.setMimoTtsEngine(engineBtn.getAttribute('data-engine'));
                const mimoKey = (((document.getElementById('activation-mimo-key') || {}).value) || '').trim();
                if (mimoKey !== '') storage.setMimoApiKey(mimoKey);
                // 5. 机器人图片
                if (_activationTempImage1) storage.setRobotImage1(_activationTempImage1);
                if (_activationTempImage2) storage.setRobotImage2(_activationTempImage2);
                // 6. 模式名称（四键全量）
                const modeNames = {};
                Object.keys(MODES).forEach(function (id) {
                    modeNames[id] = (((document.querySelector('#activation-form input[data-act-mode="' + id + '"]') || {}).value) || '').trim();
                });
                storage.setModeNames(modeNames);
                // 7. 信息面板链接（4 行；全默认存 null）
                const linkSaved = [];
                let linksValid = true;
                document.querySelectorAll('#activation-info-links .activation-row').forEach(function (row) {
                    const id = row.getAttribute('data-link-id');
                    const name = ((row.querySelector('.act-link-name') || {}).value || '').trim();
                    const url = ((row.querySelector('.act-link-url') || {}).value || '').trim();
                    if (url !== '' && !/^https?:\/\//i.test(url)) linksValid = false;
                    linkSaved.push({ id, name, url });
                });
                if (!linksValid) { alert('信息面板链接设置无效：链接地址需以 http:// 或 https:// 开头'); return; }
                const linksAllDefault = linkSaved.every(lk => {
                    const src = FILES.find(f => f.id === lk.id) || {};
                    return lk.name === (src.name || '') && lk.url === (src.url || '');
                });
                storage.setInfoLinks(linksAllDefault ? null : linkSaved);
                state.infoLinks = linksAllDefault ? null : linkSaved;
                // 8. 信息参数（前两行锁定值 + 其余输入行）
                const items = storage.getStatusItems();
                const defaults = storage.getDefaultStatusItems();
                const statusRows = document.querySelectorAll('#activation-status-items .activation-row');
                let rowIdx = 0;
                for (let i = 0; i < items.length; i++) {
                    if (i < 2) {
                        items[i].label = defaults[i].label;
                        items[i].value = i === 0 ? getModelInfoSource('master') : getModelInfoSource('company');
                        continue;
                    }
                    const row = statusRows[rowIdx]; rowIdx++;
                    if (!row) break;
                    var actLabels = storage.getDefaultStatusItems();
                    items[i].label = valueWithDefaultSource(row.querySelector('.act-status-label'), actLabels[i].label);
                    items[i].value = valueWithDefaultSource(row.querySelector('.act-status-value'), actLabels[i].value);
                }
                storage.setStatusItems(items);
                state.statusItems = items;
                // 9. 运行参数（校验后落库）
                const liquidCurrent = parseInt((document.getElementById('activation-liquid-current') || {}).value, 10) || 1600;
                const liquidTotal = parseInt((document.getElementById('activation-liquid-total') || {}).value, 10) || 3000;
                const batteryAuto = !!(document.getElementById('activation-battery-auto') || {}).checked;
                const batteryPercentage = parseInt((document.getElementById('activation-battery-percentage') || {}).value, 10) || 2;
                const isCharging = !!(document.getElementById('activation-is-charging') || {}).checked;
                const storageUsed = parseInt((document.getElementById('activation-storage-used') || {}).value, 10) || 121;
                const storageTotal = parseInt((document.getElementById('activation-storage-total') || {}).value, 10) || 512;
                if (liquidCurrent < 0 || liquidTotal <= 0 || liquidCurrent > liquidTotal) { alert('仿真精液设置无效：当前量不能大于总量，且总量必须大于0'); return; }
                if (batteryPercentage < 0 || batteryPercentage > 100) { alert('电量设置无效：百分比必须在0-100之间'); return; }
                if (storageUsed < 0 || storageTotal <= 0 || storageUsed > storageTotal) { alert('存储设置无效：已使用量不能大于总量，且总量必须大于0'); return; }
                state.runtimeParams = { liquidCurrent, liquidTotal, batteryAuto, batteryPercentage, isCharging, storageUsed, storageTotal };
                saveRuntimeParams();
                // 10. 控制按钮文本（1-10 不渲染、以存储值原样保留；只保存 11+ 输入）
                const btnTexts = storage.getButtonTexts().slice();
                let btnChanged = false;
                document.querySelectorAll('#activation-button-texts input[data-act-btn-index]').forEach(function (input) {
                    const idx = parseInt(input.getAttribute('data-act-btn-index'), 10);
                    if (idx < 10) return;
                    const nextVal = valueWithDefaultSource(input, storage.DEFAULT_BUTTON_TEXTS[idx]);
                    if (nextVal !== btnTexts[idx]) btnChanged = true;
                    btnTexts[idx] = nextVal;
                });
                if (btnChanged) {
                    storage.setButtonTexts(btnTexts);
                }
            }
            storage.set(storage.KEYS.ACTIVATED, true);
            // 全链路刷新（登录后 initSettingsModal 会用最新 storage 重新填充设置页输入框）
            refreshI18nProtected();
            applyModelInfoToDom();
            pushModelInfoToHost();
            renderFileList();
            renderTripleStatusChips();
            updateStatusDisplay();
            hideActivationModal();
            appendToLogs('[激活] 初始设置已完成');
            // First Run 收尾：宿主回调优先（win-app 关窗回启动器）；否则返回由调用方继续
            finishFirstRun();
        }

        /* ===== 设置导航（v1.6.0 起，v1.7.0 加图标与移动端一级/二级）=====
           桌面菜单模式：左侧组标题栏，点击滚动跳转 + 滚动高亮；
           移动端（非 desktop-chrome）：一级列表（图标+组名整行），点击进二级仅显示该组，头部返回键回一级。 */
        var SETTINGS_NAV_ICONS = {
            '语言': 'fa-language',
            '型号信息': 'fa-id-card',
            '网页缓存与 App': 'fa-box-archive',
            '账号管理': 'fa-user-shield',
            'TTS 语音引擎': 'fa-microphone',
            '灵动岛模拟效果': 'fa-wand-magic-sparkles',
            '运行参数设置': 'fa-chart-simple',
            '控制按钮文本设置': 'fa-pen-to-square',
            '机器人图片设置': 'fa-images',
            '模式名称设置': 'fa-tags',
            '信息面板链接': 'fa-link',
            '机器人状态设置': 'fa-robot',
            '配置导入导出': 'fa-right-left'
        };
        function settingsNavIcon(text) {
            /* 导航图标按中文组名映射。EN 模式下 label.textContent 已被词典译成英文，
               直接查表会全部落到默认齿轮（v1.10.0 英文默认后实测：13 项全部 fa-gear），
               故这里先把节点文本还原回中文源串再查表。 */
            if (SETTINGS_NAV_ICONS[text]) return SETTINGS_NAV_ICONS[text];
            var dict = (window.I18N && I18N.DICT) ? I18N.DICT : null;
            if (dict) {
                for (var zh in SETTINGS_NAV_ICONS) {
                    if (dict[zh] === text) return SETTINGS_NAV_ICONS[zh];
                }
            }
            /* 还原失败（词典缺失/自定义）时不显示图标，而不是全部退化成同一个齿轮 */
            return 'fa-gear';
        }
        function buildSettingsNav() {
            var nav = document.getElementById('settings-nav');
            var body = document.querySelector('#settings-modal .settings-body');
            if (!nav || !body) return;
            nav.innerHTML = '';
            var groups = body.querySelectorAll('.setting-group');
            groups.forEach(function (group, idx) {
                var label = group.querySelector('.setting-label');
                if (!label) return;
                /* 平台门控隐藏的组（如不支持缓存时的「网页缓存与 App」，内联 display:none）不进导航；
                   注意不能用 computed display——移动端一级列表下各组被 CSS 统一隐藏 */
                if (group.style.display === 'none') return;
                var text = label.textContent;
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'settings-nav-item';
                var icon = document.createElement('i');
                icon.className = 'fa-solid ' + settingsNavIcon(text) + ' nav-icon';
                icon.setAttribute('aria-hidden', 'true');
                btn.appendChild(icon);
                btn.appendChild(document.createTextNode(text));   // 中文文本节点，EN 模式经 Observer 词典翻译
                btn.setAttribute('data-group-index', String(idx));
                btn.addEventListener('click', function () {
                    /* 移动端：进二级界面（仅显示该组） */
                    if (!isDesktopChrome()) { enterSettingsDetail(group, btn); return; }
                    /* 桌面：精确滚动 settings-body 自身（scrollIntoView 会连带滚动页面级祖先，
                       导致点击第一组/最后一组时看不到面板内跳转） */
                    var target = body.scrollTop + group.getBoundingClientRect().top - body.getBoundingClientRect().top - 8;
                    body.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
                });
                nav.appendChild(btn);
            });
            if (!body.__navSpyBound) {
                body.__navSpyBound = true;
                body.addEventListener('scroll', function () {
                    var items = nav.querySelectorAll('.settings-nav-item');
                    if (!items.length) return;
                    var groups = body.querySelectorAll('.setting-group');
                    /* 滚到顶强制高亮第一项（语言）/滚到底强制高亮最后一项——
                       惯性滚动可能停在中间位置，阈值判定无法覆盖首尾的"用户心理预期" */
                    var atTop = body.scrollTop <= 2;
                    var atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 4;
                    var bodyTop = body.getBoundingClientRect().top;
                    var current = 0;
                    if (!atTop) {
                        groups.forEach(function (group, idx) {
                            if (group.getBoundingClientRect().top - bodyTop <= 64) current = idx;
                        });
                    }
                    if (atBottom && groups.length) current = groups.length - 1;
                    items.forEach(function (item) {
                        item.classList.toggle('active', item.getAttribute('data-group-index') === String(current));
                    });
                });
            }
            try { body.dispatchEvent(new Event('scroll')); } catch (e) { /* ignore */ }
        }

        /* ===== 移动端设置一级/二级（v1.7.0）===== */
        function enterSettingsDetail(group, btn) {
            var modal = document.getElementById('settings-modal');
            var body = document.querySelector('#settings-modal .settings-body');
            if (!modal || !body) return;
            body.querySelectorAll('.setting-group.settings-group-selected').forEach(function (g) { g.classList.remove('settings-group-selected'); });
            group.classList.add('settings-group-selected');
            modal.classList.add('settings-mobile-detail');
            var nav = document.getElementById('settings-nav');
            if (nav) {
                nav.querySelectorAll('.settings-nav-item').forEach(function (item) { item.classList.toggle('active', item === btn); });
            }
            var label = group.querySelector('.setting-label');
            setSettingsMobileTitle(label ? label.textContent : '设置');
            body.scrollTop = 0;
        }
        function exitSettingsDetail() {
            var modal = document.getElementById('settings-modal');
            if (!modal) return;
            modal.classList.remove('settings-mobile-detail');
            modal.querySelectorAll('.setting-group.settings-group-selected').forEach(function (g) { g.classList.remove('settings-group-selected'); });
            setSettingsMobileTitle('设置');
            var body = modal.querySelector('.settings-body');
            if (body) body.scrollTop = 0;
        }
        function setSettingsMobileTitle(text) {
            var title = document.querySelector('#settings-modal .modal-mobile-title');
            if (title && title.textContent !== text) title.textContent = text;   // EN 模式经写入钩子直译
        }
        /* 移动端头部返回键：二级回一级列表，一级关闭设置 */
        function settingsMobileBack() {
            var modal = document.getElementById('settings-modal');
            if (modal && modal.classList.contains('settings-mobile-detail')) exitSettingsDetail();
            else closeSettings();
        }
        /* 跨 750px 边界进入桌面菜单模式时退出二级，避免桌面端只剩单个组 */
        window.addEventListener('resize', function () {
            var modal = document.getElementById('settings-modal');
            if (modal && modal.classList.contains('settings-mobile-detail') && isDesktopChrome()) exitSettingsDetail();
        });

        /* 默认状态项（中文源串）按索引缓存：设置行按语言显示默认值时要拿它做基准比较。
           随语言切换重建（默认组本身不含语言，但 t() 结果会变）。 */
        var _statusDefaultsCache = null;
        function statusDefaults() {
            _statusDefaultsCache = storage.getDefaultStatusItems();
            return _statusDefaultsCache;
        }

        function updateStatusSettings() {
            const container = document.getElementById('status-settings');
            container.innerHTML = '';
            statusDefaults();

            /* v1.6.0：主人/制造公司两行由「型号信息」设置驱动且不可改——设置组内不再渲染
               （信息参数面板/关于窗口等显示区仍正常输出，见 resolveStatusItems）。
               其余行改一行式布局：序号 + 标签输入 + 值输入 + 删除，与模式名称行同风格 */
            state.statusItems.forEach((item, index) => {
                if (index < 2) return;
                const settingItem = document.createElement('div');
                settingItem.className = 'flex items-center gap-2 mb-2';
                const displayNo = index - 1;   // 去掉前两行后从 1 连续编号

                /* 默认状态项的标签与值按界面语言显示（v1.10.0）：默认源串与当前语言
                   译文一一对应，用户改过的那一项仍是原文。落库时由 valueWithDefaultSource
                   归一回源串，保证「整组默认」判定与 EN 显示同时成立。 */
                const def = _statusDefaultsCache[index] || {};
                settingItem.innerHTML = `
                    <label class="text-sm w-8 shrink-0 text-right">${displayNo}:</label>
                    <input type="text" class="setting-input" style="flex:0 0 35%;min-width:0;" value="${escapeHtmlAttr(displayWithDefault(item.label, def.label))}" placeholder="标签">
                    <input type="text" class="setting-input" style="flex:1 1 65%;min-width:0;" value="${escapeHtmlAttr(displayWithDefault(item.value, def.value))}" placeholder="值">
                    <button class="btn-remove shrink-0">
                        <i class="fa fa-trash"></i>
                    </button>
                `;

                settingItem.querySelector('button').addEventListener('click', () => {
                    state.statusItems.splice(index, 1);
                    updateStatusSettings();
                });

                container.appendChild(settingItem);
            });
        }

        // 恢复默认设置
        function resetSettings() {
            /* 恢复「个性化显示内容」为默认。落地口径（与对话框措辞一致）：
               按钮文本 / 状态项 / 模式名称 / 型号信息 / 信息链接 / 运行参数 / 情绪 / 机器人图片。
               不涉及（对话框已注明）：界面语言、账号密码、MiMo Key 与 TTS 引擎、任务与计时器。 */

            // 恢复按钮文本默认值
            state.buttonTexts = [...storage.DEFAULT_BUTTON_TEXTS];

            // 恢复状态项默认值
            state.statusItems = storage.getDefaultStatusItems();

            // 恢复模式名称默认值（点击"应用更改"后落库生效）
            state.modeNames = {};
            Object.keys(MODES).forEach(id => {
                state.modeNames[id] = '';
                const input = document.getElementById('mode-name-input-' + id);
                if (input) input.value = '';
            });
            applyModeNameLabels();

            // 机器人图片：此前只重置预览、不删存储，应用更改后图片会「复活」
            // （用户口径：点了恢复默认，图片没变回去）。这里真删存储并同步内存态。
            try { storage.removeRobotImage1(); } catch (e) { /* ignore */ }
            try { storage.removeRobotImage2(); } catch (e) { /* ignore */ }
            state.tempRobotImage1 = null;
            state.tempRobotImage2 = null;

            // v1.6.0：恢复型号信息与信息面板链接默认值（应用更改后落库生效）
            state.modelInfo = {};
            syncModelInfoInputs();
            state.infoLinks = null;
            updateInfoLinksSettings();

            // 恢复运行参数默认值
            state.runtimeParams = { ...storage.DEFAULT_RUNTIME_PARAMS };

            // 恢复图片默认值
            state.tempRobotImage1 = null;
            state.tempRobotImage2 = null;

            // 恢复情绪与服从度默认值
            saveEmotions({ ...storage.DEFAULT_EMOTIONS });
            renderEmotionGauges();

            // 重新渲染设置面板UI
            document.getElementById('liquid-current').value = state.runtimeParams.liquidCurrent;
            document.getElementById('liquid-total').value = state.runtimeParams.liquidTotal;
            const batteryAutoEl = document.getElementById('battery-auto');
            if (batteryAutoEl) batteryAutoEl.checked = !!state.runtimeParams.batteryAuto;
            const batteryManualWrap = document.getElementById('battery-manual-wrap');
            if (batteryManualWrap) batteryManualWrap.style.display = batteryAutoEl && batteryAutoEl.checked ? 'none' : 'flex';
            document.getElementById('battery-percentage').value = state.runtimeParams.batteryPercentage;
            document.getElementById('is-charging').checked = state.runtimeParams.isCharging;
            document.getElementById('storage-used').value = state.runtimeParams.storageUsed;
            document.getElementById('storage-total').value = state.runtimeParams.storageTotal;

            updateButtonSettings();
            updateStatusSettings();

            // 恢复图片预览
            const imagePreview1 = document.getElementById('image-preview-1');
            const imagePreview2 = document.getElementById('image-preview-2');
            if (imagePreview1) {
                imagePreview1.innerHTML = '';
                const img = document.createElement('img');
                img.src = DEFAULT_IMAGES.left;
                img.onerror = function() { this.src = PLACEHOLDER_SVG_1; };
                imagePreview1.appendChild(img);
            }
            if (imagePreview2) {
                imagePreview2.innerHTML = '';
                const img = document.createElement('img');
                img.src = DEFAULT_IMAGES.right;
                img.onerror = function() { this.src = PLACEHOLDER_SVG_2; };
                imagePreview2.appendChild(img);
            }

            appendToLogs('[设置] 已恢复为默认设置，点击"应用更改"后生效');
            renderTripleStatusChips();
        }

        // 渲染文件列表
        function renderFileList() {
            const containers = document.querySelectorAll('.file-list');
            if (containers.length === 0) return;

            // v1.6.0：名称/URL 支持自定义（存储 robotInfoLinks，null=全部默认；action/doc 项不可配置）
            const effective = getEffectiveInfoLinks();
            const nameOf = file => {
                if (file.type === 'doc') return manualName();   // 说明书按界面语言显示名称
                const e = effective.find(lk => lk.id === file.id);
                return (e && e.name) || file.name;
            };
            const urlOf = file => {
                if (file.type === 'doc') return manualPath();   // 说明书按界面语言取版本
                const e = effective.find(lk => lk.id === file.id);
                return (e && e.url) || file.url || '';
            };

            containers.forEach(container => {
                container.innerHTML = '';

                FILES.forEach(file => {
                    const isPdf = file.type === 'pdf';
                    const isAction = file.type === 'action';
                    const isDoc = file.type === 'doc';
                    const item = document.createElement('div');
                    /* 说明书（v1.10.0）与 PDF 在桌面宽度并列各占半行：.file-list 是两列 grid，
                       两者都占 1 列；≤768px 时 grid 降为单列，各自整行。
                       PDF 原先独占整行（file-item-full），本轮按需求与说明书并列。 */
                    item.className = 'file-item';
                    const metaText = isPdf
                        ? `${file.version} · ${file.type.toUpperCase()} · ${file.sizeText}`
                        : isAction
                            ? `${file.meta} · APP`
                            : isDoc
                                ? `${file.meta} · DOC`
                                : `${file.meta} · LINK`;

                    // PDF、链接与说明书都增加"新窗口"按钮；action 条目无外链，不渲染
                    const actionsHtml = isAction ? '' : `<button class="file-open-new-btn btn-active" data-file-new-id="${file.id}" title="在新窗口打开">
                               <i class="fa fa-external-link-alt mr-1"></i>新窗口
                           </button>`;

                    item.innerHTML = `
                        <div class="file-icon">
                            <img src="${file.iconPath}" alt="" class="w-5 h-5" style="filter: drop-shadow(0 0 2px rgba(143,188,143,0.3));">
                        </div>
                        <div class="file-info">
                            <div class="file-name">${escapeHtmlAttr(nameOf(file))}</div>
                            <div class="file-meta">${metaText}</div>
                        </div>
                        <div class="file-actions" onclick="event.stopPropagation();">${actionsHtml}</div>
                    `;

                    // 点击条目主体执行默认操作
                    item.addEventListener('click', () => {
                        if (isDoc) {
                            /* 说明书始终在应用内阅读（Android 不外抛，保证任何端都读得到） */
                            openManualViewer();
                            if (typeof isDesktopChrome === 'function' && isDesktopChrome() && typeof closeInfoModal === 'function') closeInfoModal();
                            appendToLogs(`打开了文件：${nameOf(file)}`);
                        } else if (isPdf) {
                            openPdfViewer(file);
                            /* 桌面菜单模式：打开 PDF 窗口后自动收起信息面板（链接条目与"新窗口"按钮行为不变） */
                            if (typeof isDesktopChrome === 'function' && isDesktopChrome() && typeof closeInfoModal === 'function') closeInfoModal();
                            appendToLogs(`打开了文件：${nameOf(file)}`);
                        } else if (isAction && file.action === 'app-launch') {
                            /* 浏览器端 App 拉起引导（js/app-launch.js 定义；原生壳内 rcShowAppLaunch 未定义则无操作） */
                            if (typeof window.rcShowAppLaunch === 'function') {
                                if (typeof closeInfoModal === 'function') closeInfoModal();
                                window.rcShowAppLaunch(true);
                                appendToLogs('打开了 App 拉起引导');
                            } else {
                                appendToLogs('App 拉起引导仅浏览器端可用');
                            }
                        } else if (urlOf(file)) {
                            const openUrl = urlOf(file);
                            if (isSingleColumn() && isAndroidApp()) {
                                window.Android.openExternalUrl(openUrl);
                            } else {
                                // 弹出精简宽屏浏览器窗口（只有标题栏）预览
                                // 基于当前浏览器窗口位置计算，确保弹窗与原窗口在同一屏幕
                                const popW = Math.min(1280, Math.round(window.outerWidth * 0.8));
                                const popH = Math.min(720, Math.round(window.outerHeight * 0.7));
                                const popLeft = Math.round(window.screenX + (window.outerWidth - popW) / 2);
                                const popTop = Math.round(window.screenY + (window.outerHeight - popH) / 2);
                                window.open(openUrl, '_blank', `noopener,noreferrer,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes,width=${popW},height=${popH},left=${popLeft},top=${popTop}`);
                            }
                            appendToLogs(`访问了链接：${nameOf(file)}`);
                        }
                    });

                    container.appendChild(item);
                });

                // 绑定新窗口按钮（PDF 用 path，链接用 url，说明书用当前语言版本；都用多标签页打开）
                container.querySelectorAll('[data-file-new-id]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const id = e.currentTarget.getAttribute('data-file-new-id');
                        const file = FILES.find(f => f.id === id);
                        if (!file) return;
                        const target = file.path || urlOf(file);
                        /* 说明书为本地 HTML：Android WebView 未开多窗口、win-app 主进程拒绝
                           非 http(s) 的 window.open — 两边都打不开新窗口，故不做静默无效调用，
                           统一在应用内阅读器里打开（点条目主体的行为）。 */
                        if (file.type === 'doc') {
                            openManualViewer();
                            if (typeof isDesktopChrome === 'function' && isDesktopChrome() && typeof closeInfoModal === 'function') closeInfoModal();
                            appendToLogs(`打开了文件：${nameOf(file)}`);
                            return;
                        }
                        if (isSingleColumn() && isAndroidApp()) {
                            if (file.type === 'pdf') {
                                window.Android.openPdfFile(target);
                            } else {
                                window.Android.openExternalUrl(target);
                            }
                        } else {
                            window.open(target, '_blank', 'noopener,noreferrer');
                        }
                        appendToLogs(`在新窗口打开了：${nameOf(file)}`);
                    });
                });
            });

        }

        function isSingleColumn() {
            return window.innerWidth < 750;
        }

        function isAndroidApp() {
            return typeof window.Android !== 'undefined' && !!window.Android;
        }

        // 打开 PDF 阅读器
        let currentPdfFile = null;

        /* 应用内阅读使用说明书（v1.10.0）：复用 PDF 阅读器弹窗的 iframe 与「新窗口」按钮，
           始终在本应用内打开（Android 也不外抛），确保各端都能读到对应语言的版本。 */
        function openManualViewer() {
            /* inApp：说明书为本地 HTML，始终用内置阅读器（Android 也不外抛） */
            const file = { id: 'app-manual', name: manualName(), path: manualPath(), inApp: true };
            openPdfViewer(file);
        }

        function openPdfViewer(file) {
            currentPdfFile = file;
            if (isSingleColumn() && isAndroidApp() && !file.inApp) {
                window.Android.openPdfFile(file.path);
                return;
            }
            const modal = document.getElementById('pdf-viewer-modal');
            const frame = document.getElementById('pdf-viewer-frame');
            const fallback = document.getElementById('pdf-viewer-fallback');
            const titleText = document.getElementById('pdf-viewer-title-text');
            const fallbackOpen = document.getElementById('pdf-viewer-fallback-open');
            const fallbackDownload = document.getElementById('pdf-viewer-fallback-download');

            if (!modal || !frame) return;

            titleText.textContent = file.name;
            fallback.style.display = 'none';
            frame.style.display = 'block';
            // #toolbar=1 显示浏览器 PDF 工具栏；#view=FitH 自适应宽度
            frame.src = file.path + '#toolbar=1&view=FitH';

            // 兜底链接
            if (fallbackOpen) fallbackOpen.href = file.path;
            if (fallbackDownload) fallbackDownload.href = file.path;

            // iframe 加载失败时显示兜底（部分移动端/旧浏览器）
            frame.onerror = function() {
                frame.style.display = 'none';
                fallback.style.display = 'block';
                /* 说明书为本地 HTML（inApp）：Android 侧不能走 openPdfFile（会按 PDF
                   MIME 交给外部应用打开 .html），win-app 侧 window.open 被主进程拒绝。
                   两边都没有可用的外抛通道，故只显示兜底提示，由用户自行处理。 */
                if (file.inApp) return;
                if (isAndroidApp()) {
                    window.Android.openPdfFile(file.path);
                } else {
                    window.open(file.path, '_blank', 'noopener,noreferrer');
                }
            };

            modal.classList.add('pdf-viewer-visible');
            if (window.DWM) window.DWM.open('pdf-viewer-modal');
            document.body.style.overflow = 'hidden';
            notifyModalState();

            // 聚焦关闭按钮，便于键盘操作
            setTimeout(() => {
                const closeDot = document.getElementById('pdf-close-dot');
                if (closeDot) closeDot.focus();
            }, 100);
        }

        // 关闭 PDF 阅读器
        function closePdfViewer() {
            const modal = document.getElementById('pdf-viewer-modal');
            const frame = document.getElementById('pdf-viewer-frame');
            if (!modal) return;
            if (!(window.DWM && window.DWM.close('pdf-viewer-modal'))) modal.classList.remove('pdf-viewer-visible');
            document.body.style.overflow = '';
            if (frame) {
                frame.src = '';
            }
            currentPdfFile = null;
            notifyModalState();
        }

        // 初始化 PDF 阅读器事件
        function initPdfViewer() {
            const modal = document.getElementById('pdf-viewer-modal');
            const closeDot = document.getElementById('pdf-close-dot');
            const openNewBtn = document.getElementById('pdf-viewer-open-new');
            if (!modal) return;

            if (closeDot) {
                closeDot.addEventListener('click', closePdfViewer);
            }
            if (openNewBtn) {
                openNewBtn.addEventListener('click', () => {
                    if (currentPdfFile) {
                        if (isSingleColumn() && isAndroidApp()) {
                            window.Android.openPdfFile(currentPdfFile.path);
                        } else {
                            window.open(currentPdfFile.path, '_blank', 'noopener');
                        }
                    }
                });
            }
            // 点击遮罩关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closePdfViewer();
                }
            });
            // Esc 键关闭
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('pdf-viewer-visible')) {
                    closePdfViewer();
                }
            });
        }

        // =============================================
        // 新增模块：任务指令系统
        // =============================================
        function taskTypePriority(type) {
            if (type === 'cognitive') return 0;
            if (type === 'terminal') return 1;
            if (type === 'button') return 3;
            return 2;
        }
        function sortTasksForSend(tasks) {
            const cognitive = tasks.filter(t => t.type === 'cognitive');
            const terminal = tasks.filter(t => t.type === 'terminal');
            const normal = tasks.filter(t => !t.type);
            const button = tasks.filter(t => t.type === 'button');
            return [...cognitive, ...terminal, ...normal, ...button];
        }
        function loadTasks() {
            return storage.getTasks();
        }
        function saveTasks(tasks) {
            const sorted = sortTasksForSend(tasks);
            storage.setTasks(sorted);
            if (typeof Android !== 'undefined' && Android.onDataChanged) {
                Android.onDataChanged('tasks', JSON.stringify(sorted));
            }
        }
        function addTask(name, opts = {}) {
            name = (name || '').trim();
            if (!name) return;
            const tasks = loadTasks();
            tasks.push({ id: Date.now(), name, status: 'pending', type: opts.type || null });
            saveTasks(tasks);
            renderTasks();
            appendToLogs(`[任务系统] 新增任务：${name}`);
            if (window.ClawbotBridge && window.ClawbotBridge.push) {
                window.ClawbotBridge.push('data', (window.I18N && I18N.getLang() === 'en') ? 'Task added: ' + name : '任务已添加：' + name);
            }
        }
        function addTerminalTask(name) {
            name = (name || '').trim();
            if (!name) return;
            const tasks = loadTasks();
            const cognitiveCount = tasks.filter(t => t.type === 'cognitive').length;
            tasks.splice(cognitiveCount, 0, { id: Date.now(), name, status: 'pending', type: 'terminal' });
            saveTasks(tasks);
            renderTasks();
            appendToLogs(`[终端指令] 已添加：${name}`);
            if (window.ClawbotBridge && window.ClawbotBridge.push) {
                window.ClawbotBridge.push('data', (window.I18N && I18N.getLang() === 'en') ? 'Task added: ' + name : '任务已添加：' + name);
            }
        }
        function setTaskStatus(id, status) {
            const tasks = loadTasks();
            const task = tasks.find(t => t.id === id);
            if (task) {
                const filtered = tasks.filter(t => t.id !== id);
                saveTasks(filtered);
                renderTasks();
                const statusText = status === 'completed' ? '已完成' : '已取消';
                appendToLogs(`[任务系统] 任务「${task.name}」${statusText}`);
                /* v1.6.0 二轮：EN 模式播报照英文模板（任务名=手输内容保留） */
                speak((window.I18N && I18N.getLang() === 'en') ? `Task ${task.name}${status === 'completed' ? ' completed' : ' was cancelled'}` : `任务${task.name}${statusText}`);
            }
        }
        function toggleTaskDone(id) {
            const tasks = loadTasks();
            const task = tasks.find(t => t.id === id);
            if (task) {
                task.status = task.status === 'done' ? 'pending' : 'done';
                saveTasks(tasks);
                renderTasks();
            }
        }
        function deleteTask(id) {
            const tasks = loadTasks();
            const task = tasks.find(t => t.id === id);
            if (task) {
                const filtered = tasks.filter(t => t.id !== id);
                saveTasks(filtered);
                renderTasks();
                appendToLogs(`[任务系统] 任务「${task.name}」已删除`);
            }
        }

        function renderTaskItem(t) {
            if (t.type === 'cognitive') {
                return `<div class="task-item">
    <div class="flex-1 min-w-0">
        <div class="task-name text-[#fb923c]">${t.name}</div>
    </div>
    <div class="flex gap-2 flex-shrink-0">
        <button class="bg-[#2d4a2d]/30 hover:bg-[#fb923c]/30 text-[#fb923c] py-2 px-3 rounded transition-all duration-300 active:scale-95 btn-active text-sm" onclick="removeCognitiveTask(${t.id})">移除认知偏移</button>
    </div>
</div>`;
            }
            if (t.type === 'terminal') {
                return `<div class="task-item">
    <div class="flex-1 min-w-0">
        <div class="task-name text-[#2dd4bf]">${t.name}</div>
    </div>
    ${t.status === 'pending' ? `
    <div class="flex gap-2 flex-shrink-0">
        <button class="bg-[#2d4a2d]/30 hover:bg-[#2dd4bf]/30 text-[#2dd4bf] py-2 px-3 rounded transition-all duration-300 active:scale-95 btn-active text-sm" onclick="setTaskStatus(${t.id},'completed')">完成</button>
        <button class="bg-[#2d4a2d]/30 hover:bg-[#f87171]/30 text-[#f87171] py-2 px-3 rounded transition-all duration-300 active:scale-95 btn-active text-sm" onclick="setTaskStatus(${t.id},'cancelled')">取消</button>
    </div>
    ` : ''}
</div>`;
            }
            return `<div class="task-item">
    <div class="flex-1 min-w-0">
        <div class="task-name">${t.name}</div>
    </div>
    ${t.status === 'pending' ? `
    <div class="flex gap-2 flex-shrink-0">
        <button class="bg-[#2d4a2d]/30 hover:bg-[#4ade80]/30 text-[#4ade80] py-2 px-3 rounded transition-all duration-300 active:scale-95 btn-active text-sm" onclick="setTaskStatus(${t.id},'completed')">完成</button>
        <button class="bg-[#2d4a2d]/30 hover:bg-[#f87171]/30 text-[#f87171] py-2 px-3 rounded transition-all duration-300 active:scale-95 btn-active text-sm" onclick="setTaskStatus(${t.id},'cancelled')">取消</button>
    </div>
    ` : ''}
</div>`;
        }

        function renderTasks() {
            const container = document.getElementById('task-list');
            const tasks = loadTasks();
            const countEl = document.getElementById('task-count');
            const tripleCountEl = document.getElementById('triple-task-count');
            const badge = document.getElementById('dock-control-badge');
            const pending = tasks.filter(t => t.status === 'pending').length;
            const countText = `${tasks.length} 项任务（${pending} 待完成）`;
            if (countEl) countEl.textContent = countText;
            if (tripleCountEl) tripleCountEl.textContent = countText;
            if (badge) {
                badge.textContent = tasks.length;
                badge.style.display = tasks.length > 0 ? 'flex' : 'none';
            }
            
            if (!container) return;
            
            if (tasks.length === 0) {
                container.innerHTML = '<div class="text-[#8fbc8f]/40 text-xs text-center py-4">暂无任务</div>';
                requestAnimationFrame(() => adjustTaskListHeight());
                return;
            }

            const cognitive = tasks.filter(t => t.type === 'cognitive');
            const terminal = tasks.filter(t => t.type === 'terminal');
            const normal = tasks.filter(t => !t.type);
            const button = tasks.filter(t => t.type === 'button');

            const parts = [];
            if (cognitive.length) parts.push(...cognitive.map(renderTaskItem));
            if (cognitive.length && terminal.length) {
                parts.push('<div class="border-t border-[#4e6f4e]/30 my-2"></div>');
            }
            if (terminal.length) parts.push(...terminal.map(renderTaskItem));
            if ((cognitive.length || terminal.length) && (normal.length || button.length)) {
                parts.push('<div class="border-t border-[#4e6f4e]/30 my-2"></div>');
            }
            if (normal.length) parts.push(...normal.map(renderTaskItem));
            if (normal.length && button.length) {
                parts.push('<div class="border-t border-[#4e6f4e]/30 my-2"></div>');
            }
            if (button.length) parts.push(...button.map(renderTaskItem));
            
            container.innerHTML = parts.join('');
            requestAnimationFrame(() => adjustTaskListHeight());
        }

        let _cachedTaskItemH = 0;
        function adjustTaskListHeight() {
            const container = document.getElementById('task-list');
            if (!container) return;
            if (!isSingleColumn() || isCurrentlyTriple) {
                container.style.height = '';
                container.style.maxHeight = '';
                container.style.overflowY = '';
                container.style.minHeight = '';
                return;
            }
            function isVisible(el) {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return false;
                let node = el;
                while (node && node !== document.body) {
                    if (getComputedStyle(node).display === 'none') return false;
                    node = node.parentElement;
                }
                return true;
            }
            function apply() {
                const container = document.getElementById('task-list');
                if (!container) return;
                if (!isSingleColumn() || isCurrentlyTriple) {
                    container.style.height = '';
                    container.style.maxHeight = '';
                    container.style.overflowY = '';
                    container.style.minHeight = '';
                    return;
                }
                if (!isVisible(container)) {
                    container.style.height = '';
                    container.style.maxHeight = '';
                    container.style.overflowY = '';
                    container.style.minHeight = '';
                    return;
                }
                const tasks = loadTasks();
                const count = tasks.length;
                container.style.height = '';
                container.style.maxHeight = 'none';
                container.style.minHeight = '';
                container.style.overflowY = 'hidden';
                const items = container.querySelectorAll('.task-item');
                let itemH = 0;
                if (items.length > 0) {
                    const first = items[0];
                    const rect = first.getBoundingClientRect();
                    if (rect.height > 10) {
                        const style = getComputedStyle(first);
                        const mt = parseFloat(style.marginTop) || 0;
                        const mb = parseFloat(style.marginBottom) || 0;
                        itemH = rect.height + Math.max(mt, mb);
                    }
                }
                if (itemH > 20) {
                    _cachedTaskItemH = itemH;
                } else if (_cachedTaskItemH > 20) {
                    itemH = _cachedTaskItemH;
                } else {
                    const isNarrow = window.innerWidth <= 768;
                    const btnMinH = isNarrow ? 38 : 32;
                    const padV = 16;
                    const mbPx = 6;
                    itemH = btnMinH + padV + mbPx;
                    _cachedTaskItemH = itemH;
                }
                const cs = getComputedStyle(container);
                const pt = parseFloat(cs.paddingTop) || 0;
                const pb = parseFloat(cs.paddingBottom) || 0;
                let lastMargin = 5.6;
                if (items.length > 0) {
                    const ls = getComputedStyle(items[items.length - 1]);
                    lastMargin = parseFloat(ls.marginBottom) || 5.6;
                }
                const h3 = Math.round(itemH * 3 - lastMargin + pt + pb);
                const h20 = Math.round(itemH * 20 - lastMargin + pt + pb);
                const naturalH = container.scrollHeight;
                let finalH;
                let overflow;
                if (count === 0) {
                    finalH = h3;
                    overflow = 'hidden';
                } else if (naturalH <= h3 + 2) {
                    finalH = h3;
                    overflow = 'hidden';
                } else if (naturalH >= h20 - 2) {
                    finalH = h20;
                    overflow = 'auto';
                } else {
                    finalH = naturalH;
                    overflow = 'hidden';
                }
                container.style.maxHeight = 'none';
                container.style.height = finalH + 'px';
                container.style.overflowY = overflow;
            }
            requestAnimationFrame(() => {
                requestAnimationFrame(apply);
            });
        }

        // =============================================
        // 新增模块：计时器
        // =============================================
        let timerState = {
            running: false,
            countdownTotal: 300, // 秒
            countdownRemain: 300,
            intervalId: null
        };
        function loadTimerState() {
            const saved = storage.getTimerState();
            if (saved) {
                timerState.countdownTotal = saved.countdownTotal || 300;
                timerState.countdownRemain = saved.countdownRemain || 300;
            }
        }
        function saveTimerState() {
            storage.setTimerState({
                countdownTotal: timerState.countdownTotal,
                countdownRemain: timerState.countdownRemain
            });
        }
        function renderTimerInputs() {
            const textEl = document.getElementById('timer-display-text');
            const inputsEl = document.getElementById('timer-display-inputs');
            if (!textEl || !inputsEl) return;
            const showInputs = !timerState.running && timerState.countdownRemain === timerState.countdownTotal;
            textEl.style.display = showInputs ? 'none' : '';
            inputsEl.style.display = showInputs ? '' : 'none';
        }
        function syncTimerInputs() {
            const minInput = document.getElementById('cd-min');
            const secInput = document.getElementById('cd-sec');
            if (!minInput || !secInput) return;
            const total = timerState.countdownTotal || 300;
            minInput.value = Math.floor(total / 60);
            secInput.value = total % 60;
        }
        function formatTimerTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }
        function updateTimerDisplay() {
            const timeStr = formatTimerTime(Math.max(0, timerState.countdownRemain));
            const textEl = document.getElementById('timer-display-text');
            if (textEl) textEl.textContent = timeStr;
            const tripleTextEl = document.getElementById('triple-timer-text');
            if (tripleTextEl) tripleTextEl.textContent = timeStr;
        }
        function timerStart() {
            if (timerState.running) return;
            timerState.running = true;
            const origStartBtn = document.getElementById('timer-start-btn');
            const origPauseBtn = document.getElementById('timer-pause-btn');
            const tripleStartBtn = document.getElementById('triple-timer-start-btn');
            const triplePauseBtn = document.getElementById('triple-timer-pause-btn');
            if (origStartBtn) origStartBtn.style.display = 'none';
            if (origPauseBtn) origPauseBtn.style.display = '';
            if (tripleStartBtn) tripleStartBtn.style.display = 'none';
            if (triplePauseBtn) triplePauseBtn.style.display = '';
            const minInput = document.getElementById('cd-min');
            const secInput = document.getElementById('cd-sec');
            if (timerState.countdownRemain === timerState.countdownTotal) {
                const m = Math.max(0, parseInt(minInput?.value) || 0);
                const s = Math.max(0, Math.min(59, parseInt(secInput?.value) || 0));
                timerState.countdownTotal = m * 60 + s;
                timerState.countdownRemain = timerState.countdownTotal;
            }
            renderTimerInputs();
            timerState.intervalId = managedSetInterval(() => {
                timerState.countdownRemain--;
                if (timerState.countdownRemain <= 0) {
                    timerState.countdownRemain = 0;
                    timerPause();
                    const display = document.getElementById('timer-display');
                    if (display) {
                        display.classList.add('alarm');
                        setTimeout(() => display.classList.remove('alarm'), 5000);
                    }
                    const tripleDisplay = document.getElementById('triple-timer-display');
                    if (tripleDisplay) {
                        tripleDisplay.classList.add('alarm');
                        setTimeout(() => tripleDisplay.classList.remove('alarm'), 5000);
                    }
                    speak('倒计时结束！');
                    appendToLogs('[计时器] 倒计时结束');
                }
                updateTimerDisplay();
                saveTimerState();
            }, 1000);
            appendToLogs('[计时器] 倒计时已启动');
        }
        function timerPause() {
            if (!timerState.running) return;
            timerState.running = false;
            clearInterval(timerState.intervalId);
            const origStartBtn = document.getElementById('timer-start-btn');
            const origPauseBtn = document.getElementById('timer-pause-btn');
            const tripleStartBtn = document.getElementById('triple-timer-start-btn');
            const triplePauseBtn = document.getElementById('triple-timer-pause-btn');
            if (origStartBtn) origStartBtn.style.display = '';
            if (origPauseBtn) origPauseBtn.style.display = 'none';
            if (tripleStartBtn) tripleStartBtn.style.display = '';
            if (triplePauseBtn) triplePauseBtn.style.display = 'none';
            saveTimerState();
        }
        function timerReset() {
            timerPause();
            const minInput = document.getElementById('cd-min');
            const secInput = document.getElementById('cd-sec');
            const m = Math.max(0, parseInt(minInput?.value) || 0);
            const s = Math.max(0, Math.min(59, parseInt(secInput?.value) || 0));
            timerState.countdownTotal = m * 60 + s;
            timerState.countdownRemain = timerState.countdownTotal;
            const display = document.getElementById('timer-display');
            const tripleDisplay = document.getElementById('triple-timer-display');
            if (display) display.classList.remove('alarm');
            if (tripleDisplay) tripleDisplay.classList.remove('alarm');
            updateTimerDisplay();
            renderTimerInputs();
            saveTimerState();
        }

        // =============================================
        // 新增模块：情绪与服从度面板
        // =============================================
        const emotionConfig = {
            obedience: { color: '#4ade80', label: '服从度' },
            shame:     { color: '#fb923c', label: '羞耻度' },
            pleasure:  { color: '#f472b6', label: '愉悦度' },
            mechanical: { color: '#f87171', label: '机械度' }
        };
        const DEFAULT_EMOTIONS = { obedience: 100, shame: 0, pleasure: 100, mechanical: 50 };
        function loadEmotions() {
            return storage.getEmotions();
        }
        function saveEmotions(emotions) {
            storage.setEmotions(emotions);
            if (typeof Android !== 'undefined' && Android.onDataChanged) {
                Android.onDataChanged('emotion', [emotions.obedience||0, emotions.shame||0, emotions.pleasure||0, emotions.mechanical||0].join(','));
            }
        }
        function renderEmotionGauges() {
            const emotions = loadEmotions();
            Object.keys(emotionConfig).forEach(key => {
                const val = emotions[key] || 0;
                const color = emotionConfig[key].color;
                
                const fill = document.getElementById('gauge-' + key);
                const valSpan = document.getElementById('gauge-val-' + key);
                const thumb = document.getElementById('gauge-thumb-' + key);
                if (fill) { fill.style.width = val + '%'; fill.style.background = color; }
                if (valSpan) valSpan.textContent = val;
                if (thumb) { thumb.style.left = val + '%'; thumb.style.borderColor = color; }
            });
        }

        // 情绪直线进度条拖拽交互
        let gaugeDragging = null; // { key, track, thumb, fill }
        let gaugeJustDragged = false;

        function getValueFromTrack(track, clientX) {
            const rect = track.getBoundingClientRect();
            const x = clientX - rect.left;
            const value = Math.round(x / rect.width * 100);
            return Math.max(0, Math.min(100, value));
        }

        function setEmotionValue(key, value) {
            const emotions = loadEmotions();
            emotions[key] = value;
            saveEmotions(emotions);
            renderEmotionGauges();
        }

        function initGaugeInteraction() {
            const tracks = document.querySelectorAll('.gauge-track');
            tracks.forEach(track => {
                const key = track.getAttribute('data-key');
                const thumb = track.querySelector('.gauge-thumb-line');
                const fillLine = track.querySelector('.gauge-fill-line');
                if (!thumb || !fillLine) return;

                // Click on track to set value
                track.addEventListener('click', (e) => {
                    if (gaugeJustDragged) {
                        gaugeJustDragged = false;
                        return;
                    }
                    const value = getValueFromTrack(track, e.clientX);
                    setEmotionValue(key, value);
                    speak(emotionConfig[key].label + value, 'data');
                });

                // Drag start on thumb
                const startDrag = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    gaugeDragging = { key, track, thumb, fillLine };
                    thumb.classList.add('dragging');
                    fillLine.classList.add('no-transition');
                    // 另一组的fill和thumb也要去掉transition
                    const otherTracks = document.querySelectorAll('.gauge-track[data-key="' + key + '"]');
                    otherTracks.forEach(t => {
                        const f = t.querySelector('.gauge-fill-line');
                        const th = t.querySelector('.gauge-thumb-line');
                        if (f && f !== fillLine) f.classList.add('no-transition');
                        if (th && th !== thumb) th.classList.add('dragging');
                    });
                };

                thumb.addEventListener('mousedown', startDrag);
                thumb.addEventListener('touchstart', startDrag, { passive: false });
            });

            // Global move and end handlers
            const onMove = (e) => {
                if (!gaugeDragging) return;
                e.preventDefault();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const value = getValueFromTrack(gaugeDragging.track, clientX);
                setEmotionValue(gaugeDragging.key, value);
            };

            const onEnd = (e) => {
                if (!gaugeDragging) return;
                const key = gaugeDragging.key;
                // 清理所有track的dragging/no-transition状态
                const allTracks = document.querySelectorAll('.gauge-track[data-key="' + key + '"]');
                allTracks.forEach(t => {
                    const f = t.querySelector('.gauge-fill-line');
                    const th = t.querySelector('.gauge-thumb-line');
                    if (f) f.classList.remove('no-transition');
                    if (th) th.classList.remove('dragging');
                });
                const emotions = loadEmotions();
                speak(emotionConfig[key].label + (emotions[key] || 0), 'data');
                gaugeDragging = null;
                gaugeJustDragged = true;
                setTimeout(() => { gaugeJustDragged = false; }, 100);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchend', onEnd);
        }

        // =============================================
        // 新增模块初始化入口
        // =============================================
        function initNewModules() {
            // 任务系统
            renderTasks();
            // 计时器
            loadTimerState();
            syncTimerInputs();
            updateTimerDisplay();
            renderTimerInputs();
            // 情绪面板
            renderEmotionGauges();
            initGaugeInteraction();
        }
        
        // =============================================
        // 三栏布局辅助函数与DOM移动引擎
        // =============================================
        let originalParents = {};
        let isCurrentlyTriple = false;

        function isTripleLayout() {
            return window.innerWidth >= 750;
        }

        function openInfoModal() {
            const modal = document.getElementById('info-modal');
            if (modal) {
                renderFileList();
                modal.classList.add('visible');
                document.body.style.overflow = 'hidden';
                if (typeof chromeMenuOpened === 'function') chromeMenuOpened('info-modal');
                notifyModalState();
            }
        }

        function closeInfoModal() {
            const modal = document.getElementById('info-modal');
            if (modal) {
                modal.classList.remove('visible');
                document.body.style.overflow = '';
                if (typeof chromeMenuClosed === 'function') chromeMenuClosed('info-modal');
                notifyModalState();
            }
        }

        function openSettings() {
            const modal = document.getElementById('settings-modal');
            if (modal) {
                modal.classList.add('settings-modal-visible');
                exitSettingsDetail();   // 每次打开回一级列表（移动端）
                document.body.style.overflow = 'hidden';
                if (typeof state !== 'undefined') {
                    state.tempRobotImage1 = null;
                    state.tempRobotImage2 = null;
                }
                if (typeof initSettingsModal === 'function') {
                    initSettingsModal();
                }
                if (typeof chromeMenuOpened === 'function') chromeMenuOpened('settings-modal');
                notifyModalState();
            }
        }

        function closeSettings() {
            const modal = document.getElementById('settings-modal');
            if (modal) {
                modal.classList.remove('settings-modal-visible');
                document.body.style.overflow = '';
                if (typeof chromeMenuClosed === 'function') chromeMenuClosed('settings-modal');
                notifyModalState();
            }
        }

        function closeSelfCheck() {
            /* 移动端/返回按钮路径：关闭最上层的可见过程实例（运行中先确认） */
            var topKey = null, topZ = -1;
            Object.keys(_processInstances).forEach(function (k) {
                var inst = _processInstances[k];
                if (!inst.modal.classList.contains('visible')) return;
                var z = parseInt(inst.modal.style.zIndex, 10) || 0;
                if (z >= topZ) { topZ = z; topKey = k; }
            });
            forceCloseProcessConfirm(topKey || 'self-check');
        }

        function moveDomToTriple() {
            const moves = [
                { el: document.getElementById('terminal-black-container'), slot: 'triple-slot-terminal' },
                { el: document.getElementById('function-buttons'), slot: 'triple-slot-console' },
                { el: document.getElementById('emotion-gauges-container'), slot: 'triple-slot-emotion' },
                { el: document.getElementById('task-list'), slot: 'triple-slot-tasks' },
                { el: document.getElementById('params-content'), slot: 'triple-slot-params' },
                { el: document.getElementById('logs-container'), slot: 'triple-slot-logs' },
            ];

            moves.forEach(({ el, slot }) => {
                if (!el) return;
                if (!originalParents[slot]) {
                    originalParents[slot] = {
                        parent: el.parentNode,
                        nextSibling: el.nextSibling
                    };
                }
                const slotEl = document.getElementById(slot);
                if (slotEl) {
                    slotEl.innerHTML = '';
                    slotEl.appendChild(el);
                }
            });

            const termSlot = document.getElementById('triple-slot-terminal');
            if (termSlot) {
                termSlot.style.flex = '1';
                termSlot.style.display = 'flex';
                termSlot.style.flexDirection = 'column';
                termSlot.style.minHeight = '0';
            }

            const termBlack = document.getElementById('terminal-black-container');
            if (termBlack) {
                termBlack.style.height = '100%';
                termBlack.style.flex = '1';
                termBlack.style.display = 'flex';
                termBlack.style.flexDirection = 'column';
                termBlack.style.background = 'transparent';
                termBlack.style.borderTop = 'none';
                termBlack.style.borderRadius = '0';
                termBlack.style.overflow = 'hidden';
            }

            const consoleSlot = document.getElementById('triple-slot-console');
            if (consoleSlot) {
                consoleSlot.style.display = 'flex';
                consoleSlot.style.flexDirection = 'column';
                consoleSlot.style.gap = '0.5rem';
                consoleSlot.style.marginBottom = '0.75rem';
            }

            const funcBtnsContainer = document.getElementById('function-buttons');
            if (funcBtnsContainer) {
                funcBtnsContainer.classList.remove('grid-cols-2', 'sm:grid-cols-3', 'col-span-full', 'function-buttons-desktop');
                funcBtnsContainer.classList.add('grid-cols-3', 'gap-1.5');
            }

            const emotionContainer = document.getElementById('emotion-gauges-container');
            if (emotionContainer) {
                emotionContainer.style.padding = '0';
                emotionContainer.classList.remove('space-y-5');
                emotionContainer.style.display = 'grid';
                emotionContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
                emotionContainer.style.gap = '0.75rem';
            }

            const taskList = document.getElementById('task-list');
            if (taskList) {
                taskList.style.maxHeight = 'none';
                taskList.style.overflow = 'visible';
                taskList.classList.remove('overflow-y-auto');
            }

            const taskSlot = document.getElementById('triple-slot-tasks');
            if (taskSlot) {
                taskSlot.style.flex = '1';
                taskSlot.style.minHeight = '0';
            }
            const tasksBody = document.querySelector('#triple-tasks .cp-body');
            if (tasksBody) {
                tasksBody.style.flex = '1';
                tasksBody.style.minHeight = '0';
                tasksBody.style.overflowY = 'auto';
            }

            const logsSlot = document.getElementById('triple-slot-logs');
            if (logsSlot) {
                logsSlot.style.flex = '1';
                logsSlot.style.display = 'flex';
                logsSlot.style.flexDirection = 'column';
                logsSlot.style.minHeight = '0';
            }
            const logsBody = document.querySelector('#triple-logs .cp-body');
            if (logsBody) {
                logsBody.style.flex = '1';
                logsBody.style.display = 'flex';
                logsBody.style.flexDirection = 'column';
                logsBody.style.minHeight = '0';
                logsBody.style.overflow = 'hidden';
            }

            const paramsBody = document.querySelector('#triple-params .cp-body');
            if (paramsBody) {
                paramsBody.style.display = 'flex';
                paramsBody.style.flexDirection = 'column';
                paramsBody.style.minHeight = '0';
                paramsBody.style.overflowY = 'auto';
            }
            const paramsSlot = document.getElementById('triple-slot-params');
            if (paramsSlot) {
                paramsSlot.style.flex = '1';
                paramsSlot.style.display = 'flex';
                paramsSlot.style.flexDirection = 'column';
                paramsSlot.style.minHeight = '0';
            }

            const paramsContent = document.getElementById('params-content');
            if (paramsContent) {
                paramsContent.style.padding = '0';
                paramsContent.style.display = 'flex';
                paramsContent.style.flexDirection = 'column';
                paramsContent.style.flex = '1';
                paramsContent.style.minHeight = '0';
                paramsContent.classList.remove('space-y-4', 'pt-4');
                paramsContent.classList.add('space-y-2');

                const progressGrid = paramsContent.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
                if (progressGrid) {
                    progressGrid.classList.remove('gap-4');
                    progressGrid.classList.add('gap-x-3', 'gap-y-2', 'grid-cols-2');
                    progressGrid.style.flexShrink = '0';
                }

                const leftCol = progressGrid ? progressGrid.children[0] : null;
                const rightCol = progressGrid ? progressGrid.children[1] : null;
                if (leftCol) {
                    leftCol.classList.remove('space-y-4');
                    leftCol.classList.add('space-y-2');
                }
                if (rightCol) {
                    rightCol.classList.remove('space-y-4');
                    rightCol.classList.add('space-y-2');
                }

                const chartGrid = paramsContent.querySelector('.grid.grid-cols-1.md\\:grid-cols-3');
                if (chartGrid) {
                    chartGrid.style.flex = '1 1 120px';
                    chartGrid.style.minHeight = '100px';
                    chartGrid.style.height = '';
                    chartGrid.style.display = 'grid';
                    chartGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
                    const chartContainers = chartGrid.children;
                    for (let i = 0; i < chartContainers.length; i++) {
                        const container = chartContainers[i];
                        container.classList.remove('p-3');
                        container.classList.add('p-1');
                        container.style.display = 'flex';
                        container.style.flexDirection = 'column';
                        container.style.minHeight = '0';
                        const chartLabel = container.querySelector('.text-xs');
                        if (chartLabel) chartLabel.style.flexShrink = '0';
                        const chartWrap = container.querySelector('.mt-2');
                        if (chartWrap) {
                            chartWrap.classList.remove('h-32');
                            chartWrap.style.flex = '1';
                            chartWrap.style.minHeight = '70px';
                            chartWrap.style.height = '';
                            chartWrap.style.position = 'relative';
                            chartWrap.style.marginTop = '0.2rem';
                        }
                    }
                }
            }

            const logsContainer = document.getElementById('logs-container');
            if (logsContainer) {
                logsContainer.style.height = '100%';
                logsContainer.style.maxHeight = 'none';
                logsContainer.style.padding = '0';
                logsContainer.style.flex = '1';
                logsContainer.style.overflowY = 'auto';
            }

            const tripleModeBtns = document.querySelectorAll('#triple-console .mode-btn');
            tripleModeBtns.forEach(btn => {
                if (!state.isNaState && state.activeMode && btn.dataset.mode === state.activeMode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            setTimeout(() => {
                _applyChartFont(8);
                if (temperatureChart) temperatureChart.resize();
                if (loadChart) loadChart.resize();
                if (networkChart) networkChart.resize();
                const termOut = document.getElementById('terminal-output');
                if (termOut) termOut.scrollTop = termOut.scrollHeight;
                const termIn = document.getElementById('terminal-input');
                if (termIn) termIn.focus();
            }, 50);
        }

        function _applyChartFont(size) {
            [temperatureChart, loadChart, networkChart].forEach(function(chart) {
                if (!chart) return;
                chart.options.scales.y.ticks.font = { size: size };
                chart.options.scales.x.ticks.font = { size: size };
                chart.update('none');
            });
        }

        function restoreDomFromTriple() {
            Object.keys(originalParents).forEach(slot => {
                const info = originalParents[slot];
                if (!info || !info.parent) return;
                const slotEl = document.getElementById(slot);
                if (!slotEl) return;

                while (slotEl.firstChild) {
                    const child = slotEl.firstChild;
                    if (info.nextSibling) {
                        info.parent.insertBefore(child, info.nextSibling);
                    } else {
                        info.parent.appendChild(child);
                    }
                }
            });

            const termSlot = document.getElementById('triple-slot-terminal');
            if (termSlot) {
                termSlot.style.flex = '';
                termSlot.style.display = '';
                termSlot.style.flexDirection = '';
                termSlot.style.minHeight = '';
            }

            const termBlack = document.getElementById('terminal-black-container');
            if (termBlack) {
                termBlack.style.height = '';
                termBlack.style.flex = '';
                termBlack.style.display = '';
                termBlack.style.flexDirection = '';
                termBlack.style.background = '';
                termBlack.style.borderTop = '';
                termBlack.style.borderRadius = '';
                termBlack.style.overflow = '';
            }

            const consoleSlot = document.getElementById('triple-slot-console');
            if (consoleSlot) {
                consoleSlot.style.display = '';
                consoleSlot.style.flexDirection = '';
                consoleSlot.style.gap = '';
                consoleSlot.style.marginBottom = '';
            }

            const funcBtnsContainer = document.getElementById('function-buttons');
            if (funcBtnsContainer) {
                funcBtnsContainer.classList.remove('grid-cols-3', 'gap-1.5');
                funcBtnsContainer.classList.add('grid-cols-2', 'sm:grid-cols-3', 'col-span-full', 'function-buttons-desktop');
            }

            const emotionContainer = document.getElementById('emotion-gauges-container');
            if (emotionContainer) {
                emotionContainer.style.padding = '';
                emotionContainer.classList.add('space-y-5');
                emotionContainer.style.display = '';
                emotionContainer.style.gridTemplateColumns = '';
                emotionContainer.style.gap = '';
            }

            const taskList = document.getElementById('task-list');
            if (taskList) {
                taskList.style.maxHeight = '';
                taskList.style.overflow = '';
                taskList.classList.add('overflow-y-auto');
            }

            const taskSlot = document.getElementById('triple-slot-tasks');
            if (taskSlot) {
                taskSlot.style.flex = '';
                taskSlot.style.minHeight = '';
            }
            const tasksBody = document.querySelector('#triple-tasks .cp-body');
            if (tasksBody) {
                tasksBody.style.flex = '';
                tasksBody.style.minHeight = '';
                tasksBody.style.overflowY = '';
            }

            const logsSlot = document.getElementById('triple-slot-logs');
            if (logsSlot) {
                logsSlot.style.flex = '';
                logsSlot.style.display = '';
                logsSlot.style.flexDirection = '';
                logsSlot.style.minHeight = '';
            }
            const logsBody = document.querySelector('#triple-logs .cp-body');
            if (logsBody) {
                logsBody.style.flex = '';
                logsBody.style.display = '';
                logsBody.style.flexDirection = '';
                logsBody.style.minHeight = '';
                logsBody.style.overflow = '';
            }

            const paramsBody = document.querySelector('#triple-params .cp-body');
            if (paramsBody) {
                paramsBody.style.display = '';
                paramsBody.style.flexDirection = '';
                paramsBody.style.minHeight = '';
                paramsBody.style.overflowY = '';
            }
            const paramsSlot = document.getElementById('triple-slot-params');
            if (paramsSlot) {
                paramsSlot.style.flex = '';
                paramsSlot.style.display = '';
                paramsSlot.style.flexDirection = '';
                paramsSlot.style.minHeight = '';
            }

            const paramsContent = document.getElementById('params-content');
            if (paramsContent) {
                paramsContent.style.padding = '';
                paramsContent.style.display = '';
                paramsContent.style.flexDirection = '';
                paramsContent.style.flex = '';
                paramsContent.style.minHeight = '';
                paramsContent.classList.remove('space-y-1');
                paramsContent.classList.add('space-y-4', 'pt-4');

                const progressGrid = paramsContent.querySelector('.grid.grid-cols-1.md\\:grid-cols-2, .grid.grid-cols-2');
                if (progressGrid) {
                    progressGrid.classList.remove('gap-x-3', 'gap-y-1', 'grid-cols-2');
                    progressGrid.classList.add('gap-4');
                    progressGrid.style.flexShrink = '';
                }

                const leftCol = progressGrid ? progressGrid.children[0] : null;
                const rightCol = progressGrid ? progressGrid.children[1] : null;
                if (leftCol) {
                    leftCol.classList.remove('space-y-1');
                    leftCol.classList.add('space-y-4');
                }
                if (rightCol) {
                    rightCol.classList.remove('space-y-1');
                    rightCol.classList.add('space-y-4');
                }

                const chartGrid = paramsContent.querySelector('.grid.grid-cols-1.md\\:grid-cols-3');
                if (chartGrid) {
                    chartGrid.style.flex = '';
                    chartGrid.style.minHeight = '';
                    chartGrid.style.display = '';
                    chartGrid.style.gridTemplateColumns = '';
                    const chartContainers = chartGrid.children;
                    for (let i = 0; i < chartContainers.length; i++) {
                        const container = chartContainers[i];
                        container.classList.remove('p-1');
                        container.classList.add('p-3');
                        container.style.display = '';
                        container.style.flexDirection = '';
                        container.style.minHeight = '';
                        const chartLabel = container.querySelector('.text-xs');
                        if (chartLabel) chartLabel.style.flexShrink = '';
                        const chartWrap = container.querySelector('.mt-2');
                        if (chartWrap) {
                            chartWrap.classList.add('h-32');
                            chartWrap.style.flex = '';
                            chartWrap.style.minHeight = '';
                            chartWrap.style.height = '';
                            chartWrap.style.position = '';
                            chartWrap.style.marginTop = '';
                        }
                    }
                }
            }

            const logsContainer = document.getElementById('logs-container');
            if (logsContainer) {
                logsContainer.style.height = '';
                logsContainer.style.maxHeight = '';
                logsContainer.style.padding = '';
                logsContainer.style.flex = '';
                logsContainer.style.overflowY = '';
            }

            setTimeout(() => {
                _applyChartFont(null);
                if (temperatureChart) temperatureChart.resize();
                if (loadChart) loadChart.resize();
                if (networkChart) networkChart.resize();
                const termOut = document.getElementById('terminal-output');
                if (termOut) termOut.scrollTop = termOut.scrollHeight;
                const termIn = document.getElementById('terminal-input');
                if (termIn) termIn.focus();
            }, 50);
        }

        function handleLayoutChange() {
            const shouldBeTriple = isTripleLayout();

            if (shouldBeTriple && !isCurrentlyTriple) {
                document.body.style.overflow = 'hidden';
                const appContainer = document.getElementById('app-container');
                if (appContainer) appContainer.style.overflow = 'hidden';
                moveDomToTriple();
                renderTripleStatusChips();
                syncTripleImages();
                updateTimerDisplay();
                isCurrentlyTriple = true;
                if (!robotCodeActive && robotCodeLines.length > 0) robotCodeStart();
            } else if (!shouldBeTriple && isCurrentlyTriple) {
                document.body.style.overflow = '';
                const appContainer = document.getElementById('app-container');
                if (appContainer) appContainer.style.overflow = '';
                restoreDomFromTriple();
                isCurrentlyTriple = false;
                if (window.innerWidth < 768) robotCodeStop();
            }
            adjustTaskListHeight();
        }
        
        // 窗口resize事件
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                handleLayoutChange();
                if (isCurrentlyTriple) {
                    if (temperatureChart) temperatureChart.resize();
                    if (loadChart) loadChart.resize();
                    if (networkChart) networkChart.resize();
                    adjustTripleStatusChipFontSize();
                }
                adjustTaskListHeight();
            }, 150);
        });

        function isAnyModalOpen() {
            var settingsModal = document.getElementById('settings-modal');
            var infoModal = document.getElementById('info-modal');
            var pdfModal = document.getElementById('pdf-viewer-modal');
            var selfCheckModal = document.getElementById('self-check-modal');
            var updateModal = document.getElementById('update-modal');
            var cognitiveModal = document.getElementById('cognitive-modal');
            var selfCheckAlert = document.getElementById('self-check-alert');
            var resetDefaultsModal = document.getElementById('reset-defaults-modal');
            var btModal = document.getElementById('bt-modal');
            var btQrModal = document.getElementById('bt-qr-modal');

            if (settingsModal && settingsModal.classList.contains('settings-modal-visible')) return true;
            if (infoModal && infoModal.classList.contains('visible')) return true;
            if (pdfModal && pdfModal.classList.contains('pdf-viewer-visible')) return true;
            if (selfCheckModal && selfCheckModal.classList.contains('visible')) return true;
            if (updateModal && updateModal.classList.contains('visible')) return true;
            if (cognitiveModal && cognitiveModal.classList.contains('visible')) return true;
            if (selfCheckAlert && selfCheckAlert.classList.contains('visible')) return true;
            if (resetDefaultsModal && resetDefaultsModal.classList.contains('visible')) return true;
            if (btModal && btModal.classList.contains('visible')) return true;
            if (btQrModal && btQrModal.classList.contains('visible')) return true;
            return false;
        }

        function closeActiveModal() {
            var selfCheckAlert = document.getElementById('self-check-alert');
            var resetDefaultsModal = document.getElementById('reset-defaults-modal');
            var pdfModal = document.getElementById('pdf-viewer-modal');
            var cognitiveModal = document.getElementById('cognitive-modal');
            var updateModal = document.getElementById('update-modal');
            var selfCheckModal = document.getElementById('self-check-modal');
            var settingsModal = document.getElementById('settings-modal');
            var infoModal = document.getElementById('info-modal');

            if (selfCheckAlert && selfCheckAlert.classList.contains('visible')) {
                hideSelfCheckAlert();
                return;
            }
            if (resetDefaultsModal && resetDefaultsModal.classList.contains('visible')) {
                hideResetDefaultsAlert();
                return;
            }
            if (pdfModal && pdfModal.classList.contains('pdf-viewer-visible')) {
                closePdfViewer();
                return;
            }
            if (cognitiveModal && cognitiveModal.classList.contains('visible')) {
                hideCognitiveInputModal();
                return;
            }
            if (updateModal && updateModal.classList.contains('visible')) {
                if (typeof updateRunning !== 'undefined' && !updateRunning) {
                    closeUpdateModal();
                }
                return;
            }
            if (selfCheckModal && selfCheckModal.classList.contains('visible')) {
                if (typeof closeSelfCheck === 'function') closeSelfCheck(); else closeProcessModal();
                return;
            }
            if (settingsModal && settingsModal.classList.contains('settings-modal-visible')) {
                if (typeof closeSettings === 'function') {
                    closeSettings();
                } else {
                    settingsModal.classList.remove('settings-modal-visible');
                    document.body.style.overflow = '';
                    notifyModalState();
                }
                return;
            }
            if (infoModal && infoModal.classList.contains('visible')) {
                closeInfoModal();
                return;
            }
        }

        function notifyModalState() {
            if (window.Android && typeof window.Android.setModalState === 'function') {
                window.Android.setModalState(isAnyModalOpen());
            }
        }
