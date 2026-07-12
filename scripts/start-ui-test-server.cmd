@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
set "DATA_FILE=%CD%\tmp\ui-test-mailboxes.json"
npm start
