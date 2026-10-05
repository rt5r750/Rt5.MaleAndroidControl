'use strict';

// Windows PnP USB 设备解析 / 规则匹配 / 快照 diff（纯函数，便于单元测试）

// 解析形如 "USB\VID_3277&PID_00FF&MI_02\6&1EF22B4F&1&0002"
// 或 "USB\VID_27C6&PID_6890\UIDDCE0B84B_XXXX_MOC_B0" 的 DeviceID
function parsePnPDeviceId(deviceId) {
  if (typeof deviceId !== 'string') return null;
  const text = deviceId.trim();
  const m = /^USB\\VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})(?:&[^\\]*)?\\(.*)$/i.exec(text);
  if (!m) return null;
  return {
    vid: m[1].toUpperCase(),
    pid: m[2].toUpperCase(),
    serialNumber: m[3] || ''
  };
}

// VID/PID 归一化：去空格、去 0x/0X 前缀、转小写
function normalizeHex(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase().replace(/^0x/, '');
}

// 规则必须至少填写 VID、PID 或设备/磁盘 ID（deviceId）才有效（必须配置规则语义）
function ruleIsValid(rule) {
  return !!(rule && (
    String(rule.vid || '').trim() ||
    String(rule.pid || '').trim() ||
    String(rule.deviceId || '').trim()
  ));
}

function validRules(rules) {
  return (rules || []).filter(ruleIsValid);
}

// 单条规则匹配：空字段通配；VID/PID 大小写与 0x 前缀不敏感；序列号精确；厂商名包含匹配
function matchesRule(device, rule) {
  if (!ruleIsValid(rule)) return false;
  if (!device) return false;
  const deviceId = String(rule.deviceId || '').trim();
  const vid = normalizeHex(rule.vid);
  const pid = normalizeHex(rule.pid);
  const serial = String(rule.serial || '').trim();
  const manufacturer = String(rule.manufacturer || '').trim();
  const volumeName = String(rule.volumeName || '').trim();
  const driveLetter = String(rule.driveLetter || '').trim();
  if (deviceId) {
    if (!device.deviceId || String(device.deviceId) !== deviceId) return false;
  }
  if (vid && normalizeHex(device.vid) !== vid) return false;
  if (pid && normalizeHex(device.pid) !== pid) return false;
  if (serial && String(device.serialNumber || '') !== serial) return false;
  if (manufacturer && !String(device.manufacturer || '').includes(manufacturer)) return false;
  if (volumeName && String(device.volumeName || '') !== volumeName) return false;
  if (driveLetter && String(device.driveLetter || '') !== driveLetter) return false;
  return true;
}

function matchesAnyRule(device, rules) {
  return (rules || []).some((rule) => matchesRule(device, rule));
}

// 按 deviceId 做快照 diff，返回 { attached, detached }
function diffDeviceSets(prevDevices, nextDevices) {
  const prevMap = new Map((prevDevices || []).map((d) => [d.deviceId, d]));
  const nextMap = new Map((nextDevices || []).map((d) => [d.deviceId, d]));
  const attached = [];
  const detached = [];
  for (const [id, device] of nextMap) {
    if (!prevMap.has(id)) attached.push(device);
  }
  for (const [id, device] of prevMap) {
    if (!nextMap.has(id)) detached.push(device);
  }
  return { attached, detached };
}

// 解析 PowerShell 输出的 JSON 行（原始 WMI 条目数组），过滤为 USB 大容量存储设备信息列表；
// 保留对旧版 PnP USB 设备快照的兼容，便于现有单元测试通过。
function parseSnapshot(text) {
  const devices = [];
  if (!text) return devices;
  let arr;
  try {
    arr = JSON.parse(text);
  } catch (e) {
    return devices;
  }
  // 兼容 Windows PowerShell 5.1：ConvertTo-Json 对单元素数组会解包成对象
  if (!Array.isArray(arr)) {
    if (arr && typeof arr === 'object' && (arr.deviceId || arr.vid || arr.pid || arr.driveLetter)) arr = [arr];
    else return devices;
  }
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    // 新版 USB 大容量存储查询：包含 driveLetter / volumeName
    if (Object.prototype.hasOwnProperty.call(item, 'driveLetter') || Object.prototype.hasOwnProperty.call(item, 'volumeName')) {
      const deviceId = String(item.deviceId || item.deviceID || '');
      const name = String(item.name || item.Model || '');
      const driveLetter = String(item.driveLetter || '');
      const volumeName = String(item.volumeName || '');
      const displayName = volumeName || (driveLetter ? `${driveLetter} ${name}` : name);
      devices.push({
        deviceId,
        name,
        driveLetter,
        volumeName,
        displayName
      });
      continue;
    }
    // 旧版 PnP USB 设备快照
    const id = item.deviceId;
    const parsed = parsePnPDeviceId(id);
    if (!parsed) continue;
    devices.push({
      deviceId: String(id),
      vid: parsed.vid,
      pid: parsed.pid,
      serialNumber: parsed.serialNumber,
      manufacturer: String(item.manufacturer || ''),
      product: String(item.name || '')
    });
  }
  return devices;
}

module.exports = {
  parsePnPDeviceId,
  normalizeHex,
  ruleIsValid,
  validRules,
  matchesRule,
  matchesAnyRule,
  diffDeviceSets,
  parseSnapshot
};
