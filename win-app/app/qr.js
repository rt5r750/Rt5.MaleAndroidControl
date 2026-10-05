'use strict';
const QRCode = require('qrcode');

const SERVICE_UUID = '00007500-0000-1000-8000-00805f9b34fb';
const DEFAULT_CONSOLE_NAME = 'RobotControl-Win';

function consoleQrPayload(overrides = {}) {
  return JSON.stringify({
    mac: overrides.mac || '00:00:00:00:00:00',
    name: overrides.name || DEFAULT_CONSOLE_NAME,
    service: SERVICE_UUID,
    role: 'console'
  });
}

function generateConsoleQr(overrides = {}) {
  return QRCode.toDataURL(consoleQrPayload(overrides), {
    errorCorrectionLevel: 'L',
    margin: 2,
    width: 500,
    type: 'png'
  });
}

module.exports = { consoleQrPayload, generateConsoleQr };
