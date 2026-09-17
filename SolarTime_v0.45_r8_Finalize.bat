@echo off
setlocal
title Solar Time v0.45 r8 Finalize
cd /d D:\_Program\SolarTime

echo.
echo ========================================
echo   Solar Time v0.45 r8 Finalize
echo   Idempotent test correction
echo ========================================
echo.

if not exist package.json (echo [ERROR] package.json not found.& goto :fail)
if not exist .git (echo [ERROR] .git folder not found.& goto :fail)
if not exist "%~dp0Apply_v0.45_r8_finalize.ps1" (echo [ERROR] Finalize script not found.& goto :fail)

echo [1/4] Normalizing current r8 test expectations...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Apply_v0.45_r8_finalize.ps1"
if errorlevel 1 goto :fail
del /q "%~dp0Apply_v0.45_r8_finalize.ps1" >nul 2>nul

echo.
echo [2/4] Running full tests...
call npm test
if errorlevel 1 goto :fail

echo.
echo [3/4] Deploying to Cloudflare...
call npm run deploy:cloudflare
if errorlevel 1 goto :fail

echo.
echo [4/4] Committing and pushing completed r8...
git add -A
if errorlevel 1 goto :fail

git diff --cached --quiet
if %errorlevel%==0 (
  echo No new Git changes to commit.
) else (
  git commit -m "Set star density to 30000"
  if errorlevel 1 goto :fail
)

git push
if errorlevel 1 goto :fail

echo.
echo ========================================
echo   SUCCESS - Solar Time v0.45 r8 deployed
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
