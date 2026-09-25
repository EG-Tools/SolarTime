@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
if not exist "tools\deploy-shutdown.cjs" goto fail
where node >nul 2>&1
if errorlevel 1 goto fail
call npm ci
if errorlevel 1 goto fail
if not defined CLOUDFLARE_API_TOKEN (
  node node_modules\wrangler\bin\wrangler.js login
  if errorlevel 1 goto fail
)
node tools\deploy-shutdown.cjs --apply
if errorlevel 1 goto fail
echo Cloudflare helper and Worker delivery verified.
echo GitHub Pages must use this release too. Reinstall the helper ONLY if its hash changed.
pause
exit /b 0
:fail
echo Deployment did NOT finish. Read the error above. No success is assumed.
pause
exit /b 1
