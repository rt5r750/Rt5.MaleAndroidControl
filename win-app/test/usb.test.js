'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsePnPDeviceId,
  normalizeHex,
  ruleIsValid,
  validRules,
  matchesRule,
  matchesAnyRule,
  diffDeviceSets,
  parseSnapshot
} = require('../app/usb.js');
const { UsbWatcher, extractJsonLine } = require('../app/usb-watcher.js');

test('parsePnPDeviceId parses MI composite device ids', () => {
  const parsed = parsePnPDeviceId('USB\\VID_3277&PID_00FF&MI_02\\6&1EF22B4F&1&0002');
  assert.deepEqual(parsed, {
    vid: '3277',
    pid: '00FF',
    serialNumber: '6&1EF22B4F&1&0002'
  });
});

test('parsePnPDeviceId parses simple usb device ids', () => {
  const parsed = parsePnPDeviceId('USB\\VID_27C6&PID_6890\\UIDDCE0B84B_XXXX_MOC_B0');
  assert.deepEqual(parsed, {
    vid: '27C6',
    pid: '6890',
    serialNumber: 'UIDDCE0B84B_XXXX_MOC_B0'
  });
});

test('parsePnPDeviceId uppercases hex and trims input', () => {
  const parsed = parsePnPDeviceId('  usb\\vid_abcd&pid_12ef\\ser-1  ');
  assert.deepEqual(parsed, {
    vid: 'ABCD',
    pid: '12EF',
    serialNumber: 'ser-1'
  });
});

test('parsePnPDeviceId rejects non usb and malformed ids', () => {
  assert.equal(parsePnPDeviceId('PCI\\VEN_8086&DEV_9A36\\subsys'), null);
  assert.equal(parsePnPDeviceId('USB\\VID_123&PID_4567\\serial'), null);
  assert.equal(parsePnPDeviceId('USB\\VID_1234\\serial'), null);
  assert.equal(parsePnPDeviceId(''), null);
  assert.equal(parsePnPDeviceId(null), null);
});

test('normalizeHex strips prefix and lowercases', () => {
  assert.equal(normalizeHex('0x1234'), '1234');
  assert.equal(normalizeHex(' 0X00FF '), '00ff');
  assert.equal(normalizeHex('ABCD'), 'abcd');
  assert.equal(normalizeHex(''), '');
  assert.equal(normalizeHex(null), '');
});

test('ruleIsValid requires vid, pid or deviceId', () => {
  assert.equal(ruleIsValid({ vid: '0x1234' }), true);
  assert.equal(ruleIsValid({ pid: '5678' }), true);
  assert.equal(ruleIsValid({ deviceId: '\\\\.\\PHYSICALDRIVE1' }), true);
  assert.equal(ruleIsValid({}), false);
  assert.equal(ruleIsValid({ vid: '', pid: '  ' }), false);
  assert.equal(ruleIsValid({ vid: '', pid: '', deviceId: '  ' }), false);
  assert.equal(ruleIsValid({ vid: '  0x1234  ' }), true);
  assert.equal(ruleIsValid(null), false);
});

test('validRules filters invalid rules', () => {
  const rules = [
    { vid: '0x1234', pid: '' },
    { vid: '', pid: '' },
    { vid: '1234', pid: '5678' }
  ];
  assert.equal(validRules(rules).length, 2);
});

test('matchesRule supports partial wildcard matching', () => {
  const device = {
    vid: '1234',
    pid: '5678',
    serialNumber: 'SN-01',
    manufacturer: 'ACME Devices Ltd'
  };
  assert.equal(matchesRule(device, { vid: '0x1234' }), true);
  assert.equal(matchesRule(device, { pid: '5678' }), true);
  assert.equal(matchesRule(device, { vid: '1234', pid: '5678' }), true);
  assert.equal(matchesRule(device, { vid: 'abcd' }), false);
  assert.equal(matchesRule(device, { pid: '1234' }), false);
  assert.equal(matchesRule(device, { vid: '1234', serial: 'SN-01' }), true);
  assert.equal(matchesRule(device, { vid: '1234', serial: 'sn-01' }), false);
  assert.equal(matchesRule(device, { vid: '1234', manufacturer: 'ACME' }), true);
  assert.equal(matchesRule(device, { vid: '1234', manufacturer: 'XYZ' }), false);
  assert.equal(matchesRule(device, { vid: '', pid: '' }), false);
  assert.equal(matchesRule(null, { vid: '1234' }), false);
});

