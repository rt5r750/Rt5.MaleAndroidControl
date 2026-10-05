$ErrorActionPreference = 'Stop'

# Single-source www sync: mirrors repo-root www/ into win-app/app/www (runs before start/dist)
$winAppRoot = Split-Path -Parent $PSScriptRoot
$srcWww = Join-Path (Split-Path -Parent $winAppRoot) 'www'
$dstWww = Join-Path $winAppRoot 'app\www'

$srcResolved = (Resolve-Path -LiteralPath $srcWww).Path
if (-not $dstWww.EndsWith('\win-app\app\www')) {
    throw "refusing to sync to unexpected target: $dstWww"
}

if (Test-Path -LiteralPath $dstWww) {
    Remove-Item -LiteralPath $dstWww -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $dstWww | Out-Null
# 镜像 www/，排除工具状态目录（.mimosa 等，不入包；拷贝后按层级清扫兜底）
Get-ChildItem -LiteralPath $srcResolved -Force | Where-Object { $_.Name -notin @('.mimosa') } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $dstWww -Recurse -Force
}
Get-ChildItem -LiteralPath $dstWww -Recurse -Force -Directory -Filter '.mimosa' | Remove-Item -Recurse -Force

Write-Output "[sync-www] mirrored $srcResolved -> $dstWww"
