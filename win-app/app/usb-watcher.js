'use strict';

const { spawn } = require('node:child_process');
const { parseSnapshot, diffDeviceSets } = require('./usb.js');

// 持久 PowerShell 进程：每轮输出一行 JSON 数组（USB 大容量存储设备快照）
const PS_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [Console]::OutputEncoding
$ErrorActionPreference = 'SilentlyContinue'
while ($true) {
  try {
    $items = @()
    # 主路径：可移动逻辑盘（U盘/存储卡，DriveType=2），再反查物理磁盘拿到稳定 deviceId
    $removables = @(Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 })
    $mappedDiskIds = @()
    foreach ($ld in $removables) {
      $diskId = $ld.DeviceID
      $model = ''
      try {
        $parts = @(Get-CimInstance -Query "ASSOCIATORS OF {Win32_LogicalDisk.DeviceID='$($ld.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition")
        foreach ($p in $parts) {
          $disks = @(Get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($p.DeviceID.Replace('\\','\\\\'))'} WHERE AssocClass = Win32_DiskDriveToDiskPartition")
          foreach ($d in $disks) {
            $diskId = $d.DeviceID
            $model = $d.Model
          }
        }
      } catch {}
      $mappedDiskIds += $diskId
      $items += [PSCustomObject]@{ deviceId = $diskId; name = $model; driveLetter = $ld.DeviceID; volumeName = $ld.VolumeName }
    }
    # 兜底：其余无盘符的 USB 磁盘（读卡器等）
    $disks = @(Get-CimInstance Win32_DiskDrive | Where-Object { $_.InterfaceType -eq 'USB' })
    foreach ($disk in $disks) {
      if ($mappedDiskIds -contains $disk.DeviceID) { continue }
      $items += [PSCustomObject]@{ deviceId = $disk.DeviceID; name = $disk.Model; driveLetter = ''; volumeName = '' }
    }
    $json = $items | ConvertTo-Json -Compress -Depth 3
    if (-not $json.StartsWith('[')) { $json = '[' + $json + ']' }
    $json
  } catch {
    '[]'
  }
  Start-Sleep -Milliseconds 1000
}
`;

const PS_ONE_SHOT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [Console]::OutputEncoding
$ErrorActionPreference = 'SilentlyContinue'
try {
  $items = @()
  # 主路径：可移动逻辑盘（U盘/存储卡，DriveType=2），再反查物理磁盘拿到稳定 deviceId
  $removables = @(Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 })
  $mappedDiskIds = @()
  foreach ($ld in $removables) {
    $diskId = $ld.DeviceID
    $model = ''
    try {
      $parts = @(Get-CimInstance -Query "ASSOCIATORS OF {Win32_LogicalDisk.DeviceID='$($ld.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition")
      foreach ($p in $parts) {
        $disks = @(Get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($p.DeviceID.Replace('\\','\\\\'))'} WHERE AssocClass = Win32_DiskDriveToDiskPartition")
        foreach ($d in $disks) {
          $diskId = $d.DeviceID
          $model = $d.Model
        }
      }
    } catch {}
    $mappedDiskIds += $diskId
    $items += [PSCustomObject]@{ deviceId = $diskId; name = $model; driveLetter = $ld.DeviceID; volumeName = $ld.VolumeName }
  }
  # 兜底：其余无盘符的 USB 磁盘（读卡器等）
  $disks = @(Get-CimInstance Win32_DiskDrive | Where-Object { $_.InterfaceType -eq 'USB' })
  foreach ($disk in $disks) {
    if ($mappedDiskIds -contains $disk.DeviceID) { continue }
    $items += [PSCustomObject]@{ deviceId = $disk.DeviceID; name = $disk.Model; driveLetter = ''; volumeName = '' }
  }
  $json = $items | ConvertTo-Json -Compress -Depth 3
  if (-not $json.StartsWith('[')) { $json = '[' + $json + ']' }
  $json
} catch {
  '[]'
}
`;

function extractJsonLine(text) {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if ((line.startsWith('[') && line.endsWith(']')) || (line.startsWith('{') && line.endsWith('}'))) return line;
  }
  return '';
}

// PowerShell 脚本以 UTF-16LE Base64 传入 -EncodedCommand，避免 stdin 多行解析问题
function encodeScript(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

class UsbWatcher {
  constructor(options = {}) {
    this.pollIntervalMs = options.pollIntervalMs || 1000;
    this.restartDelayMs = options.restartDelayMs || 5000;
    this.powershellPath = options.powershellPath || 'powershell.exe';
    this.spawnFn = options.spawnFn || spawn;
    this.onDevicesChanged = options.onDevicesChanged || null;
    this.onSnapshot = options.onSnapshot || null;
    this.child = null;
    this.devices = [];
    this.buffer = '';
    this.stopped = false;
    this.restartTimer = null;
  }

  start() {
    this.stopped = false;
    this.spawnWorker();
    return this;
  }

  stop() {
    this.stopped = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.child) {
      try {
        this.child.kill();
      } catch (e) {}
      this.child = null;
    }
  }

  getDevices() {
    return this.devices;
  }

  // 按需执行一次快照查询，并把结果作为基线（不触发 attach/detach 事件）
  refresh() {
    return new Promise((resolve) => {
      let child;
      try {
        child = this.spawnFn(
          this.powershellPath,
          ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodeScript(PS_ONE_SHOT)],
          { stdio: ['ignore', 'pipe', 'pipe'] }
        );
      } catch (e) {
        resolve(this.devices);
        return;
      }
      let out = '';
      const timer = setTimeout(() => {
        try { child.kill(); } catch (e) {}
      }, 20000);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { out += chunk; });
      child.on('error', () => {
        clearTimeout(timer);
        resolve(this.devices);
      });
      child.on('exit', () => {
        clearTimeout(timer);
        const parsed = parseSnapshot(extractJsonLine(out));
        this.devices = parsed;
        resolve(parsed);
      });
    });
  }

  spawnWorker() {
    if (this.stopped) return;
    this.buffer = '';
    let child;
    try {
      child = this.spawnFn(
        this.powershellPath,
        ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodeScript(PS_SCRIPT)],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );
    } catch (e) {
      this.scheduleRestart();
      return;
    }
    this.child = child;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => this.onData(chunk));
    child.on('error', () => {
      this.child = null;
      this.scheduleRestart();
    });
    child.on('exit', () => {
      this.child = null;
      this.scheduleRestart();
    });
  }

  onData(chunk) {
    this.buffer += chunk;
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      this.handleSnapshot(line);
    }
  }

  handleSnapshot(text) {
    const next = parseSnapshot(text);
    const { attached, detached } = diffDeviceSets(this.devices, next);
    this.devices = next;
    if (this.onSnapshot) {
      try { this.onSnapshot(next); } catch (e) {}
    }
    if ((attached.length > 0 || detached.length > 0) && this.onDevicesChanged) {
      try { this.onDevicesChanged(attached, detached); } catch (e) {}
    }
  }

  scheduleRestart() {
    if (this.stopped || this.restartTimer) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.spawnWorker();
    }, this.restartDelayMs);
  }
}

module.exports = { UsbWatcher, extractJsonLine };
