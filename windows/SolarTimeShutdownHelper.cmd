@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Solar Time - Windows Shutdown Helper

if /I "%~1"=="/uninstall" goto uninstall
if not "%~1"=="" goto protocol

set "SOLARTIME_DIR=%LOCALAPPDATA%\SolarTime"
set "SOLARTIME_TARGET=%SOLARTIME_DIR%\SolarTimeShutdownHelper.cmd"
set "SOLARTIME_INSTALLER_SOURCE=%~f0"
if not exist "%SOLARTIME_DIR%" mkdir "%SOLARTIME_DIR%"
copy /Y "%~f0" "%SOLARTIME_TARGET%" >nul
powershell.exe -NoProfile -Command "$root='HKCU:\Software\Classes\solartime-timer'; New-Item -Path $root -Force | Out-Null; Set-Item -Path $root -Value 'URL:Solar Time Windows Timer'; New-ItemProperty -Path $root -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null; New-Item -Path ($root+'\DefaultIcon') -Force | Out-Null; Set-Item -Path ($root+'\DefaultIcon') -Value ($env:SystemRoot+'\System32\shutdown.exe,0'); New-Item -Path ($root+'\shell\open\command') -Force | Out-Null; $quote=[char]34; $percent=[char]37; Set-Item -Path ($root+'\shell\open\command') -Value ($quote+$env:SOLARTIME_TARGET+$quote+' '+$quote+$percent+'1'+$quote)"
if errorlevel 1 (
  echo Solar Time shutdown helper installation failed.
  pause
  exit /b 1
)
powershell.exe -NoProfile -WindowStyle Hidden -Command "$zone=Get-Content -LiteralPath $env:SOLARTIME_INSTALLER_SOURCE -Stream Zone.Identifier -ErrorAction SilentlyContinue; $hostUrl=$zone | Where-Object { $_ -like 'HostUrl=*' } | Select-Object -First 1; if($hostUrl -match '[?&]install=([a-f0-9]{32})'){try{Invoke-WebRequest -UseBasicParsing -Method Post -Uri ('https://solar-time.keg0320.workers.dev/api/windows-helper/install-complete?token='+$Matches[1]) -TimeoutSec 4 | Out-Null}catch{}}"
echo Solar Time Windows shutdown helper is active.
echo 설치가 완료되었습니다.
powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1"
if /I not "%~f0"=="%SOLARTIME_TARGET%" (
  set "SOLARTIME_INSTALLER_DELETE=%~f0"
  start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Remove-Item -LiteralPath $env:SOLARTIME_INSTALLER_DELETE -Force -ErrorAction SilentlyContinue"
)
exit /b 0

:protocol
set "SOLARTIME_URI=%~1"
if /I "%SOLARTIME_URI%"=="solartime-timer://uninstall" goto uninstall_silent
if /I "%SOLARTIME_URI%"=="solartime-timer://uninstall/" goto uninstall_silent
powershell.exe -NoProfile -WindowStyle Hidden -Command "$u=$null; try{$u=[Uri]$env:SOLARTIME_URI}catch{exit 2}; if($u.Scheme -ne 'solartime-timer'){exit 3}; $shutdown=Join-Path $env:SystemRoot 'System32\shutdown.exe'; if($u.Host -eq 'cancel'){& $shutdown /a 2>$null; exit 0}; if($u.Host -ne 'schedule' -or $u.Query -notmatch '^\?seconds=(\d{2,6})$'){exit 4}; $seconds=[int]$Matches[1]; if($seconds -lt 60 -or $seconds -gt 359940){exit 5}; & $shutdown /a 2>$null; & $shutdown /s /t $seconds /c 'Solar Time scheduled shutdown'"
exit /b %errorlevel%

:uninstall_silent
"%SystemRoot%\System32\shutdown.exe" /a >nul 2>&1
set "SOLARTIME_UNINSTALL_TARGET=%~f0"
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 30; Remove-Item -Path 'HKCU:\Software\Classes\solartime-timer' -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $env:SOLARTIME_UNINSTALL_TARGET -Force -ErrorAction SilentlyContinue"
exit /b 0

:uninstall
"%SystemRoot%\System32\shutdown.exe" /a >nul 2>&1
powershell.exe -NoProfile -Command "Remove-Item -Path 'HKCU:\Software\Classes\solartime-timer' -Recurse -Force -ErrorAction SilentlyContinue"
echo Solar Time Windows shutdown helper was disabled.
pause
del /f /q "%~f0" >nul 2>&1
exit /b 0
