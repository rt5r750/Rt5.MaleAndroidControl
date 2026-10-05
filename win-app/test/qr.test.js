'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { consoleQrPayload, generateConsoleQr } = require('../app/qr.js');

test('consoleQrPayload contains console pairing info', () => {
  const payload = JSON.parse(consoleQrPayload());
  assert.equal(payload.role, 'console');
  assert.equal(payload.name, 'RobotControl-Win');
  assert.equal(payload.service, '00007500-0000-1000-8000-00805f9b34fb');
  assert.ok(payload.mac);
});

test('consoleQrPayload supports real mac/name overrides', () => {
  const payload = JSON.parse(consoleQrPayload({ mac: '80:13:16:3C:AA:AE', name: 'RobotControl-Win' }));
  assert.equal(payload.mac, '80:13:16:3C:AA:AE');
  assert.equal(payload.name, 'RobotControl-Win');
  assert.equal(payload.role, 'console');
});

test('generateConsoleQr returns png data url', async () => {
  const out = await generateConsoleQr();
  assert.match(out, /^data:image\/png;base64,/);
  assert.ok(out.length > 200);
});
