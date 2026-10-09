# v1.10.0 素材上传（curl 版）：Release 已创建，仅逐件上传三个 asset。
# 用法（仓库根）：pwsh tools/upload-v1.10.0-assets.ps1
$ErrorActionPreference = 'Stop'

$Proxy = 'http://127.0.0.1:10808'
$Repo = 'rt5r750/Rt5.MaleAndroidControl'
$Tag = 'v1.10.0'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Stage = Join-Path $Root 'release\v1.10.0'

Push-Location $Root
try {
    $credRaw = "protocol=https`nhost=github.com`n" | git credential fill 2>$null
    $token = ($credRaw | Where-Object { $_ -like 'password=*' }) -replace '^password=', ''
    if (-not $token) { throw '未能取得 token' }

    # 取 release id
    $meta = curl.exe -sS --max-time 30 --proxy $Proxy `
        -H "Authorization: Bearer $token" -H 'Accept: application/vnd.github+json' `
        "https://api.github.com/repos/$Repo/releases/tags/$Tag"
    $id = ([regex]'"id":\s*(\d+)').Match($meta).Groups[1].Value
    if (-not $id) { throw "未找到 Release $Tag" }
    Write-Host "Release id = $id"

    # 已存在的素材名（幂等：先删同名再传）
    $existing = curl.exe -sS --max-time 30 --proxy $Proxy `
        -H "Authorization: Bearer $token" -H 'Accept: application/vnd.github+json' `
        "https://api.github.com/repos/$Repo/releases/$id/assets"

    $files = @(
        'MACS-Android-v1.10.0.apk',
        'Slave-Android-v1.10.0.apk',
        'MACS-Windows-v1.10.0.zip'
    )

    foreach ($name in $files) {
        $path = Join-Path $Stage $name
        if (-not (Test-Path -LiteralPath $path)) { throw "缺少素材：$path" }

        if ($existing -match [regex]::Escape('"' + $name + '"')) {
            $assetId = ([regex]('"id":\s*(\d+),\s*"node_id"[^}]*"name":\s*"' + [regex]::Escape($name) + '"')).Match($existing).Groups[1].Value
            if ($assetId) {
                Write-Host "  删除已存在的同名素材 $name (id=$assetId)"
                curl.exe -sS --max-time 60 --proxy $Proxy -X DELETE `
                    -H "Authorization: Bearer $token" `
                    "https://api.github.com/repos/$Repo/releases/assets/$assetId" | Out-Null
            }
        }

        $mb = [math]::Round((Get-Item -LiteralPath $path).Length / 1MB, 1)
        Write-Host "  上传 $name （$mb MB）…"
        $url = "https://uploads.github.com/repos/$Repo/releases/$id/assets?name=$name"
        $out = curl.exe -sS --fail --max-time 3600 --proxy $Proxy -X POST `
            -H "Authorization: Bearer $token" `
            -H 'Accept: application/vnd.github+json' `
            -H 'Content-Type: application/octet-stream' `
            --data-binary "@$path" $url
        if ($LASTEXITCODE -ne 0) { throw "上传失败：$name（curl exit $LASTEXITCODE）" }
        $sz = ([regex]'"size":\s*(\d+)').Match($out).Groups[1].Value
        if (-not $sz) { throw "上传 $name 未返回 size：$($out.Substring(0, [Math]::Min(200, $out.Length)))" }
        Write-Host "    ok  $sz bytes"
    }

    Write-Host ''
    Write-Host '== 结果 =='
    $final = curl.exe -sS --max-time 30 --proxy $Proxy `
        -H "Authorization: Bearer $token" -H 'Accept: application/vnd.github+json' `
        "https://api.github.com/repos/$Repo/releases/$id"
    $final | python -c "import json,sys; d=json.load(sys.stdin); print(' ', d['html_url']); [print('   -', a['name'], a['size'], 'bytes') for a in d['assets']]"
}
finally {
    Pop-Location
}
