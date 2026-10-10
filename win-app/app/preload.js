'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const { computeControlsWidth } = require('./titlebar-width.js');

let qrDataUrl = '';
let btStatus = 0;
// 主进程持久化的界面语言（huancun/i18n-lang.json）：preload 阶段 sendSync 一次性带回，
// 经 consoleAPI.bootLang 供 www 头脚本（i18n.js）在首帧前确定初始语言——
// 启动器设置里切换语言后，主控制台进入即跟随（页面脚本运行前已就位，无中文闪帧）
let bootLang = '';
try { bootLang = ipcRenderer.sendSync('i18n-get-lang-sync') || ''; } catch (e) { /* keep '' */ }
let btHasBond = false;
let phoneApiKey = '';
const mimoResults = new Map();
let audioEl = null;

// 依据 Window Controls Overlay 实时计算系统按钮区宽度，写入 CSS 变量供顶栏避让
function syncTitlebarWidth() {
  let width = 0;
  try {
    const wco = navigator.windowControlsOverlay;
    const fullscreen =
      (document.body && document.body.classList.contains('win-fullscreen')) || !!document.fullscreenElement;
    if (wco && wco.visible) {
      width = computeControlsWidth(window.innerWidth, wco.getTitlebarAreaRect(), fullscreen);
    }
  } catch {}
  document.documentElement.style.setProperty('--win-controls-width', width + 'px');
}

if (navigator.windowControlsOverlay) {
  navigator.windowControlsOverlay.addEventListener('titlebarareachange', syncTitlebarWidth);
}
window.addEventListener('resize', syncTitlebarWidth);
document.addEventListener('fullscreenchange', syncTitlebarWidth);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncTitlebarWidth);
} else {
  syncTitlebarWidth();
}
// Window Controls Overlay 可能晚于 preload 就绪，补几次同步避免顶栏右侧按钮被系统按钮遮挡
setTimeout(syncTitlebarWidth, 250);
setTimeout(syncTitlebarWidth, 1000);

ipcRenderer.on('qr-ready', (_event, dataUrl) => {
  qrDataUrl = String(dataUrl || '');
});

ipcRenderer.on('ble-status', (_event, status) => {
  btStatus = Number(status) || 0;
});

ipcRenderer.on('ble-bond', (_event, bond) => {
  btHasBond = !!bond;
});

// USB 进入控制台状态（默认电量设置：USB 进入且在位时显示正在充电）
let consoleUsbState = { enteredViaUsb: false, deviceId: null, present: false };
const consoleUsbListeners = new Set();

function normalizeConsoleUsbState(state) {
  return {
    enteredViaUsb: !!(state && state.enteredViaUsb),
    deviceId: state && state.deviceId ? String(state.deviceId) : null,
    present: !!(state && state.present)
  };
}

function emitConsoleUsbState() {
  consoleUsbListeners.forEach((cb) => {
    try { cb({ ...consoleUsbState }); } catch {}
  });
}

ipcRenderer.on('console-usb-state', (_event, state) => {
  consoleUsbState = normalizeConsoleUsbState(state);
  emitConsoleUsbState();
});

// 主进程已就绪时主动拉取一次，避免事件早于页面注册而丢失
ipcRenderer.invoke('console-get-usb-state').then((state) => {
  consoleUsbState = normalizeConsoleUsbState(state);
  emitConsoleUsbState();
}).catch(() => {});

ipcRenderer.on('mimo-result', (_event, cbId, resultJson) => {
  mimoResults.set(String(cbId), String(resultJson));
});

// 通用 HTTP 桥（v1.12.0 Clawbot）：结果存表，getHttpFetchResult 同步取回
const httpResults = new Map();
ipcRenderer.on('http-result', (_event, cbId, resultJson) => {
  httpResults.set(String(cbId), String(resultJson));
});

function normalizeEngine(engine) {
  const e = String(engine || 'voicedesign');
  if (e === 'voiceclone') return 'voicedesign';
  return e === 'birch' || e === 'voicedesign' ? e : 'voicedesign';
}

