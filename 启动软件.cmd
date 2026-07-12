@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process 'http://127.0.0.1:4173/'"
npm start
if errorlevel 1 pause
