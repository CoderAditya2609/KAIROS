@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo KAIROS needs Node.js 18 or newer. Install the LTS from https://nodejs.org
  echo then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo KAIROS: installing express and dotenv, one time...
  call npm install
)

rem config.json owns the port; 4747 if it cannot be read.
set PORT=4747
for /f "usebackq delims=" %%p in (`node -p "require('./config.json').port||4747"`) do set PORT=%%p
set URL=http://localhost:%PORT%

rem Reuse a server that is already up instead of crashing on the port.
node -e "fetch('http://localhost:%PORT%/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
if not errorlevel 1 (
  echo KAIROS: server already running on port %PORT%
  goto :browser
)

rem Server runs in its own minimised window. Close that window to stop KAIROS.
start "KAIROS SERVER" /min cmd /k "title KAIROS SERVER && node server\index.js"

rem Give the server a moment to bind the port. timeout cannot run with
rem redirected input, so ping is used for the delay.
ping -n 3 127.0.0.1 >nul 2>&1

:browser
set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if exist "%BROWSER%" (
  rem --window-size is in device-independent pixels, so on a scaled display it can
  rem ask for more than the screen has. Maximising keeps the whole HUD visible.
  start "" "%BROWSER%" --app=%URL% --window-size=1280,800 --start-maximized
  goto :end
)

echo KAIROS could not find Edge or Chrome.
echo Open %URL% in any browser once the KAIROS SERVER window is running.
pause

:end
endlocal