function readLocal(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

// API Key 清洗：去除首尾空白与成对引号（粘贴/同步时可能带入 "sk-..."）
function normalizeApiKey(key) {
  let k = String(key || '').trim();
  if (k.length >= 2 && ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'")))) {
    k = k.slice(1, -1).trim();
  }
  return k;
}

contextBridge.exposeInMainWorld('Android', {
  getSafeAreaTop: () => 0,
  getSafeAreaBottom: () => 0,
  getImeHeight: () => 0,
  setModalState: () => {},

  openExternalUrl: (url) => {
    if (typeof url === 'string' && url) ipcRenderer.send('open-external', url);
  },
  openPdfFile: (filePath) => {
    if (typeof filePath === 'string' && filePath) ipcRenderer.send('open-pdf', filePath);
  },

  // BLE 外设：经 IPC 桥接到主进程 → C# 宿主（Windows GATT Server）
  btGetStatus: () => btStatus,
  btUnbond: () => ipcRenderer.send('bt-unbond'),
  btShowQr: () => qrDataUrl,
  btStartConnect: () => ipcRenderer.send('bt-start-connect'),
  btOnPageLoaded: () => ipcRenderer.send('bt-page-loaded'),
  btHasClientBond: () => btHasBond,

  onDataChanged: (type, json) => {
    if (typeof type === 'string' && type) {
      ipcRenderer.send('bt-data-changed', type, String(json == null ? '' : json));
    }
  },

  getMimoApiKey: () => {
    const key = normalizeApiKey(readLocal('mimoApiKey') || phoneApiKey);
    if (key) writeLocal('mimoApiKey', key);
    return key;
  },
  setMimoApiKey: (key) => writeLocal('mimoApiKey', normalizeApiKey(key)),
  getTtsEngine: () => {
    const engine = normalizeEngine(readLocal('mimoTtsEngine'));
    writeLocal('mimoTtsEngine', engine);
    return engine;
  },
  setTtsEngine: (engine) => writeLocal('mimoTtsEngine', normalizeEngine(engine)),

  mimoFetchAsync: (bodyJson, cbId) => {
    ipcRenderer.send('mimo-fetch', {
      bodyJson: String(bodyJson || ''),
      cbId: String(cbId || ''),
      apiKey: normalizeApiKey(readLocal('mimoApiKey'))
    });
  },
  getMimoFetchResult: (cbId) => {
    const key = String(cbId);
    const result = mimoResults.get(key);
    mimoResults.delete(key);
    return result || '';
  },

  // 通用 HTTP 桥（v1.12.0 Clawbot）：URL/options 通用，白名单在主进程校验
  httpFetchAsync: (url, optionsJson, cbId) => {
    ipcRenderer.send('http-fetch', {
      url: String(url || ''),
      optionsJson: String(optionsJson || '{}'),
      cbId: String(cbId || '')
    });
  },
  getHttpFetchResult: (cbId) => {
    const key = String(cbId);
    const result = httpResults.get(key);
    httpResults.delete(key);
    return result || '';
  },

  playAudioBase64: (base64Data, mimeType, callbackId) => {
    const cbId = String(callbackId || '');
    const done = (ok, err) => ipcRenderer.send('audio-done', cbId, ok, err || '');
    try {
      const binary = atob(String(base64Data || ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: String(mimeType || 'audio/wav') });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioEl = audio;
      const finish = (ok, err) => {
        if (audioEl === audio) audioEl = null;
        try { URL.revokeObjectURL(url); } catch {}
        done(ok, err);
      };
      audio.onended = () => finish(true, '');
      audio.onerror = () => finish(false, 'Audio playback error');
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((e) => finish(false, e && e.message ? e.message : 'play() rejected'));
      }
    } catch (e) {
      done(false, e && e.message ? e.message : 'decode error');
    }
  },
  stopAudio: () => {
    if (!audioEl) return;
    try { audioEl.pause(); } catch {}
    try { audioEl.src = ''; } catch {}
    audioEl = null;
  },

  getRotationVideoBgColor: () => '29,62,29'
});

// 仿 Win11 自绘窗口控制按钮（仅 Electron 主控制台窗口使用）
contextBridge.exposeInMainWorld('consoleAPI', {
  minimizeWindow: () => ipcRenderer.send('win-minimize'),
  toggleMaximize: () => ipcRenderer.send('win-maximize-toggle'),
  closeWindow: () => ipcRenderer.send('win-close'),
  toggleFullscreen: () => ipcRenderer.send('win-fullscreen-toggle'),
  backToLauncher: () => ipcRenderer.send('win-back-to-launcher'),
  onMaximizedChange: (callback) => {
    ipcRenderer.on('win-maximized', (_event, maximized) => {
      if (typeof callback === 'function') callback(!!maximized);
    });
  },
  onFullscreenChange: (callback) => {
    ipcRenderer.on('win-fullscreen', (_event, fullscreen) => {
      if (typeof callback === 'function') callback(!!fullscreen);
    });
  },
  setUiLang: (lang) => ipcRenderer.send('i18n-set-lang', String(lang || 'zh')),
  getUiLang: () => ipcRenderer.invoke('i18n-get-lang'),
  // 型号信息（v1.6.0）：控制台保存/启动时推送生效值给主进程（启动器经 model-info-get 读取）
  setModelInfo: (info) => ipcRenderer.send('model-info-set', info),
  // First Run（v1.10.0）：激活页完成/跳过后通知主进程收尾（关激活窗口 → 回启动器）；
  // firstRunReady 携带"是否真的需要填表"——已激活用户直接收尾，不闪出激活窗口。
  firstRunDone: () => ipcRenderer.send('firstrun-done'),
  firstRunReady: (needsForm) => ipcRenderer.send('firstrun-ready', !!needsForm),
  bootLang: bootLang
});

// 电量默认设置 USB 联动桥接：getState() 同步读取，onStateChanged 监听主进程推送
contextBridge.exposeInMainWorld('consoleUSB', {
  getState: () => ({ ...consoleUsbState }),
  onStateChanged: (callback) => {
    if (typeof callback !== 'function') return;
    consoleUsbListeners.add(callback);
    try { callback({ ...consoleUsbState }); } catch {}
  }
});
