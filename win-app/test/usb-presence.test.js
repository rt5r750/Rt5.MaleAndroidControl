'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { createUsbEntry, computePresence } = require('../app/usb-presence.js');

test('createUsbEntry normalizes payload', () => {
  const entry = createUsbEntry({ enteredViaUsb: true, deviceId: 'USB\\VID_1234&PID_5678\\ABC' });
  assert.strictEqual(entry.enteredViaUsb, true);
  assert.strictEqual(entry.deviceId, 'USB\\VID_1234&PID_5678\\ABC');
  assert.strictEqual(entry.present, false);
  const empty = createUsbEntry(null);
  assert.strictEqual(empty.enteredViaUsb, false);
  assert.strictEqual(empty.deviceId, null);
});

test('computePresence matches deviceId', () => {
  const entry = createUsbEntry({ enteredViaUsb: true, deviceId: 'disk1' });
  assert.strictEqual(computePresence(entry, [{ deviceId: 'disk1' }]), true);
  assert.strictEqual(computePresence(entry, [{ deviceId: 'disk2' }]), false);
  assert.strictEqual(computePresence(entry, []), false);
});

test('computePresence falls back to any device when deviceId missing', () => {
  const entry = createUsbEntry({ enteredViaUsb: true, deviceId: null });
  assert.strictEqual(computePresence(entry, []), false);
  assert.strictEqual(computePresence(entry, [{ deviceId: 'x' }]), true);
});
