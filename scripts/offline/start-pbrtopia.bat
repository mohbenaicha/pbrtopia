@echo off
rem Starts pbrtopia from its built files and opens it in the browser (app/web-hosting R7). Needs nothing installed.
setlocal
set "HERE=%~dp0"
set "SITE=%HERE%site"
if not exist "%SITE%\index.html" set "SITE=%HERE%..\..\builds\web\material"
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%serve-site.ps1" -Site "%SITE%" -Port 4393
if errorlevel 1 pause
