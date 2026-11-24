@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "ROOT=%CD%"
set "JVM=-Xms96m -Xmx256m"
set "DATA=%ROOT%\data"

title 黑马商城 - 启动服务

echo ============================================================
echo   黑马商城 本地启动
echo   目录：%ROOT%
echo ============================================================
echo.

if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"
if not exist "%DATA%" mkdir "%DATA%"

echo [1/3] 检查端口 8081~8085 / 8090 ...
set "BUSY=0"
for %%p in (8081 8082 8083 8084 8085 8090) do (
    netstat -ano | findstr /R /C:":%%p .*LISTENING" >nul && set "BUSY=1"
)
if "%BUSY%"=="1" (
    echo   检测到残留实例，先自动停止它们...
    powershell -ExecutionPolicy Bypass -NoProfile -File "%ROOT%\scripts\stop-detached.ps1"
    ping -n 4 127.0.0.1 >nul
)
echo   端口空闲，可以启动
echo.

echo [2/3] 拉起 5 个服务（每个一个最小化窗口，关掉窗口即等于停止该服务）...
start "hmall-item  8081" /min cmd /c "cd /d %ROOT% && java %JVM% -jar item-service\target\item-service.jar --server.port=8081 --hmall.data.dir=%DATA% --hmall.remote.order-url=http://localhost:8083 > logs\item.out.log 2>&1"
start "hmall-user  8085" /min cmd /c "cd /d %ROOT% && java %JVM% -jar user-service\target\user-service.jar --server.port=8085 --hmall.data.dir=%DATA% > logs\user.out.log 2>&1"
rem 用 ping 计时而不是 timeout：timeout 在标准输入被重定向时会直接报错退出
ping -n 3 127.0.0.1 >nul
start "hmall-cart  8082" /min cmd /c "cd /d %ROOT% && java %JVM% -jar cart-service\target\cart-service.jar --server.port=8082 --hmall.data.dir=%DATA% --hmall.remote.item-url=http://localhost:8081 > logs\cart.out.log 2>&1"
start "hmall-order 8083" /min cmd /c "cd /d %ROOT% && java %JVM% -jar order-service\target\order-service.jar --server.port=8083 --hmall.data.dir=%DATA% --hmall.remote.item-url=http://localhost:8081 --hmall.remote.cart-url=http://localhost:8082 > logs\order.out.log 2>&1"
start "hmall-pay   8084" /min cmd /c "cd /d %ROOT% && java %JVM% -jar pay-service\target\pay-service.jar --server.port=8084 --hmall.data.dir=%DATA% --hmall.remote.order-url=http://localhost:8083 --hmall.remote.user-url=http://localhost:8085 > logs\pay.out.log 2>&1"

where python >nul 2>&1
if errorlevel 1 (
    echo   未找到 python，跳过前端静态服务，请手动执行：python scripts\serve-frontend.py 8090
) else (
    start "hmall-web   8090" /min cmd /c "cd /d %ROOT% && python scripts\serve-frontend.py 8090 > logs\web.out.log 2>&1"
    echo   前端静态服务已拉起（8090）
)
echo.

echo [3/3] 等待服务就绪（约 40 秒，首次启动 H2 建表会慢一些）...
ping -n 41 127.0.0.1 >nul

set OK=0
for %%p in (8081 8082 8083 8084 8085) do (
    netstat -ano | findstr /R /C:":%%p .*LISTENING" >nul && set /a OK+=1
)

echo.
if "%OK%"=="5" (
    echo   全部就绪 5/5
    echo   商品 8081 / 购物车 8082 / 订单 8083 / 支付 8084 / 用户 8085
    echo   前端 http://127.0.0.1:8090/login.html
    echo   演示账号 zhangsan / lisi / wangwu，密码都是 123456
    echo.
    start "" http://127.0.0.1:8090/login.html
) else (
    echo   只有 %OK%/5 就绪，请看 logs\ 下对应服务的 .out.log
    echo   常见原因：jar 没打包（先跑 bash scripts\build.sh），或端口被别的程序占用
)
echo.
echo 停止全部服务：双击 stop-services.bat
pause
