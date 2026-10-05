# Package script: produce splash-loader entry + Electron runtime directory
# Output layout:
#   win-app/RobotControl-Console.exe       <- splash-loader (double-click entry)
#   win-app/runtime/                       <- Electron unpacked app directory
#
[CmdletBinding()]
param(
    [string]$ElectronUnpackedDir = "",
    [string]$OutDir = "",
    [switch]$SkipBuildElectron
)

$ErrorActionPreference = "Stop"
if (-not $OutDir) {
    $OutDir = Join-Path $PSScriptRoot ".."
}

$root = Resolve-Path "$PSScriptRoot\.."
$splashSource = Join-Path $root "splash-loader\bin\splash-loader.exe"
$runtimeDir = Join-Path $OutDir "runtime"
$mainExeName = "RobotControl-Console-Main.exe"
$bleHostPublish = Join-Path $root "ble-host\publish\RobotControl-BleHost.exe"

function Find-ElectronUnpackedDir {
    $candidates = @(
        Join-Path $root "dist-new\win-unpacked"
        Join-Path $root "dist-new\win-ia32-unpacked"
        Join-Path $root "dist-new\win-x64-unpacked"
        Join-Path $root "dist\win-unpacked"
        Join-Path $root "dist\win-ia32-unpacked"
        Join-Path $root "dist\win-x64-unpacked"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

# 0. 确保 C# BLE 宿主已发布（npm run dist 的 predist 也会执行；这里兜底）
if (-not (Test-Path $bleHostPublish)) {
    Write-Host "[ble-host] Publishing ble host first..."
    & (Join-Path $PSScriptRoot "build-ble-host.ps1")
    if ($LASTEXITCODE -ne 0) { throw "ble host publish failed" }
}

# 1. Make sure splash-loader is compiled
if (-not (Test-Path $splashSource)) {
    Write-Host "[splash] Compiling splash-loader..."
    $cs = Join-Path $root "splash-loader\Program.cs"
    $logo = Join-Path $root "splash-loader\Rt5Logo.png"
    $icon = Join-Path $root "build\icon.ico"
    $bin = Join-Path $root "splash-loader\bin"
    if (-not (Test-Path $bin)) { New-Item -ItemType Directory -Path $bin | Out-Null }

    $csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    if (-not (Test-Path $csc)) {
        throw "csc.exe not found. .NET Framework 4.x is required."
    }

    # 参数用数组传递，避免 /resource:"$logo",Rt5Logo 被当作字面量 "$logo" 传给 csc
    $compileArgs = @(
        "/target:winexe",
        "/out:$bin\splash-loader.exe",
        "/resource:$logo,Rt5Logo",
        "/win32icon:$icon",
        "/reference:System.dll",
        "/reference:System.Drawing.dll",
        "/reference:System.Windows.Forms.dll",
        $cs
    )
    & $csc @compileArgs

    if ($LASTEXITCODE -ne 0) { throw "splash-loader compile failed" }
}

# 2. Locate Electron unpacked directory
$electronUnpacked = if ($ElectronUnpackedDir) { $ElectronUnpackedDir } else { Find-ElectronUnpackedDir }

# 3. Build if missing and allowed
if ((-not $electronUnpacked) -and (-not $SkipBuildElectron)) {
    Write-Host "[electron] Unpacked dir not found, running npm run dist..."
    Push-Location $root
    & npm run dist
    Pop-Location
    $electronUnpacked = Find-ElectronUnpackedDir
}

if (-not $electronUnpacked -or -not (Test-Path $electronUnpacked)) {
    throw "Electron unpacked directory not found"
}

$mainExe = Join-Path $electronUnpacked $mainExeName
if (-not (Test-Path $mainExe)) {
    throw "Main executable not found in unpacked dir: $mainExeName"
}

Write-Host "[electron] Using: $electronUnpacked"

# 4. Prepare output directories
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

# 5. Copy Electron runtime directory (robocopy fallback to xcopy/copy)
$sourceFull = (Get-Item $electronUnpacked).FullName
$targetFull = (Get-Item $runtimeDir -ErrorAction SilentlyContinue).FullName
if ($sourceFull -eq $targetFull) {
    Write-Host "[copy] runtime dir already in place"
} else {
    if (Test-Path $runtimeDir) {
        Write-Host "[copy] Cleaning old runtime dir..."
        try {
            [System.IO.Directory]::Delete($runtimeDir, $true)
        } catch {
            # If locked, fall back to robocopy mirror
            & robocopy $sourceFull $runtimeDir /MIR /MT /NP /NFL /NDL /R:2 /W:1 | Out-Null
            if ($LASTEXITCODE -ge 8) {
                throw "robocopy mirror failed with exit code $LASTEXITCODE"
            }
            $copied = $true
        }
    }
    if (-not $copied) {
        # Use robocopy for fast directory copy
        & robocopy $sourceFull $runtimeDir /E /MT /NP /NFL /NDL /R:2 /W:1 | Out-Null
        if ($LASTEXITCODE -ge 8) {
            throw "robocopy failed with exit code $LASTEXITCODE"
        }
    }
    Write-Host "[copy] Electron runtime -> runtime/"
}

# 6. Copy splash-loader as root entry executable
$entryExe = Join-Path $OutDir "RobotControl-Console.exe"
Copy-Item -Path $splashSource -Destination $entryExe -Force
Write-Host "[copy] splash-loader.exe -> RobotControl-Console.exe"

# 7. Verify
if (-not (Test-Path $entryExe)) { throw "Entry exe creation failed" }
$finalMainExe = Join-Path $runtimeDir $mainExeName
if (-not (Test-Path $finalMainExe)) { throw "Electron main executable copy failed" }
$srcMainExe = Join-Path $electronUnpacked $mainExeName
if ((Get-Item $finalMainExe).LastWriteTimeUtc -lt (Get-Item $srcMainExe).LastWriteTimeUtc) {
    throw "Runtime copy is stale: $finalMainExe"
}

# 8. 验证 BLE 宿主已包含在 runtime/resources/ble-host/
$bleHostInRuntime = Join-Path $runtimeDir "resources\ble-host\RobotControl-BleHost.exe"
if (-not (Test-Path $bleHostInRuntime)) {
    Write-Host "[ble-host] Warning: runtime resources/ble-host missing (electron-builder extraResources 未复制)"
}

$entrySize = (Get-Item $entryExe).Length / 1KB
$runtimeSize = (Get-ChildItem -Recurse -File $runtimeDir | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ""
Write-Host "===== Package OK ====="
Write-Host "Entry loader: $entryExe ($([math]::Round($entrySize,1)) KB)"
Write-Host "Runtime dir : $runtimeDir ($([math]::Round($runtimeSize,1)) MB)"
if (Test-Path $bleHostInRuntime) {
    Write-Host "BLE host    : $bleHostInRuntime ($([math]::Round((Get-Item $bleHostInRuntime).Length / 1MB, 1)) MB)"
} else {
    Write-Host "BLE host    : MISSING in runtime"
}
Write-Host "======================"

# robocopy 可能留下非零退出码；脚本成功执行到此，强制归零避免误导
$global:LASTEXITCODE = 0
exit 0
