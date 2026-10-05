// 缓存控制台（仅纯浏览器；由 platform-bootstrap.js 在首次进入入口时按需注入）
// 与"系统更新"窗口同壳（openProcessModal externalFeed 变体），但内容是真实下载：
// 按 cache-manifest.json（构建期生成）逐项 fetch + 写入 Cache Storage，SW（sw.js）随后
// 以 cache-first 提供离线/秒开。缓存名规则与 sw.js 一致：rc-www-<manifest.version>。
// 本文件按需加载：入口门控（cacheConsoleSupported）与按钮绑定在 platform-bootstrap.js。
(function () {
    'use strict';

    var CACHE_PREFIX = 'rc-www-';
    var MANIFEST_URL = './cache-manifest.json';
    var INDEX_KEY = '/__rc-index__';
    var FULL_FLAG_KEY = 'rc_full_cache';   // 与 platform-bootstrap.js 的 FULL_FLAG_KEY 同键
    var PROMPT_EXEMPT = ['pic/login/Background.webp'];   // 背景图更新不提示重新缓存（SW 哈希校验自动换新）
    var running = false;
    var currentVersion = null;
    var outdatedPromptShown = false;

    function fmtSize(n) {
        if (!isFinite(n) || n < 0) return '?';
        if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + 'MB';
        if (n >= 1024) return Math.round(n / 1024) + 'KB';
        return n + 'B';
    }

    function absUrl(path) { return new URL(path, location.href).href; }

    function cacheNameFor(version) { return CACHE_PREFIX + version; }

    function fetchManifest() {
        // no-store：版本探测必须绕过 HTTP 缓存（与 sw.js 的 syncVersion 同规则）
        return fetch(MANIFEST_URL, { cache: 'no-store' }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        }).then(function (data) {
            if (!data || !data.version || !Array.isArray(data.files) || !data.files.length) {
                throw new Error('清单格式无效');
            }
            return data;
        });
    }

    /* 缓存内元数据（path -> 内容哈希）：与 sw.js 的 loadIndex/saveIndex 同约定。
       hashes 对象全程共享并原地更新，顺序流程内无并发写问题 */
    function loadIndex(cache) {
        return cache.match(absUrl(INDEX_KEY)).then(function (res) {
            if (!res) return {};
            return res.json().then(function (d) { return (d && d.hashes) || {}; }).catch(function () { return {}; });
        });
    }

    function saveIndex(cache, hashes) {
        var body = JSON.stringify({ version: currentVersion, hashes: hashes });
        return cache.put(absUrl(INDEX_KEY), new Response(body, { headers: { 'Content-Type': 'application/json' } }));
    }

    function downloadOne(handle, cache, file, seq, total, hashes) {
        handle.pushLine('正在下载 ' + file.path + ' (' + seq + '/' + total + ')…');
        var attempt = function (isRetry) {
            return fetch(absUrl(file.path), { cache: 'no-store' }).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.blob().then(function (blob) {
                    return cache.put(absUrl(file.path), new Response(blob));
                });
            }).then(function () {
                hashes[file.path] = file.hash;
                return saveIndex(cache, hashes);
            }).then(function () {
                handle.pushLine('已下载 ' + file.path + ' (' + fmtSize(file.size) + (isRetry ? '，重试成功' : '') + ')');
            });
        };
        return attempt(false).catch(function (err) {
            handle.pushLine('警告：下载失败 ' + file.path + ' (' + (err && err.message ? err.message : '网络错误') + ')，正在重试…');
            return attempt(true).catch(function () {
                return 'failed';
            });
        });
    }

    /* 缓存完成：写入全量标记并就地切全量模式（字体/图片/精灵图预热），全部来自刚建好的 SW 缓存。
       网页更新提示（RC_CACHE_OUTDATED）监听在 platform-bootstrap.js（本文件按需加载，更新到达时多半未加载） */
    function unlockFullMode(version) {
        try { localStorage.setItem(FULL_FLAG_KEY, version); } catch (e) { }
        if (typeof window.rcApplyFullAssets === 'function') window.rcApplyFullAssets();
        if (typeof loadRobotImages === 'function') { try { loadRobotImages(); } catch (e) { } }
        if (window.rotationSprite && typeof window.rotationSprite.warmup === 'function') {
            window.rotationSprite.warmup();
        }
    }

    window.openCacheConsole = function () {
        if (!window.cacheConsoleSupported || !window.cacheConsoleSupported()) {
            if (typeof appendToLogs === 'function') appendToLogs('[缓存] 当前环境不支持网页离线缓存（需 https/localhost 且浏览器支持 Cache Storage）');
            return;
        }
        if (running) return;
        running = true;

        if (navigator.storage && navigator.storage.persist) {
            try { navigator.storage.persist(); } catch (e) { }
        }

        /* 登录前 lite（首访强制流程）：登录层(950)会盖住过程窗口(930)——
           全页遮罩拦点击 + 窗口提到 955；登录后（更新重缓存）不加遮罩不提层。
           所有场景完成都不自动关窗：窗口 footer 追加「刷新」按钮（完成才激活，点击刷新页面）；
           进度窗口/按钮全部复用已加载资源，零额外下载 */
        var preLoginLite = window.__rcFullMode === false;
        var blocker = null;
        var refreshBtn = null;
        var clone = null;
        var removeBlocker = function () {
            if (blocker && blocker.parentNode) blocker.parentNode.removeChild(blocker);
            blocker = null;
        };
        if (preLoginLite) {
            blocker = document.createElement('div');
            blocker.className = 'rc-cache-blocking-overlay';
            document.body.appendChild(blocker);
        }

        fetchManifest().then(function (manifest) {
            currentVersion = manifest.version;
            var total = manifest.files.length;
            var totalSize = manifest.totalSize || manifest.files.reduce(function (s, f) { return s + (f.size || 0); }, 0);

            var handle = openProcessModal({
                key: 'cache-console',
                title: 'T31-750型仿人男性机器人 网页缓存控制台',
                mobileTitle: '缓存控制台',
                externalFeed: true,
                autoClose: false,   // 完成后窗口保留，等用户点「刷新」（失败时窗口本就不自动关）
                statusText: '正在缓存网页资源…',
                finishText: '缓存完成',
                onComplete: function () {
                    if (typeof appendToLogs === 'function') appendToLogs('[缓存] 已完成，共 ' + total + ' 项 ' + fmtSize(totalSize));
                }
            });
            if (!handle) {
                removeBlocker();
                running = false;
                return;   // 窗口已在运行中（running 标志已拦截，双保险）
            }

            clone = document.getElementById('process-modal-cache-console');
            if (preLoginLite) {
                // 克隆体随模板位于 #main-content 内，未登录时该容器 display:none——
                // 缓存控制台是唯一登录前打开的过程窗口，必须挪到 body 直下才能显示
                // （fixed 定位 + DWM 绝对定位矩形不受父级影响，事件/DWM 均按 id 操作）
                if (clone && clone.parentNode !== document.body) document.body.appendChild(clone);
                if (clone) clone.style.zIndex = '955';
            }
            if (clone) {
                // 清掉上一轮残留的刷新行（失败重试/前后场景切换），避免重复按钮与陈旧激活态
                var staleRow = clone.querySelector('.rc-cache-refresh-row');
                if (staleRow) staleRow.parentNode.removeChild(staleRow);
                var footer = clone.querySelector('.self-check-footer');
                if (footer) {
                    var row = document.createElement('div');
                    row.className = 'rc-cache-refresh-row';
                    refreshBtn = document.createElement('button');
                    refreshBtn.type = 'button';
                    refreshBtn.className = 'rc-cache-refresh-btn';
                    refreshBtn.disabled = true;
                    refreshBtn.innerHTML = '<i class="fa fa-sync-alt"></i> 刷新';
                    refreshBtn.addEventListener('click', function () {
                        if (!refreshBtn.classList.contains('active')) return;
                        location.reload();
                    });
                    row.appendChild(refreshBtn);
                    footer.appendChild(row);
                }
            }
            if (preLoginLite && clone) {
                // 窗口被手动关闭（失败关窗/成功后关窗）时撤遮罩，交还引导窗/登录页
                var mo = new MutationObserver(function () {
                    if (!clone.classList.contains('visible')) { removeBlocker(); mo.disconnect(); }
                });
                mo.observe(clone, { attributes: true, attributeFilter: ['class'] });
            }

            caches.open(cacheNameFor(manifest.version)).then(function (cache) {
                return loadIndex(cache).then(function (hashes) {
                    handle.pushLine('缓存版本 ' + manifest.version + '，清单共 ' + total + ' 项 / ' + fmtSize(totalSize));
                    handle.pushLine('');

                    var doneBytes = 0;
                    var skipped = 0;
                    var failed = [];

                    function settle() {
                        if (failed.length) {
                            handle.pushLine('');
                            handle.pushLine('警告：' + failed.length + ' 项下载失败，可关闭窗口后重新打开重试');
                            handle.setStatus(failed.length + ' 项失败：' + failed.slice(0, 3).join('、') + (failed.length > 3 ? ' 等' : ''));
                            handle.setBusy(false);
                            handle.stop();
                            if (typeof appendToLogs === 'function') appendToLogs('[缓存] ' + failed.length + ' 项失败');
                        } else {
                            handle.setProgress(100, '100%');
                            handle.pushLine('缓存完成：' + (total - skipped) + ' 项新下载，' + skipped + ' 项命中缓存，共 ' + fmtSize(doneBytes));
                            unlockFullMode(manifest.version);
                            if (refreshBtn) {
                                refreshBtn.disabled = false;
                                refreshBtn.classList.add('active');
                            }
                            handle.finish();
                        }
                        running = false;
                    }

                    function next(i) {
                        if (i >= total) { settle(); return; }
                        var file = manifest.files[i];
                        cache.match(absUrl(file.path)).then(function (cached) {
                            if (cached) {
                                skipped++;
                                doneBytes += file.size;
                                handle.pushLine('已下载(缓存命中) ' + file.path + ' (' + fmtSize(file.size) + ')');
                                var pct0 = Math.min(99, Math.round(doneBytes / totalSize * 100));
                                handle.setProgress(pct0, pct0 + '%');
                                next(i + 1);
                                return null;
                            }
                            return downloadOne(handle, cache, file, i + 1, total, hashes).then(function (result) {
                                if (result === 'failed') {
                                    failed.push(file.path);
                                } else {
                                    doneBytes += file.size;
                                }
                                var pct = Math.min(99, Math.round(doneBytes / totalSize * 100));
                                handle.setProgress(pct, pct + '%');
                                next(i + 1);
                            });
                        }).catch(function () {
                            failed.push(file.path);
                            next(i + 1);
                        });
                    }

                    next(0);
                });
            }).catch(function () {
                running = false;
                removeBlocker();
                if (typeof showSelfCheckAlert === 'function') {
                    showSelfCheckAlert('警告：无法打开缓存存储，请检查浏览器隐私模式限制。', null, false);
                }
            });
        }).catch(function (err) {
            running = false;
            removeBlocker();
            if (typeof showSelfCheckAlert === 'function') {
                showSelfCheckAlert('警告：获取缓存清单失败，请检查网络后重试。', null, false);
            }
            if (typeof appendToLogs === 'function') appendToLogs('[缓存] 清单获取失败：' + (err && err.message ? err.message : '未知错误'));
        });
    };
})();
