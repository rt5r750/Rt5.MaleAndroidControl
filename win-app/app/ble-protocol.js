'use strict';

// win-app 主进程 <-> C# BLE 宿主（RobotControl-BleHost.exe）的命名管道 JSON 行协议。

function encodeMessage(message) {
  return JSON.stringify(message) + '\n';
}

// 返回 { push(chunk), reset() }：把流式数据切成 JSON 行，逐行回调 onLine。
function createLineDecoder(onLine) {
  let buffer = '';
  return {
    push(chunk) {
      buffer += String(chunk);
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          onLine(JSON.parse(line));
        } catch (e) {
          // 忽略损坏行
        }
      }
    },
    reset() {
      buffer = '';
    }
  };
}

// 前端 onDataChanged(type, json) 格式 → 宿主特征字节值（base64）。
function encodeDataValue(type, json) {
  switch (type) {
    case 'mode': {
      const ordinal = parseInt(String(json), 10);
      const n = Number.isFinite(ordinal) ? ordinal : 255;
      return Buffer.from([n & 0xff]).toString('base64');
    }
    case 'emotion': {
      const parts = String(json).split(',').map((s) => parseInt(s.trim(), 10));
      const bytes = [];
      for (let i = 0; i < 4; i++) {
        const v = Number.isFinite(parts[i]) ? parts[i] : 0;
        bytes.push(Math.max(0, Math.min(100, v)) & 0xff);
      }
      return Buffer.from(bytes).toString('base64');
    }
    case 'tasks':
    case 'voice':
    case 'voice-history':
    case 'apikey':
    default:
      return Buffer.from(String(json == null ? '' : json), 'utf8').toString('base64');
  }
}

// 前端 type → 宿主特征名
const CHAR_NAMES = {
  mode: 'mode',
  emotion: 'emotion',
  tasks: 'tasks',
  voice: 'voice',
  'voice-history': 'voice',
  heartbeat: 'heartbeat',
  apikey: 'apikey',
  'ui-lang': 'ui-lang'
};

module.exports = { encodeMessage, createLineDecoder, encodeDataValue, CHAR_NAMES };
