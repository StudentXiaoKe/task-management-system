@echo off
chcp 65001 >nul 2>&1

set ROOT=%~dp0
set BACKEND_PORT=8001
set FRONTEND_PORT=5173

echo.
echo ==========================================
echo  Task Management System - Starting...
echo ==========================================
echo.

REM --- Check Python ---
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found
    pause
    exit /b 1
)
echo [OK] Python found

REM --- Check Node ---
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)
echo [OK] Node.js found

echo.
echo [1/2] Starting backend on port %BACKEND_PORT%...
echo.

REM --- Install backend deps ---
cd /d "%ROOT%backend"
python -m pip install -r requirements.txt -q
if errorlevel 1 (
    echo [ERROR] pip install failed
    pause
    exit /b 1
)

REM --- Start backend in new window ---
cd /d "%ROOT%backend"
start "Backend" python -m uvicorn app.main:app --reload --host 0.0.0.0 --port %BACKEND_PORT%
echo [OK] Backend window opened

echo.
echo [2/2] Starting frontend on port %FRONTEND_PORT%...
echo.

REM --- Install frontend deps if needed ---
cd /d "%ROOT%frontend"
if not exist node_modules (
    echo Installing npm packages, please wait...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
)

REM --- Start frontend in new window ---
cd /d "%ROOT%frontend"
start "Frontend" cmd /k npm run dev
echo [OK] Frontend window opened

echo.
echo ==========================================
echo  Done!
echo.
echo  Frontend: http://localhost:%FRONTEND_PORT%
echo  Backend:  http://localhost:%BACKEND_PORT%
echo  Swagger:  http://localhost:%BACKEND_PORT%/docs
echo.
echo  Close the Backend/Frontend windows to stop
echo ==========================================
echo.

timeout /t 4 /nobreak >nul
start http://localhost:%FRONTEND_PORT%

pause
