@echo off
setlocal
set "ROOT=%~dp0"
set BACKEND_PORT=8001
set FRONTEND_PORT=5173

echo.
echo ==========================================
echo  Task Management System
echo ==========================================
echo.

REM === Step 1: Check environment ===
echo [1/5] Checking environment...
python --version >nul 2>&1
if errorlevel 1 ( echo [ERROR] Python not found & pause & exit /b 1 )
node --version >nul 2>&1
if errorlevel 1 ( echo [ERROR] Node.js not found & pause & exit /b 1 )
echo       OK

REM === Step 2: Kill processes on our specific ports ===
echo [2/5] Killing processes on ports %BACKEND_PORT% and %FRONTEND_PORT%...
:KILL_LOOP
set KILLED=0
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":%BACKEND_PORT%.*LISTENING"') do (
    echo       Killing backend PID %%p
    taskkill /F /PID %%p >nul 2>&1
    set KILLED=1
)
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":%FRONTEND_PORT%.*LISTENING"') do (
    echo       Killing frontend PID %%p
    taskkill /F /PID %%p >nul 2>&1
    set KILLED=1
)
if %KILLED%==1 (
    timeout /t 2 /nobreak >nul
    goto KILL_LOOP
)
echo       All clear

REM === Step 3: Install dependencies & clean database ===
echo [3/5] Installing backend dependencies...
cd /d "%ROOT%backend"
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Backend dependency installation failed!
    pause
    exit /b 1
)
echo       Done

REM === Step 3: Start backend (auto-migrate + auto-seed on startup) ===
echo [4/5] Starting backend...
cd /d "%ROOT%backend"
start "Backend" python -m uvicorn app.main:app --reload --host 0.0.0.0 --port %BACKEND_PORT%

REM Wait for backend to be ready (max 30 seconds)
echo       Waiting for backend on port %BACKEND_PORT%...
set WAIT_COUNT=0
:WAIT_BACKEND
timeout /t 1 /nobreak >nul
set /a WAIT_COUNT+=1
if %WAIT_COUNT% GTR 30 (
    echo [ERROR] Backend failed to start within 30 seconds!
    pause
    exit /b 1
)
curl -s http://localhost:%BACKEND_PORT%/api/health >nul 2>&1
if errorlevel 1 goto WAIT_BACKEND
echo       Backend ready! (%WAIT_COUNT%s)

REM === Step 4: Start frontend ===
echo [5/5] Starting frontend...
cd /d "%ROOT%frontend"
start "Frontend" cmd /k npx vite --port %FRONTEND_PORT% --host 0.0.0.0

REM Wait for frontend to be ready
echo       Waiting for frontend on port %FRONTEND_PORT%...
set WAIT_COUNT=0
:WAIT_FRONTEND
timeout /t 1 /nobreak >nul
set /a WAIT_COUNT+=1
if %WAIT_COUNT% GTR 30 (
    echo [ERROR] Frontend failed to start within 30 seconds!
    pause
    exit /b 1
)
curl -s http://localhost:%FRONTEND_PORT%/ >nul 2>&1
if errorlevel 1 goto WAIT_FRONTEND
echo       Frontend ready! (%WAIT_COUNT%s)

echo.
echo ==========================================
echo  Frontend: http://localhost:%FRONTEND_PORT%
echo  Backend:  http://localhost:%BACKEND_PORT%
echo  管理员:   admin / Admin@123456
echo  需求方:   client / Client@123456
echo  开发者:   memberA / Dev@123456
echo ==========================================
echo.

start http://localhost:%FRONTEND_PORT%

pause
