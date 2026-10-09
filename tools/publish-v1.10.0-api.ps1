# v1.10.0 发布（无 gh CLI 版）：用 GitHub REST API 创建 Release 并上传三件素材。
# 凭据经 Git Credential Manager 读取（与 git push 同一份），脚本内只读一次。
# 用法（仓库根）：pwsh tools/publish-v1.10.0-api.ps1
#
# 要点（本机实测踩坑）：含中文的 JSON 必须写成 UTF-8 无 BOM 文件再 --data-binary @file，
# 直接经命令行传会被本地码页破坏导致 400；curl 与 pwsh 共用的临时文件用绝对 Windows 路径。

$ErrorActionPreference = 'Stop'

$Proxy = 'http://127.0.0.1:10808'
$Repo = 'rt5r750/Rt5.MaleAndroidControl'
$Tag = 'v1.10.0'
$Api = "https://api.github.com/repos/$Repo"
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Stage = Join-Path $Root 'release\v1.10.0'
$NotesPath = Join-Path $Stage 'RELEASE-NOTES.md'
$TmpDir = Join-Path $Root '.zcode'

Push-Location $Root
try {
    # ---- 1. 取凭据（Git Credential Manager；只读一次，避免反复弹授权）----
    Write-Host '== 1/4 读取凭据 =='
    $credRaw = "protocol=https`nhost=github.com`n" | git credential fill 2>$null
    $token = ($credRaw | Where-Object { $_ -like 'password=*' }) -replace '^password=', ''
    if (-not $token) { throw '未能从凭据管理器取得 GitHub token' }
    $headers = @{
        Authorization          = "Bearer $token"
        Accept                 = 'application/vnd.github+json'
        'X-GitHub-Api-Version' = '2022-11-28'
        'User-Agent'           = 'robotcontrol-publish'
    }
    Write-Host ('   已取得凭据（用户 {0}）' -f (($credRaw | Where-Object { $_ -like 'username=*' }) -replace '^username=', ''))

    # ---- 2. 创建 Release（正文用 notes 文件，UTF-8 无 BOM）----
    Write-Host '== 2/4 创建 Release =='
    $body = Get-Content -LiteralPath $NotesPath -Raw -Encoding UTF8
    $payloadFile = Join-Path $TmpDir 'release-create.json'
    $obj = [ordered]@{
        tag_name         = $Tag
        name             = 'v1.10.0 — 语言自动检测 / 首次启动统一 / 客户端改名（MACS · Slave）'
        body             = $body
        draft            = $false
        prerelease       = $false
    }
    $json = $obj | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText($payloadFile, $json, (New-Object System.Text.UTF8Encoding($false)))

    $resp = Invoke-RestMethod -Method Post -Uri "$Api/releases" -Headers $headers `
        -ContentType 'application/json; charset=utf-8' -InFile $payloadFile -Proxy $Proxy
    $releaseId = $resp.id
    $uploadUrl = $resp.upload_url -replace '\{.*$', ''
    Write-Host ("   Release #{0} 已创建" -f $releaseId)

    # ---- 3. 上传三件素材 ----
    Write-Host '== 3/4 上传素材 =='
    $files = @(
        (Join-Path $Stage 'MACS-Android-v1.10.0.apk'),
        (Join-Path $Stage 'Slave-Android-v1.10.0.apk'),
        (Join-Path $Stage 'MACS-Windows-v1.10.0.zip')
    )
    foreach ($f in $files) {
        if (-not (Test-Path -LiteralPath $f)) { throw "缺少素材：$f" }
        $name = Split-Path -Leaf $f
        $sizeMb = [math]::Round((Get-Item -LiteralPath $f).Length / 1MB, 1)
        Write-Host ("   上传 {0}（{1} MB）…" -f $name, $sizeMb)
        $uri = "$uploadUrl?name=$name"
        $r = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers `
            -ContentType 'application/octet-stream' -InFile $f -Proxy $Proxy -TimeoutSec 1800
        Write-Host ("     ok  {0} bytes" -f $r.size)
    }

    # ---- 4. 结果 ----
    Write-Host '== 4/4 完成 =='
    $final = Invoke-RestMethod -Method Get -Uri "$Api/releases/$releaseId" -Headers $headers -Proxy $Proxy
    Write-Host ('   {0}' -f $final.html_url)
    Write-Host '   素材：'
    $final.assets | ForEach-Object { Write-Host ('     - {0}  {1} bytes' -f $_.name, $_.size) }

    Remove-Item -LiteralPath $payloadFile -Force -ErrorAction SilentlyContinue
}
finally {
    Pop-Location
}
