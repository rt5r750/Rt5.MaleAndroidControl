'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { BleBridge, resolveHostPath } = require('../app/ble-bridge.js');

test('resolveHostPath uses resources/ble-host in packaged mode', () => {
  const p = resolveHostPath({
    appRoot: 'C:\\app',
    resourcesPath: 'C:\\app\\resources',
    isPackaged: true
  });
  assert.equal(p, path.join('C:\\app\\resources', 'ble-host', 'RobotControl-BleHost.exe'));
});

test('resolveHostPath uses ble-host/publish in dev mode', () => {
  const p = resolveHostPath({
    appRoot: 'C:\\app\\app',
    resourcesPath: '',
    isPackaged: false
  });
  assert.equal(p, path.join('C:\\app\\app', '..', 'ble-host', 'publish', 'RobotControl-BleHost.exe'));
});

test('BleBridge send returns false when not connected', () => {
  const bridge = new BleBridge({ hostPath: '' });
  assert.equal(bridge.send({ type: 'start' }), false);
  assert.equal(bridge.startAdvertising(), false);
  assert.equal(bridge.stopAdvertising(), false);
});

test('BleBridge emits specific event for host messages', () => {
  const bridge = new BleBridge({ hostPath: '' });
  const seen = [];
  bridge.on('device-connected', (msg) => seen.push(['device-connected', msg.address]));
  bridge.on('apikey', (msg) => seen.push(['apikey', msg.key]));
  bridge.handleMessage({ type: 'device-connected', address: 'AA:BB' });
  bridge.handleMessage({ type: 'apikey', key: 'k1' });
  assert.deepEqual(seen, [
    ['device-connected', 'AA:BB'],
    ['apikey', 'k1']
  ]);
});
