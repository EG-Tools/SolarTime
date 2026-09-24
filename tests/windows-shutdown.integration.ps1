# Native Windows PowerShell 5.1 regression. All shutdown execution is mocked.
# Temporary per-user registry keys are used; the real SolarTime registration is untouched.
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$source=Join-Path $repo 'windows\SolarTimeShutdownHelper.cmd'
$oldLocal=$env:LOCALAPPDATA
$oldSource=$env:SOLARTIME_INSTALLER_SOURCE
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('Solar Time '+[guid]::NewGuid().ToString('N')+' (test) '+[char]0xD55C+[char]0xAE00)
$testRegistry='HKCU:\Software\Classes\solartime-timer-test-'+[guid]::NewGuid().ToString('N')
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$checks=0
function Assert-True([bool]$Condition,[string]$Name){if(-not $Condition){throw $Name};$script:checks++;Write-Host ('PASS '+$Name)}
try {
 $env:LOCALAPPDATA=$testRoot
 $payload=([IO.File]::ReadAllText($source,[Text.Encoding]::UTF8) -split '(?m)^# SOLARTIME_POWERSHELL\r?$',2)[1]
 $library=Join-Path $testRoot 'runtime-test.ps1'
 [IO.File]::WriteAllText($library,$payload,(New-Object Text.UTF8Encoding($true)))
 . $library
 $script:ProtocolRoot=$testRegistry
 New-Item -ItemType Directory -Path $script:HelperDir -Force | Out-Null
 Copy-Item -LiteralPath $source -Destination (Join-Path $script:HelperDir 'SolarTimeShutdownHelper.cmd')
 $script:Calls=New-Object 'Collections.Generic.List[string]'
 $script:Codes=New-Object 'Collections.Generic.Queue[int]'
 function Invoke-ShutdownCommand([string]$Arguments){$script:Calls.Add($Arguments);if($script:Codes.Count -eq 0){throw 'Unexpected native call'};return $script:Codes.Dequeue()}
 $at=Get-HelperNow
 $token='0123456789abcdef0123456789abcdef'
 $request=Convert-HelperUri ('solartime-timer://schedule?seconds=120&token='+$token+'&at='+$at)
 Assert-True ($request.seconds -eq 120) 'valid protocol parsed'
 foreach($bad in @(('solartime-timer://schedule?seconds=1&token='+$token+'&at='+$at),('solartime-timer://schedule?seconds=359941&token='+$token+'&at='+$at),('solartime-timer://probe?seconds=60&token='+$token+'&at='+$at),('solartime-timer://schedule?seconds=60&token='+$token+'&at='+$at+';Start-Process calc'),('solartime-timer://cancel?token='+$token+'&at='+$at+'&other=1'))){
  $rejected=$false;try{Convert-HelperUri $bad | Out-Null}catch{$rejected=$true};Assert-True $rejected 'invalid protocol rejected'
 }
 $script:Codes.Enqueue(1116);$script:Codes.Enqueue(0)
 $result=Invoke-HelperOperation $request
 Assert-True ($result.ok -and $result.code -eq 0 -and $result.deadline -gt $at) 'native success alone confirms a deadline'
 Assert-True ($script:Calls.Count -eq 2 -and $script:Calls[1] -match '^/s /t 120 ') 'fixed allow-listed shutdown arguments'
 $script:Codes.Enqueue(0);$request.action='cancel';$request.at=$at+1;$request.seconds=0
 $result=Invoke-HelperOperation $request
 Assert-True $result.ok 'confirmed cancellation'
 $before=$script:Calls.Count;$request.action='schedule';$request.seconds=120;$request.at=$at
 $result=Invoke-HelperOperation $request
 Assert-True (-not $result.ok -and $result.code -eq 409 -and $script:Calls.Count -eq $before) 'late schedule cannot reverse cancellation'
 $request.at=$at+2;$script:Codes.Enqueue(1116);$script:Codes.Enqueue(5)
 $result=Invoke-HelperOperation $request
 Assert-True (-not $result.ok -and $result.code -eq 5 -and $result.deadline -eq 0) 'Windows error is never success'
 $request.action='probe';$request.seconds=0;$request.at=$at+3;$before=$script:Calls.Count
 $result=Invoke-HelperOperation $request
 Assert-True ($result.ok -and $script:Calls.Count -eq $before) 'probe cannot execute shutdown'
 $request.action='schedule';$request.seconds=120;$request.at=$at-130000
 $result=Invoke-HelperOperation $request
 Assert-True (-not $result.ok -and $result.code -eq 408) 'expired browser prompt cannot schedule later'
 $request.action='cancel';$request.seconds=0;$request.at=$at+4;$script:Codes.Enqueue(1116)
 $result=Invoke-HelperOperation $request
 Assert-True $result.ok 'no pending system shutdown is successful cancellation'
 # Exercise extraction, PS 5.1 child loading and registry generation under an isolated key.
 $env:SOLARTIME_INSTALLER_SOURCE=$source
 Install-Helper
 $command=(Get-Item -LiteralPath ($testRegistry+'\shell\open\command')).GetValue('')
 Assert-True ($command -match 'powershell.exe" -NoProfile' -and $command.EndsWith('-Uri "%1"')) 'direct PowerShell registration retains literal percent-one'
 Assert-True (-not ($command -match 'wscript|cmd.exe')) 'no cmd or VBScript intermediate launcher'
 Assert-True (Test-Path -LiteralPath (Join-Path $script:HelperDir 'SolarTimeShutdownHelper.ps1')) 'installed runtime exists in spaced path'
 Assert-True ((Get-HelperRevision) -eq (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash) 'actual installed source revision is reported'
 Assert-True ($script:Codes.Count -eq 0) 'all native calls accounted for; no real shutdown used'
 Write-Host ('WINDOWS_SHUTDOWN_TESTS_PASSED='+$checks)
} finally {
 Remove-Item -LiteralPath $testRegistry -Recurse -Force -ErrorAction SilentlyContinue
 Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
 $env:LOCALAPPDATA=$oldLocal
 $env:SOLARTIME_INSTALLER_SOURCE=$oldSource
}
