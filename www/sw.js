/* RobotControl www Service Worker（仅纯浏览器注册：http/https 安全上下文；
   Android WebView 为 file://、win-app 的 app:// 协议未开 serviceWorker 特权，两端天然不会走到这里）
   策略：
   - 缓存名版本化 rc-www-<version>，version 来自构建期生成的 cache-manifest.json
   - 页面导航（HTML）network-first（3s 超时回退缓存）：离线可开，部署新版本后首屏永远取最新
   - 清单内静态资源 cache-first，命中前用每文件内容哈希校验（同 path 内容变了 → 走网络并回填）
   - 清单外同源 GET（如 doc/*.pdf）成功后运行时缓存，二次打开离线可用
   - cache-manifest.json 本身永不缓存（页面与 SW 侧均 no-store 拉取）
   缓存名规则与 js/cache-console.js 保持一致（rc-www- + manifest.version），两端各自从
   同一份 no-store 清单推导，无需互相协调。 */

var CACHE_PREFIX = 'rc-www-';
var META_CACHE = 'rc-meta';       // 版本指针持久化：SW 进程被回收重启后内存 state 归零，仍能找到旧版本缓存做增量拷贝
var INDEX_URL = './cache-manifest.json';
var INDEX_KEY = '/__rc-index__';   // 缓存内元数据：{version, hashes:{path:hash}}，存为合成 Response
var NAV_TIMEOUT_MS = 3000;

var state = {
    version: null,          // 当前生效的清单版本
    hashes: {},             // 清单 path -> hash
    paths: null,            // 清单 path 集合（Set）
    cacheName: null,
    cachedHashes: null,     // 内存化的缓存内元数据（path -> hash）；null = 未加载
    initPromise: null,      // SW 唤醒后的一次性状态初始化
    syncing: null,          // 进行中的版本同步 Promise（防并发）
    lastChanged: null       // 最近一次版本切换时内容有变化的文件列表（供页面更新提示）
};

function cacheNameFor(version) { return CACHE_PREFIX + version; }

function metaUrl() { return new URL('/__rc-version__', self.registration.scope).href; }

function readMetaVersion() {
    return caches.open(META_CACHE).then(function (mc) {
        return mc.match(metaUrl()).then(function (res) {
            if (!res) return null;
            return res.json().then(function (d) { return (d && d.version) || null; }).catch(function () { return null; });
        });
    }).catch(function () { return null; });
}

function writeMetaVersion(version) {
    return caches.open(META_CACHE).then(function (mc) {
        return mc.put(metaUrl(), new Response(JSON.stringify({ version: version }), { headers: { 'Content-Type': 'application/json' } }));
    }).catch(function () { });
}

function indexUrl() { return new URL(INDEX_KEY, self.registration.scope).href; }

function fetchManifest() {
    // no-store：托管平台静态服务的缓存头不可控，版本探测必须绕过一切缓存
    return fetch(INDEX_URL, { cache: 'no-store' }).then(function (res) {
        if (!res.ok) throw new Error('manifest HTTP ' + res.status);
        return res.json();
    });
}

/* 读取缓存内元数据（path -> hash），缺失时返回空表 */
function loadIndex(cache) {
    return cache.match(indexUrl()).then(function (res) {
        if (!res) return {};
        return res.json().then(function (data) { return (data && data.hashes) || {}; }).catch(function () { return {}; });
    });
}

function saveIndex(cache, version, hashes) {
    var body = JSON.stringify({ version: version, hashes: hashes });
    return cache.put(indexUrl(), new Response(body, { headers: { 'Content-Type': 'application/json' } }));
}

/* 版本同步：拉最新清单 → 建新版本缓存 → 沿用内容未变的旧条目 → 删除其余旧缓存。
   旧版本号以 rc-meta 持久化值为准（SW 进程回收重启后内存 state.version 为 null）。
   清单拉取失败（如离线）时保持现状，下次再试。 */