test('matchesRule supports deviceId matching for storage devices', () => {
  const device = { deviceId: '\\\\.\\PHYSICALDRIVE1', driveLetter: 'E:', volumeName: 'RT5' };
  assert.equal(matchesRule(device, { deviceId: '\\\\.\\PHYSICALDRIVE1' }), true);
  assert.equal(matchesRule(device, { deviceId: '\\\\.\\PHYSICALDRIVE2' }), false);
  assert.equal(matchesRule(device, { deviceId: '', vid: '', pid: '' }), false);
  assert.equal(matchesRule({ deviceId: '' }, { deviceId: '\\\\.\\PHYSICALDRIVE1' }), false);
  assert.equal(matchesRule(null, { deviceId: '\\\\.\\PHYSICALDRIVE1' }), false);
});

test('matchesRule supports volumeName and driveLetter for storage devices', () => {
  const device = { deviceId: '\\\\.\\PHYSICALDRIVE1', driveLetter: 'E:', volumeName: 'T31-750' };
  assert.equal(matchesRule(device, { deviceId: '\\\\.\\PHYSICALDRIVE1', volumeName: 'T31-750' }), true);
  assert.equal(matchesRule(device, { deviceId: '\\\\.\\PHYSICALDRIVE1', volumeName: 'OTHER' }), false);
  assert.equal(matchesRule(device, { deviceId: '\\\\.\\PHYSICALDRIVE1', driveLetter: 'E:' }), true);
  assert.equal(matchesRule(device, { deviceId: '\\\\.\\PHYSICALDRIVE1', driveLetter: 'F:' }), false);
});

test('matchesAnyRule honors must-configure semantics', () => {
  const device = { vid: '1234', pid: '5678' };
  assert.equal(matchesAnyRule(device, []), false);
  assert.equal(matchesAnyRule(device, [{ vid: '', pid: '' }]), false);
  assert.equal(matchesAnyRule(device, [{ vid: '9999' }, { pid: '5678' }]), true);
});

test('diffDeviceSets reports attached and detached by deviceId', () => {
  const a = { deviceId: 'USB\\VID_1&PID_1\\S1', vid: '0001' };
  const b = { deviceId: 'USB\\VID_2&PID_2\\S2', vid: '0002' };
  const c = { deviceId: 'USB\\VID_3&PID_3\\S3', vid: '0003' };
  const diff = diffDeviceSets([a, b], [b, c]);
  assert.deepEqual(diff.attached, [c]);
  assert.deepEqual(diff.detached, [a]);
  assert.deepEqual(diffDeviceSets([], [a]).attached, [a]);
  assert.deepEqual(diffDeviceSets([a], []).detached, [a]);
  assert.deepEqual(diffDeviceSets([a, a], [a]), { attached: [], detached: [] });
});

test('parseSnapshot converts wmi json lines to device info', () => {
  const text = JSON.stringify([
    { deviceId: 'USB\\VID_3277&PID_00FF&MI_02\\6&1EF22B4F&1&0002', manufacturer: 'Microsoft', name: 'XiaoMi WebCam' },
    { deviceId: 'USB\\VID_27C6&PID_6890\\UIDDCE0B84B_XXXX_MOC_B0', manufacturer: 'Goodix', name: 'Fingerprint' },
    { deviceId: 'PCI\\VEN_8086\\x', manufacturer: 'Intel', name: 'Chipset' }
  ]);
  const devices = parseSnapshot(text);
  assert.equal(devices.length, 2);
  assert.deepEqual(devices[0], {
    deviceId: 'USB\\VID_3277&PID_00FF&MI_02\\6&1EF22B4F&1&0002',
    vid: '3277',
    pid: '00FF',
    serialNumber: '6&1EF22B4F&1&0002',
    manufacturer: 'Microsoft',
    product: 'XiaoMi WebCam'
  });
  assert.equal(devices[1].product, 'Fingerprint');
});

