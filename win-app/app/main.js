'use strict';
const { app, BrowserWindow, ipcMain, shell, net, protocol, screen } = require('electron');
const path = require('node:path');
const nodeFs = require('node:fs');
const { createProtocolHandler } = require('./protocol-handler.js');
const { generateConsoleQr } = require('./qr.js');
const { resolveOpenPath } = require('./paths.js');
const { buildTtsCallbackJs, buildFetchCallbackJs } = require('./js-utils.js');
const { UsbWatcher } = require('./usb-watcher.js');
const { BleBridge, resolveHostPath } = require('./ble-bridge.js');
const { encodeDataValue, CHAR_NAMES } = require('./ble-protocol.js');
const { createUsbEntry, computePresence } = require('./usb-presence.js');
const i18n = require('./i18n.js');

// 允许闪屏视频带声音自动播放（用户已通过启动器点击进入，避免 autoplay 策略拦截）
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// ============ 日志安全包装：GUI/无控制台启动时 stdout 可能已关闭，避免 EPIPE 抛错弹 Error 框冻结整个应用 ============
const __origLog = console.log.bind(console);
const __origWarn = console.warn.bind(console);
const __origError = console.error.bind(console);
console.log = (...args) => { try { __origLog(...args); } catch (e) {} };
console.warn = (...args) => { try { __origWarn(...args); } catch (e) {} };
console.error = (...args) => { try { __origError(...args); } catch (e) {} };

const APP_ROOT = __dirname;
// In dev: win-app/app/ → ../../design (project root/design)
// In packaged: resources/app.asar/app/ → ../../design (resources/design via extraResources)
const DESIGN_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'design')
  : path.join(APP_ROOT, '..', '..', 'design');
const WWW_ROOT = path.join(APP_ROOT, 'www');
const MIMO_API_URL = 'https://api.xiaomimimo.com/v1/chat/completions';
const APP_SCHEME = 'app';
const APP_HOST = 'bundle';

// ============ 运行时数据目录：全部落在代码根目录的 huancun（避免写入 C 盘） ============
// 开发模式：win-app 根目录；打包后：若 exe 在 runtime/ 子目录，则使用父目录作为根目录
const EXEC_DIR = path.dirname(process.execPath);
const HUANCUN_BASE_DIR = app.isPackaged
  ? (process.env.PORTABLE_EXECUTABLE_DIR || (path.basename(EXEC_DIR).toLowerCase() === 'runtime' ? path.dirname(EXEC_DIR) : EXEC_DIR))
  : path.resolve(__dirname, '..');
const HUANCUN_DIR = path.join(HUANCUN_BASE_DIR, 'huancun');
const HUANCUN_TMP_DIR = path.join(HUANCUN_DIR, 'tmp');
const LAUNCHER_READY_FLAG = path.join(HUANCUN_DIR, '.launcher-ready');
const BLE_STATE_PATH = path.join(HUANCUN_DIR, 'ble-state.json');
// 启动器保存的 USB 设备规则：持久化到 huancun 文件，避免便携版解压目录变化导致 localStorage 被遗忘
const LAUNCHER_USB_DEVICES_PATH = path.join(HUANCUN_DIR, 'launcher-usb-devices.json');
// 型号信息（v1.6.0）：www 控制台保存后推送生效值，启动器跨 origin（app://design vs app://bundle）
// 读不到控制台 localStorage，经此文件 + IPC 中转
const MODEL_INFO_PATH = path.join(HUANCUN_DIR, 'model-info.json');
// First Run 完成标记（v1.10.0）：首次启动时先弹激活窗口，完成后回启动器走原流程
const FIRST_RUN_PATH = path.join(HUANCUN_DIR, 'activated.json');
const WIN_CONSOLE_NAME = 'RobotControl-Win';
// 本次应用启动的唯一纪元：启动器测试模式等"仅本次启动生效"状态以它判定是否同一次启动
const LAUNCH_EPOCH = `${Date.now().toString(36)}-${process.pid}`;

// 进程级 TEMP 一并重定向，Chromium 的临时文件不再落到 C 盘
process.env.TEMP = HUANCUN_TMP_DIR;
process.env.TMP = HUANCUN_TMP_DIR;