function syncVersion() {
    if (state.syncing) return state.syncing;
    state.syncing = fetchManifest().then(function (manifest) {
        if (!manifest || !manifest.version || !Array.isArray(manifest.files)) return null;
        if (manifest.version === state.version) return null;

            var hashes = {};
            manifest.files.forEach(function (f) { hashes[f.path] = f.hash; });
            var newName = cacheNameFor(manifest.version);

        return readMetaVersion().then(function (metaVersion) {
            var copyFromVersion = metaVersion && metaVersion !== manifest.version ? metaVersion : state.version;
            var prepare = caches.open(newName).then(function (cache) {
                // 从旧版本缓存拷贝"同 path 同内容哈希"的条目，版本切换不重复下载未变更资源；
                // 同时记录内容有变化的文件列表（供页面"重新缓存"提示，背景图除外由页面侧判定）
                var changedPaths = [];
                if (!copyFromVersion || copyFromVersion === manifest.version) {
                    changedPaths = null;   // 首次建缓存：无旧版可比，页面侧按"未知"处理
                    return null;
                }
                return caches.open(cacheNameFor(copyFromVersion)).then(function (oldCache) {
                    return loadIndex(oldCache).then(function (oldHashes) {
                        var kept = {};
                        var copies = [];
                        if (Object.keys(oldHashes).length === 0) {
                            changedPaths = manifest.files.map(function (f) { return f.path; });
                        } else {
                            manifest.files.forEach(function (f) {
                                if (oldHashes[f.path] === f.hash) {
                                    var abs = new URL(f.path, self.registration.scope).href;
                                    copies.push(
                                        oldCache.match(abs)
                                            .then(function (res) {
                                                if (res) { kept[f.path] = f.hash; return cache.put(abs, res); }
                                            })
                                            .catch(function () { })
                                    );
                                } else {
                                    changedPaths.push(f.path);
                                }
                            });
                        }
                        return Promise.all(copies).then(function () { return saveIndex(cache, manifest.version, kept); }).then(function () { return changedPaths; });
                    });
                });
            });

            return prepare.then(function (changedPaths) {
                state.version = manifest.version;
                state.hashes = hashes;
                state.paths = new Set(manifest.files.map(function (f) { return f.path; }));
                state.cacheName = newName;
                state.cachedHashes = null;   // 新缓存元数据按需重读
                state.lastChanged = changedPaths;
                // 删除其余全部 rc-www-* 旧缓存（rc-meta 版本指针保留）
                return caches.keys().then(function (keys) {
                    return Promise.all(keys.map(function (k) {
                        if (k.indexOf(CACHE_PREFIX) === 0 && k !== newName) return caches.delete(k);
                    }));
                }).then(function () { return writeMetaVersion(manifest.version); });
            });
        });
    }).catch(function () {
        /* 清单拉取失败：保持现有缓存，不打断页面 */
    }).then(function () {
        state.syncing = null;
    });
    return state.syncing;
}

function putRuntime(cache, request, response) {
    // 只缓存完整成功的响应；跳过 206 分片与不透明响应
    if (!response || response.status !== 200 || response.type === 'opaque') return;
    var copy = response.clone();
    cache.put(request, copy).then(function () {
        if (!state.paths) return;
        var path = new URL(request.url).pathname;
        var base = new URL(self.registration.scope).pathname;
        if (path.indexOf(base) !== 0) return;
        var rel = decodeURIComponent(path.slice(base.length));
        if (!state.paths.has(rel)) return;
        // 记录内容哈希；若缓存控制台已记录则以其为准（两边可能并发写索引）
        return loadIndex(cache).then(function (hashes) {
            if (hashes[rel] === state.hashes[rel]) return null;
            hashes[rel] = state.hashes[rel];
            if (state.cachedHashes) state.cachedHashes[rel] = state.hashes[rel];
            return saveIndex(cache, state.version, hashes);
        }).catch(function () { });
    }).catch(function () { });
}

/* SW 唤醒后首次请求先初始化状态（读 meta 版本指针 + 拉清单），
   避免进程回收重启后 state 为空导致请求全部透传网络、缓存失效 */
function ensureState() {
    if (!state.initPromise) state.initPromise = syncVersion();
    return state.initPromise;
}

