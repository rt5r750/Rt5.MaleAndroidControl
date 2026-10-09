// i18n 检查 ⑤：中文长句数组（自检叙述等）是否能被 t() 真正译出。
// 背景：t() 的片段替换只要译后仍含中文就退回原文，因此「部分片段已入词典」的长句
// 在英文模式下会整句露出中文——这类缺陷前面的三个检查器都发现不了（它们只看
// 整串相等），必须真跑一遍 t() 才知道。
// 用法（仓库根）：node tools/i18n-check/check-long-lines.cjs   —— 退出码 0 为通过。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const CJK = /[\u4e00-\u9fa5]/;

// 1) 在最小 DOM 壳里加载 i18n.js，拿到真实的 t()
const i18nSrc = fs.readFileSync(path.join(ROOT, 'www/js/i18n.js'), 'utf8');
const sandbox = {
  window: null,
  document: {
    documentElement: { lang: '', classList: { add() {}, remove() {} } },
    addEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
    createTreeWalker: () => ({ nextNode: () => null }),
    title: '', head: { appendChild() {} }, body: {}
  },
  navigator: { language: 'en-US', languages: ['en-US'] },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  localStorage: { getItem: () => 'en', setItem() {}, removeItem() {} },
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  CustomEvent: function () {},
  console
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
try {
  new vm.Script(i18nSrc, { filename: 'i18n.js' }).runInContext(sandbox);
} catch (e) {
  console.log('[i18n] 加载 i18n.js 失败:', e.message);
  process.exit(1);
}
const I18N = sandbox.I18N;
if (!I18N) {
  console.log('[i18n] i18n.js 未暴露 I18N');
  process.exit(1);
}
if (I18N.getLang() !== 'en') {
  console.log('[i18n] 沙箱语言不是 en（实际 ' + I18N.getLang() + '），长句检查无意义');
  process.exit(1);
}

// 2) 抽出 app-core.js 中的全大写中文长句数组（SELF_CHECK_LINES 等）
const coreSrc = fs.readFileSync(path.join(ROOT, 'www/js/app-core.js'), 'utf8');
const arrays = [];
const declRe = /(?:const|var|let)\s+([A-Z][A-Z_]*LINES)\s*=\s*\[/g;
let m;
while ((m = declRe.exec(coreSrc))) {
  const name = m[1];
  let i = m.index + m[0].length - 1;
  let depth = 0;
  let end = -1;
  for (; i < coreSrc.length; i++) {
    if (coreSrc[i] === '[') depth++;
    else if (coreSrc[i] === ']') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) continue;
  const body = coreSrc.slice(m.index + m[0].length, end);
  const items = [];
  const strRe = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  let s;
  while ((s = strRe.exec(body))) {
    const v = (s[1] !== undefined ? s[1] : s[2]).replace(/\\"/g, '"').replace(/\\'/g, "'");
    if (CJK.test(v)) items.push(v);
  }
  if (items.length) arrays.push({ name, items });
}

let total = 0;
let bad = 0;
for (const a of arrays) {
  const leaks = [];
  for (const line of a.items) {
    total++;
    const out = I18N.t(line);
    if (out === line && CJK.test(out)) leaks.push(line);
  }
  console.log(`[i18n] ${a.name}: ${a.items.length} 条中文，未译出 ${leaks.length} 条`);
  leaks.forEach((l) => { bad++; console.log('  LEAK ' + JSON.stringify(l.slice(0, 120))); });
}
if (!arrays.length) console.log('[i18n] 未找到长句数组（检查正则是否过期）');
console.log(`[i18n] 长句合计 ${total} 条，未译出 ${bad} 条`);
process.exitCode = bad ? 1 : 0;
