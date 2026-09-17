$ErrorActionPreference = 'Stop'
$root = 'D:\_Program\SolarTime'
Set-Location $root
$path = Join-Path $root 'tests\v045-release.test.cjs'
$utf8 = [System.Text.UTF8Encoding]::new($false)

if (-not (Test-Path $path)) {
    throw 'tests\v045-release.test.cjs not found.'
}

$text = [System.IO.File]::ReadAllText($path, $utf8)

$oldRevision = 'name=\"solar-time-revision\" content=\"r7\"'
$newRevision = 'name=\"solar-time-revision\" content=\"r8\"'
$oldSlider   = 'id=\"star-density\" class=\"solar-range\" type=\"range\" min=\"0\" max=\"400\" step=\"10\" value=\"100\"'
$newSlider   = 'id=\"star-density\" class=\"solar-range\" type=\"range\" min=\"0\" max=\"300\" step=\"10\" value=\"100\"'

$revisionHits = ([regex]::Matches($text, [regex]::Escape($oldRevision))).Count
$sliderHits   = ([regex]::Matches($text, [regex]::Escape($oldSlider))).Count

if ($revisionHits -ne 1) {
    throw "Expected exactly 1 stale revision assertion, found $revisionHits."
}
if ($sliderHits -ne 1) {
    throw "Expected exactly 1 stale star-density assertion, found $sliderHits."
}

$text = $text.Replace($oldRevision, $newRevision)
$text = $text.Replace($oldSlider, $newSlider)

if ($text.Contains($oldRevision)) {
    throw 'Stale r7 revision assertion remains after replacement.'
}
if ($text.Contains($oldSlider)) {
    throw 'Stale max=400 star-density assertion remains after replacement.'
}
if (-not $text.Contains($newRevision)) {
    throw 'r8 revision assertion was not written.'
}
if (-not $text.Contains($newSlider)) {
    throw 'max=300 star-density assertion was not written.'
}

[System.IO.File]::WriteAllText($path, $text, $utf8)
Write-Host 'Exactly two stale r8 test expectations were corrected.' -ForegroundColor Green
