// i18n 检查 ③：英文侧资料与英文界面文案里是否混入中文。
// 覆盖：① 英文说明书 md/html ② 三份词典的英文值 ③ win-app 启动器词典。
// 例外：说明书页顶部的语言切换链接（简体中文）本就该是中文。
// 用法（仓库根）：node tools/i18n-check/check-english-leak.cjs   —— 退出码 0 为通过。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CJK = /[\u4e00-\u9fa5]/;
const ALLOW = [/简体中文/];               // 语言切换链接
let problems = 0;

function report(title, hits) {
  console.log(`\n=== ${title} (${hits.length}) ===`);
  hits.forEach((h) => console.log('  ' + h));
  problems += hits.length;
}

// ① 英文说明书（md 源与 html 产物）
for (const f of ['www/doc/manual/manual.en.md', 'www/doc/manual/manual.en.html']) {
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  const hits = [];
  lines.forEach((l, i) => {
    if (CJK.test(l) && !ALLOW.some((re) => re.test(l))) hits.push(`${i + 1}: ${l.trim().slice(0, 120)}`);
  });
  report(f, hits);
}

// ② JS 词典：英文值里出现汉字
for (const f of ['www/js/i18n.js', 'win-app/app/i18n.js', 'design/launcher-i18n.js']) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const hits = [];
  const re = /^\s*'((?:\\'|[^'])*)':\s*'((?:\\'|[^'])*)'/gm;
  let m;
  while ((m = re.exec(src))) {
    const key = m[1].replace(/\\'/g, "'");
    const val = m[2].replace(/\\'/g, "'");
    if (CJK.test(val)) hits.push(`key=${JSON.stringify(key)} -> value=${JSON.stringify(val)}`);
  }
  report(f + ' (英文值含中文)', hits);
}

// ③ Kotlin 词典：英文值里出现汉字
for (const f of [
  'master-app/app/src/main/java/com/robotcontrol/console/ConsoleI18n.kt',
  'slave-app/app/src/main/java/com/robotcontrol/phone/PhoneI18n.kt',
]) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const hits = [];
  const re = /"((?:[^"\\]|\\.)*)"\s*to\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(src))) {
    if (CJK.test(m[2])) hits.push(`key=${JSON.stringify(m[1])} -> value=${JSON.stringify(m[2])}`);
  }
  report(f + ' (英文值含中文)', hits);
}

console.log(`\n[i18n] 英文侧中文泄漏合计 ${problems} 处`);
process.exitCode = problems ? 1 : 0;
