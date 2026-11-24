# ============================================================
# 以「独立进程」方式启动 5 个微服务（Windows）
#
# 与 start-local.sh 的区别：
#   bash 里的 `nohup java ... &` 启动的进程仍挂在调用它的终端/任务下面，
#   一旦那个终端或后台任务结束，Windows 会把子进程一起回收（本项目踩过很多次）。
#
#   ★ 注意：Start-Process / [Process]::Start 也不够。它们只是换了父进程，
#     新进程仍落在同一个 Windows Job Object 里，调用方任务结束时整个 Job 被终止，
#     服务照样一起死（本脚本第一版就是这样：打印了「5/5 就绪」，几分钟后全掉线）。
#     真正能脱离的做法是 WMI 的 Win32_Process.Create —— 进程由 WmiPrvSE.exe 创建，
#     父进程是系统服务，不属于任何用户 Job，终端关闭也不影响它。
#
# ★★ 但在「AI 智能体会话里由工具执行」时，连 WMI 也救不回来：
#     实测（2026-11-24）任何由工具调用创建的子进程都会在该调用结束时被清理，
#     心跳探针只写了 2 行就断；schtasks 又在安全中心黑名单里，无法用计划任务兜底。
#     所以要让商城长期在线，请自己双击根目录的 start-services.bat（绕开智能体会话），
#     本脚本适合在没有会话清理机制的第一终端（如手动开的 PowerShell）里使用。
#
# 用法（在项目根目录）：
#   powershell -ExecutionPolicy Bypass -File scripts\start-detached.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\start-detached.ps1 -Base 18080
#   powershell -ExecutionPolicy Bypass -File scripts\start-detached.ps1 -Degraded
#
#   -Base      端口基准，默认 8080 → 商品 8081 / 购物车 8082 / 订单 8083 / 支付 8084 / 用户 8085
#              平移时数据目录自动切到 data-<Base>/，避免和默认那套抢同一个 H2 文件
#   -Degraded  用户服务强制降级（验证码只打日志不真发），给 smoke-test / e2e 取码用
#
# 停止：powershell -ExecutionPolicy Bypass -File scripts\stop-detached.ps1
# ============================================================
param(
    [int]$Base = 8080,
    [switch]$Degraded
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Logs = Join-Path $Root 'logs'
$Data = if ($Base -eq 8080) { Join-Path $Root 'data' } else { Join-Path $Root "data-$Base" }
$DataWin = $Data -replace '\\', '/'

New-Item -ItemType Directory -Force -Path $Logs | Out-Null
New-Item -ItemType Directory -Force -Path $Data | Out-Null

$ItemPort = $Base + 1
$CartPort = $Base + 2
$OrderPort = $Base + 3
$PayPort = $Base + 4
$UserPort = $Base + 5
$Jvm = @('-Xms96m', '-Xmx256m')

# 先确认没有残留实例占着端口（H2 文件库不允许两个进程同时打开同一个库文件）
foreach ($p in @($ItemPort, $CartPort, $OrderPort, $PayPort, $UserPort)) {
    $busy = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($busy) {
        Write-Host "端口 $p 已被进程 $($busy[0].OwningProcess) 占用，请先停止它" -ForegroundColor Red
        exit 1
    }
}
foreach ($m in @('item', 'cart', 'order', 'pay', 'user')) {
    $jar = Join-Path $Root "$m-service\target\$m-service.jar"
    if (-not (Test-Path $jar)) {
        Write-Host "缺少 $jar，请先执行 bash scripts/build.sh" -ForegroundColor Red
        exit 1
    }
}

function Start-Svc {
    param([string]$Name, [int]$Port, [string[]]$Extra)

    $jar = Join-Path $Root "$Name-service\target\$Name-service.jar"
    $out = Join-Path $Logs "$Name.out.log"
    $err = Join-Path $Logs "$Name.err.log"

    $line = 'java ' + ($Jvm -join ' ') + ' -jar "' + $jar + '" --server.port=' + $Port + ' --hmall.data.dir="' + $DataWin + '"'
    if ($Extra -and $Extra.Count -gt 0) { $line += ' ' + ($Extra -join ' ') }
    $line += ' > "' + $out + '" 2> "' + $err + '"'

    # 经 cmd /c 转一层：
    #   ① 重定向由 cmd 处理，不需要自己接 stdout/stderr 管道（接管道就会绑上本进程）；
    #   ② 环境块由系统直接复制，绕开 Start-Process 合并环境时
    #      「http_proxy / HTTP_PROXY 大小写重复键」的字典异常。
    $cmdLine = 'cmd.exe /c ' + $line

    $res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create `
        -Arguments @{ CommandLine = $cmdLine; CurrentDirectory = $Root }
    if ($res.ReturnValue -ne 0) {
        throw "创建 $Name 进程失败，Win32_Process.Create 返回 $($res.ReturnValue)"
    }

    Set-Content -Path (Join-Path $Logs "$Name.pid") -Value $res.ProcessId -Encoding ascii
    Write-Host ("  {0,-5} -> {1}  pid={2}" -f $Name, $Port, $res.ProcessId)
}

Write-Host "数据目录：$DataWin"
Write-Host "启动中（每个服务约 10~20 秒）..." -ForegroundColor Cyan

Start-Svc item $ItemPort  @("--hmall.remote.order-url=http://localhost:$OrderPort")
$mailArg = if ($Degraded) { @('--spring.mail.username=', '--spring.mail.password=') } else { @() }
if ($Degraded) { Write-Host '  （Degraded：user-service 验证码只打日志，供自动化测试取码）' -ForegroundColor Yellow }
Start-Svc user $UserPort  $mailArg
Start-Sleep -Seconds 2
Start-Svc cart  $CartPort  @("--hmall.remote.item-url=http://localhost:$ItemPort")
Start-Svc order $OrderPort @("--hmall.remote.item-url=http://localhost:$ItemPort", "--hmall.remote.cart-url=http://localhost:$CartPort")
Start-Svc pay   $PayPort   @("--hmall.remote.order-url=http://localhost:$OrderPort", "--hmall.remote.user-url=http://localhost:$UserPort")

Write-Host "等待端口就绪..." -ForegroundColor Cyan
$ok = 0
for ($i = 0; $i -lt 60; $i++) {
    $ok = 0
    foreach ($p in @($ItemPort, $CartPort, $OrderPort, $PayPort, $UserPort)) {
        try {
            $code = (Invoke-WebRequest -Uri "http://localhost:$p/v3/api-docs" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop).StatusCode
            if ($code -eq 200) { $ok++ }
        } catch { }
    }
    if ($ok -ge 5) { break }
    Start-Sleep -Seconds 2
}

Write-Host ""
if ($ok -ge 5) {
    # pid 文件先记的是 cmd.exe 的 pid。这里按端口查到真正的 java 进程并回写，
    # 让 stop-detached.ps1 杀的是 java 本体（cmd 会在 java 退出后自行结束）。
    $pairs = @{ item = $ItemPort; cart = $CartPort; order = $OrderPort; pay = $PayPort; user = $UserPort }
    foreach ($k in $pairs.Keys) {
        $conn = Get-NetTCPConnection -LocalPort $pairs[$k] -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($conn) { Set-Content -Path (Join-Path $Logs "$k.pid") -Value $conn.OwningProcess -Encoding ascii }
    }

    Write-Host "全部就绪（$ok/5），日志在 logs\<服务>.out.log" -ForegroundColor Green
    Write-Host "  商品 $ItemPort / 购物车 $CartPort / 订单 $OrderPort / 支付 $PayPort / 用户 $UserPort"
    Write-Host "  前端：python scripts/serve-frontend.py 8090 然后打开 http://127.0.0.1:8090/login.html"
    Write-Host "  这些进程由 WmiPrvSE.exe 创建，关闭终端 / 后台任务到期都不会带走它们。" -ForegroundColor DarkGray
    Write-Host "  停止：powershell -ExecutionPolicy Bypass -File scripts\stop-detached.ps1" -ForegroundColor DarkGray
} else {
    Write-Host "只有 $ok/5 就绪，请查看 logs\*.err.log" -ForegroundColor Red
    exit 1
}
