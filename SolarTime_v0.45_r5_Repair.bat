@echo off
setlocal
title Solar Time v0.45 r5 Repair
cd /d D:\_Program\SolarTime

echo.
echo ========================================
echo   Solar Time v0.45 r5 Repair
echo   Restore r4 + stabilize tiny stars
echo ========================================
echo.

if not exist .git (
  echo [ERROR] .git folder not found.
  goto :fail
)

for /f "delims=" %%H in ('git rev-parse HEAD 2^>nul') do set HEADSHA=%%H
if /I not "%HEADSHA%"=="c3fa0e4c185b876c394aee9a03bd08b0cec8ffd9" (
  echo [ERROR] Git HEAD is not the known-good r4 commit.
  echo Current: %HEADSHA%
  echo Expected: c3fa0e4c185b876c394aee9a03bd08b0cec8ffd9
  echo No files were changed.
  goto :fail
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Apply_v0.45_r5_fix.ps1"
if errorlevel 1 goto :fail

echo.
echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 goto :fail

echo.
echo [2/4] Running full tests...
call npm test
if errorlevel 1 goto :fail

echo.
echo [3/4] Deploying to Cloudflare...
call npm run deploy:cloudflare
if errorlevel 1 goto :fail

echo.
echo [4/4] Committing and pushing...
git add -A
if errorlevel 1 goto :fail
git diff --cached --quiet
if %errorlevel%==0 (
  echo No changes to commit.
) else (
  git commit -m "Stabilize tiny star rendering"
  if errorlevel 1 goto :fail
)
git push
if errorlevel 1 goto :fail

echo.
echo ========================================
echo   SUCCESS - Solar Time v0.45 r5
echo ========================================
git status
echo.
pause
exit /b 0

:fail
echo.
echo ========================================
echo   FAILED - stopped before later steps
echo ========================================
echo.
pause
exit /b 1
