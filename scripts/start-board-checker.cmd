@echo off
rem Starts the board checker (owner, 2026-10-17: run it at Windows sign-in).
rem A shortcut to this file goes in the Startup folder (Win+R, shell:startup).
title Board checker
cd /d "%~dp0.."
node scripts\board-auto.js --me SR03 --every 5
echo.
echo The board checker stopped. Press any key to close this window.
pause >nul
