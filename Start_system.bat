@echo off
color 0A
echo ========================================
echo   [School Name] System - Launcher
echo   (Node.js + PostgreSQL + JWT Auth)
echo ========================================
echo.

:: --- STEP 0: Move to project folder ---
:: (Always runs from wherever THIS .bat file actually lives — no more
:: hardcoded path to an old version folder.)
cd /d "%~dp0"
if not exist "index.html" (
    echo [ERROR] Could not find index.html in this folder:
    echo %~dp0
    echo Make sure Start_system.bat is inside the same folder as index.html.
    pause
    exit /b 1
)

:: --- STEP 1: Check Node.js ---
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install it from https://nodejs.org
    pause
    exit /b 1
)

:: --- STEP 2: Check Ollama ---
where ollama >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Ollama not found. Install from ollama.com
    pause
    exit /b 1
)

:: --- STEP 3: Check .env ---
if not exist ".env" (
    echo [ERROR] .env file not found in this folder.
    echo Copy .env.example to .env and fill in your PostgreSQL
    echo connection details and JWT_SECRET first ^(see SETUP.md^).
    pause
    exit /b 1
)

:: --- STEP 4: Install / update backend dependencies ---
if not exist "node_modules" (
    echo [1/4] Installing server dependencies ^(first run only^)...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. See the messages above.
        pause
        exit /b 1
    )
) else (
    if not exist "node_modules\bcryptjs" (
        echo [1/4] Installing dependencies...
        call npm install
    ) else if not exist "node_modules\pdf-parse" (
        echo [1/4] Installing new dependencies ^(document parsing^)...
        call npm install
    ) else if not exist "node_modules\mammoth" (
        echo [1/4] Installing new dependencies ^(document parsing^)...
        call npm install
    ) else if not exist "node_modules\xlsx" (
        echo [1/4] Installing new dependencies ^(document parsing^)...
        call npm install
    ) else if not exist "node_modules\adm-zip" (
        echo [1/4] Installing new dependencies ^(archive parsing^)...
        call npm install
    ) else if not exist "node_modules\tar-stream" (
        echo [1/4] Installing new dependencies ^(archive parsing^)...
        call npm install
    ) else (
        echo [1/4] Server dependencies already installed.
    )
)

:: --- STEP 5: Start Ollama (with automatic session logging) ---
echo [2/4] Starting Ollama...
if not exist "logs" mkdir "logs"
start "Ollama Server" powershell -NoLogo -NoExit -ExecutionPolicy Bypass -File "%~dp0start_ollama.ps1"
timeout /t 5 /nobreak >nul

:: --- STEP 6: Start Node server ---
echo [3/4] Starting web server ^(Node.js + PostgreSQL + JWT^)...
start cmd /k "color 0A && npm start"

:: --- STEP 7: Wait and open browser ---
echo Waiting for server...
timeout /t 3 /nobreak >nul

echo [4/4] Opening browser...
start http://localhost:8000/

echo.
echo ========================================
echo   DONE! Browser should open now.
echo.
echo   V162 features:
echo   - System Activity Timeline
echo   - Error Log Dashboard
echo   - Server Health Monitoring
echo   - Database Health Monitoring
echo   - Automatic Daily Backups
echo   - Backup Restore System
echo   - Database Migration Manager
echo   - AI Chat File / Picture Attachments (1GB max)
echo   - Document Parsing (PDF, Word, Excel)
echo   - Archive Parsing (ZIP, TAR, GZ, TGZ)
echo   - Fully Automatic Language Translation
echo   - Persistent Translation Memory (survives Ollama outages)
echo   - Automatic Ollama Session Logging (.\logs)
echo   - Security Hardening (auth, RBAC, rate limiting)
echo ========================================
echo.
pause
