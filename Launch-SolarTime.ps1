param([switch]$Inspect)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSCommandPath
$entryPath = Join-Path $projectRoot 'index.html'
if (-not (Test-Path -LiteralPath $entryPath)) { throw 'Solar Time 실행 파일을 찾을 수 없습니다.' }
$entry = Get-Item -LiteralPath $entryPath

function Get-DefaultBrowserPath {
  $choicePath = 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice'
  $progId = (Get-ItemProperty -LiteralPath $choicePath -ErrorAction SilentlyContinue).ProgId
  if ($progId) {
    $commandKey = Get-Item -LiteralPath "Registry::HKEY_CLASSES_ROOT\$progId\shell\open\command" -ErrorAction SilentlyContinue
    $command = if ($commandKey) { [Environment]::ExpandEnvironmentVariables([string]$commandKey.GetValue('')) } else { '' }
    if ($command -match '^\s*"([^"]+\.exe)"') { return $Matches[1] }
    if ($command -match '^\s*([^\s]+\.exe)') { return $Matches[1] }
  }

  foreach ($candidate in @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }
  return $null
}

$browser = Get-DefaultBrowserPath
$url = ([Uri]$entry.FullName).AbsoluteUri
$browserName = if ($browser) { [IO.Path]::GetFileNameWithoutExtension($browser).ToLowerInvariant() } else { 'default' }

if ($Inspect) {
  [pscustomobject]@{ Browser = $browser; BrowserName = $browserName; Entry = $entry.FullName; Url = $url } | ConvertTo-Json
  exit 0
}

if (-not $browser -or -not (Test-Path -LiteralPath $browser)) {
  Start-Process -FilePath $url
  exit 0
}

if ($browserName -match '^(chrome|msedge|brave|vivaldi|opera)$') {
  Start-Process -FilePath $browser -ArgumentList @('--new-window', '--start-fullscreen', $url)
} elseif ($browserName -eq 'firefox') {
  Start-Process -FilePath $browser -ArgumentList @('--new-window', '--kiosk', $url)
} else {
  Start-Process -FilePath $browser -ArgumentList @($url)
}
