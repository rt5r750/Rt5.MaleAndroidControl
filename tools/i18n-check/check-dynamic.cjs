// i18n 检查 ②：脚本直接写入 DOM/alert 的中文串是否都已进词典。
// 覆盖 www/js 下会渲染文案的模块；未进词典的串在英文模式下会露出中文。
// 用法（仓库根）：node tools/i18n-check/check-dynamic.cjs   —— 退出码 0 为通过。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const i18n = fs.readFileSync(path.join(ROOT, 'www/js/i18n.js'), 'utf8');
const dictKeys = new Set();
let m;
const dictRe = /'((?:\\'|[^'])*)'\s*:/g;
while ((m = dictRe.exec(i18n))) dictKeys.add(m[1].replace(/\\'/g, "'"));

const CJK = /[\u4e00-\u9fa5]/;
const files = ['app-core.js', 'app-ble.js', 'app-desktop.js', 'app-boot.js', 'app-launch.js', 'cache-console.js'];

const found = new Map(); // 文案 -> 出现的文件
const patterns = [
  /alert\(\s*'([^']*[\u4e00-\u9fa5][^']*)'/g,
  /alert\(\s*"([^"]*[\u4e00-\u9fa5][^"]*)"/g,
  /textContent\s*=\s*'([^']*[\u4e00-\u9fa5][^']*)'/g,
  /innerHTML\s*=\s*[`'"]([^`'"]*[\u4e00-\u9fa5][^`'"]*)['"`]/g,
  /titleText\.textContent\s*=\s*'([^']*[\u4e00-\u9fa5][^']*)'/g,
];

for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, 'www/js', f), 'utf8');
  for (const re of patterns) {
    re.lastIndex = 0;
    let x;
    while ((x = re.exec(src))) {
      const t = x[1].replace(/\s+/g, ' ').trim();
      if (t && CJK.test(t)) {
        if (!found.has(t)) found.set(t, new Set());
        found.get(t).add(f);
      }
    }
  }
}

const missing = [...found].filter(([t]) => !dictKeys.has(t));
console.log(`[i18n] 脚本内中文写入串 ${found.size} 条，词典缺失 ${missing.length} 条`);
for (const [t, hits] of missing) console.log('  MISSING ' + JSON.stringify(t) + '  <- ' + [...hits].join(','));
process.exitCode = missing.length ? 1 : 0;