/* 页面导航：network-first，超时/失败回退缓存（缓存条目来自此前成功访问时的运行时回填） */
function handleNavigation(request) {
    var networkFetch = fetch(request);
    return new Promise(function (resolve) {
        var settled = false;
        var timer = setTimeout(function () {
            if (!settled) { settled = true; resolve(null); }
        }, NAV_TIMEOUT_MS);
        networkFetch.then(function (res) {
            if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
        }).catch(function () {
            if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
        });
    }).then(function (res) {
        if (res) {
            if (state.cacheName) caches.open(state.cacheName).then(function (c) { putRuntime(c, request, res.clone()); }).catch(function () { });
            return res;
        }
        return caches.match(request).then(function (cached) {
            return cached || new Response('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>离线</title></head><body style="background:#0d1a0d;color:#8fbc8f;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div>当前处于离线状态，且缓存中暂无该页面。<br>联网后刷新即可恢复。</div></body></html>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        });
    });
}

/* 静态资源：清单内 cache-first + 哈希校验；清单外同源 GET 走运行时缓存 */
function handleAsset(request) {
    return ensureState().then(function () {
        if (!state.cacheName) {
            // 状态初始化失败（如离线拉不到清单）：全局缓存兜底后回退网络
            return caches.match(request).then(function (cached) { return cached || fetch(request); });
        }
        return serveAsset(request);
    });
}

function serveAsset(request) {
    var url = new URL(request.url);
    var base = new URL(self.registration.scope).pathname;
    var rel = null;
    if (url.pathname.indexOf(base) === 0) {
        try { rel = decodeURIComponent(url.pathname.slice(base.length)); } catch (e) { rel = url.pathname.slice(base.length); }
    }
    var inManifest = rel !== null && state.paths && state.paths.has(rel);

    return caches.open(state.cacheName).then(function (cache) {
        var fromNetwork = function () {
            return fetch(request).then(function (res) {
                if (res && res.status === 200) putRuntime(cache, request, res.clone());
                return res;
            });
        };

        if (!inManifest) {
            // 运行时缓存：先缓存后网络
            return cache.match(request).then(function (cached) {
                return cached || fromNetwork();
            });
        }

        // 清单内：内存化读取元数据后比对哈希。
        // 元数据无记录（缓存控制台写入时未及记录等）视为本版本有效——条目只会在
        // 当前版本缓存内存在，且控制台/写入方都以当次清单为准。
        var ensureIndex = state.cachedHashes
            ? Promise.resolve(state.cachedHashes)
            : loadIndex(cache).then(function (hashes) {
                state.cachedHashes = hashes;
                return hashes;
            });

        return ensureIndex.then(function (hashes) {
            return cache.match(request).then(function (cached) {
                if (!cached) return fromNetwork();
                var recorded = hashes[rel];
                if (recorded === undefined || recorded === state.hashes[rel]) return cached;
                // 同 path 内容已更新 → 重新下载；网络失败回退旧内容
                return fromNetwork().catch(function () { return cached; });
            });
        });
    });
}

self.addEventListener('install', function () {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        self.clients.claim().then(function () {
            state.initPromise = syncVersion();
            return state.initPromise;
        })
    );
});

self.addEventListener('message', function (event) {
    var data = event.data || {};
    if (data.type === 'RC_SW_CHECK_VERSION') {
        var source = event.source;
        syncVersion().then(function () {
            if (!source || !source.postMessage || !state.version) return;   // 离线等拿不到清单：不回发，页面按"未知"处理
            var fullVersion = data.fullVersion || null;
            var outdated = !!(fullVersion && fullVersion !== state.version);
            // 总是回发缓存状态：页面据此决定是否提醒重新缓存/显示缓存入口
            source.postMessage({ type: 'RC_CACHE_STATE', version: state.version, outdated: outdated, changed: state.lastChanged });
        });
    }
});

self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') return;
    if (request.headers.has('range')) return;
    var url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.endsWith('/cache-manifest.json')) return;
    if (url.pathname.endsWith('/sw.js')) return;

    try {
        if (request.mode === 'navigate') {
            // 导航请求只对 HTML 文档走 network-first（iframe 加载 PDF 等文件也是 navigate，
            // 必须走资源策略的运行时缓存——PDF 不在预缓存清单，走导航策略会因 3s 超时/
            // 离线直接落到兜底错误页，且永远进不了缓存）
            var isHtmlDoc = /\.html?$/i.test(url.pathname) || !/\.[a-z0-9]+$/i.test(url.pathname);
            if (isHtmlDoc) {
                event.respondWith(handleNavigation(request));
            } else {
                event.respondWith(handleAsset(request).then(function (res) {
                    return res || fetch(request);
                }));
            }
        } else {
            event.respondWith(handleAsset(request).then(function (res) {
                return res || fetch(request);
            }));
        }
    } catch (e) {
        /* SW 内部异常不打断页面：退化为普通网络请求 */
    }});
