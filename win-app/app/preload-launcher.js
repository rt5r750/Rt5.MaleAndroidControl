'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('launcher-minimize'),
  close: () => ipcRenderer.send('launcher-close'),
  enterConsole: (payload) => ipcRenderer.send('launcher-enter-console', payload || {}),
  getUsbDevices: () => ipcRenderer.invoke('launcher-get-usb-devices'),
  // 启动器保存的 USB 设备规则：持久化到 huancun 文件（跨启动永续）
  getUsbDevicesConfig: () => ipcRenderer.invoke('launcher-get-usb-devices-config'),
  setUsbDevicesConfig: (devices) => ipcRenderer.send('launcher-set-usb-devices-config', devices),
  // 首帧内容渲染完成后再显示窗口，避免出现无控件空窗
  markRendered: () => ipcRenderer.send('launcher-rendered'),
  // 主窗口接管时淡出“正在进入控制台”遮罩
  onExitFade: (callback) => {
    ipcRenderer.on('launcher-exit-fade', () => {
      if (typeof callback === 'function') callback();
    });
  },

  // For USB hot-plug events (to be wired up with node-usb or wmi):
  // Main process should send 'usb-attached' / 'usb-detached' events
  onUsbAttached: (callback) => {
    ipcRenderer.on('usb-attached', (_event, deviceInfo) => callback(deviceInfo));
  },
  onUsbDetached: (callback) => {
    ipcRenderer.on('usb-detached', (_event, deviceInfo) => callback(deviceInfo));
  },

  // 界面语言（与主控制台 www 设置共用 robot_ui_lang；i18n-set-lang/i18n-get-lang 由 main.js 注册）
  getUiLang: () => ipcRenderer.invoke('i18n-get-lang'),
  setUiLang: (lang) => ipcRenderer.send('i18n-set-lang', String(lang || 'zh')),
  // 型号信息（v1.6.0）：主控制台保存的生效值（zh 源串四键），主标题随之统一
  getModelInfo: () => ipcRenderer.invoke('model-info-get')
});
