@echo off
setlocal
title Solar Time v0.45 Release
cd /d D:\_Program\SolarTime

echo.
echo ========================================
echo   Solar Time v0.45 Release (r6)
echo   D:\_Program\SolarTime
echo ========================================
echo.

if not exist package.json (echo [ERROR] package.json not found.& goto :fail)
if not exist .git (echo [ERROR] .git folder not found. This folder is not connected to GitHub.& goto :fail)
if not exist "%~dp0Apply_v0.45_r6.ps1" (echo [ERROR] Apply_v0.45_r6.ps1 not found.& goto :fail)

echo [1/6] Applying r6 visual-distance patch...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Apply_v0.45_r6.ps1"
if errorlevel 1 goto :fail
del /q "%~dp0Apply_v0.45_r6.ps1" >nul 2>nul

echo.
echo [2/6] Installing project dependencies...
call npm install
if errorlevel 1 goto :fail

echo.
echo [3/6] Running tests...
call npm test
if errorlevel 1 goto :fail

echo.
echo [4/6] Deploying to Cloudflare...
call npm run deploy:cloudflare
if errorlevel 1 goto :fail

echo.
echo [5/6] Staging and committing Git changes...
git add -A
if errorlevel 1 goto :fail

git diff --cached --quiet
if %errorlevel%==0 (
  echo No new Git changes to commit.
) else (
  git commit -m "Refine distant sky rendering"
  if errorlevel 1 goto :fail
)

echo.
echo [6/6] Pushing to GitHub...
git push
if errorlevel 1 goto :fail

echo.
echo ========================================
echo   SUCCESS - Solar Time v0.45 r6 deployed
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
