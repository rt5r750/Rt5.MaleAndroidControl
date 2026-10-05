'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const LAUNCHER_HTML = path.join(__dirname, '..', '..', 'design', 'launcher.html');
const MAIN_JS = path.join(__dirname, '..', 'app', 'main.js');
const PRELOAD_LAUNCHER = path.join(__dirname, '..', 'app', 'preload-launcher.js');

test('launcher persists saved USB device rules to huancun file via IPC (not only localStorage)', () => {
  const html = fs.readFileSync(LAUNCHER_HTML, 'utf8');
  // 保存：既写入文件桥接，也写 localStorage
  assert.match(html, /getUsbDevicesConfig/);
  assert.match(html, /setUsbDevicesConfig/);
  assert.match(html, /reconcileUsbDevicesFromFile/);
  // 启动时用文件持久源回填快照
  assert.match(html, /reconcileUsbDevicesFromFile\(\)\.then/);
  // 添加检测设备后立即保存，避免遗忘
  assert.match(html, /addSelectedDetectedDevices/);
  const addFn = html.match(/function addSelectedDetectedDevices\(\)[\s\S]*?\n    \}/);
  assert.ok(addFn, 'addSelectedDetectedDevices should exist');
  assert.match(addFn[0], /saveUsbDevices\(\)/);
});

test('main.js exposes launcher USB devices config IPC handlers', () => {
  const mainJs = fs.readFileSync(MAIN_JS, 'utf8');
  assert.match(mainJs, /LAUNCHER_USB_DEVICES_PATH/);
  assert.match(mainJs, /launcher-get-usb-devices-config/);
  assert.match(mainJs, /launcher-set-usb-devices-config/);
});

test('preload-launcher wires USB config bridge', () => {
  const preload = fs.readFileSync(PRELOAD_LAUNCHER, 'utf8');
  assert.match(preload, /getUsbDevicesConfig/);
  assert.match(preload, /setUsbDevicesConfig/);
});
