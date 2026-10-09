# 打包 win-app 便携版 zip（release/ 用）：根目录 RobotControl-Console.exe + runtime/
# 用法（仓库根）：pwsh tools/pack-win-zip.ps1 -Version 1.10.0
#
# 口径与上一版保持一致：便携版解压即用（huancun 运行时在解压目录生成，不入包）；
# exe 名固定 RobotControl-Console.exe（协议/热更新链路依赖，改名会破坏既有安装）。
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Version
)

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$WinApp = Join-Path $Root 'win-app'
$EntryExe = Join-Path $WinApp 'RobotControl-Console.exe'
$RuntimeDir = Join-Path $WinApp 'runtime'
$OutDir = Join-Path $Root "release\v$Version"
$OutZip = Join-Path $OutDir "Master-Windows-v$Version.zip"

foreach ($p in @($EntryExe, $RuntimeDir)) {
    if (-not (Test-Path -LiteralPath $p)) { throw "缺少打包输入：$p（先跑 win-app 的 npm run dist 与 scripts/package-with-splash.ps1）" }
}
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

# 暂存目录：仅放要入包的顶层两项，避免把 huancun/node_modules 等带进去
$Stage = Join-Path $env:TEMP ("rc-win-zip-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Stage -Force | Out-Null
try {
    Copy-Item -LiteralPath $EntryExe -Destination $Stage -Force
    Write-Host '   复制 runtime/（约 385 MB，耗时较长）…'
    Copy-Item -LiteralPath $RuntimeDir -Destination $Stage -Recurse -Force
    # huancun 是用户数据，绝不能入包（解压目录首次运行会自建）
    $stagedHuancun = Join-Path $Stage 'runtime\huancun'
    if (Test-Path -LiteralPath $stagedHuancun) { Remove-Item -LiteralPath $stagedHuancun -Recurse -Force }

    if (Test-Path -LiteralPath $OutZip) { Remove-Item -LiteralPath $OutZip -Force }
    Write-Host "   压缩到 $OutZip …"
    Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $OutZip -CompressionLevel Optimal
} finally {
    Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue
}

$item = Get-Item -LiteralPath $OutZip
$hash = (Get-FileHash -LiteralPath $OutZip -Algorithm SHA256).Hash
Write-Host ("===== OK =====`n{0}`n{1} bytes  sha256={2}" -f $OutZip, $item.Length, $hash.Substring(0, 16).ToLower())
