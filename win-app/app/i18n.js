/**
 * win-app 主进程界面文案（英语翻译测试）。
 * 默认中文；与 www 的 robot_ui_lang 对齐（huancun/i18n-lang.json）。
 * 中文源字面量保留在本表中文键中，不改动既有业务代码里的中文。
 */
const fs = require('fs');
const path = require('path');

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

let lang = 'zh';
function loadLang() {
  try {
    const p = STORE_FILE();
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j && (j.lang === 'en' || j.lang === 'zh')) lang = j.lang;
    }
  } catch (e) { /* keep zh */ }
  return lang;
}

function saveLang(next) {
  lang = (next === 'en') ? 'en' : 'zh';
  try {
    const p = STORE_FILE();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ lang }), 'utf8');
  } catch (e) { /* ignore */ }
}

function t(zh) {
  if (lang !== 'en') return zh;
  return Object.prototype.hasOwnProperty.call(DICT, zh) ? DICT[zh] : zh;
}

function getLang() { loadLang(); return lang; }

loadLang();

module.exports = { t, getLang, setLang: saveLang, DICT };