// 首次启动：把旧的 %APPDATA%\robotcontrol-windows-console 数据迁移到 huancun（仅一次）
const OLD_USER_DATA_DIR = path.join(app.getPath('appData'), 'robotcontrol-windows-console');
const NEW_USER_DATA_DIR = path.join(HUANCUN_DIR, 'userData');
try {
  nodeFs.mkdirSync(HUANCUN_DIR, { recursive: true });
  nodeFs.mkdirSync(HUANCUN_TMP_DIR, { recursive: true });
  // 每次启动前清理旧的 launcher-ready 标记
  try { nodeFs.rmSync(LAUNCHER_READY_FLAG, { force: true }); } catch (e) {}
  // 读取 BLE 绑定标记（是否曾有手机连接过，供 btHasClientBond 使用）
  try {
    if (nodeFs.existsSync(BLE_STATE_PATH)) {
      const savedBle = JSON.parse(nodeFs.readFileSync(BLE_STATE_PATH, 'utf8'));
      bleHasBond = !!savedBle.hasBond;
    }
  } catch (e) {}
  if (!nodeFs.existsSync(NEW_USER_DATA_DIR) && nodeFs.existsSync(OLD_USER_DATA_DIR)) {
    nodeFs.cpSync(OLD_USER_DATA_DIR, NEW_USER_DATA_DIR, { recursive: true });
    console.log('[huancun] 已迁移旧用户数据到', NEW_USER_DATA_DIR);
  }
} catch (e) {
  console.error('[huancun] 初始化失败:', e);
}
app.setPath('userData', NEW_USER_DATA_DIR);
console.log('[huancun] userData =', NEW_USER_DATA_DIR);

let launcherWindow = null;
let mainWindow = null;
let firstRunWindow = null;
// First Run 相位：pending=窗口已建待页面表态 | form=正在填表 | done/timeout/closed=已收尾
let firstRunPhase = 'none';
let launcherShown = false;
let qrDataUrl = '';
let usbWatcher = null;
let bleBridge = null;
let bleStatus = 0;          // BLE_STATUS_*（0 未绑定/1 已连接/2 断开/3 连接中/4 手动断开）
let bleHasBond = false;
let bleManualDisconnect = false;
// USB 进入控制台状态：通过 USB 设备进入（非测试模式）+ 当前 USB 在位（默认电量设置=充电）
let consoleUsbEntry = { enteredViaUsb: false, deviceId: null, present: false };
// 返回启动器标记：主窗口因“返回”关闭时重建启动器；因关闭按钮关闭时退出应用
let returningToLauncher = false;

const APP_ICON = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.ico')
  : path.join(__dirname, '..', 'build', 'icon.ico');

// ============ 单实例锁 + robotcontrol:// OS 协议（浏览器端"打开 App"拉起引导） ============
// 已有实例在跑时：本次进程立即退出，由首实例把主控制台（或启动器）窗口带到前台
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : launcherWindow;
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  // 注册 HKCU 级 URL 协议（无需管理员，绿色版可用）：robotcontrol://console
  // 开发模式必须显式传 app 路径，否则拉起的是不带应用的裸 electron.exe
  try {
    if (app.isPackaged) app.setAsDefaultProtocolClient('robotcontrol');
    else app.setAsDefaultProtocolClient('robotcontrol', process.execPath, [path.resolve(__dirname, '..')]);
  } catch (e) { console.error('[protocol] robotcontrol 注册失败:', e); }
}

// Fixed origin (app://bundle) to prevent localStorage invalidation from local port changes
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);

// ============ First Run 激活窗口（v1.10.0）============
// 首次启动（huancun/activated.json 无 done 标记）时先弹激活窗口，完成后回到启动器继续原流程。
// 内容复用 www 控制台的激活页（?firstrun=1），与主控制台同 origin（app://bundle）——
// 表单实现只有一份，激活结果直接写控制台自身的 localStorage。
function isFirstRunDone() {
  try {
    if (!nodeFs.existsSync(FIRST_RUN_PATH)) return false;
    const j = JSON.parse(nodeFs.readFileSync(FIRST_RUN_PATH, 'utf8'));
    return !!(j && j.done === true);
  } catch (e) {
    return false;
  }
}

function markFirstRunDone() {
  try {
    nodeFs.mkdirSync(HUANCUN_DIR, { recursive: true });
    nodeFs.writeFileSync(FIRST_RUN_PATH, JSON.stringify({ done: true, at: new Date().toISOString() }), 'utf8');
  } catch (e) {
    console.error('[firstrun] 写入激活标记失败:', e);
  }
}

