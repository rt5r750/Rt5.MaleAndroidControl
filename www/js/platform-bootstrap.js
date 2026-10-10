    // platform bootstrap: load platform-specific styles on demand (win=Electron consoleAPI, android=WebView bridge)
    (function () {
        var isWin = typeof window.consoleAPI !== 'undefined' && !!window.consoleAPI;
        var isAndroid = typeof window.Android !== 'undefined' && !!window.Android;
        var isPureBrowser = !isWin && !isAndroid;
        // Android WebView 真判（排除 win-app preload 同名暴露的 window.Android）：
        // 供登录门控使用——Android App 无登录界面，任何宽度直接进主界面（v1.6.0）；
        // 激活页自 v1.10.0 起不再免除（未激活时先显示激活页，见 app-core.js 门控分支）
        window.__rcIsAndroidWebview = isAndroid && !isWin;
        if (isWin) document.documentElement.classList.add('win-desktop');
        // 桌面菜单模式（macOS 菜单风格窗口 + 底部程序坞）：win-app 与浏览器启用，Android WebView 不启用
        // （win-app preload 同名暴露 window.Android，故以 isWin 优先判定）
        if (isWin || !isAndroid) document.documentElement.classList.add('desktop-chrome');
        /* android-webview 类只给真正的 Android WebView：win-app preload 同名暴露
           window.Android，若不排除 win，会误中 app.css 的
           html.android-webview #login-modal{display:none!important}，
           打包后的 win-app 登录层只剩背景图、无密码输入框（v1.11.0 修复） */
        if (isAndroid && !isWin) {
            document.documentElement.classList.add('android-webview');
            var aLink = document.createElement('link');
            aLink.rel = 'stylesheet';
            aLink.href = './css/android.css';
            document.head.appendChild(aLink);
        }
        if (isWin) {
            var wLink = document.createElement('link');
            wLink.rel = 'stylesheet';
            wLink.href = './css/win.css';
            document.head.appendChild(wLink);
        }

        /* ===== 首访极简（lite）/ 全量（full）双模式 =====
           原生壳（Win/Android）与 file:// 本地打开资源都在本地，恒为 full；
           仅 http(s) 纯浏览器首访为 lite——不注入字体 @font-face（woff2 不下载，
           回退系统字体）、壁纸/图片不加载（html.lite CSS 门控 + img data-src），
           登录/核心功能不受影响。缓存控制台完成后写 localStorage['rc_full_cache']=版本
           并切全量。字体栈本身一字不动（AGENTS.md 硬性规范），仅延迟字体文件下载。 */
        var FULL_FLAG_KEY = 'rc_full_cache';
        var isHttpLike = location.protocol === 'http:' || location.protocol === 'https:';
        var isFull = !isPureBrowser || !isHttpLike;
        try { if (isHttpLike && localStorage.getItem(FULL_FLAG_KEY)) isFull = true; } catch (e) { }
        window.__rcFullMode = isFull;
        if (!isFull) document.documentElement.classList.add('lite');

        var fontsFaceInjected = false;
        function injectFontsFace() {
            if (fontsFaceInjected) return;
            fontsFaceInjected = true;
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = './css/fonts-face.css';
            document.head.appendChild(link);
        }

        /* 恢复延迟资源：字体注入 + data-src 图片还原 + 摘除 lite 类。幂等，可重复调用 */
        window.rcApplyFullAssets = function () {
            window.__rcFullMode = true;
            document.documentElement.classList.remove('lite');
            injectFontsFace();
            var imgs = document.querySelectorAll('img[data-src]');
            for (var i = 0; i < imgs.length; i++) {
                var el = imgs[i];
                var src = el.getAttribute('data-src');
                if (src) { el.src = src; el.removeAttribute('data-src'); }
            }
            try { window.dispatchEvent(new CustomEvent('rc-full-unlocked')); } catch (e) { }
        };
        if (isFull) {
            injectFontsFace();
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function () {
                    if (window.__rcFullMode) window.rcApplyFullAssets();
                });
            } else {
                window.rcApplyFullAssets();
            }
        }

        /* ===== 浏览器端：App 拉起引导 + 缓存控制台（按需注入） + Service Worker =====
           仅纯浏览器加载（原生壳内不注入，避免无谓 DOM/样式）；
           cache-console.js 首次进入任一入口才下载——首访净增文件请求为 0。 */
        if (isPureBrowser) {
            var alCss = document.createElement('link');
            alCss.rel = 'stylesheet';
            alCss.href = './css/app-launch.css';
            document.head.appendChild(alCss);
            var alJs = document.createElement('script');
            alJs.src = './js/app-launch.js';
            alJs.async = false;
            document.head.appendChild(alJs);

            /* 缓存控制台支持判定（入口门控；完整逻辑文件按需注入后才到位） */
            window.cacheConsoleSupported = function () {
                try {
                    if (!isPureBrowser) return false;
                    if (location.protocol !== 'http:' && location.protocol !== 'https:') return false;
                    return !!(window.caches && navigator.serviceWorker);
                } catch (e) {
                    return false;
                }
            };

            /* 按需注入 js/cache-console.js（进度窗口复用页面已有过程窗口模板，无新增资源） */
            var cacheConsoleLoading = false;
            window.ensureCacheConsole = function (onReady) {
                var real = window.openCacheConsole;
                if (real && !real.__shim) { if (onReady) onReady(); return; }
                if (cacheConsoleLoading) return;
                cacheConsoleLoading = true;
                var s = document.createElement('script');
                s.src = './js/cache-console.js';
                s.async = false;
                s.onload = function () { if (onReady) onReady(); };
                s.onerror = function () { cacheConsoleLoading = false; };
                document.head.appendChild(s);
            };
            window.openCacheConsole = function () {
                window.ensureCacheConsole(function () {
                    var real = window.openCacheConsole;
                    if (real && !real.__shim) real();
                });
            };
            window.openCacheConsole.__shim = true;

            /* 入口门控与绑定：设置页按钮组 + Rt5 系统菜单项默认 display:none，仅支持的浏览器放开 */
            function onReady(fn) {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', fn);
                } else {
                    setTimeout(fn, 0);
                }
            }
            onReady(function () {
                if (!window.cacheConsoleSupported()) return;
                var setting = document.getElementById('cache-console-setting');
                if (setting) setting.style.display = '';
                var menuItem = document.getElementById('ns-logo-cache-console');
                if (menuItem) menuItem.style.display = '';
                var btn = document.getElementById('open-cache-console-btn');
                if (btn) btn.addEventListener('click', function () { window.openCacheConsole(); });
                var launchBtn = document.getElementById('launch-app-btn');
                if (launchBtn) launchBtn.addEventListener('click', function () {
                    if (typeof window.rcTryOpenApp === 'function') window.rcTryOpenApp();
                    else location.href = 'robotcontrol://console';
                });
                /* download-app-btn 为 <a> 原生外链跳转，无需绑定 */
            });

            /* ===== 网页更新提示（仅已缓存的全量模式用户）=====
               SW 版本同步发现页面缓存落后时回发 RC_CACHE_OUTDATED + 变化列表；
               仅 pic/login/Background.webp 变更则静默（SW 哈希校验自动换新壁纸） */
            var PROMPT_EXEMPT = ['pic/login/Background.webp'];
            var outdatedPromptShown = false;
            var isBackgroundOnly = function (changed) {
                return Array.isArray(changed) && changed.length > 0 &&
                    changed.every(function (p) { return PROMPT_EXEMPT.indexOf(p) !== -1; });
            };
            var showCacheOutdatedPrompt = function () {
                if (outdatedPromptShown) return;
                outdatedPromptShown = true;
                var open = function () { outdatedPromptShown = false; window.openCacheConsole(); };
                // 登录层(z 950)会盖住 macOS 通知堆栈(z 948)且通知 12s 自动过期——
                // 登录页可见时直接走横幅（z 965），避免全量用户停在登录页时错过更新提示
                var loginModal = document.getElementById('login-modal');
                var loginVisible = !!(loginModal && loginModal.style.display !== 'none');
                if (!loginVisible && typeof showMacosNotification === 'function' && document.getElementById('macos-notification-stack')) {
                    var el = showMacosNotification({ icon: 'fa-database', title: '网页已更新', body: '检测到资源更新，建议重新缓存', appName: 'T31-750', duration: 12000 });
                    if (el) {
                        var body = el.querySelector('.macos-notification-body');
                        if (body) {
                            body.style.cursor = 'pointer';
                            body.addEventListener('click', function () {
                                var clear = el.querySelector('.macos-notification-clear');
                                if (clear) clear.click();
                                open();
                            });
                        }
                    }
                    return;
                }
                // 移动端 / 无通知堆栈：底部横幅兜底（样式见 app-launch.css .rc-cache-banner）
                var banner = document.createElement('div');
                banner.className = 'rc-cache-banner';
                banner.innerHTML = '<span class="rc-cache-banner-text">网页已更新，建议重新缓存</span>' +
                    '<button type="button" class="rc-cache-banner-btn">重新缓存</button>' +
                    '<span class="rc-cache-banner-close" title="关闭"><i class="fa fa-xmark"></i></span>';
                document.body.appendChild(banner);
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () { banner.classList.add('visible'); });
                });
                banner.querySelector('.rc-cache-banner-btn').addEventListener('click', function () {
                    if (banner.parentNode) banner.parentNode.removeChild(banner);
                    open();
                });
                banner.querySelector('.rc-cache-banner-close').addEventListener('click', function () {
                    if (banner.parentNode) banner.parentNode.removeChild(banner);
                });
            };
            if (navigator.serviceWorker) {
                navigator.serviceWorker.addEventListener('message', function (event) {
                    var data = event.data || {};
                    if (data.type !== 'RC_CACHE_STATE') return;
                    var outdated = !!data.outdated;
                    // 有差异：仅已缓存（全量）用户提示重新缓存（背景图变更静默，SW 哈希校验自动换新）
                    if (outdated && window.__rcFullMode === true && !isBackgroundOnly(data.changed)) {
                        showCacheOutdatedPrompt();
                    }
                    // 广播缓存状态给页面模块（app-launch 据此决定弹窗是否显示缓存入口）
                    try { window.dispatchEvent(new CustomEvent('rc-cache-state', { detail: { outdated: outdated, changed: data.changed } })); } catch (e) { }
                });
            }

            /* Service Worker 注册（原 sw-register.js 内联，少一个首访请求）：
               Android WebView（file://）与 Electron（app:// 未开 serviceWorker 特权）天然不可用，
               这里按协议再兜底一道，任何失败静默——退化为无 SW 的现状 */
            if (navigator.serviceWorker && (location.protocol === 'http:' || location.protocol === 'https:')) {
                var pingVersionCheck = function (reg) {
                    var sw = reg.active || navigator.serviceWorker.controller || null;
                    var fullVersion = null;
                    try { fullVersion = localStorage.getItem(FULL_FLAG_KEY); } catch (e) { }
                    if (sw && sw.postMessage) {
                        // 内容更新但 sw.js 未变时不会自动 install，靠页面加载时主动做版本同步；
                        // 附带全量缓存版本号，SW 检测到落后时回发 RC_CACHE_OUTDATED 触发重新缓存提示
                        sw.postMessage({ type: 'RC_SW_CHECK_VERSION', fullVersion: fullVersion });
                    }
                };
                window.addEventListener('load', function () {
                    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(function (reg) {
                        if (reg.active) {
                            pingVersionCheck(reg);
                        } else {
                            navigator.serviceWorker.ready.then(function (r) { pingVersionCheck(r); }).catch(function () { });
                        }
                    }).catch(function () {
                        /* 注册失败静默：无 SW 时一切按原网络行为运行 */
                    });
                });
            }
        }
    })();
