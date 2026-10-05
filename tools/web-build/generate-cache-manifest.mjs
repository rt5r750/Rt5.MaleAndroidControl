// 生成 www/cache-manifest.json：Service Worker 预缓存清单 + 缓存控制台下载清单。
// 用法：node generate-cache-manifest.mjs（npm run build 末步自动执行）
// 规则：只收静态资源；排除 .mimosa、原生壳专用视频、无引用文件与清单自身。
import { createHash } from 'node:crypto';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const WWW_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', 'www');
const OUT_FILE = join(WWW_ROOT, 'cache-manifest.json');

// 不进预缓存清单的文件（相对 www 根，正斜杠）：
// - pic/Rt5Open*.mp4：仅 Android 原生闪屏（assets 直读）与 win-app splash.html 使用，浏览器不 fetch
// - doc/*.pdf：1.5MB 按需打开，交给 SW 运行时缓存（首次打开后离线可用）
// - doc/自检.txt：全仓库无引用
// - sw.js / cache-manifest.json：基础设施自身（manifest 在 SW/页面侧恒 no-store）
const EXACT_EXCLUDES = new Set([
    'sw.js',
    'cache-manifest.json',
    'doc/自检.txt'
]);
const EXCLUDE_TESTS = [
    /(^|\/)\.mimosa(\/|$)/, /* 任意层级的 .mimosa 会话目录（顶层与 css/js 等嵌套子目录一并排除） */
    /^pic\/Rt5Open.*\.mp4$/,
    /^doc\/.+\.pdf$/
];

function walk(dir, base) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const rel = relative(base, full).split(sep).join('/');
        const st = statSync(full);
        if (st.isDirectory()) {
            out.push(...walk(full, base));
        } else {
            out.push(rel);
        }
    }
    return out;
}

const all = walk(WWW_ROOT, WWW_ROOT)
    .filter((rel) => {
        if (EXACT_EXCLUDES.has(rel)) return false;
        return !EXCLUDE_TESTS.some((re) => re.test(rel));
    })
    .sort();

const files = all.map((path) => {
    const content = readFileSync(join(WWW_ROOT, path));
    return {
        path,
        size: content.length,
        // 内容哈希：SW 版本切换时据此判断旧缓存条目是否可直接沿用（同 path 不同内容则重新下载）
        hash: createHash('sha1').update(content).digest('hex').slice(0, 12)
    };
});

const hash = createHash('sha1');
for (const f of files) hash.update(`${f.path}:${f.hash}\n`);

const manifest = {
    version: hash.digest('hex').slice(0, 12),
    generatedAt: new Date().toISOString(),
    totalSize: files.reduce((s, f) => s + f.size, 0),
    files
};

writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`[cache-manifest] ${files.length} 个文件，共 ${(manifest.totalSize / 1024 / 1024).toFixed(2)} MB，版本 ${manifest.version}`);