function createFirstRunWindow() {
  if (firstRunWindow && !firstRunWindow.isDestroyed()) {
    firstRunWindow.show();
    firstRunWindow.focus();
    return;
  }
  firstRunWindow = new BrowserWindow({
    width: 1080,
    height: 860,
    minWidth: 900,
    minHeight: 700,
    center: true,
    show: false,
    frame: false,
    transparent: false,
    roundedCorners: true,
    backgroundMaterial: 'acrylic',
    backgroundColor: '#050d05',
    resizable: true,
    icon: APP_ICON,
    autoHideMenuBar: true,
    title: 'Master',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  firstRunWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  firstRunWindow.webContents.on('will-navigate', (event, url) => {
    if (/^https?:/i.test(String(url || ''))) {
      event.preventDefault();
      shell.openExternal(String(url));
    }
  });

  // 用户直接关闭激活窗口 = 跳过 First Run：与 www/Android、slave 同一语义——跳过即置完成，
  // 否则每次启动都会再弹（用户按 Alt+F4 也永远甩不掉）。完成激活走
  // finishFirstRunAndOpenLauncher（已先写标记，此处重复写为幂等）。
  firstRunWindow.once('closed', () => {
    const wasForm = firstRunPhase === 'form';
    firstRunWindow = null;
    firstRunPhase = 'closed';
    if (wasForm) markFirstRunDone();
    if (!launcherWindow || launcherWindow.isDestroyed()) createLauncherWindow();
  });

  // 窗口保持隐藏直到页面报出「是否需要填表」：已激活用户（旧版升级、宿主标记丢失）
  // 由 firstRunReady(false) 直接收尾，不闪窗。
  // 兜底：3s 内没有任何信号说明页面自身出错（缺文件/脚本异常）——此时不得把用户
  // 卡在一个显示控制台登录页的窗口里，直接关窗进启动器，且**不写标记**，
  // 让控制台内置的激活页继续兜底。
  const firstRunShowFallback = setTimeout(() => {
    if (!firstRunWindow || firstRunWindow.isDestroyed()) return;
    if (firstRunPhase === 'pending') {
      console.error('[firstrun] 页面未在 3s 内就绪，跳过激活窗口转由控制台内置激活页兜底');
      const w = firstRunWindow;
      firstRunWindow = null;
      firstRunPhase = 'timeout';
      w.destroy();
      if (!launcherWindow || launcherWindow.isDestroyed()) createLauncherWindow();
      return;
    }
    if (firstRunPhase === 'form' && !firstRunWindow.isVisible()) firstRunWindow.show();
  }, 3000);
  firstRunWindow.once('closed', () => clearTimeout(firstRunShowFallback));

  const FR_PAGE = 'www/' + encodeURIComponent('芮誊T系列仿人男性机器人控制台V1.1.html') + '?firstrun=1';
  firstRunPhase = 'pending';
  firstRunWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/${FR_PAGE}`);
}

// 激活完成：写标记 → 关激活窗口 → 打开启动器（原流程）
function finishFirstRunAndOpenLauncher() {
  markFirstRunDone();
  if (firstRunWindow && !firstRunWindow.isDestroyed()) {
    firstRunWindow.destroy();
  }
  firstRunWindow = null;
  createLauncherWindow();
}

function createLauncherWindow() {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.show();
    launcherWindow.focus();
    return;
  }
  launcherShown = false;
  launcherWindow = new BrowserWindow({
    width: 580,
    height: 840,
    minWidth: 500,
    minHeight: 720,
    maxWidth: 700,
    maxHeight: 960,
    center: true,
    show: false,
    frame: false,
    // 使用 Windows 11 原生 DWM 圆角与阴影，配合非透明窗口恢复任务栏动画
    transparent: false,
    roundedCorners: true,
    backgroundMaterial: 'acrylic',
    backgroundColor: '#050d05',
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    icon: APP_ICON,
    autoHideMenuBar: true,
    title: 'Master',
    webPreferences: {
      preload: path.join(__dirname, 'preload-launcher.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Windows 11 acrylic frosted glass effect
  // Apply immediately and re-apply on show for reliability
  function applyAcrylic() {
    if (launcherWindow && !launcherWindow.isDestroyed() && launcherWindow.setBackgroundMaterial) {
      try { launcherWindow.setBackgroundMaterial('acrylic'); } catch (e) {}
    }
  }

  // 非透明窗口由 DWM 负责原生圆角、阴影与任务栏动画，无需 setShape
  applyAcrylic();

  launcherWindow.once('ready-to-show', () => {
    // 不再以 ready-to-show 直接显示：等待页面内容渲染完成的 IPC 信号再显示，
    // 避免先出现无控件的空窗；此处仅作兜底，防止信号异常导致窗口一直不出现
    setTimeout(() => { showLauncherWindow(); }, 2500);
  });

  launcherWindow.once('show', () => {
    applyAcrylic();
    // 启动器首屏已显示，再异步初始化 QR/USB，避免阻塞窗口出现
    startBackgroundServices();
  });

  launcherWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // 无 target="_blank" 的外链（http/https）同样交给系统默认浏览器，避免在壳内导航顶掉界面
  launcherWindow.webContents.on('will-navigate', (event, url) => {
    if (/^https?:/i.test(String(url || ''))) {
      event.preventDefault();
      shell.openExternal(String(url));
    }
  });

  // 启动器界面加载完成后写入标记，供 splash-loader 等待后再淡出
  launcherWindow.webContents.on('did-finish-load', () => {
    try {
      nodeFs.writeFileSync(LAUNCHER_READY_FLAG, '1');
      console.log('[launcher] ready flag written');
    } catch (e) {
      console.error('[launcher] 写入 ready 标记失败:', e);
    }
  });

  launcherWindow.on('closed', () => {
    launcherWindow = null;
    // 进入主控制台时主窗口仍在运行：保持 USB 轮询，供主控制台实时检测拔插（默认电量=充电联动）
    if (!mainWindow || mainWindow.isDestroyed()) stopUsbWatcher();
    // 进入主控制台时启动器会被销毁：主控制台仍在运行则不退出应用
    if (!mainWindow || mainWindow.isDestroyed()) app.quit();
  });

  // Load launcher via stable app://design origin（避免便携版自解压目录变化导致 localStorage 丢失）
  // launch 查询参数 = 本次进程启动纪元：启动器据此把测试模式恢复限定在同一应用启动内
  launcherWindow.loadURL(`${APP_SCHEME}://design/launcher.html?launch=${LAUNCH_EPOCH}`);
}

// 页面首帧内容渲染完成后才显示启动器窗口
function showLauncherWindow() {
  if (launcherShown || !launcherWindow || launcherWindow.isDestroyed()) return;
  launcherShown = true;
  launcherWindow.show();
  try { launcherWindow.focus(); } catch (e) {}
  try { launcherWindow.moveTop(); } catch (e) {}
  // 返回启动器：主窗口已隐藏，启动器淡入后关闭已隐藏的主窗口（无关闭动画/抽搐）
  if (returningToLauncher && mainWindow && !mainWindow.isDestroyed()) {
    setTimeout(() => {
      if (returningToLauncher && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
      }
    }, 400);
  }
}

function createMainWindow() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    // 最小网页尺寸：宽度为运行参数文本单行显示的阈值；高度为第一栏/第二栏各自最小高度取大者
    minWidth: 1300,
    minHeight: 815,
    center: true,
    // 首帧渲染完成后再显示，避免出现中间态/背景闪动
    show: false,
    // 无边框窗口 + 自绘毛玻璃标题栏（WCO 原生按钮在本环境无法渲染且图标状态异常）
    frame: false,
    // 窗口级 Acrylic：标题栏透明区透出对当前电脑桌面的毛玻璃（与启动器一致）
    backgroundMaterial: 'acrylic',
    transparent: false,
    roundedCorners: true,
    // 深色回退底色：Acrylic 不可用/透明区未合成时仍呈深色毛玻璃观感
    backgroundColor: '#0d1a0d',
    icon: APP_ICON,
    autoHideMenuBar: true,
    title: i18n.t('已连接至T31-750型仿人男性机器人的内部系统'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // 与启动器一致：显式补设 Acrylic，确保透明标题栏区能透出桌面毛玻璃
  if (mainWindow && mainWindow.setBackgroundMaterial) {
    try { mainWindow.setBackgroundMaterial('acrylic'); } catch (e) {}
  }

  // 主窗口首帧渲染完成后柔和淡入；同时让启动器“正在进入控制台”遮罩淡出，再销毁启动器，
  // 形成连贯过渡，避免硬切换闪烁
  mainWindow.once('ready-to-show', () => {
    // 主窗口以不透明方式显示（黑色闪屏覆盖启动器），避免半透明窗口在 DWM 上闪烁
    mainWindow.show();
    try { mainWindow.moveTop(); } catch (e) {}
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.webContents.send('launcher-exit-fade');
    }
    setTimeout(() => { destroyLauncher(); }, 350);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // 无 target="_blank" 的外链（http/https）同样交给系统默认浏览器，避免在壳内导航顶掉控制台
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (/^https?:/i.test(String(url || ''))) {
      event.preventDefault();
      shell.openExternal(String(url));
    }
  });

  // 全屏退出/进入快捷键：F11 切换，Esc 退出全屏（原生按钮在全屏时隐藏）
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!input || input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
    } else if (input.key === 'Escape' && mainWindow && mainWindow.isFullScreen()) {
      event.preventDefault();
      mainWindow.setFullScreen(false);
    }
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    // 主控制台就绪后启动 BLE 宿主（仅初始化，不自动广播；点击“开始连接”才广播）
    initBleBridge();
    // 下发 USB 进入方式/在位状态（默认电量设置：USB 进入且在位时显示正在充电）
    pushConsoleUsbState();
    // QR 在启动器显示后异步生成，主控制台加载完成时等待 QR 就绪再下发
    const qrUrl = await waitForQrDataUrl();
    mainWindow.webContents.send('qr-ready', qrUrl);
    mainWindow.webContents.executeJavaScript('if(window.updateSafeAreaInsets)updateSafeAreaInsets(0);').catch(() => {});
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (returningToLauncher) {
      returningToLauncher = false;
      createLauncherWindow();
    } else {
      app.quit();
    }
  });

  // 仿 Win11 自绘按钮的最大化/还原状态同步
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('win-maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('win-maximized', false);
  });

  const setWinFullscreenClass = (on) => {
    if (!mainWindow) return;
    mainWindow.webContents.send('win-fullscreen', !!on);
    mainWindow.webContents
      .executeJavaScript(`document.body.classList.${on ? 'add' : 'remove'}('win-fullscreen')`)
      .catch(() => {});
  };
  mainWindow.on('enter-full-screen', () => setWinFullscreenClass(true));
  mainWindow.on('leave-full-screen', () => setWinFullscreenClass(false));

  const MAIN_PAGE = 'www/' + encodeURIComponent('芮誊T系列仿人男性机器人控制台V1.1.html');
  mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/splash.html`);
}

// 进入主控制台后销毁启动器窗口：关闭其渲染进程并停止 USB 轮询，降低内存占用
function destroyLauncher() {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.destroy();
  }
}

function startUsbWatcher() {
  if (usbWatcher) return;
  usbWatcher = new UsbWatcher({
    onDevicesChanged: (attached, detached) => {
      if (launcherWindow && !launcherWindow.isDestroyed()) {
        for (const device of attached) {
          launcherWindow.webContents.send('usb-attached', device);
        }
        for (const device of detached) {
          launcherWindow.webContents.send('usb-detached', device);
        }
      }
      // 主控制台期间：USB 在位状态变化 → 通知前端（默认电量设置下 USB 接入=充电）
      if (consoleUsbEntry.enteredViaUsb) updateConsoleUsbPresence();
    }
  });
  usbWatcher.start();
}

function stopUsbWatcher() {
  if (!usbWatcher) return;
  usbWatcher.stop();
  usbWatcher = null;
}

// 根据最新 USB 快照计算进入时设备是否仍在位，变化时推送给主控制台
function updateConsoleUsbPresence() {
  if (!usbWatcher) return;
  const present = computePresence(consoleUsbEntry, usbWatcher.getDevices());
  if (present === consoleUsbEntry.present) return;
  consoleUsbEntry.present = present;
  pushConsoleUsbState();
}

// 把 USB 进入/在位状态推送给主控制台前端（preload 缓存 + 事件回调）
function pushConsoleUsbState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const state = {
    enteredViaUsb: consoleUsbEntry.enteredViaUsb,
    deviceId: consoleUsbEntry.deviceId,
    present: consoleUsbEntry.present
  };
  mainWindow.webContents.send('console-usb-state', state);
}

// 启动器首屏显示后再异步初始化后台服务，不阻塞窗口出现
function startBackgroundServices() {
  startUsbWatcher();
  generateConsoleQr().then((url) => {
    qrDataUrl = url;
  }).catch((e) => {
    console.error('QR 生成失败:', e);
    qrDataUrl = '';
  });
}

// 等待 QR 生成完成（用于主控制台加载时）
function waitForQrDataUrl(timeoutMs = 5000) {
  if (qrDataUrl) return Promise.resolve(qrDataUrl);
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (qrDataUrl || Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve(qrDataUrl);
      }
    }, 50);
  });
}

// ============ BLE 外设（GATT Server）桥接 ============

function execInMain(js) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(js).catch(() => {});
  }
}

function pushBtStatus(status) {
  bleStatus = status;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ble-status', status);
    execInMain(`if(window.updateBtStatus)window.updateBtStatus(${status})`);
  }
}

function setBleHasBond(value) {
  bleHasBond = !!value;
  try {
    nodeFs.writeFileSync(BLE_STATE_PATH, JSON.stringify({ hasBond: bleHasBond }));
  } catch (e) {}
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ble-bond', bleHasBond);
  }
}

function initBleBridge() {
  if (bleBridge) return bleBridge;
  bleBridge = new BleBridge({
    hostPath: resolveHostPath({
      appRoot: APP_ROOT,
      resourcesPath: app.isPackaged ? process.resourcesPath : '',
      isPackaged: app.isPackaged
    })
  });

  bleBridge.on('stdout', (chunk) => console.log('[ble-host]', chunk.replace(/\s+$/, '')));
  bleBridge.on('stderr', (chunk) => console.error('[ble-host]', chunk.replace(/\s+$/, '')));

  bleBridge.on('ready', (info) => {
    if (info && info.supported && info.mac) {
      console.log('[ble] 宿主就绪 MAC=', info.mac);
      regenerateBleQr(info.mac);
      // 宿主就绪即把当前界面语言推到 7507(UiLang)，phone 连接后初读即跟随
      pushBleUiLang(i18n.getLang());
    } else {
      console.warn('[ble] 宿主不支持外设模式:', info && info.error);
    }
  });

  bleBridge.on('device-connected', (msg) => {
    bleManualDisconnect = false;
    setBleHasBond(true);
    pushBtStatus(1);
    const addr = msg && msg.address ? JSON.stringify(String(msg.address)) : 'null';
    execInMain(`if(window.btNotifyDeviceConnected)btNotifyDeviceConnected(${addr})`);
  });

  /* 每次开始广播（特征刚建好/初值重置）都把当前语言补推到 7507，防"先切语言后开广播"被初值覆盖 */
  bleBridge.on('advertising-started', () => pushBleUiLang(i18n.getLang()));

  bleBridge.on('device-disconnected', () => {
    pushBtStatus(bleManualDisconnect ? 4 : 2);
  });

  bleBridge.on('manual-disconnect', () => {
    bleManualDisconnect = true;
    pushBtStatus(4);
  });

  bleBridge.on('apikey', (msg) => {
    if (!msg || !msg.key) return;
    execInMain(`if(window._onMimoApiKeySynced)_onMimoApiKeySynced(${JSON.stringify(String(msg.key))})`);
  });

  // 反向模式推送：客户端写入 Mode(7501) → 控制台切换到对应模式并提示「推送成功」
  bleBridge.on('mode', (msg) => {
    const ordinal = Number(msg && msg.ordinal);
    if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal > 3) return;
    execInMain(`if(window.__rcOnRemoteMode)window.__rcOnRemoteMode(${ordinal})`);
  });

  bleBridge.on('error', (message) => {
    console.warn('[ble]', message);
    execInMain(`if(window.showTripleVoiceToast)showTripleVoiceToast(${JSON.stringify(String(message))})`);
  });

  bleBridge.start();
  return bleBridge;
}

function bleSendWhenReady(message) {
  const bridge = initBleBridge();
  if (bridge.connected) return bridge.send(message);
  bridge.once('connect', () => bridge.send(message));
  return true;
}

/* 界面语言 → 7507(UiLang)：0=zh、1=en、255=未设置。语言变化即推（phone 端初读/订阅后跟随） */
function pushBleUiLang(lang) {
  const byte = lang === 'en' ? 0x01 : (lang === 'zh' ? 0x00 : 0xFF);
  bleSendWhenReady({ type: 'data', char: 'ui-lang', value: Buffer.from([byte]).toString('base64') });
}

function regenerateBleQr(mac) {
  if (!mac) return;
  generateConsoleQr({ mac, name: WIN_CONSOLE_NAME })
    .then((dataUrl) => {
      qrDataUrl = dataUrl;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('qr-ready', qrDataUrl);
      }
    })
    .catch((e) => console.error('BLE QR 生成失败:', e));
}

function registerIpc() {
  ipcMain.on('launcher-rendered', () => {
    showLauncherWindow();
  });

  ipcMain.on('open-external', (_event, url) => {
    if (/^https?:/i.test(String(url || ''))) shell.openExternal(String(url));
  });

  ipcMain.on('open-pdf', (_event, filePath) => {
    const resolved = resolveOpenPath(WWW_ROOT, String(filePath || ''));
    if (resolved) shell.openPath(resolved);
  });

  ipcMain.on('bt-start-connect', () => {
    const ok = bleSendWhenReady({ type: 'start' });
    if (!ok) {
      execInMain(`if(window.showTripleVoiceToast)showTripleVoiceToast(${JSON.stringify(i18n.t('BLE 宿主未就绪，请稍后重试'))})`);
      return;
    }
    bleManualDisconnect = false;
    pushBtStatus(3);
  });

  ipcMain.on('bt-unbond', () => {
    if (bleBridge) bleBridge.send({ type: 'stop' });
    bleManualDisconnect = true;
    setBleHasBond(false);
    pushBtStatus(4);
  });

  ipcMain.on('bt-data-changed', (_event, type, json) => {
    if (!bleBridge || typeof type !== 'string') return;
    const charName = CHAR_NAMES[type];
    if (!charName) return;
    bleBridge.updateData(charName, encodeDataValue(type, json));
  });

  ipcMain.on('bt-page-loaded', () => {
    // 连接弹窗不再主动弹出：页面加载完成后保持可交互，由用户点击蓝牙按钮再打开。
    // 保留该 IPC 入口仅为兼容页面调用，不执行任何弹窗逻辑。
  });

  // 界面语言同步：www 设置里切换中文/English 时写入 huancun，主进程原生文案随动；
  // 同时推到 7507(UiLang)：服务端照常广播，供旧版 slave 客户端订阅（1.10.0 起当前版 slave 不再消费）
  ipcMain.on('i18n-set-lang', (_event, lang) => {
    try { i18n.setLang(lang); } catch (e) { /* ignore */ }
    try { pushBleUiLang(String(lang || 'zh')); } catch (e) { /* ignore */ }
  });
  ipcMain.handle('i18n-get-lang', () => i18n.getLang());
  // preload 顶层 sendSync 一次性带回初始语言：www 头脚本（i18n.js）在首帧前即以
  // huancun/i18n-lang.json 为准——启动器设置里切换语言后，主控制台进入即跟随
  ipcMain.on('i18n-get-lang-sync', (event) => {
    event.returnValue = i18n.getLang();
  });

  // First Run（v1.10.0）：激活窗口内的激活页完成/跳过后收尾（写标记 → 关窗 → 回启动器）；
  // 控制台内完成激活时也经此回写标记，两处状态一致、不再重复弹激活窗口。
  ipcMain.on('firstrun-done', () => {
    if (firstRunWindow && !firstRunWindow.isDestroyed() && firstRunPhase !== 'done') {
      firstRunPhase = 'done';
      finishFirstRunAndOpenLauncher();
    } else {
      markFirstRunDone();
    }
  });
  ipcMain.on('firstrun-ready', (_event, needsForm) => {
    if (!firstRunWindow || firstRunWindow.isDestroyed() || firstRunPhase === 'done') return;
    // 无需填表（已激活）：不显示窗口，直接走完成路径（写标记 → 回启动器），避免闪窗
    if (needsForm === false) {
      firstRunPhase = 'done';
      finishFirstRunAndOpenLauncher();
      return;
    }
    firstRunPhase = 'form';
    if (!firstRunWindow.isVisible()) firstRunWindow.show();
  });

  // 型号信息（v1.6.0）：www 控制台保存/启动时推送生效值（zh 源串四键），
  // 启动器主标题经 model-info-get 读取；文件缺失时返回 null（启动器用默认值）
  ipcMain.handle('model-info-get', () => {
    try {
      if (nodeFs.existsSync(MODEL_INFO_PATH)) {
        return JSON.parse(nodeFs.readFileSync(MODEL_INFO_PATH, 'utf8'));
      }
    } catch (e) {
      console.error('[huancun] 读取型号信息失败:', e);
    }
    return null;
  });
  ipcMain.on('model-info-set', (_event, info) => {
    try {
      nodeFs.mkdirSync(HUANCUN_DIR, { recursive: true });
      nodeFs.writeFileSync(MODEL_INFO_PATH, JSON.stringify(info || {}));
    } catch (e) {
      console.error('[huancun] 保存型号信息失败:', e);
    }
  });

  ipcMain.handle('bt-get-status', () => bleStatus);

  ipcMain.handle('bt-has-client-bond', () => bleHasBond);

  ipcMain.on('mimo-fetch', async (_event, payload) => {
    const bodyJson = String(payload && payload.bodyJson || '');
    const cbId = String(payload && payload.cbId || '');
    const apiKey = String(payload && payload.apiKey || '');
    let resultStr;
    try {
      const response = await net.fetch(MIMO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'api-key': apiKey
        },
        body: bodyJson
      });
      const text = await response.text();
      if (!response.ok) {
        resultStr = JSON.stringify({ error: `HTTP ${response.status}: ${text.replace(/"/g, "'").slice(0, 400)}` });
      } else {
        resultStr = text;
      }
    } catch (e) {
      const msg = String(e && e.message || 'Unknown error').replace(/"/g, "'").slice(0, 300);
      resultStr = JSON.stringify({ error: `${e && e.name || 'Error'}: ${msg}` });
    }
    if (!mainWindow) return;
    mainWindow.webContents.send('mimo-result', cbId, resultStr);
    mainWindow.webContents.executeJavaScript(buildFetchCallbackJs(cbId)).catch(() => {});
  });

  ipcMain.on('audio-done', (_event, cbId, ok, errMsg) => {
    if (!mainWindow) return;
    const result = ok
      ? '{"ok":true}'
      : JSON.stringify({ ok: false, error: String(errMsg || 'Audio playback error') });
    mainWindow.webContents.executeJavaScript(buildTtsCallbackJs(String(cbId), result)).catch(() => {});
  });

  // Launcher window controls
  ipcMain.on('launcher-minimize', () => {
    if (launcherWindow && !launcherWindow.isDestroyed()) launcherWindow.minimize();
  });

  ipcMain.on('launcher-close', () => {
    if (launcherWindow && !launcherWindow.isDestroyed()) launcherWindow.close();
  });

  ipcMain.on('launcher-enter-console', (_event, payload) => {
    consoleUsbEntry = createUsbEntry(payload);
    // 进入时立即用当前 USB 快照判定在位状态，避免首帧误显示为未充电
    if (consoleUsbEntry.enteredViaUsb && usbWatcher) {
      consoleUsbEntry.present = computePresence(consoleUsbEntry, usbWatcher.getDevices());
    }
    createMainWindow();
  });

  ipcMain.handle('console-get-usb-state', () => ({
    enteredViaUsb: consoleUsbEntry.enteredViaUsb,
    deviceId: consoleUsbEntry.deviceId,
    present: consoleUsbEntry.present
  }));

  // 自绘窗口控制（仿 Win11 按钮）：主控制台与 First Run 激活窗口都是 frame:false，
  // 目标统一解析为「当前活动的无边框窗口」——激活窗口阶段 mainWindow 尚未创建，
  // 若只认 mainWindow，激活窗口标题栏的按钮会全部失效（无处可关）。
  const framelessTarget = () => {
    for (const w of [mainWindow, firstRunWindow, launcherWindow]) {
      if (w && !w.isDestroyed()) return w;
    }
    return null;
  };
  ipcMain.on('win-minimize', () => {
    const w = framelessTarget();
    if (w) w.minimize();
  });
  ipcMain.on('win-maximize-toggle', () => {
    const w = framelessTarget();
    if (!w || w === launcherWindow) return;   // 启动器不可最大化
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
  });
  ipcMain.on('win-close', () => {
    const w = framelessTarget();
    if (w) w.close();
  });

  ipcMain.on('win-fullscreen-toggle', () => {
    const w = framelessTarget();
    if (!w || w === launcherWindow) return;
    w.setFullScreen(!w.isFullScreen());
  });

  ipcMain.on('win-back-to-launcher', () => {
    returningToLauncher = true;
    if (!mainWindow || mainWindow.isDestroyed()) {
      returningToLauncher = false;
      return;
    }
    // 反向过渡：直接隐藏主窗口（无关闭动画/黑屏/抽搐），再创建并加载启动器（隐藏），
    // 就绪后启动器淡入，最后关闭已隐藏的主窗口
    mainWindow.hide();
    createLauncherWindow();
  });

  ipcMain.handle('launcher-get-usb-devices', async () => {
    if (!usbWatcher) return [];
    try {
      return await usbWatcher.refresh();
    } catch (e) {
      console.error('USB 枚举失败:', e);
      return usbWatcher.getDevices();
    }
  });

  // 启动器保存的 USB 设备规则：读/写 huancun 文件（跨启动永续，不随 localStorage/origin 丢失）
  ipcMain.handle('launcher-get-usb-devices-config', () => {
    try {
      if (nodeFs.existsSync(LAUNCHER_USB_DEVICES_PATH)) {
        return JSON.parse(nodeFs.readFileSync(LAUNCHER_USB_DEVICES_PATH, 'utf8'));
      }
    } catch (e) {
      console.error('[huancun] 读取 USB 设备规则失败:', e);
    }
    return null;
  });

  ipcMain.on('launcher-set-usb-devices-config', (_event, devices) => {
    try {
      nodeFs.mkdirSync(HUANCUN_DIR, { recursive: true });
      nodeFs.writeFileSync(LAUNCHER_USB_DEVICES_PATH, JSON.stringify(devices || []));
    } catch (e) {
      console.error('[huancun] 保存 USB 设备规则失败:', e);
    }
  });
}

app.whenReady().then(() => {
  registerIpc();
  // app://design 启动器；app://bundle 主控制台（splash.html 位于 app 根，随后跳转 www/...）
  protocol.handle(APP_SCHEME, createProtocolHandler(APP_ROOT, { design: DESIGN_ROOT, bundle: APP_ROOT }));
  // First Run（v1.10.0）：首次启动时激活窗口先于启动器出现，完成后回到启动器继续原流程；
  // 用户直接关闭激活窗口视为跳过（未写标记，控制台内的激活页仍是兜底）→ 照常进启动器。
  if (!isFirstRunDone()) {
    createFirstRunWindow();
    if (firstRunWindow && !firstRunWindow.isDestroyed()) return;
  }
  // 先创建并显示启动器，QR/USB 等后台服务在窗口 ready-to-show 后再异步初始化，减少首屏等待
  createLauncherWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (bleBridge) {
    bleBridge.stop();
    bleBridge = null;
  }
  stopUsbWatcher();
});
