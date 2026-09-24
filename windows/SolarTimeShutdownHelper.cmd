@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Solar Time - Windows Shutdown Helper

if /I "%~1"=="/uninstall" goto uninstall
if not "%~1"=="" goto protocol

set "SOLARTIME_DIR=%LOCALAPPDATA%\SolarTime"
set "SOLARTIME_TARGET=%SOLARTIME_DIR%\SolarTimeShutdownHelper.cmd"
set "SOLARTIME_LAUNCHER=%SOLARTIME_DIR%\SolarTimeShutdownLauncher.vbs"
set "SOLARTIME_MARKER=%SOLARTIME_DIR%\SolarTimeShutdownInstall.id"
set "SOLARTIME_INSTALL_ID=%RANDOM%%RANDOM%%RANDOM%%RANDOM%"
set "SOLARTIME_INSTALLER_SOURCE=%~f0"
if not exist "%SOLARTIME_DIR%" mkdir "%SOLARTIME_DIR%"
copy /Y "%~f0" "%SOLARTIME_TARGET%" >nul
> "%SOLARTIME_MARKER%" echo %SOLARTIME_INSTALL_ID%
> "%SOLARTIME_LAUNCHER%" echo Option Explicit
>> "%SOLARTIME_LAUNCHER%" echo Dim shell, fso, expression, helper, uri, quote, command
>> "%SOLARTIME_LAUNCHER%" echo If WScript.Arguments.Count ^< 1 Then WScript.Quit 2
>> "%SOLARTIME_LAUNCHER%" echo Set expression = New RegExp
>> "%SOLARTIME_LAUNCHER%" echo expression.Pattern = "^solartime-timer://(cancel/?|uninstall/?|schedule[?]seconds=[0-9]{2,6})$"
>> "%SOLARTIME_LAUNCHER%" echo expression.IgnoreCase = True
>> "%SOLARTIME_LAUNCHER%" echo uri = WScript.Arguments(0^)
>> "%SOLARTIME_LAUNCHER%" echo If Not expression.Test(uri^) Then WScript.Quit 3
>> "%SOLARTIME_LAUNCHER%" echo Set shell = CreateObject("WScript.Shell"^)
>> "%SOLARTIME_LAUNCHER%" echo Set fso = CreateObject("Scripting.FileSystemObject"^)
>> "%SOLARTIME_LAUNCHER%" echo helper = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName^), "SolarTimeShutdownHelper.cmd"^)
>> "%SOLARTIME_LAUNCHER%" echo quote = Chr(34^)
>> "%SOLARTIME_LAUNCHER%" echo command = quote ^& shell.ExpandEnvironmentStrings("%%ComSpec%%"^) ^& quote ^& " /d /c " ^& quote ^& quote ^& helper ^& quote ^& " " ^& quote ^& uri ^& quote ^& quote
>> "%SOLARTIME_LAUNCHER%" echo shell.Run command, 0, False
powershell.exe -NoProfile -Command "$root='HKCU:\Software\Classes\solartime-timer'; New-Item -Path $root -Force | Out-Null; Set-Item -Path $root -Value 'URL:Solar Time Windows Timer'; New-ItemProperty -Path $root -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null; New-Item -Path ($root+'\DefaultIcon') -Force | Out-Null; Set-Item -Path ($root+'\DefaultIcon') -Value ($env:SystemRoot+'\System32\shutdown.exe,0'); New-Item -Path ($root+'\shell\open\command') -Force | Out-Null; $quote=[char]34; $percent=[char]37; $wscript=$env:SystemRoot+'\System32\wscript.exe'; Set-Item -Path ($root+'\shell\open\command') -Value ($quote+$wscript+$quote+' //B //Nologo '+$quote+$env:SOLARTIME_LAUNCHER+$quote+' '+$quote+$percent+'1'+$quote)"
if errorlevel 1 (
  echo Solar Time shutdown helper installation failed.
  pause
  exit /b 1
)
powershell.exe -NoProfile -WindowStyle Hidden -Command "$zone=Get-Content -LiteralPath $env:SOLARTIME_INSTALLER_SOURCE -Stream Zone.Identifier -ErrorAction SilentlyContinue; $hostUrl=$zone | Where-Object { $_ -like 'HostUrl=*' } | Select-Object -First 1; if($hostUrl -match '[?&]install=([a-f0-9]{32})'){try{Invoke-WebRequest -UseBasicParsing -Method Post -Uri ('https://solar-time.keg0320.workers.dev/api/windows-helper/install-complete?token='+$Matches[1]) -TimeoutSec 4 | Out-Null}catch{}}"
echo Solar Time Windows shutdown helper is active.
echo 설치가 완료되었습니다.
powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1"
if /I "%~f0"=="%SOLARTIME_TARGET%" goto install_done
set "SOLARTIME_INSTALLER_DELETE=%~f0"
set "SOLARTIME_INSTALLER_CLEANUP=%TEMP%\SolarTimeInstallerCleanup_%RANDOM%%RANDOM%.vbs"
> "%SOLARTIME_INSTALLER_CLEANUP%" echo Option Explicit
>> "%SOLARTIME_INSTALLER_CLEANUP%" echo Dim fso, target
>> "%SOLARTIME_INSTALLER_CLEANUP%" echo Set fso = CreateObject("Scripting.FileSystemObject"^)
>> "%SOLARTIME_INSTALLER_CLEANUP%" echo target = WScript.Arguments(0^)
>> "%SOLARTIME_INSTALLER_CLEANUP%" echo WScript.Sleep 2000
>> "%SOLARTIME_INSTALLER_CLEANUP%" echo On Error Resume Next
>> "%SOLARTIME_INSTALLER_CLEANUP%" echo fso.DeleteFile target, True
>> "%SOLARTIME_INSTALLER_CLEANUP%" echo fso.DeleteFile WScript.ScriptFullName, True
start "" "%SystemRoot%\System32\wscript.exe" //B //Nologo "%SOLARTIME_INSTALLER_CLEANUP%" "%SOLARTIME_INSTALLER_DELETE%"
:install_done
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
set "SOLARTIME_UNINSTALL_LAUNCHER=%~dp0SolarTimeShutdownLauncher.vbs"
set "SOLARTIME_UNINSTALL_MARKER=%~dp0SolarTimeShutdownInstall.id"
set "SOLARTIME_UNINSTALL_ID="
if exist "%SOLARTIME_UNINSTALL_MARKER%" set /p SOLARTIME_UNINSTALL_ID=<"%SOLARTIME_UNINSTALL_MARKER%"
set "SOLARTIME_UNINSTALL_CLEANUP=%TEMP%\SolarTimeShutdownCleanup_%RANDOM%%RANDOM%.vbs"
> "%SOLARTIME_UNINSTALL_CLEANUP%" echo Option Explicit
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo Dim shell, fso, target, launcher, marker, expected, current, stream
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo Set shell = CreateObject("WScript.Shell"^)
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo Set fso = CreateObject("Scripting.FileSystemObject"^)
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo target = WScript.Arguments(0^)
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo launcher = WScript.Arguments(1^)
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo marker = WScript.Arguments(2^)
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo expected = WScript.Arguments(3^)
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo WScript.Sleep 5000
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo On Error Resume Next
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo current = ""
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo If fso.FileExists(marker^) Then
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo   Set stream = fso.OpenTextFile(marker, 1, False^)
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo   current = Trim(stream.ReadLine^)
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo   stream.Close
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo End If
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo If current = expected Then
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo   shell.Run "reg.exe delete ""HKCU\Software\Classes\solartime-timer"" /f", 0, True
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo   fso.DeleteFile target, True
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo   fso.DeleteFile launcher, True
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo   fso.DeleteFile marker, True
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo End If
>> "%SOLARTIME_UNINSTALL_CLEANUP%" echo fso.DeleteFile WScript.ScriptFullName, True
start "" "%SystemRoot%\System32\wscript.exe" //B //Nologo "%SOLARTIME_UNINSTALL_CLEANUP%" "%SOLARTIME_UNINSTALL_TARGET%" "%SOLARTIME_UNINSTALL_LAUNCHER%" "%SOLARTIME_UNINSTALL_MARKER%" "%SOLARTIME_UNINSTALL_ID%"
exit /b 0

:uninstall
"%SystemRoot%\System32\shutdown.exe" /a >nul 2>&1
powershell.exe -NoProfile -Command "Remove-Item -Path 'HKCU:\Software\Classes\solartime-timer' -Recurse -Force -ErrorAction SilentlyContinue"
del /f /q "%~dp0SolarTimeShutdownLauncher.vbs" >nul 2>&1
del /f /q "%~dp0SolarTimeShutdownInstall.id" >nul 2>&1
echo Solar Time Windows shutdown helper was disabled.
pause
del /f /q "%~f0" >nul 2>&1
exit /b 0
