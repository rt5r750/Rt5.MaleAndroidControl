// 浏览器端 App 拉起引导（仅纯浏览器由 platform-bootstrap 注入本文件；Android WebView / Electron 壳内不加载）
// 协议：robotcontrol://console（master-app VIEW+BROWSABLE / win-app setAsDefaultProtocolClient）
// 检测：跳转 scheme 后监听 visibilitychange/pagehide；~2.2s 内页面未隐藏视为未安装 → 高亮下载引导
// 首访强制模式（lite 且支持缓存）：窗口不可关闭/忽略，「缓存网页」按钮置顶突出，
// 必须完成缓存才能进入；已缓存/不支持缓存的用户为常规可关闭引导，缓存入口退居末位弱化样式。
(function () {
    'use strict';

    var DISMISS_KEY = 'rc_app_launch_dismissed';
    var SCHEME_URL = 'robotcontrol://console';
    var LAUNCH_DELAY_MS = 1500;   // 常规模式首屏稳定后再弹出，避免抢登录页首帧
    var FORCED_DELAY_MS = 300;    // 强制模式尽快弹出，避免用户先操作到登录表单
    var LAUNCH_DETECT_MS = 2200;  // scheme 跳转后判定"未安装"的超时

    var isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    var els = null;
    var forcedWatchTimer = null;
    var consoleWindowSeen = false;
    var cacheOutdated = null;   // null=未知（离线等）、false=与服务器一致、true=有更新；full 模式弹窗仅在 true 时显示缓存入口

    /* 首访强制缓存：尚未全量（无缓存标记）且环境支持 Cache Storage */
    function isForcedMode() {
        return window.__rcFullMode === false &&
            typeof window.cacheConsoleSupported === 'function' && window.cacheConsoleSupported();
    }

    function queryEls() {
        if (els) return els;
        var root = document.getElementById('app-launch-modal');
        if (!root) return null;
        els = {
            root: root,
            icon: document.getElementById('app-launch-icon-fa'),
            open: document.getElementById('app-launch-open'),
            download: document.getElementById('app-launch-download'),
            cache: document.getElementById('app-launch-cache'),
            close: document.getElementById('app-launch-close'),
            rememberLabel: root.querySelector('.app-launch-remember'),
            noPrompt: document.getElementById('app-launch-no-prompt')
        };
        return els;
    }

    function targetLabel() {
        return isMobileUA ? 'Android 控制台 App' : 'Windows 桌面版';
    }

    function fillPlatformText() {
        var e = queryEls();
        if (!e) return;
        if (e.icon) e.icon.className = isMobileUA ? 'fa fa-mobile-alt' : 'fa fa-desktop';
        var desc = document.getElementById('app-launch-desc');
        if (desc) {
            desc.textContent = isForcedMode()
                ? '首次访问需先缓存网页资源：点击绿色按钮完成缓存（约十几秒，仅需一次），本页即可极速加载、离线使用。也可选择打开或下载 App。'
                : '检测到您正在浏览器中访问控制台，建议打开' + targetLabel() + '，获得蓝牙直连、语音引擎等完整功能。';
        }
    }

    /* 强制/常规两态的窗口形态切换：强制模式无关闭钮、无"不再提示"、缓存按钮置顶突出；
       常规（已缓存）模式缓存入口仅在确认与服务器有差异时显示（一致/未知则不提醒缓存） */
    function applyForcedStyle(forced) {
        var e = els;
        if (!e) return;
        if (forced) {
            if (e.close) e.close.style.display = 'none';
            if (e.rememberLabel) e.rememberLabel.style.display = 'none';
            if (e.cache) {
                e.cache.style.display = '';
                e.cache.style.order = '-1';
                e.cache.classList.remove('app-launch-btn-tertiary');
                e.cache.classList.add('app-launch-btn-cache-main');
            }
        } else {
            if (e.close) e.close.style.display = '';
            if (e.rememberLabel) e.rememberLabel.style.display = '';
            if (e.cache) {
                var showCacheEntry = window.cacheConsoleSupported && window.cacheConsoleSupported() && cacheOutdated === true;
                e.cache.style.display = showCacheEntry ? '' : 'none';
                e.cache.style.order = '';
                e.cache.classList.add('app-launch-btn-tertiary');
                e.cache.classList.remove('app-launch-btn-cache-main');
            }
        }
    }

    function show(force) {
        var e = queryEls();
        if (!e) return;
        var forced = isForcedMode();
        if (!force && !forced) {
            try { if (localStorage.getItem(DISMISS_KEY) === '1') return; } catch (err) {}
        }
        applyForcedStyle(forced);
        fillPlatformText();
        if (e.open) e.open.classList.remove('missed');
        e.root.classList.add('visible');
        // 双帧触发过渡动画
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { e.root.classList.add('shown'); });
        });
        if (typeof appendToLogs === 'function') appendToLogs(forced ? '首访强制缓存引导（不可跳过）' : '显示 App 拉起引导');
    }

    function hide() {
        var e = queryEls();
        if (!e) return;
        try {
            if (e.noPrompt && e.noPrompt.checked) localStorage.setItem(DISMISS_KEY, '1');
        } catch (err) {}
        e.root.classList.remove('shown');
        setTimeout(function () { e.root.classList.remove('visible'); }, 260);
    }

    function markMissed() {
        var e = queryEls();
        if (!e) return;
        if (e.open) e.open.classList.add('missed');
        var fb = document.getElementById('app-launch-fallback');
        if (fb) fb.classList.add('missed');
    }

    function tryOpenApp() {
        var e = queryEls();
        if (!e) return;
        var forced = isForcedMode();
        // Chrome 对未注册协议的失败导航可能短暂置页面 hidden 后恢复，
        // 故不做过程监听，以超时时刻的可见性做最终判定：后台=已拉起，仍可见=未安装
        document.addEventListener('visibilitychange', function onVis() {
            if (document.hidden) {
                document.removeEventListener('visibilitychange', onVis, true);
                // 强制模式下拉起成功也不收窗：用户返回浏览器后仍需完成缓存
                if (!forced) setTimeout(hide, 400);
            }
        }, true);
        setTimeout(function () {
            if (!document.hidden) markMissed();
        }, LAUNCH_DETECT_MS);
        window.location.href = SCHEME_URL;
    }

    /* 强制模式守望：① 控制台窗口打开过又关闭、且仍未全量（失败/被中止）→ 重新弹出引导；
       ② 点击后控制台迟迟未打开（如离线拉不到清单，alert 兜底）→ 8s 超时也回弹引导，避免用户卡死 */
    function startForcedWatch() {
        if (forcedWatchTimer) return;
        consoleWindowSeen = false;
        var startedAt = Date.now();
        forcedWatchTimer = setInterval(function () {
            var modal = document.getElementById('process-modal-cache-console');
            var consoleVisible = !!(modal && modal.classList.contains('visible'));
            if (consoleVisible) consoleWindowSeen = true;
            if (window.__rcFullMode === true) { stopForcedWatch(); return; }
            var neverOpened = !consoleWindowSeen && (Date.now() - startedAt) > 8000 && !consoleVisible;
            var openedThenClosed = consoleWindowSeen && modal && !consoleVisible;
            if (neverOpened || openedThenClosed) {
                stopForcedWatch();
                show(true);
            }
        }, 400);
    }

    function stopForcedWatch() {
        if (forcedWatchTimer) { clearInterval(forcedWatchTimer); forcedWatchTimer = null; }
    }

    function bind() {
        var e = queryEls();
        if (!e) return;
        if (e.open && !e.open.dataset.bound) {
            e.open.dataset.bound = '1';
            e.open.addEventListener('click', function (ev) {
                ev.preventDefault();
                if (e.open.classList.contains('missed')) show(true); // 复位为可重试
                else tryOpenApp();
            });
        }
        if (e.close && !e.close.dataset.bound) {
            e.close.dataset.bound = '1';
            e.close.addEventListener('click', function (ev) { ev.preventDefault(); hide(); });
        }
        // 缓存网页按钮：强制模式置顶突出（见 applyForcedStyle）；点击藏引导窗、打开缓存过程窗口，
        // 完成后由 rc-full-unlocked 事件收尾，失败/中止则守望定时器重新弹出引导
        if (e.cache && !e.cache.dataset.bound) {
            e.cache.dataset.bound = '1';
            if (window.cacheConsoleSupported && window.cacheConsoleSupported()) {
                e.cache.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    var forced = isForcedMode();
                    hide();
                if (forced) {
                    startForcedWatch();
                }
                    if (typeof window.openCacheConsole === 'function') window.openCacheConsole();
                });
            }
        }
        e.root.addEventListener('click', function (ev) {
            if (ev.target === e.root && !isForcedMode()) hide(); // 点击遮罩关闭（强制模式不可关）
        });
    }

    // 信息弹窗"获取 App"入口（app-core.js renderFileList action 条目调用）
    window.rcShowAppLaunch = function (force) { show(!!force); };

    // 设置页"拉起 App"按钮入口：复用 scheme 跳转 + 未安装检测逻辑
    window.rcTryOpenApp = tryOpenApp;

    // 缓存完成（unlockFullMode → rcApplyFullAssets）收尾：解除强制守望，缓存状态复位为"与服务器一致"
    window.addEventListener('rc-full-unlocked', function () {
        stopForcedWatch();
        cacheOutdated = false;
        var e = queryEls();
        if (e && e.root.classList.contains('visible')) {
            applyForcedStyle(false);
            hide();
        }
    });

    // SW 版本核对结果：有差异时已弹出的常规窗口实时显示缓存入口，一致则隐藏
    window.addEventListener('rc-cache-state', function (event) {
        var outdated = !!(event.detail && event.detail.outdated);
        if (cacheOutdated === outdated) return;
        cacheOutdated = outdated;
        var e = queryEls();
        if (e && e.root.classList.contains('visible') && !isForcedMode()) applyForcedStyle(false);
    });

    // 本文件由 platform-bootstrap 动态注入，执行时解析可能已完成（readyState=interactive），
    // DOMContentLoaded 事件已错过，需按就绪状态兼容
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            setTimeout(fn, 0);
        }
    }

    onReady(function () {
        bind();
        setTimeout(function () { show(false); }, isForcedMode() ? FORCED_DELAY_MS : LAUNCH_DELAY_MS);
    });
})();
