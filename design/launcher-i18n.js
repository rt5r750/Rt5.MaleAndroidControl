/**
 * 启动器界面语言覆盖层（英语翻译测试）。
 * 默认中文；语言与主控制台 www 设置（robot_ui_lang）对齐，
 * 经 preload-launcher 的 electronAPI.getUiLang() 读取。
 * 中文源字符串不改动，仅在 EN 模式下替换显示文本（DOM 覆盖 + MutationObserver）。
 * 术语遵循 T31-750 说明书英文版。
 */
(function (global) {
    'use strict';
    var DICT = {
        '最小化': 'Minimize',
        '关闭': 'Close',
        'T31-750型仿人男性机器人': 'T31-750 Male Android',
        '系统初始化中': 'System initializing',
        '点击进入控制界面': 'Click to enter the console',
        '等待设备接入': 'Waiting for device',
        '请连接机器人USB设备': 'Please connect the robot USB device',
        '请在设置中配置USB设备规则': 'Please configure USB device rules in Settings',
        '模拟设备接入 (F2)': 'Simulate device connection (F2)',
        '测试模式': 'Test Mode',
        'USB设备设置': 'USB Device Settings',
        '设置': 'Settings',
        'USB 设备配置': 'USB Device Configuration',
        '配置需要识别的USB设备列表，支持多设备判断。未配置规则时不会自动连接；每条规则至少填写 VID、PID 或设备/磁盘 ID，留空字段不作为匹配条件。': 'Configure the list of USB devices to recognize; multiple devices supported. Auto-connect is disabled until rules are configured; each rule requires at least a VID, PID, or device/disk ID. Empty fields are ignored for matching.',
        '已检测到的 USB 设备': 'Detected USB Devices',
        '刷新列表': 'Refresh list',
        '+ 添加选中设备': '+ Add Selected Device',
        '+ 手动添加设备': '+ Add Device Manually',
        '取消': 'Cancel',
        '保存配置': 'Save Configuration',
        '正在进入控制台': 'Entering the console',
        '正在进入控制系统': 'Entering the control system',
        '设备名称': 'Device Name',
        '例: RT-5 主控': 'e.g. RT-5 Main Controller',
        '例: \\.\PHYSICALDRIVE1': 'e.g. \\.\PHYSICALDRIVE1',
        '设备/磁盘 ID (存储设备自动填充)': 'Device/Disk ID (auto-filled for storage devices)',
        'VID (十六进制)': 'VID (hex)',
        'PID (十六进制)': 'PID (hex)',
        '序列号 (可选)': 'Serial (optional)',
        '厂商名 (可选)': 'Manufacturer (optional)',
        '留空则不匹配': 'Leave empty to ignore',
        '移除': 'Remove',
        '正在扫描 USB 设备…': 'Scanning USB devices...',
        '未检测到 USB 存储设备': 'No USB storage devices detected',
        '已检测到 ': 'Detected ',
        ' 个 USB 存储设备，点击选中后添加到配置': ' USB storage devices; click one to add it to the configuration',
        '未知 USB 设备': 'Unknown USB Device',
        '盘符: ': 'Drive: ',
        '卷标: ': 'Volume: ',
        '型号: ': 'Model: ',
        '序列号: ': 'Serial: ',
        '厂商: ': 'Manufacturer: ',
        'USB 设备': 'USB Device',
        '新设备': 'New Device',
        '每条规则至少填写 VID、PID 或设备/磁盘 ID': 'Each rule requires at least a VID, PID, or device/disk ID',
        '正在建立连接': 'Establishing connection',
        '设备已识别': 'Device recognized',
        '设备就绪': 'Device ready',
        '正在激活...': 'Activating...',
        '设备已连接': 'Device connected',
        '连接断开': 'Connection lost',
        '正在断开...': 'Disconnecting...',
        '检测到 USB 设备：': 'USB device detected: ',
        '（未匹配，请在设置中添加）': ' (not matched; add it in Settings)',
        '检测到USB设备，未匹配当前配置': 'USB device detected; not matched by the current configuration',
        'RT-5 主控模块': 'RT-5 Main Controller Module',
        '设置已保存': 'Settings saved',
        '界面语言': 'Interface Language',
        '© 芮誊智能虚构公司': '© Rt5 A.I. Fictional Liability Company'
    };

    var _sortedKeys = Object.keys(DICT).sort(function (a, b) { return b.length - a.length; });
    var lang = 'zh';

    function t(zh) {
        if (lang !== 'en' || zh == null) return zh;
        if (Object.prototype.hasOwnProperty.call(DICT, zh)) return DICT[zh];
        var s = String(zh);
        for (var i = 0; i < _sortedKeys.length; i++) {
            var k = _sortedKeys[i];
            if (k.length >= 2 && s.indexOf(k) !== -1) s = s.split(k).join(DICT[k]);
        }
        return s;
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
        var attrs = ['placeholder', 'title', 'aria-label'];
        for (var i = 0; i < attrs.length; i++) {
            var name = attrs[i];
            if (!el.hasAttribute(name)) continue;
            var key = '__i18nAttr_' + name;
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
        if (root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
        translateAttrs(root);
        var nodes = root.childNodes;
        for (var i = 0; i < nodes.length; i++) walk(nodes[i]);
    }

    function applyLang() {
        try {
            walk(document.body);
            if (!document.__i18nTitleOrig && document.title) document.__i18nTitleOrig = document.title;
            document.title = (lang === 'en') ? t(document.__i18nTitleOrig || document.title) : (document.__i18nTitleOrig || document.title);
            /* 通知设置面板语言按钮刷新选中态（含初始异步确定语言后的首次同步） */
            try { document.dispatchEvent(new CustomEvent('launcher-lang-changed', { detail: { lang: lang } })); } catch (e) { /* ignore */ }
        } catch (e) { /* ignore */ }
    }

    function observe() {
        if (typeof MutationObserver === 'undefined') return;
        new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                var m = muts[i];
                if (m.type === 'characterData') translateTextNode(m.target);
                else if (m.type === 'childList') for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
                else if (m.type === 'attributes') translateAttrs(m.target);
            }
        }).observe(document.documentElement, {
            subtree: true, childList: true, characterData: true,
            attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label']
        });
    }

    /* Browser / embedded-iframe mode: the language lives in localStorage under
       the same key the main console (and the promo film driver) uses. The film
       writes it on an interval after iframe load, so keep re-checking briefly. */
    function storedLang() {
        try {
            var v = global.localStorage && global.localStorage.getItem('robot_ui_lang');
            return (v === 'en') ? 'en' : 'zh';
        } catch (e) { return 'zh'; }
    }

    function setLang(l) {
        var next = (l === 'en') ? 'en' : 'zh';
        if (next === lang) return;
        lang = next;
        applyLang();
    }

    function init() {
        var onLang = function (l) {
            lang = (l === 'en') ? 'en' : 'zh';
            applyLang();
            observe();
        };
        if (global.electronAPI && typeof global.electronAPI.getUiLang === 'function') {
            Promise.resolve(global.electronAPI.getUiLang()).then(onLang).catch(function () {
                onLang(storedLang());
            });
        } else {
            onLang(storedLang());
            /* the host page (promo film) may flip the stored language a beat
               after this iframe loads */
            var polls = 0;
            var iv = setInterval(function () {
                polls++;
                var want = storedLang();
                if (want !== lang) setLang(want);
                if (polls > 40) clearInterval(iv);
            }, 120);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    global.LauncherI18N = { t: t, applyLang: applyLang, setLang: setLang, getLang: function () { return lang; } };
})(typeof window !== 'undefined' ? window : this);
