/**
 * win-app 主进程界面文案与语言状态。
 * 语言决策（v1.10.0）：① 用户手选（huancun/i18n-lang.json 且 manual=true）→
 * ② 设备语言自动检测（app.getLocale()，zh* → 中文）→ ③ 兜底英文。
 * 自动检测结果不写入状态文件——每次启动重新检测，仅手选持久化。
 * 中文源字面量保留在本表中文键中，不改动既有业务代码里的中文。
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const STORE_FILE = () => {
  try {
    const huancun = path.join(__dirname, '..', 'huancun');
    return path.join(huancun, 'i18n-lang.json');
  } catch (e) {
    return path.join(require('os').tmpdir(), 'robot-i18n-lang.json');
  }
};

const DICT = {
  '已连接至T31-750型仿人男性机器人的内部系统': 'Connected to the internal system of T31-750 Male Android',
  'BLE 宿主未就绪，请稍后重试': 'BLE host is not ready, please try again later',
  '未找到 BLE 宿主程序（AndroidControl-BleHost.exe），请重新打包': 'BLE host program (AndroidControl-BleHost.exe) not found; please repackage',
  'BLE 宿主连续启动失败，请重启应用后重试': 'BLE host failed to start repeatedly; restart the app and try again',
  'BLE 宿主启动失败：': 'BLE host failed to start: ',
  'BLE 宿主启动异常：': 'BLE host failed to start (exception): ',
  'QR 生成失败:': 'QR generation failed: ',
  'BLE QR 生成失败:': 'BLE QR generation failed: ',
  'USB 枚举失败:': 'USB enumeration failed: '
};

/** 设备语言检测：zh* → 中文，其余/取不到 → 英文。app 未就绪时按系统 locale 兜底。 */
function detectLang() {
  let tag = '';
  try {
    if (app && typeof app.getLocale === 'function') tag = app.getLocale() || '';
  } catch (e) { /* app 未就绪等：继续用 Intl 兜底 */ }
  if (!tag) {
    try { tag = Intl.DateTimeFormat().resolvedOptions().locale || ''; } catch (e) { /* ignore */ }
  }
  if (!tag) {
    try { tag = process.env.LANG || process.env.LC_ALL || ''; } catch (e) { /* ignore */ }
  }
  return /^zh\b/i.test(String(tag).trim()) ? 'zh' : 'en';
}

function readStore() {
  try {
    const p = STORE_FILE();
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j && (j.lang === 'en' || j.lang === 'zh') && j.manual === true) return j.lang;
    }
  } catch (e) { /* ignore */ }
  return null;
}

let lang = 'en';
function loadLang() {
  lang = readStore() || detectLang();
  return lang;
}

/** 用户在启动器/控制台手选语言：写入状态文件并即时生效。 */
function saveLang(next) {
  lang = (next === 'en') ? 'en' : 'zh';
  try {
    const p = STORE_FILE();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ lang, manual: true }), 'utf8');
  } catch (e) { /* ignore */ }
}

function t(zh) {
  if (lang !== 'en') return zh;
  return Object.prototype.hasOwnProperty.call(DICT, zh) ? DICT[zh] : zh;
}

/** app 就绪后调用：此时 app.getLocale() 才可靠，重新解析自动检测结果。 */
function getLang() { return loadLang(); }

loadLang();

module.exports = { t, getLang, setLang: saveLang, detectLang, DICT };
