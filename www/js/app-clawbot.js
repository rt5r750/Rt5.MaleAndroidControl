/* =============================================================
   Clawbot 通知推送与斜杠指令查询（v1.12.0）
   - 推送：语音播报内容 → 「主人指令：」+内容；实时数据修改 → 「数据变更：」+内容
     （EN 模式前缀与内容随 master 端语言设置翻成英文）
   - 反向：Telegram getUpdates 长轮询 / 飞书应用消息轮询，斜杠指令本地解析
     直接回复参数（0 token：全程不调用任何 LLM）
   - 空白指令（空串/单独「/」）不支持、直接忽略；回复语言=当前界面语言，
     模式名等文案取实际设置值（自定义名原样）
   - 平台：Telegram（需设备可达 api.telegram.org）+ 飞书（webhook 仅推送 /
     自建应用双向）；微信不做
   依赖 app-core.js 顶层全局（storage/state/modeDisplayName/getModelInfoSource 等），
   在其后加载；本文件只暴露 window.ClawbotBridge。
   ============================================================= */
(function () {
    'use strict';

    var CFG_KEY = 'robotClawbotConfig';
    var TG_OFFSET_KEY = 'robotClawbotTgOffset';
    var FS_LAST_KEY = 'robotClawbotFsLast';
    var PUSH_MIN_INTERVAL_MS = 1000;   // 队列发送间隔，防平台限流（飞书 webhook 5 次/秒）
    var MSG_MAX_LEN = 3500;            // Telegram 上限 4096，留余量
    var ALLOW_HOSTS = ['api.telegram.org', 'open.feishu.cn'];

    var DEFAULT_CONFIG = {
        cmdPush: true,
        dataPush: true,
        queryEnabled: true,
        telegram: { enabled: false, botToken: '', chatId: '' },
        feishu: { enabled: false, mode: 'webhook', webhookUrl: '', appId: '', appSecret: '', chatId: '' }
    };

    /* ---------- 小工具 ---------- */
    function lang() {
        return (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : 'zh';
    }
    function t(zh, en) { return lang() === 'en' ? en : zh; }
    function trim(s) { return String(s == null ? '' : s).trim(); }
    function readJson(key, dflt) {
        try {
            var raw = localStorage.getItem(key);
            return raw == null ? dflt : JSON.parse(raw);
        } catch (e) { return dflt; }
    }
    function writeJson(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
    function hostAllowed(url) {
        try {
            var h = new URL(String(url)).hostname;
            return ALLOW_HOSTS.indexOf(h) !== -1;
        } catch (e) { return false; }
    }
    function clipText(text) {
        var s = String(text == null ? '' : text);
        return s.length > MSG_MAX_LEN ? s.slice(0, MSG_MAX_LEN - 1) + '…' : s;
    }

    /* ---------- 配置 ---------- */
    function getConfig() {
        var saved = readJson(CFG_KEY, null);
        if (!saved || typeof saved !== 'object') return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        var cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        if (typeof saved.cmdPush === 'boolean') cfg.cmdPush = saved.cmdPush;
        if (typeof saved.dataPush === 'boolean') cfg.dataPush = saved.dataPush;
        if (typeof saved.queryEnabled === 'boolean') cfg.queryEnabled = saved.queryEnabled;
        ['telegram', 'feishu'].forEach(function (p) {
            if (saved[p] && typeof saved[p] === 'object') {
                Object.keys(cfg[p]).forEach(function (k) {
                    if (typeof saved[p][k] === typeof cfg[p][k] && saved[p][k] != null) cfg[p][k] = saved[p][k];
                });
            }
        });
        return cfg;
    }
    function setConfig(cfg) {
        writeJson(CFG_KEY, cfg);
        restartPolling();
        syncActivationStatus();
    }
    /* 校验并规范化：返回 null=通过，否则返回错误提示（按界面语言） */
    function validateConfig(cfg) {
        var tg = cfg.telegram, fs = cfg.feishu;
        if (tg.enabled) {
            if (!trim(tg.botToken)) return t('Telegram 已启用：Bot Token 不能为空', 'Telegram enabled: Bot Token must not be blank');
            if (!trim(tg.chatId)) return t('Telegram 已启用：Chat ID 不能为空', 'Telegram enabled: Chat ID must not be blank');
        }
        if (fs.enabled) {
            if (fs.mode === 'webhook') {
                var url = trim(fs.webhookUrl);
                if (!url) return t('飞书已启用：Webhook URL 不能为空', 'Feishu enabled: Webhook URL must not be blank');
                if (!/^https:\/\/open\.feishu\.cn\//i.test(url)) return t('飞书 Webhook URL 需以 https://open.feishu.cn/ 开头', 'Feishu Webhook URL must start with https://open.feishu.cn/');
            } else {
                if (!trim(fs.appId)) return t('飞书已启用（自建应用）：App ID 不能为空', 'Feishu enabled (custom app): App ID must not be blank');
                if (!trim(fs.appSecret)) return t('飞书已启用（自建应用）：App Secret 不能为空', 'Feishu enabled (custom app): App Secret must not be blank');
                if (!trim(fs.chatId)) return t('飞书已启用（自建应用）：Chat ID 不能为空', 'Feishu enabled (custom app): Chat ID must not be blank');
            }
        }
        return null;
    }

    /* ---------- 通用 HTTP（三路：fetch → 原生桥 httpFetchAsync）----------
       原生桥（master-app WebView / win-app preload 同名暴露）只放行
       api.telegram.org 与 open.feishu.cn（防特权通道被滥用为任意请求代理）。
       原生协议仿 mimoFetchAsync：完成调 window.__httpFetchCallback(cbId) 通知，
       结果经 Android.getHttpFetchResult(cbId) 同步取回（避免大 JSON 注入转义问题）。
       返回 Promise<{status, text}>；网络层失败 reject。 */
    var _httpCbCounter = 0;
    function clawbotFetch(url, options) {
        options = options || {};
        var method = String(options.method || 'GET').toUpperCase();
        var headers = options.headers || {};
        var body = options.body || null;
        var direct = fetch(url, {
            method: method,
            headers: headers,
            body: body
        }).then(function (resp) {
            return resp.text().then(function (text) {
                return { status: resp.status, text: text };
            });
        });
        var nativeBridge = window.Android && typeof window.Android.httpFetchAsync === 'function' ? window.Android.httpFetchAsync : null;
        if (!nativeBridge) return direct;
        return direct.catch(function () {
            if (!hostAllowed(url)) {
                return Promise.reject(new Error('host not allowed for native bridge'));
            }
            return new Promise(function (resolve, reject) {
                var cbId = 'claw_' + (++_httpCbCounter) + '_' + Date.now();
                window.__httpFetchCallbacks = window.__httpFetchCallbacks || {};
                window.__httpFetchCallbacks[cbId] = { resolve: resolve, reject: reject };
                try {
                    nativeBridge(url, JSON.stringify({ method: method, headers: headers, body: body }), cbId);
                } catch (e) {
                    delete window.__httpFetchCallbacks[cbId];
                    reject(e);
                }
            });
        });
    }
    /* 原生桥完成回调（只带 cbId；结果同步取回） */
    window.__httpFetchCallback = function (cbId) {
        var cb = (window.__httpFetchCallbacks || {})[cbId];
        if (!cb) return;
        delete window.__httpFetchCallbacks[cbId];
        var resultJson = '';
        try {
            if (window.Android && typeof window.Android.getHttpFetchResult === 'function') {
                resultJson = window.Android.getHttpFetchResult(cbId);
            }
        } catch (e) { /* ignore */ }
        var data = null;
        try { data = JSON.parse(resultJson); } catch (e) { /* ignore */ }
        if (!data || typeof data.status !== 'number') {
            cb.reject(new Error((data && data.error) || 'native fetch failed'));
        } else {
            cb.resolve({ status: data.status, text: String(data.text == null ? '' : data.text) });
        }
    };

    /* ---------- Chat ID 规范化与解析（v1.12.1）----------
       用户常填 t.me/xxx、@xxx 或纯用户名（bot 链接/用户名不是会话 ID）：
       - 数字（含负号）直接用；
       - t.me 链接 / @用户名 / 纯名 → 规范化为 @xxx，经 getChat 解析为数字会话 ID；
       - 解析到的是机器人（is_bot）或 getChat 失败时给明确指引（私聊会话 ID 需先给 bot
         发送 /start 再用「自动获取」发现）；解析结果缓存，配置变化即失效。 */
    var _tgResolved = { raw: '', resolved: '' };
    function parseChatIdInput(raw) {
        var s = trim(raw);
        if (!s) return '';
        var m = s.match(/^(?:https?:\/\/)?t\.me\/(?:@)?([A-Za-z0-9_]{3,})\/?$/i);
        if (m) return '@' + m[1];
        if (/^[A-Za-z0-9_]{3,}$/.test(s) && !/^\d+$/.test(s)) return '@' + s;
        return s;
    }
    function resolveTgChatId(tg) {
        var input = parseChatIdInput(tg.chatId);
        if (/^-?\d+$/.test(input)) {
            _tgResolved = { raw: trim(tg.chatId), resolved: input };
            return Promise.resolve(input);
        }
        if (_tgResolved.raw === trim(tg.chatId) && _tgResolved.resolved) {
            return Promise.resolve(_tgResolved.resolved);
        }
        if (input.charAt(0) !== '@') {
            return Promise.reject(new Error(t('Chat ID 无法识别：请填数字会话 ID、@用户名或 t.me 链接', 'Unrecognized Chat ID: use a numeric chat id, @username or a t.me link')));
        }
        return clawbotFetch('https://api.telegram.org/bot' + trim(tg.botToken) + '/getChat?chat_id=' + encodeURIComponent(input), { method: 'GET' }).then(function (r) {
            var data = null;
            try { data = JSON.parse(r.text); } catch (e) { /* ignore */ }
            if (data && data.ok === true && data.result && typeof data.result.id === 'number') {
                var resolvedId = String(data.result.id);
                /* getChat 的 Chat 对象没有 is_bot 字段：识别"这是 bot 自己的用户名"改用
                   getMe 对比——token 前缀即 bot id，解析结果等于它就是发给了 bot 自己 */
                return clawbotFetch('https://api.telegram.org/bot' + trim(tg.botToken) + '/getMe', { method: 'GET' }).then(function (r2) {
                    var me = null;
                    try { me = JSON.parse(r2.text); } catch (e) { /* ignore */ }
                    var myId = (me && me.ok === true && me.result && me.result.id) ? String(me.result.id) : '';
                    if (myId && resolvedId === myId) {
                        throw new Error(t('这是 bot 自己的用户名，不能作为会话接收消息。请在 Telegram 给该 bot 发送 /start，然后点「自动获取」填入你的会话 ID',
                            'This is the bot\'s own username and cannot receive chat messages. Send /start to the bot in Telegram, then press "Auto detect" to fill your chat id'));
                    }
                    _tgResolved = { raw: trim(tg.chatId), resolved: resolvedId };
                    return resolvedId;
                });
            }
            var desc = (data && data.description) || '';
            throw new Error(t('无法解析 Chat ID ' + input + '：' + (desc || '请确认用户名，或改用数字会话 ID（给 bot 发送 /start 后点「自动获取」）'),
                'Cannot resolve Chat ID ' + input + ': ' + (desc || 'check the username, or use a numeric chat id (send /start to the bot and press "Auto detect")')));
        });
    }
    /* 「自动获取」：从 getUpdates 最近一条消息发现会话 ID（offset=-1 不消费历史） */
    function discoverTgChatId(tg, cb) {
        clawbotFetch('https://api.telegram.org/bot' + trim(tg.botToken) + '/getUpdates?offset=-1&limit=1', { method: 'GET' }).then(function (r) {
            var data = null;
            try { data = JSON.parse(r.text); } catch (e) { /* ignore */ }
            if (!data || data.ok !== true) {
                cb(null, t('查询失败：', 'Query failed: ') + ((data && data.description) || ('HTTP ' + r.status)));
                return;
            }
            var up = (data.result || [])[0];
            var msg = up && (up.message || up.edited_message);
            if (!msg || !msg.chat || typeof msg.chat.id !== 'number') {
                cb(null, t('暂未发现会话：请先在 Telegram 给该 bot 发送一条消息（如 /start），再点「自动获取」',
                    'No chat found yet: send a message (e.g. /start) to the bot in Telegram first, then press "Auto detect"'));
                return;
            }
            cb(String(msg.chat.id), null);
        }, function (err) {
            cb(null, t('网络错误：', 'Network error: ') + String(err && err.message || err));
        });
    }
    /* ---------- 首次连接绑定提示 ----------
       每平台+会话的首条出站消息前先发一条绑定提示（只发一次，落库记忆）：
       （完整型号）已被主人成功绑定，输入/help查看帮助，反查状态需要（主人名称）Master端在线。
       完整型号/主人名称取实际设置值并随界面语言；提示词本身按界面语言（EN 有独立译文）。 */
    var BOUND_KEY = 'robotClawbotBoundSent';
    function boundKey(platform, cfg) {
        return platform + '|' + (platform === 'telegram'
            ? trim(cfg.telegram.chatId)
            : (trim(cfg.feishu.webhookUrl) || trim(cfg.feishu.chatId)));
    }
    function bindNoticeText() {
        var full = safe(function () { return getModelInfo('fullName'); }, '');
        var master = safe(function () { return getModelInfo('master'); }, '');
        return t(full + '已被主人成功绑定，输入/help查看帮助，反查状态需要' + master + 'Master端在线。',
            full + ' has been successfully bound to its master. Send /help for help; status queries require ' + master + "'s Master console to be online.");
    }
    function withBindNotice(platform, cfg, sender, text) {
        var store = readJson(BOUND_KEY, {});
        var key = boundKey(platform, cfg);
        if (store[key]) return sender(text);
        store[key] = true;
        writeJson(BOUND_KEY, store);
        return sender(bindNoticeText()).then(function () {
            return sender(text);
        }, function (err) {
            var s2 = readJson(BOUND_KEY, {});
            delete s2[key];
            writeJson(BOUND_KEY, s2);
            throw err;
        });
    }

    /* ---------- 平台发送 ---------- */
    function tgSendRaw(cfg, text) {
        return resolveTgChatId(cfg).then(function (chatId) {
            return clawbotFetch('https://api.telegram.org/bot' + trim(cfg.botToken) + '/sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: clipText(text) })
            });
        }).then(function (r) {
            var ok = r.status === 200;
            var data = null;
            try { data = JSON.parse(r.text); } catch (e) { /* ignore */ }
            if (!ok || (data && data.ok === false)) {
                var desc = (data && data.description) || '';
                if (/chat not found/i.test(desc)) {
                    throw new Error(t('会话不存在：请确认 Chat ID，或在 Telegram 给该 bot 发送 /start 后点「自动获取」',
                        'Chat not found: check the Chat ID, or send /start to the bot in Telegram and press "Auto detect"'));
                }
                if (/unauthorized/i.test(desc) || r.status === 401) {
                    throw new Error(t('Bot Token 无效，请检查是否复制完整', 'Invalid Bot Token — check it was copied in full'));
                }
                throw new Error('Telegram sendMessage HTTP ' + r.status + ': ' + String(r.text).slice(0, 200));
            }
            return r;
        });
    }
    function tgSend(cfg, text) {
        return withBindNotice('telegram', cfg, function (msg) { return tgSendRaw(cfg, msg); }, text);
    }
    function fsWebhookSend(cfg, text) {
        return withBindNotice('feishu', cfg, function (msg) { return fsWebhookSendRaw(cfg, msg); }, text);
    }
    function fsWebhookSendRaw(cfg, text) {
        return clawbotFetch(trim(cfg.webhookUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msg_type: 'text', content: { text: clipText(text) } })
        }).then(function (r) {
            var data = null;
            try { data = JSON.parse(r.text); } catch (e) { /* ignore */ }
            if (r.status !== 200 || (data && (data.code || data.StatusCode))) {
                throw new Error('Feishu webhook HTTP ' + r.status + ': ' + String(r.text).slice(0, 200));
            }
            return r;
        });
    }
    var _fsTokenCache = { token: '', expireAt: 0 };
    function fsGetToken(cfg) {
        var now = Date.now();
        if (_fsTokenCache.token && _fsTokenCache.expireAt > now) {
            return Promise.resolve(_fsTokenCache.token);
        }
        return clawbotFetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_id: trim(cfg.appId), app_secret: trim(cfg.appSecret) })
        }).then(function (r) {
            var data = null;
            try { data = JSON.parse(r.text); } catch (e) { /* ignore */ }
            if (!data || data.code !== 0 || !data.tenant_access_token) {
                throw new Error('Feishu tenant_access_token failed: ' + String(r.text).slice(0, 200));
            }
            _fsTokenCache.token = data.tenant_access_token;
            _fsTokenCache.expireAt = now + Math.max(60, (data.expire || 7200) - 60) * 1000;
            return _fsTokenCache.token;
        });
    }
    function fsAppSend(cfg, text) {
        return withBindNotice('feishu', cfg, function (msg) { return fsAppSendRaw(cfg, msg); }, text);
    }
    function fsAppSendRaw(cfg, text) {
        return fsGetToken(cfg).then(function (token) {
            return clawbotFetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({
                    receive_id: trim(cfg.chatId),
                    msg_type: 'text',
                    content: JSON.stringify({ text: clipText(text) })
                })
            }).then(function (r) {
                var data = null;
                try { data = JSON.parse(r.text); } catch (e) { /* ignore */ }
                if (r.status === 401 || (data && data.code === 99991663)) {
                    _fsTokenCache = { token: '', expireAt: 0 };   // token 失效：清缓存重试一次
                    return fsAppSendRaw(cfg, text);
                }
                if (r.status !== 200 || (data && data.code !== 0)) {
                    throw new Error('Feishu sendMessage HTTP ' + r.status + ': ' + String(r.text).slice(0, 200));
                }
                return r;
            });
        });
    }

    /* ---------- 推送队列（每平台串行，≥1s 间隔，空白内容丢弃） ---------- */
    var _queues = { telegram: [], feishu: [] };
    var _queueBusy = { telegram: false, feishu: false };
    function enqueue(platform, text) {
        if (!trim(text)) return;                 // 空白指令/空白内容不支持推送
        _queues[platform].push(clipText(text));
        drainQueue(platform);
    }
    function drainQueue(platform) {
        if (_queueBusy[platform]) return;
        var cfg = getConfig();
        var q = _queues[platform];
        if (!q.length) return;
        var text = q.shift();
        var sender;
        if (platform === 'telegram') {
            if (!cfg.telegram.enabled || !trim(cfg.telegram.botToken)) { drainQueue(platform); return; }
            sender = tgSend(cfg.telegram, text);
        } else {
            if (!cfg.feishu.enabled) { drainQueue(platform); return; }
            sender = cfg.feishu.mode === 'webhook' ? fsWebhookSend(cfg.feishu, text) : fsAppSend(cfg.feishu, text);
        }
        _queueBusy[platform] = true;
        sender.then(function () { /* sent */ }, function (err) {
            try { console.warn('[Clawbot] push failed (' + platform + '):', err && err.message); } catch (e) { /* ignore */ }
        }).then(function () {
            setTimeout(function () {
                _queueBusy[platform] = false;
                drainQueue(platform);
            }, PUSH_MIN_INTERVAL_MS);
        });
    }

    /* ---------- 推送出口 ---------- */
    function push(kind, text) {
        var cfg = getConfig();
        if (!trim(text)) return;
        if (kind === 'cmd' && !cfg.cmdPush) return;
        if (kind === 'data' && !cfg.dataPush) return;
        var prefix = kind === 'data'
            ? t('数据变更：', 'Data Change: ')
            : t('主人指令：', "Master's Command: ");
        var msg = prefix + String(text);
        if (cfg.telegram.enabled) enqueue('telegram', msg);
        if (cfg.feishu.enabled) enqueue('feishu', msg);
    }

    /* ---------- 设置变更摘要（data 类） ---------- */
    /* 保存前后快照对比 → 变更行（类别：旧 → 新）；无变更返回空串 */
    function settingsDiffLines(before, after) {
        var lines = [];
        function add(name, a, b) {
            var sa = JSON.stringify(a == null ? '' : a);
            var sb = JSON.stringify(b == null ? '' : b);
            if (sa !== sb) lines.push(name + '：' + shortVal(a) + ' → ' + shortVal(b));
        }
        function shortVal(v) {
            if (v == null || v === '') return t('（空）', '(empty)');
            var s = typeof v === 'string' ? v : JSON.stringify(v);
            return s.length > 40 ? s.slice(0, 40) + '…' : s;
        }
        var CAT = {
            modeNames: t('模式名称', 'Mode names'),
            buttonTexts: t('控制按钮文本', 'Button texts'),
            statusItems: t('信息参数', 'Info params'),
            modelInfo: t('型号信息', 'Model info'),
            infoLinks: t('信息面板链接', 'Info links'),
            accounts: t('账号管理', 'Accounts'),
            emotions: t('情绪参数', 'Emotions')
        };
        Object.keys(CAT).forEach(function (k) {
            var name = CAT[k];
            var a = before ? before[k] : null;
            var b = after ? after[k] : null;
            if (k === 'emotions' && a && b) {
                ['obedience', 'shame', 'pleasure', 'mechanical'].forEach(function (f) {
                    add(t('情绪参数', 'Emotions') + '.' + f, a[f], b[f]);
                });
                return;
            }
            add(name, a, b);
        });
        return lines;
    }
    function pushSettingsDiff(before, after) {
        var lines = settingsDiffLines(before, after);
        if (!lines.length) return;
        push('data', lines.join('\n'));
    }

    /* ---------- 充电状态切换推送（data 类）----------
       运行参数本身不推送（与不推给 slave 端同口径），仅充电状态切换推送；
       首次建立基线不推，此后开始/停止充电各推一条。 */
    var _lastChargingNotified;
    function notifyChargingChange(charging) {
        var c = !!charging;
        if (_lastChargingNotified === undefined) { _lastChargingNotified = c; return; }
        if (_lastChargingNotified === c) return;
        _lastChargingNotified = c;
        push('data', t(c ? '开始充电' : '停止充电', c ? 'Charging started' : 'Charging stopped'));
    }

    /* ---------- 斜杠指令查询（0 token 本地解析） ---------- */
    var COMMANDS = [
        { name: 'help', zh: '查看指令列表', en: 'List commands' },
        { name: 'query', zh: '查询全部参数', en: 'Query all parameters' },
        { name: 'mode', zh: '查询当前模式与模式名称', en: 'Query current mode & mode names' },
        { name: 'emotion', zh: '查询情绪参数', en: 'Query emotion parameters' },
        { name: 'runtime', zh: '查询运行参数', en: 'Query runtime parameters' },
        { name: 'tasks', zh: '查询任务列表', en: 'Query task list' },
        { name: 'model', zh: '查询型号信息', en: 'Query model info' },
        { name: 'status', zh: '查询信息参数', en: 'Query info parameters' },
        { name: 'buttons', zh: '查询控制按钮文本', en: 'Query button texts' },
        { name: 'links', zh: '查询信息面板链接', en: 'Query info panel links' }
    ];

    function safe(fn, dflt) {
        try { return fn(); } catch (e) { return dflt; }
    }
    function modeNameOf(id) {
        /* 模式文案「由实际设置决定」：自定义名原样；未自定义（空=默认）按当前语言
           直接查词典（绕过保护集——保护集在自定义时会整组注册，把默认名也挡成中文，
           但回复要求语言跟随 master 端设置） */
        return safe(function () {
            var saved = storage.getModeNames() || {};
            var custom = (saved[id] == null ? '' : String(saved[id])).trim();
            if (custom) return custom;
            var zh = (typeof MODES !== 'undefined' && MODES[id]) ? MODES[id].name : id;
            if (lang() === 'en' && window.I18N && window.I18N.DICT && window.I18N.DICT[zh]) return window.I18N.DICT[zh];
            return zh;
        }, id);
    }
    function currentModeId() {
        return safe(function () { return state.activeMode; }, null);
    }
    function modelVal(key) {
        return safe(function () { return getModelInfoSource(key); }, '');
    }

    function buildHelp() {
        var lines = [t('Clawbot 查询指令（0 token 本地回复）：', 'Clawbot query commands (0-token local replies):')];
        COMMANDS.forEach(function (c) {
            lines.push('/' + c.name + ' — ' + t(c.zh, c.en));
        });
        lines.push(t('空白指令不支持；回复语言跟随控制台语言设置。', 'Blank commands are ignored; replies follow the console language.'));
        return lines.join('\n');
    }
    function buildModeReply() {
        var cur = currentModeId();
        var lines = [t('当前模式：', 'Current mode: ') + (cur == null ? t('（未设置）', '(not set)') : modeNameOf(cur))];
        lines.push(t('模式名称设置：', 'Mode names: '));
        safe(function () {
            Object.keys(MODES).forEach(function (id) {
                lines.push('- ' + modeNameOf(id));
            });
        }, null);
        return lines.join('\n');
    }
    function buildEmotionReply() {
        var em = safe(function () { return storage.getEmotions(); }, {}) || {};
        return [
            t('情绪参数：', 'Emotion parameters: '),
            t('服从度', 'Obedience') + '：' + (em.obedience || 0),
            t('羞耻度', 'Shame') + '：' + (em.shame || 0),
            t('愉悦度', 'Pleasure') + '：' + (em.pleasure || 0),
            t('机械度', 'Robotic') + '：' + (em.mechanical || 0)
        ].join('\n');
    }
    function buildRuntimeReply() {
        var rp = safe(function () { return state.runtimeParams; }, null) || safe(function () { return storage.get(storage.KEYS.RUNTIME_PARAMS, null); }, null) || {};
        var battery = rp.batteryAuto
            ? t('自动（01:00-07:00 充电计划）', 'Auto (01:00-07:00 charging plan)')
            : (rp.batteryPercentage + '%' + (rp.isCharging ? t('（正在充电）', ' (charging)') : ''));
        return [
            t('运行参数：', 'Runtime parameters: '),
            t('剩余仿真精液', 'Artificial semen') + '：' + (rp.liquidCurrent != null ? rp.liquidCurrent : '?') + ' / ' + (rp.liquidTotal != null ? rp.liquidTotal : '?') + ' mL',
            t('剩余电量', 'Battery') + '：' + battery,
            t('剩余存储', 'Storage') + '：' + (rp.storageUsed != null ? rp.storageUsed : '?') + ' / ' + (rp.storageTotal != null ? rp.storageTotal : '?') + ' EB'
        ].join('\n');
    }
    function buildTasksReply() {
        var tasks = safe(function () { return storage.getTasks(); }, []) || [];
        if (!tasks.length) return t('任务列表：当前无任务', 'Tasks: none');
        var lines = [t('任务列表（', 'Tasks (') + tasks.length + t('）：', '): ')];
        tasks.forEach(function (tk) {
            lines.push('- ' + (tk.name || '?') + ' [' + (tk.status === 'done' ? t('已完成', 'done') : t('进行中', 'pending')) + ']');
        });
        return lines.join('\n');
    }
    function buildModelReply() {
        return [
            t('型号信息：', 'Model info: '),
            t('完整型号', 'Full model') + '：' + modelVal('fullName'),
            t('简称', 'Short name') + '：' + modelVal('shortName'),
            t('制造公司', 'Manufacturer') + '：' + modelVal('company'),
            t('主人', 'Master') + '：' + modelVal('master'),
            t('语音播报读法', 'TTS reading') + '：' + modelVal('ttsReading')
        ].join('\n');
    }
    function buildStatusReply() {
        var items = safe(function () { return storage.getStatusItems(); }, []) || [];
        var lines = [t('信息参数：', 'Info parameters: ')];
        items.forEach(function (it) { lines.push('- ' + it.label + '：' + it.value); });
        return lines.join('\n');
    }
    function buildButtonsReply() {
        var texts = safe(function () { return storage.getButtonTexts(); }, []) || [];
        var lines = [t('控制按钮文本：', 'Control button texts: ')];
        texts.forEach(function (tx, i) { lines.push('- ' + (i + 1) + '. ' + tx); });
        return lines.join('\n');
    }
    function buildLinksReply() {
        var links = safe(function () { return storage.getInfoLinks(); }, null);
        var lines = [t('信息面板链接：', 'Info panel links: ')];
        if (!links) {
            safe(function () {
                FILES.forEach(function (f) {
                    if (f.url) lines.push('- ' + f.name + '：' + f.url);
                });
            }, null);
            if (lines.length === 1) lines.push(t('（全部默认）', '(all defaults)'));
            return lines.join('\n');
        }
        links.forEach(function (lk) { lines.push('- ' + (lk.name || lk.id) + '：' + (lk.url || t('（默认）', '(default)'))); });
        return lines.join('\n');
    }
    function buildQueryReply() {
        /* 全量摘要：账号密码与 API Key 只回「已设置/未设置」，凭据永不回显 */
        var accounts = safe(function () { return storage.get(storage.KEYS.ACCOUNTS, []); }, []) || [];
        var mimoKey = safe(function () { return storage.get(storage.KEYS.MIMO_API_KEY, ''); }, '') || '';
        var cfg = getConfig();
        var yes = t('已设置', 'set'), no = t('未设置', 'not set');
        return [
            t('—— 当前机器人参数 ——', '—— Current Android parameters ——'),
            buildModeReply(),
            buildEmotionReply(),
            buildRuntimeReply(),
            buildTasksReply(),
            buildModelReply(),
            buildStatusReply(),
            buildButtonsReply(),
            buildLinksReply(),
            t('账号', 'Accounts') + '：' + accounts.length + t(' 个（密码', ' (password ') + yes + '/' + no + '）',
            t('MiMo API Key', 'MiMo API Key') + '：' + (trim(mimoKey) ? yes : no),
            t('界面语言', 'UI language') + '：' + (lang() === 'en' ? 'English' : '中文'),
            t('通知推送', 'Notify push') + '：Telegram ' + (cfg.telegram.enabled ? t('已启用', 'on') : t('未启用', 'off')) +
                ' / Feishu ' + (cfg.feishu.enabled ? t('已启用', 'on') : t('未启用', 'off'))
        ].join('\n');
    }

    function buildReply(cmd) {
        switch (cmd) {
            case 'help': return buildHelp();
            case 'query': return buildQueryReply();
            case 'mode': return buildModeReply();
            case 'emotion': return buildEmotionReply();
            case 'runtime': return buildRuntimeReply();
            case 'tasks': return buildTasksReply();
            case 'model': return buildModelReply();
            case 'status': return buildStatusReply();
            case 'buttons': return buildButtonsReply();
            case 'links': return buildLinksReply();
            default:
                return t('未知指令：', 'Unknown command: ') + '/' + cmd + '\n' + buildHelp();
        }
    }

    /* 斜杠指令入口：空白/非斜杠/单独「/」一律忽略（0 token，不产生任何 LLM 调用） */
    function handleCommand(text) {
        var raw = trim(text);
        if (!raw) return null;
        raw = raw.replace(/^@_user_\d+\s*/, '');       // 飞书 mention 前缀
        raw = raw.replace(/^@[A-Za-z0-9_]+\s*/, '');   // Telegram @botname 前缀
        if (raw.charAt(0) !== '/') return null;
        var cmd = raw.slice(1).split(/[\s@]/)[0].toLowerCase();
        if (!cmd) return null;                        // 单独「/」= 空白指令
        return buildReply(cmd);
    }

    /* ---------- 反向轮询 ----------
       代际 token：restartPolling 每次换代，旧循环链在回调处校验代际即退出——
       否则保存设置/大窗保存等多次重启会残留多个并行循环，同一条斜杠指令被
       多个循环消费并各回复一次（用户实测「反查回复发三遍」的根因）。 */
    var _tgPolling = false;
    var _fsPolling = false;
    var _tgPollTimer = null;
    var _fsPollTimer = null;
    var _pollGen = 0;

    function tgPollOnce(cfg) {
        var tg = cfg.telegram;
        return resolveTgChatId(tg).then(function (chatId) {
            var offset = readJson(TG_OFFSET_KEY, 0) || 0;
            var url = 'https://api.telegram.org/bot' + trim(tg.botToken) + '/getUpdates?timeout=25' + (offset ? '&offset=' + offset : '');
            return clawbotFetch(url, { method: 'GET' }).then(function (r) {
                var data = null;
                try { data = JSON.parse(r.text); } catch (e) { /* ignore */ }
                if (!data || data.ok !== true || !Array.isArray(data.result)) return;
                data.result.forEach(function (up) {
                    if (typeof up.update_id === 'number') {
                        offset = Math.max(offset, up.update_id + 1);
                    }
                    var msg = up.message || up.edited_message;
                    if (!msg || typeof msg.text !== 'string') return;
                    /* 只响应配置会话（防他人私聊 bot 查询） */
                    if (msg.chat && String(msg.chat.id) !== chatId) return;
                    var reply = handleCommand(msg.text);
                    if (reply) {
                        enqueue('telegram', reply);
                    }
                });
                if (offset) writeJson(TG_OFFSET_KEY, offset);
            });
        });
    }
    function tgPollLoop() {
        if (!_tgPolling) return;
        var gen = _pollGen;
        var cfg = getConfig();
        if (!cfg.telegram.enabled || !cfg.queryEnabled) { _tgPolling = false; return; }
        tgPollOnce(cfg).catch(function (err) {
            try { console.warn('[Clawbot] telegram poll:', err && err.message); } catch (e) { /* ignore */ }
        }).then(function () {
            if (!_tgPolling || gen !== _pollGen) return;
            _tgPollTimer = setTimeout(tgPollLoop, 1500);
        });
    }

    function fsPollOnce(cfg) {
        var fs = cfg.feishu;
        var lastTs = readJson(FS_LAST_KEY, 0) || 0;
        if (!lastTs) lastTs = Date.now() - 60000;
        return fsGetToken(fs).then(function (token) {
            var url = 'https://open.feishu.cn/open-apis/im/v1/messages?container_id_type=chat&container_id=' +
                encodeURIComponent(trim(fs.chatId)) + '&sort_type=ByCreateTimeAsc&page_size=20' +
                (lastTs ? '&start_time=' + Math.floor(lastTs / 1000) : '');
            return clawbotFetch(url, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + token }
            });
        }).then(function (r) {
            var data = null;
            try { data = JSON.parse(r.text); } catch (e) { /* ignore */ }
            if (!data || data.code !== 0 || !data.data || !Array.isArray(data.data.items)) return;
            var maxTs = lastTs;
            data.data.items.forEach(function (item) {
                var ts = parseInt(item.create_time, 10) || 0;
                if (ts > maxTs) maxTs = ts;
                if (ts <= lastTs) return;                                  // 去重：只处理新消息
                if (item.msg_type !== 'text') return;
                var senderType = item.sender && item.sender.sender_type;
                if (senderType && senderType !== 'user') return;           // 只处理用户消息（bot 自己的不回）
                var content = null;
                try { content = JSON.parse(item.body && item.body.content || '{}'); } catch (e) { /* ignore */ }
                var reply = handleCommand(content && content.text);
                if (reply) enqueue('feishu', reply);
            });
            if (maxTs > lastTs) writeJson(FS_LAST_KEY, maxTs);
        });
    }
    function fsPollLoop() {
        if (!_fsPolling) return;
        var gen = _pollGen;
        var cfg = getConfig();
        if (!cfg.feishu.enabled || cfg.feishu.mode !== 'app' || !cfg.queryEnabled) { _fsPolling = false; return; }
        fsPollOnce(cfg).catch(function (err) {
            try { console.warn('[Clawbot] feishu poll:', err && err.message); } catch (e) { /* ignore */ }
        }).then(function () {
            if (!_fsPolling || gen !== _pollGen) return;
            _fsPollTimer = setTimeout(fsPollLoop, 5000);
        });
    }

    function restartPolling() {
        var cfg = getConfig();
        _pollGen++;                       // 旧循环链在回调处因代际不符退出
        if (_tgPollTimer) { clearTimeout(_tgPollTimer); _tgPollTimer = null; }
        if (_fsPollTimer) { clearTimeout(_fsPollTimer); _fsPollTimer = null; }
        _tgPolling = false;
        _fsPolling = false;
        if (cfg.queryEnabled && cfg.telegram.enabled && trim(cfg.telegram.botToken)) {
            _tgPolling = true;
            tgPollLoop();
        }
        if (cfg.queryEnabled && cfg.feishu.enabled && cfg.feishu.mode === 'app' && trim(cfg.feishu.appId)) {
            _fsPolling = true;
            fsPollLoop();
        }
    }

    /* ---------- 测试发送 ---------- */
    function test(platform, cb) {
        var cfg = getConfig();
        var msg = t('主人指令：Clawbot 推送测试成功（0 token 链路就绪）',
            "Master's Command: Clawbot push test OK (0-token channel ready)");
        var p;
        if (platform === 'telegram') {
            if (!cfg.telegram.enabled) { cb(t('请先勾选启用 Telegram', 'Tick "Enable Telegram" first')); return; }
            p = tgSend(cfg.telegram, msg);
        } else {
            if (!cfg.feishu.enabled) { cb(t('请先勾选启用飞书', 'Tick "Enable Feishu" first')); return; }
            p = cfg.feishu.mode === 'webhook' ? fsWebhookSend(cfg.feishu, msg) : fsAppSend(cfg.feishu, msg);
        }
        p.then(function () { cb(null); }, function (err) { cb(String(err && err.message || err)); });
    }

    /* ---------- 表单（设置组与激活页大窗共用；prefix 区分实例） ---------- */
    function formHtml(prefix) {
        function id(name) { return prefix + 'clawbot-' + name; }
        return '' +
            '<div class="clawbot-form">' +
            '  <div class="clawbot-switch-row">' +
            '    <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="' + id('push-cmd') + '"><span>推送语音播报内容（主人指令：+内容）</span></label>' +
            '    <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="' + id('push-data') + '"><span>推送实时数据修改（数据变更：+内容）</span></label>' +
            '    <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="' + id('query-on') + '"><span>响应斜杠指令查询（0 token 本地回复）</span></label>' +
            '  </div>' +
            '  <div class="clawbot-platform">' +
            '    <div class="clawbot-platform-title">Telegram</div>' +
            '    <label class="flex items-center gap-2 text-sm mb-2"><input type="checkbox" id="' + id('tg-on') + '"><span>启用 Telegram</span></label>' +
            '    <div class="activation-row"><label>Bot Token</label><input type="text" id="' + id('tg-token') + '" class="setting-input" placeholder="123456789:AA...（@BotFather 获取）"></div>' +
            '    <div class="activation-row"><label>Chat ID</label><input type="text" id="' + id('tg-chat') + '" class="setting-input" placeholder="数字会话 ID / @用户名 / t.me 链接"></div>' +
            '    <div class="flex flex-wrap gap-2 mt-2">' +
            '      <button type="button" class="btn-add clawbot-discover-btn" data-clawbot-discover="telegram"><i class="fa fa-magnifying-glass mr-1"></i>自动获取会话 ID</button>' +
            '      <button type="button" class="btn-add clawbot-test-btn" data-clawbot-test="telegram"><i class="fa fa-paper-plane mr-1"></i>发送测试消息</button>' +
            '    </div>' +
            '    <p class="text-xs text-[#8fbc8f]/70 mt-1">先在 Telegram 给该 bot 发送 /start，再点「自动获取」填入你的会话 ID（不能填 bot 自己的用户名）。需设备网络可达 api.telegram.org（大陆网络通常需系统代理）；反向查询用 getUpdates 长轮询，无需公网 IP。</p>' +
            '  </div>' +
            '  <div class="clawbot-platform">' +
            '    <div class="clawbot-platform-title">飞书 / Feishu</div>' +
            '    <label class="flex items-center gap-2 text-sm mb-2"><input type="checkbox" id="' + id('fs-on') + '"><span>启用飞书</span></label>' +
            '    <div class="flex flex-wrap gap-3 mb-2 text-sm">' +
            '      <label class="flex items-center gap-1"><input type="radio" name="' + id('fs-mode') + '" value="webhook"><span>自定义机器人 Webhook（仅推送）</span></label>' +
            '      <label class="flex items-center gap-1"><input type="radio" name="' + id('fs-mode') + '" value="app"><span>自建应用（双向，支持斜杠指令）</span></label>' +
            '    </div>' +
            '    <div id="' + id('fs-webhook-wrap') + '"><div class="activation-row"><label>Webhook URL</label><input type="text" id="' + id('fs-webhook') + '" class="setting-input" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."></div></div>' +
            '    <div id="' + id('fs-app-wrap') + '"><div class="activation-row"><label>App ID</label><input type="text" id="' + id('fs-appid') + '" class="setting-input" placeholder="飞书开放平台 App ID"></div>' +
            '      <div class="activation-row"><label>App Secret</label><input type="password" id="' + id('fs-secret') + '" class="setting-input" placeholder="飞书开放平台 App Secret"></div>' +
            '      <div class="activation-row"><label>Chat ID</label><input type="text" id="' + id('fs-chat') + '" class="setting-input" placeholder="群 Chat ID（oc_...）"></div></div>' +
            '    <button type="button" class="btn-add clawbot-test-btn mt-2" data-clawbot-test="feishu"><i class="fa fa-paper-plane mr-1"></i>发送测试消息</button>' +
            '    <p class="text-xs text-[#8fbc8f]/70 mt-1">Webhook 模式只能推送、不能接收斜杠指令；双向需飞书开放平台自建应用（机器人能力 + im:message 权限）并把机器人拉进目标群。</p>' +
            '  </div>' +
            '  <div class="clawbot-help">' +
            '    <p class="text-xs text-[#8fbc8f]/70">支持的斜杠指令：/help /query /mode /emotion /runtime /tasks /model /status /buttons /links；空白指令不支持。回复语言跟随本控制台语言设置，模式名等文案取实际设置值；账号密码与 API Key 只回「已设置/未设置」。全部收发均为纯 API 直连，不经过任何大模型（0 token 消耗）。如果无法安装 Slave 端（例如 iOS 设备无法侧载），可以使用该方法将命令推送到 IM 软件。</p>' +
            '    <p class="text-xs text-[#8fbc8f]/70 mt-1">接入教程：<a href="https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot" target="_blank" rel="noopener noreferrer" class="underline hover:text-[#c0e4c0]">飞书官方 · 自定义机器人 ↗</a>、<a href="https://open.feishu.cn/document/client-docs/bot-v3/bot-overview" target="_blank" rel="noopener noreferrer" class="underline hover:text-[#c0e4c0]">飞书官方 · 机器人概览 ↗</a>、<a href="https://github.com/danshui-git/shuoming/blob/master/bot.md" target="_blank" rel="noopener noreferrer" class="underline hover:text-[#c0e4c0]">Telegram 教程（中文）↗</a>、<a href="https://core.telegram.org/bots/tutorial" target="_blank" rel="noopener noreferrer" class="underline hover:text-[#c0e4c0]">Telegram Tutorial (English) ↗</a></p>' +
            '    <p class="clawbot-test-status text-xs text-[#8fbc8f]/70 mt-1"></p>' +
            '  </div>' +
            '</div>';
    }

    function fillForm(prefix) {
        var cfg = getConfig();
        function el(name) { return document.getElementById(prefix + 'clawbot-' + name); }
        function set(idName, v) { var e = el(idName); if (e) e.value = v; }
        function chk(idName, v) { var e = el(idName); if (e) e.checked = !!v; }
        chk('push-cmd', cfg.cmdPush);
        chk('push-data', cfg.dataPush);
        chk('query-on', cfg.queryEnabled);
        chk('tg-on', cfg.telegram.enabled);
        set('tg-token', cfg.telegram.botToken);
        set('tg-chat', cfg.telegram.chatId);
        chk('fs-on', cfg.feishu.enabled);
        var modeEls = document.querySelectorAll('input[name="' + prefix + 'clawbot-fs-mode"]');
        modeEls.forEach(function (r) { r.checked = (r.value === cfg.feishu.mode); });
        set('fs-webhook', cfg.feishu.webhookUrl);
        set('fs-appid', cfg.feishu.appId);
        set('fs-secret', cfg.feishu.appSecret);
        set('fs-chat', cfg.feishu.chatId);
        updateFsModeVis(prefix);
    }

    function updateFsModeVis(prefix) {
        var sel = document.querySelector('input[name="' + prefix + 'clawbot-fs-mode"]:checked');
        var mode = sel ? sel.value : 'webhook';
        var wh = document.getElementById(prefix + 'clawbot-fs-webhook-wrap');
        var app = document.getElementById(prefix + 'clawbot-fs-app-wrap');
        if (wh) wh.style.display = mode === 'webhook' ? '' : 'none';
        if (app) app.style.display = mode === 'app' ? '' : 'none';
    }

    /* 读取表单 → 配置对象；表单未渲染返回 {skipped:true}，校验失败返回 {error} */
    function collectForm(prefix) {
        function el(name) { return document.getElementById(prefix + 'clawbot-' + name); }
        if (!el('push-cmd')) return { skipped: true };
        function val(name) { var e = el(name); return e ? trim(e.value) : ''; }
        function chk(name) { var e = el(name); return e ? !!e.checked : false; }
        var sel = document.querySelector('input[name="' + prefix + 'clawbot-fs-mode"]:checked');
        var cfg = {
            cmdPush: chk('push-cmd'),
            dataPush: chk('push-data'),
            queryEnabled: chk('query-on'),
            telegram: { enabled: chk('tg-on'), botToken: val('tg-token'), chatId: val('tg-chat') },
            feishu: {
                enabled: chk('fs-on'),
                mode: sel ? sel.value : 'webhook',
                webhookUrl: val('fs-webhook'),
                appId: val('fs-appid'),
                appSecret: val('fs-secret'),
                chatId: val('fs-chat')
            }
        };
        var err = validateConfig(cfg);
        if (err) return { error: err };
        return { config: cfg };
    }

    /* ---------- 激活页状态行同步 ---------- */
    function configSummary() {
        var cfg = getConfig();
        var on = [];
        if (cfg.telegram.enabled) on.push('Telegram');
        if (cfg.feishu.enabled) on.push(cfg.feishu.mode === 'app' ? '飞书（双向）' : '飞书（Webhook）');
        return on;
    }
    function syncActivationStatus() {
        var el = document.getElementById('clawbot-act-status');
        if (!el) return;
        var on = configSummary();
        el.textContent = on.length
            ? t('已配置：', 'Configured: ') + on.join(' / ')
            : t('未配置（可跳过，随时在设置中开启）', 'Not configured (optional — enable anytime in Settings)');
    }

    /* ---------- 大窗开关 ---------- */
    function openModal() {
        var modal = document.getElementById('clawbot-modal');
        if (!modal) return;
        var body = document.getElementById('clawbot-modal-body');
        if (body && !body.querySelector('.clawbot-form')) body.innerHTML = formHtml('act-');
        fillForm('act-');
        modal.classList.add('visible');
    }
    function closeModal() {
        var modal = document.getElementById('clawbot-modal');
        if (modal) modal.classList.remove('visible');
    }

    /* ---------- 初始化 ---------- */
    function init() {
        /* 设置组表单（静态组内容器） */
        var host = document.getElementById('clawbot-settings-body');
        if (host) {
            host.innerHTML = formHtml('set-');
            fillForm('set-');
        }
        syncActivationStatus();
        restartPolling();
        /* 激活页第 11 节「打开设置」与大窗按钮（大窗非必要项：取消/关闭不影响激活） */
        var openBtn = document.getElementById('clawbot-open-btn');
        if (openBtn) openBtn.addEventListener('click', openModal);
        ['clawbot-modal-close', 'clawbot-modal-cancel'].forEach(function (id) {
            var b = document.getElementById(id);
            if (b) b.addEventListener('click', closeModal);
        });
        var saveBtn = document.getElementById('clawbot-modal-save');
        if (saveBtn) saveBtn.addEventListener('click', function () {
            var collected = collectForm('act-');
            if (collected.error) { alert(collected.error); return; }
            setConfig(collected.config);
            closeModal();
        });
        /* 表单交互委托：飞书模式切换 + 测试发送（两实例通用） */
        document.addEventListener('change', function (e) {
            var target = e.target;
            if (target && target.name && /clawbot-fs-mode$/.test(target.name)) {
                var prefix = target.name.replace(/clawbot-fs-mode$/, '');
                updateFsModeVis(prefix);
            }
        });
        document.addEventListener('click', function (e) {
            var target = e.target && e.target.closest ? e.target : null;
            /* 「自动获取会话 ID」：getUpdates 发现最近消息的 chat.id 并回填 */
            var discBtn = target ? target.closest('.clawbot-discover-btn') : null;
            if (discBtn) {
                var discWrap = discBtn.closest('.clawbot-form');
                var discStatus = discWrap ? discWrap.querySelector('.clawbot-test-status') : null;
                var discProbe = discWrap ? discWrap.querySelector('input[id*="clawbot-"]') : null;
                var discPrefix = discProbe && discProbe.id.indexOf('act-') === 0 ? 'act-' : 'set-';
                var discCollected = collectForm(discPrefix);
                if (discCollected.error) {
                    if (discStatus) discStatus.textContent = discCollected.error;
                    else alert(discCollected.error);
                    return;
                }
                discBtn.disabled = true;
                if (discStatus) discStatus.textContent = t('正在获取…', 'Detecting…');
                var savedCfg = getConfig();
                setConfigSilent(discCollected.config);
                discoverTgChatId(discCollected.config.telegram, function (chatId, err) {
                    discBtn.disabled = false;
                    setConfigSilent(savedCfg);
                    var input = discWrap ? discWrap.querySelector('input[id$="clawbot-tg-chat"]') : null;
                    if (chatId) {
                        if (input) input.value = chatId;
                        if (discStatus) discStatus.textContent = t('已获取会话 ID：', 'Chat id detected: ') + chatId;
                    } else if (discStatus) {
                        discStatus.textContent = err || t('获取失败', 'Detection failed');
                    }
                });
                return;
            }
            var btn = target ? target.closest('.clawbot-test-btn') : null;
            if (!btn) return;
            var wrap = btn.closest('.clawbot-form');
            var statusEl = wrap ? wrap.querySelector('.clawbot-test-status') : null;
            var platform = btn.getAttribute('data-clawbot-test');
            /* 测试发送读取当前表单（含未保存内容）：临时套用副本后发送，不落库 */
            var probe = wrap ? wrap.querySelector('input[id*="clawbot-"]') : null;
            var prefix = probe && probe.id.indexOf('act-') === 0 ? 'act-' : 'set-';
            var collected = collectForm(prefix);
            if (collected.error) {
                if (statusEl) statusEl.textContent = collected.error;
                else alert(collected.error);
                return;
            }
            var saved = getConfig();
            setConfigSilent(collected.config);
            btn.disabled = true;
            if (statusEl) statusEl.textContent = t('发送中…', 'Sending…');
            test(platform, function (err) {
                btn.disabled = false;
                setConfigSilent(saved);
                if (statusEl) {
                    statusEl.textContent = err
                        ? t('发送失败：', 'Failed: ') + err
                        : t('测试消息已发送', 'Test message sent');
                }
            });
        });
    }
    function setConfigSilent(cfg) {
        try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.ClawbotBridge = {
        push: push,
        pushSettingsDiff: pushSettingsDiff,
        notifyChargingChange: notifyChargingChange,
        settingsDiffLines: settingsDiffLines,
        snapshotSettings: function () {
            return {
                modeNames: safe(function () { return storage.getModeNames(); }, null),
                buttonTexts: safe(function () { return storage.getButtonTexts(); }, null),
                statusItems: safe(function () { return storage.getStatusItems(); }, null),
                modelInfo: safe(function () { return storage.get(storage.KEYS.MODEL_INFO, null); }, null),
                infoLinks: safe(function () { return storage.get(storage.KEYS.INFO_LINKS, null); }, null),
                runtimeParams: safe(function () { return storage.get(storage.KEYS.RUNTIME_PARAMS, null); }, null),
                accounts: safe(function () { return storage.get(storage.KEYS.ACCOUNTS, null); }, null),
                emotions: safe(function () { return storage.getEmotions(); }, null)
            };
        },
        handleCommand: handleCommand,
        getConfig: getConfig,
        setConfig: setConfig,
        validateConfig: validateConfig,
        formHtml: formHtml,
        fillForm: fillForm,
        collectForm: collectForm,
        openModal: openModal,
        closeModal: closeModal,
        syncActivationStatus: syncActivationStatus,
        test: test
    };
})();
