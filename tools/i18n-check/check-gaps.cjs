// i18n 检查 ①：HTML 静态文案是否都已进词典。
// 控制台 HTML 的文本节点与 placeholder/title/aria-label 若不在 www/js/i18n.js 的
// DICT 中，英文模式下会原样露出中文。
// 用法（仓库根）：node tools/i18n-check/check-gaps.cjs   —— 退出码 0 为通过。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'www/芮誊T系列仿人男性机器人控制台V1.1.html'), 'utf8');
const i18n = fs.readFileSync(path.join(ROOT, 'www/js/i18n.js'), 'utf8');

const CJK = /[\u4e00-\u9fa5]/;
const candidates = new Set();
let m;

// 1) 属性类：placeholder / title / aria-label
const attrRe = /(?:placeholder|title|aria-label)="([^"]*)"/g;
while ((m = attrRe.exec(html))) {
  const v = m[1].trim();
  if (CJK.test(v)) candidates.add(v);
}

// 2) 文本节点（剔除脚本/样式/注释）
const stripped = html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ');
const textRe = />([^<>]*)</g;
while ((m = textRe.exec(stripped))) {
  const t = m[1].replace(/\s+/g, ' ').trim();
  if (t && CJK.test(t)) candidates.add(t);
}

// 3) 词典键
const dictKeys = new Set();
const dictRe = /'((?:\\'|[^'])*)'\s*:/g;
while ((m = dictRe.exec(i18n))) dictKeys.add(m[1].replace(/\\'/g, "'"));

// 例外：由脚本按语言动态生成的串（非静态文案，不进词典）
const EXPECTED_DYNAMIC = new Set(['X的']);

const missing = [...candidates].filter((t) => !dictKeys.has(t) && !EXPECTED_DYNAMIC.has(t)).sort();
console.log(`[i18n] HTML 中文文案 ${candidates.size} 条，词典缺失 ${missing.length} 条`);
for (const t of missing) console.log('  MISSING ' + JSON.stringify(t));
process.exitCode = missing.length ? 1 : 0;
