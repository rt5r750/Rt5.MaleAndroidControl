'use strict';

// 默认电量设置下的 USB 充电联动：
// win-app 通过 USB 设备进入控制台（非测试模式）时，USB 在位期间显示“正在充电”
function createUsbEntry(payload) {
  return {
    enteredViaUsb: !!(payload && payload.enteredViaUsb),
    deviceId: payload && payload.deviceId ? String(payload.deviceId) : null,
    present: false
  };
}

// 根据当前 USB 设备快照计算进入时设备是否仍在位
function computePresence(entry, devices) {
  const list = Array.isArray(devices) ? devices : [];
  if (entry && entry.deviceId) {
    return list.some((d) => d && String(d.deviceId) === String(entry.deviceId));
  }
  return list.length > 0;
}

module.exports = { createUsbEntry, computePresence };
