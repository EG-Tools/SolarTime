@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Solar Time - Windows Shutdown Helper
set "SOLARTIME_INSTALLER_SOURCE=%~f0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$text=[IO.File]::ReadAllText($env:SOLARTIME_INSTALLER_SOURCE,[Text.Encoding]::UTF8); $parts=$text -split '(?m)^# SOLARTIME_POWERSHELL\r?$',2; if($parts.Count -ne 2){exit 2}; & ([scriptblock]::Create($parts[1])) -Install"
if errorlevel 1 (
  echo Installation failed. Keep this window and the installer for diagnosis.
  pause
  exit /b 1
)
echo Solar Time helper installed. Return to Solar Time and verify the connection.
echo This installer may now be closed.
exit /b 0
# SOLARTIME_POWERSHELL
param([string]$Uri = '', [switch]$Install, [switch]$SelfTest)
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
$script:Api = 'https://solar-time.keg0320.workers.dev/api/windows-helper/'
$script:HelperDir = Join-Path $env:LOCALAPPDATA 'SolarTime'
$script:ProtocolRoot = 'HKCU:\Software\Classes\solartime-timer'

function Get-HelperRevision {
    $file = Join-Path $script:HelperDir 'SolarTimeShutdownHelper.cmd'
    return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
}
function Write-HelperLog([string]$Message) {
    try {
        $file = Join-Path $script:HelperDir 'shutdown-helper.log'
        if ((Test-Path -LiteralPath $file) -and (Get-Item -LiteralPath $file).Length -gt 65536) { Remove-Item -LiteralPath $file -Force }
        Add-Content -LiteralPath $file -Encoding UTF8 -Value ((Get-Date).ToUniversalTime().ToString('o') + ' ' + $Message)
    } catch { }
}
function Send-HelperReceipt([string]$Token, [object]$Result, [switch]$Installation) {
    if ($Token -notmatch '^[a-f0-9]{32}$') { return }
    $endpoint = if ($Installation) { 'install-complete' } else { 'operation-complete' }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $body = $Result | ConvertTo-Json -Compress
    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        try {
            Invoke-WebRequest -UseBasicParsing -Method Post -Uri ($script:Api + $endpoint + '?token=' + $Token) -ContentType 'application/json' -Body $body -TimeoutSec 6 | Out-Null
            return
        } catch { Write-HelperLog ('Receipt delivery failed: ' + $endpoint); Start-Sleep -Milliseconds 300 }
    }
}
function Convert-HelperUri([string]$Value) {
    # Strict allow-list. No URI text is ever evaluated as a command or script.
    $pattern = '^solartime-timer://(schedule|cancel|probe|uninstall)/?\?(?:seconds=([0-9]{2,6})&)?token=([a-f0-9]{32})&at=([0-9]{13})$'
    $match = [regex]::Match($Value, $pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $match.Success) { throw 'Invalid Solar Time protocol request.' }
    $action = $match.Groups[1].Value.ToLowerInvariant()
    $seconds = if ($match.Groups[2].Success) { [int]$match.Groups[2].Value } else { 0 }
    if (($action -eq 'schedule' -and ($seconds -lt 60 -or $seconds -gt 359940)) -or ($action -ne 'schedule' -and $match.Groups[2].Success)) { throw 'Invalid shutdown duration.' }
    return @{ action=$action; seconds=$seconds; token=$match.Groups[3].Value.ToLowerInvariant(); at=[long]$match.Groups[4].Value }
}
function Get-HelperNow { return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
function Invoke-ShutdownCommand([string]$Arguments) {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = Join-Path $env:SystemRoot 'System32\shutdown.exe'
    $info.Arguments = $Arguments
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $info
    try {
        [void]$process.Start()
        $output = $process.StandardOutput.ReadToEnd()
        $errorText = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        return [int]$process.ExitCode
    } finally { $process.Dispose() }
}
function Read-HelperState {
    $file = Join-Path $script:HelperDir 'shutdown-state.json'
    try { return Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return [pscustomobject]@{ at=0; disabled=$false } }
}
function Save-HelperState([long]$At, [bool]$Disabled = $false) {
    $file = Join-Path $script:HelperDir 'shutdown-state.json'
    @{ at=$At; disabled=$Disabled } | ConvertTo-Json -Compress | Set-Content -LiteralPath $file -Encoding UTF8
}
function Invoke-HelperOperation([object]$Request) {
    $now = Get-HelperNow
    $result = @{ protocol=2; action=$Request.action; ok=$false; code=2; revision=(Get-HelperRevision); at=$Request.at; deadline=0 }
    if ($Request.at -lt $now-120000 -or $Request.at -gt $now+30000) { $result.code=408; return $result }
    if ($Request.action -eq 'probe') { $result.ok=$true; $result.code=0; return $result }
    $state = Read-HelperState
    if ($Request.at -le [long]$state.at -or ($state.disabled -and $Request.action -ne 'cancel')) { $result.code=409; return $result }
    # Persist ordering BEFORE touching Windows; a late schedule cannot undo a newer cancellation.
    Save-HelperState $Request.at
    $code = Invoke-ShutdownCommand '/a'
    if ($code -ne 0 -and $code -ne 1116) { $result.code=$code; return $result }
    if ($Request.action -eq 'schedule') {
        # Windows /t > 0 implies forced application closing; the UI warns about unsaved work.
        $code = Invoke-ShutdownCommand ('/s /t ' + $Request.seconds + ' /c "Solar Time scheduled shutdown"')
        $result.code=$code; $result.ok=($code -eq 0)
        if ($result.ok) { $result.deadline=(Get-HelperNow)+$Request.seconds*1000 }
    } else {
        $result.code=0; $result.ok=$true
        if ($Request.action -eq 'uninstall') {
            Save-HelperState $Request.at $true
            if (Test-Path -LiteralPath $script:ProtocolRoot) { Remove-Item -LiteralPath $script:ProtocolRoot -Recurse -Force }
            if (Test-Path -LiteralPath $script:ProtocolRoot) { throw 'Protocol removal verification failed.' }
            foreach ($name in @('SolarTimeShutdownHelper.cmd','SolarTimeShutdownHelper.ps1','SolarTimeShutdownLauncher.vbs','SolarTimeShutdownInstall.id')) {
                $file = Join-Path $script:HelperDir $name
                if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
            }
            # Keep a small ordering tombstone and diagnostic log, not an executable or registration.
        }
    }
    Write-HelperLog ($Request.action + ': Windows exit ' + $result.code)
    return $result
}
function Install-Helper {
    $source = $env:SOLARTIME_INSTALLER_SOURCE
    if (-not $source -or -not (Test-Path -LiteralPath $source)) { throw 'Installer source not found.' }
    New-Item -ItemType Directory -Path $script:HelperDir -Force | Out-Null
    $target = Join-Path $script:HelperDir 'SolarTimeShutdownHelper.cmd'
    $runtime = Join-Path $script:HelperDir 'SolarTimeShutdownHelper.ps1'
    $text = [IO.File]::ReadAllText($source, [Text.Encoding]::UTF8)
    $parts = $text -split '(?m)^# SOLARTIME_POWERSHELL\r?$',2
    if ($parts.Count -ne 2) { throw 'Invalid installer payload.' }
    if ([IO.Path]::GetFullPath($source) -ne [IO.Path]::GetFullPath($target)) { Copy-Item -LiteralPath $source -Destination $target -Force }
    [IO.File]::WriteAllText($runtime, $parts[1], (New-Object Text.UTF8Encoding($true)))
    $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    & $powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $runtime -SelfTest
    if ($LASTEXITCODE -ne 0) { throw 'Installed PowerShell runtime self-test failed.' }
    $root = $script:ProtocolRoot
    New-Item -Path $root -Force | Out-Null
    Set-Item -Path $root -Value 'URL:Solar Time Windows Timer'
    New-ItemProperty -Path $root -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
    New-Item -Path ($root+'\DefaultIcon') -Force | Out-Null
    Set-Item -Path ($root+'\DefaultIcon') -Value ($env:SystemRoot+'\System32\shutdown.exe,0')
    New-Item -Path ($root+'\shell\open\command') -Force | Out-Null
    # Launch PowerShell directly. Do not pass untrusted URI text through cmd.exe or VBScript.
    $command = '"'+$powershell+'" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$runtime+'" -Uri "%1"'
    Set-Item -Path ($root+'\shell\open\command') -Value $command
    if ((Get-Item -LiteralPath ($root+'\shell\open\command')).GetValue('') -cne $command) { throw 'Protocol registration verification failed.' }
    Save-HelperState (Get-HelperNow)
    foreach ($name in @('SolarTimeShutdownLauncher.vbs','SolarTimeShutdownInstall.id')) { Remove-Item -LiteralPath (Join-Path $script:HelperDir $name) -Force -ErrorAction SilentlyContinue }
    Write-HelperLog 'Installation and runtime self-test completed.'
    $zone = Get-Content -LiteralPath $source -Stream Zone.Identifier -ErrorAction SilentlyContinue
    $hostUrl = $zone | Where-Object { $_ -like 'HostUrl=*' } | Select-Object -First 1
    if ($hostUrl -match '[?&]install=([a-f0-9]{32})') {
        $token = $Matches[1]
        Send-HelperReceipt $token @{protocol=2; action='install'; ok=$true; code=0; revision=(Get-HelperRevision); at=(Get-HelperNow); deadline=0} -Installation
    }
}
if ($MyInvocation.InvocationName -ne '.') {
    try {
        if ($SelfTest) {
            $sample = Convert-HelperUri ('solartime-timer://probe?token=0123456789abcdef0123456789abcdef&at='+(Get-HelperNow))
            if ($sample.action -ne 'probe') { throw 'URI self-test failed.' }
            exit 0
        }
        if ($Install) { Install-Helper; exit 0 }
        $request = Convert-HelperUri $Uri
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $mutex = New-Object Threading.Mutex($false, ('Local\SolarTimeShutdown-'+$sid))
        $locked = $false
        try {
            try { $locked=$mutex.WaitOne(15000) } catch [Threading.AbandonedMutexException] { $locked=$true }
            if (-not $locked) { throw 'Another helper operation did not finish.' }
            $result = Invoke-HelperOperation $request
        } finally { if ($locked) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
        Send-HelperReceipt $request.token $result
        if (-not $result.ok) { exit 1 }
        exit 0
    } catch {
        Write-HelperLog ('Error: '+$_.Exception.Message)
        if ($Install) { Write-Error $_ -ErrorAction Continue }
        exit 1
    }
}
