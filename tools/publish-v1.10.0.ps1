# v1.10.0 发布脚本：push main + tag + 创建 Release 并上传三件素材。
#
# 前置条件：本机代理客户端（127.0.0.1:10808）已启动并可用——
# git / curl 不会自动走 Windows 系统代理，脚本内已显式 `-c http.proxy` / `--proxy`。
# 用法（仓库根，pwsh）：pwsh tools/publish-v1.10.0.ps1
#
# 全部步骤幂等：tag 已存在则跳过创建，Release 已存在则改为上传（--clobber 覆盖同名素材）。

$ErrorActionPreference = 'Stop'

$Proxy = 'http://127.0.0.1:10808'
$Repo = 'rt5r750/Rt5.MaleAndroidControl'
$Tag = 'v1.10.0'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Stage = Join-Path $Root 'release\v1.10.0'
$Notes = Join-Path $Stage 'RELEASE-NOTES.md'

Push-Location $Root
try {
    Write-Host '== 1/4 检查代理连通性 =='
    $probe = curl.exe -s -o NUL -w '%{http_code}' --max-time 10 --proxy $Proxy https://api.github.com/zen
    if ($probe -ne '200') {
        throw "代理不可用（api.github.com 返回 $probe）。请先启动代理客户端再重跑本脚本。"
    }
    Write-Host "   代理可用（$probe）"

    Write-Host '== 2/4 push main =='
    git -c http.proxy=$Proxy -c https.proxy=$Proxy push origin main
    if ($LASTEXITCODE -ne 0) { throw 'push main 失败' }

    Write-Host '== 3/4 创建并推送 tag =='
    $hasTag = (git tag -l $Tag)
    if (-not $hasTag) {
        git tag -a $Tag -m "v1.10.0"
    } else {
        Write-Host "   tag $Tag 已存在，跳过创建"
    }
    git -c http.proxy=$Proxy -c https.proxy=$Proxy push origin $Tag
    if ($LASTEXITCODE -ne 0) { throw 'push tag 失败' }

    Write-Host '== 4/4 创建 Release 并上传素材 =='
    $files = @(
        (Join-Path $Stage 'MACS-Android-v1.10.0.apk'),
        (Join-Path $Stage 'Slave-Android-v1.10.0.apk'),
        (Join-Path $Stage 'MACS-Windows-v1.10.0.zip')
    )
    foreach ($f in $files) {
        if (-not (Test-Path -LiteralPath $f)) { throw "缺少素材：$f" }
    }

    $existing = curl.exe -s --max-time 20 --proxy $Proxy "https://api.github.com/repos/$Repo/releases/tags/$Tag"
    if ($existing -match '"id"') {
        Write-Host "   Release $Tag 已存在，上传（覆盖同名素材）"
        $id = ([regex]'"id":\s*(\d+)').Match($existing).Groups[1].Value
        foreach ($f in $files) {
            $name = Split-Path -Leaf $f
            curl.exe -sS --fail --max-time 1800 --proxy $Proxy -X POST `
                -H 'Content-Type: application/octet-stream' `
                --data-binary "@$f" `
                "https://uploads.github.com/repos/$Repo/releases/$id/assets?name=$name"
            Write-Host "     uploaded $name"
        }
        # Release 正文同步（含中文，必须走 UTF-8 文件 + --data-binary）
        $payload = Join-Path $env:TEMP "release-patch-$([guid]::NewGuid().ToString('N')).json"
        $body = Get-Content -LiteralPath $Notes -Raw -Encoding UTF8
        $obj = @{ body = $body } | ConvertTo-Json -Depth 3
        [System.IO.File]::WriteAllText($payload, $obj, (New-Object System.Text.UTF8Encoding($false)))
        curl.exe -sS --fail --max-time 120 --proxy $Proxy -X PATCH `
            -H 'Content-Type: application/json' `
            --data-binary "@$payload" `
            "https://api.github.com/repos/$Repo/releases/$id" | Out-Null
        Remove-Item -LiteralPath $payload -Force
        Write-Host '     release notes updated'
    } else {
        $args = @(
            'release', 'create', $Tag,
            '--repo', $Repo,
            '--title', "v1.10.0 — Language auto-detection, unified first-run flow, client rename (MACS / Slave)",
            '--notes-file', $Notes,
            '--verify-tag'
        )
        foreach ($f in $files) { $args += $f }
        & gh @args
        if ($LASTEXITCODE -ne 0) { throw 'gh release create 失败' }
    }

    Write-Host ''
    Write-Host '===== 发布完成 ====='
    Write-Host "Release: https://github.com/$Repo/releases/tag/$Tag"
} finally {
    Pop-Location
}