test('parseSnapshot converts usb storage snapshot with volume and drive letter', () => {
  const text = JSON.stringify([
    {
      deviceId: '\\\\.\\PHYSICALDRIVE1',
      name: 'RT-5 Storage Device',
      driveLetter: 'E:',
      volumeName: 'RT5'
    },
    {
      deviceId: '\\\\.\\PHYSICALDRIVE2',
      name: 'Generic USB Flash',
      driveLetter: 'F:',
      volumeName: ''
    }
  ]);
  const devices = parseSnapshot(text);
  assert.equal(devices.length, 2);
  assert.deepEqual(devices[0], {
    deviceId: '\\\\.\\PHYSICALDRIVE1',
    name: 'RT-5 Storage Device',
    driveLetter: 'E:',
    volumeName: 'RT5',
    displayName: 'RT5'
  });
  assert.equal(devices[1].displayName, 'F: Generic USB Flash');
});

test('parseSnapshot tolerates malformed input', () => {
  assert.deepEqual(parseSnapshot(''), []);
  assert.deepEqual(parseSnapshot(null), []);
  assert.deepEqual(parseSnapshot('not json'), []);
  assert.deepEqual(parseSnapshot('{"a":1}'), []);
});

test('parseSnapshot wraps single object from powershell 5.1 unwrap', () => {
  const text = JSON.stringify({
    deviceId: '\\\\.\\PHYSICALDRIVE1',
    name: 'USB Flash',
    driveLetter: 'E:',
    volumeName: 'T31-750'
  });
  const devices = parseSnapshot(text);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].volumeName, 'T31-750');
});

test('extractJsonLine picks the json array line', () => {
  assert.equal(extractJsonLine('line1\r\n[{"deviceId":"x"}]\r\n'), '[{"deviceId":"x"}]');
  assert.equal(extractJsonLine('  []  '), '[]');
  assert.equal(extractJsonLine('nothing'), '');
});

test('extractJsonLine picks single-object json line', () => {
  assert.equal(extractJsonLine('{"deviceId":"x"}\r\n'), '{"deviceId":"x"}');
});

test('UsbWatcher emits device changes from snapshots', () => {
  const changes = [];
  const watcher = new UsbWatcher({
    onDevicesChanged: (attached, detached) => changes.push({ attached, detached })
  });
  const a = JSON.stringify([{ deviceId: 'USB\\VID_0001&PID_0001\\S1', manufacturer: 'A', name: 'A' }]);
  const ab = JSON.stringify([
    { deviceId: 'USB\\VID_0001&PID_0001\\S1', manufacturer: 'A', name: 'A' },
    { deviceId: 'USB\\VID_0002&PID_0002\\S2', manufacturer: 'B', name: 'B' }
  ]);
  const b = JSON.stringify([{ deviceId: 'USB\\VID_0002&PID_0002\\S2', manufacturer: 'B', name: 'B' }]);

  watcher.handleSnapshot(a);
  assert.equal(watcher.getDevices().length, 1);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].attached.length, 1);
  assert.equal(changes[0].detached.length, 0);

  watcher.handleSnapshot(ab);
  assert.equal(changes.length, 2);
  assert.equal(changes[1].attached.length, 1);
  assert.equal(changes[1].attached[0].pid, '0002');

  watcher.handleSnapshot(b);
  assert.equal(changes.length, 3);
  assert.equal(changes[2].detached.length, 1);
  assert.equal(changes[2].detached[0].vid, '0001');

  watcher.handleSnapshot(b);
  assert.equal(changes.length, 3);

  watcher.stop();
});
