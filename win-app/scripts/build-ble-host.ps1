# 发布 C# BLE 外设宿主（RobotControl-BleHost.exe，win-x64 自包含单文件）
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."

function Find-DotnetExe {
    $dotnetRoot = $env:DOTNET_ROOT
    if (-not $dotnetRoot) {
        $candidates = @(
            "D:\11764\HUANCUN\.deps\dotnet\dotnet.exe"
            "D:\Program Files\dotnet\dotnet.exe"
            "C:\Program Files\dotnet\dotnet.exe"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) { return $c }
        }
    } elseif (Test-Path (Join-Path $dotnetRoot "dotnet.exe")) {
        return Join-Path $dotnetRoot "dotnet.exe"
    }
    $cmd = Get-Command dotnet -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$dotnetExe = Find-DotnetExe
if (-not $dotnetExe) {
    throw "未找到 dotnet.exe，请先安装 .NET 8 SDK（或设置 DOTNET_ROOT）"
}

$env:NUGET_PACKAGES = if ($env:NUGET_PACKAGES) { $env:NUGET_PACKAGES } else { "D:\11764\HUANCUN\.deps\NuGet" }
$outDir = Join-Path $root "ble-host\publish"
$csproj = Join-Path $root "ble-host\RobotControlBleHost.csproj"

Write-Host "[ble-host] dotnet publish -> $outDir"
& $dotnetExe publish $csproj -c Release -r win-x64 --self-contained true -o $outDir
if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed"
}

$exe = Join-Path $outDir "RobotControl-BleHost.exe"
if (-not (Test-Path $exe)) {
    throw "BLE host exe not found: $exe"
}
Write-Host "[ble-host] OK: $exe ($([math]::Round((Get-Item $exe).Length / 1MB, 1)) MB)"
