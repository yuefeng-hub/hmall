# ============================================================
# 停止 start-detached.ps1 拉起的 5 个服务
#   powershell -ExecutionPolicy Bypass -File scripts\stop-detached.ps1
# 先按 logs\*.pid 精确杀，再兜底清掉占用 8081~8085 的 java 进程
# ============================================================
param([int]$Base = 8080)

$ErrorActionPreference = 'SilentlyContinue'
$Root = Split-Path -Parent $PSScriptRoot
$Logs = Join-Path $Root 'logs'

$killed = @()
foreach ($m in @('item', 'cart', 'order', 'pay', 'user')) {
    $f = Join-Path $Logs "$m.pid"
    if (Test-Path $f) {
        $procId = (Get-Content $f | Select-Object -First 1).Trim()
        if ($procId) {
            $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($p) { Stop-Process -Id $procId -Force; $killed += "$m($procId)" }
        }
        Remove-Item $f -Force
    }
}

# pid 文件可能过期（手工重启过），按端口再清一遍
foreach ($p in @(($Base + 1)..($Base + 5))) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        $procId = $conn.OwningProcess
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -like 'java*') {
            Stop-Process -Id $procId -Force
            $killed += ":$p($procId)"
        }
    }
}

# 前端静态服务（python scripts/serve-frontend.py 8090）一并收掉
if ($Base -eq 8080) {
    $conn = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -like 'python*') {
            Stop-Process -Id $conn.OwningProcess -Force
            $killed += ":8090($($conn.OwningProcess))"
        }
    }
}

if ($killed.Count -eq 0) { Write-Host "没有运行中的服务" } else { Write-Host ("已停止：" + ($killed -join ', ')) }
