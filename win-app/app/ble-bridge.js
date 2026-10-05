'use strict';

const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const net = require('node:net');
const nodeFs = require('node:fs');
const path = require('node:path');
const { encodeMessage, createLineDecoder } = require('./ble-protocol.js');
const i18n = require('./i18n.js');

// 宿主路径解析（独立函数便于单测）
function resolveHostPath({ appRoot, resourcesPath, isPackaged }) {
  if (isPackaged && resourcesPath) {
    return path.join(resourcesPath, 'ble-host', 'RobotControl-BleHost.exe');
  }
  return path.join(appRoot, '..', 'ble-host', 'publish', 'RobotControl-BleHost.exe');
}

class BleBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.hostPath = options.hostPath || '';
    this.restartDelayMs = options.restartDelayMs || 5000;
    this.maxRestarts = options.maxRestarts || 5;
    this.spawnFn = options.spawnFn || spawn;
    this.connectFn = options.connectFn || net.connect;
    this.child = null;
    this.socket = null;
    this.decoder = createLineDecoder((msg) => this.handleMessage(msg));
    this.started = false;
    this.stopping = false;
    this.restartCount = 0;
    this.restartTimer = null;
    this.pipeName = '';
  }

  get connected() {
    return !!this.socket && !this.socket.destroyed;
  }

  start() {
    if (this.stopping) return;
    this.started = true;
    this.ensureConnected();
  }

  ensureConnected() {
    if (this.stopping || this.connected) return;
    // 宿主进程已在运行（可能只是管道未连上）：仅重连管道，不重复 spawn
    if (this.child) {
      if (!this.pipeName) return;
      this.connectPipe(this.pipeName);
      return;
    }
    if (!this.hostPath || !nodeFs.existsSync(this.hostPath)) {
      this.emit('error', i18n.t('未找到 BLE 宿主程序（RobotControl-BleHost.exe），请重新打包'));
      return;
    }
    try {
      const pipeName = this.pipeName || `robotcontrol-ble-${process.pid}-${Date.now().toString(36)}`;
      this.pipeName = pipeName;
      const child = this.spawnFn(this.hostPath, ['--pipe', pipeName], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      this.child = child;
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => this.emit('stdout', String(chunk)));
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => this.emit('stderr', String(chunk)));
      child.on('error', (err) => {
        this.child = null;
        this.closeSocket();
        this.emit('error', `${i18n.t('BLE 宿主启动失败：')}${err.message}`);
        this.scheduleRestart();
      });
      child.on('exit', (code, signal) => {
        this.child = null;
        this.closeSocket();
        if (!this.stopping) this.scheduleRestart();
      });
      this.connectPipe(pipeName);
    } catch (e) {
      this.emit('error', `${i18n.t('BLE 宿主启动异常：')}${e.message}`);
      this.scheduleRestart();
    }
  }

  connectPipe(pipeName) {
    let socket;
    try {
      socket = this.connectFn({ path: `\\\\.\\pipe\\${pipeName}` });
    } catch (e) {
      this.retryConnect(pipeName);
      return;
    }
    this.socket = socket;
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      this.restartCount = 0;
      this.emit('connect');
    });
    socket.on('data', (chunk) => this.decoder.push(chunk));
    socket.on('error', () => {
      this.closeSocket();
      if (!this.stopping) this.retryConnect(pipeName);
    });
    socket.on('close', () => {
      this.socket = null;
      if (!this.stopping) this.retryConnect(pipeName);
    });
  }

  retryConnect(pipeName) {
    if (this.stopping || this.connected || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.stopping || this.connected) return;
      if (this.child) {
        this.connectPipe(pipeName);
      } else {
        this.scheduleRestart();
      }
    }, 500);
  }

  closeSocket() {
    if (this.socket) {
      try { this.socket.destroy(); } catch (e) {}
      this.socket = null;
    }
  }

  scheduleRestart() {
    if (this.stopping || this.restartTimer) return;
    if (this.restartCount >= this.maxRestarts) {
      this.emit('error', i18n.t('BLE 宿主连续启动失败，请重启应用后重试'));
      return;
    }
    this.restartCount++;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.ensureConnected();
    }, this.restartDelayMs);
  }

  send(message) {
    if (!this.connected) return false;
    try {
      this.socket.write(encodeMessage(message));
      return true;
    } catch (e) {
      return false;
    }
  }

  startAdvertising() {
    return this.send({ type: 'start' });
  }

  stopAdvertising() {
    return this.send({ type: 'stop' });
  }

  updateData(charName, base64Value) {
    return this.send({ type: 'data', char: charName, value: base64Value });
  }

  handleMessage(msg) {
    this.emit('message', msg);
    if (msg && typeof msg.type === 'string') {
      this.emit(msg.type, msg);
    }
  }

  stop() {
    this.stopping = true;
    this.started = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.closeSocket();
    if (this.child) {
      try { this.child.kill(); } catch (e) {}
      this.child = null;
    }
  }
}

module.exports = { BleBridge, resolveHostPath };
