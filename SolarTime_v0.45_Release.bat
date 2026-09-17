@echo off
setlocal
title Solar Time v0.45 Release
cd /d D:\_Program\SolarTime

echo.
echo ========================================
echo   Solar Time v0.45 Release (r4)
echo   D:\_Program\SolarTime
echo ========================================
echo.

if not exist package.json (echo [ERROR] package.json not found.& goto :fail)
if not exist .git (echo [ERROR] .git folder not found. This folder is not connected to GitHub.& goto :fail)

echo [1/5] Installing project dependencies...
call npm install
if errorlevel 1 goto :fail

echo.
echo [2/5] Running tests...
call npm test
if errorlevel 1 goto :fail

echo.
echo [3/5] Deploying to Cloudflare...
call npm run deploy:cloudflare
if errorlevel 1 goto :fail

echo.
echo [4/5] Staging Git changes...
git add -A
if errorlevel 1 goto :fail

git diff --cached --quiet
if %errorlevel%==0 (
  echo No new Git changes to commit.
) else (
  git commit -m "Add right-drag camera dolly"
  if errorlevel 1 goto :fail
)

echo.
echo [5/5] Pushing to GitHub...
git push
if errorlevel 1 goto :fail

echo.
echo ========================================
echo   SUCCESS - Solar Time v0.45 r4 deployed
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
