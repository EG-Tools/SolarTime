$ErrorActionPreference = 'Stop'
$root = 'D:\_Program\SolarTime'
Set-Location $root

function ReadText($path) { [System.IO.File]::ReadAllText((Join-Path $root $path), [System.Text.UTF8Encoding]::new($false)) }
function WriteText($path, $text) { [System.IO.File]::WriteAllText((Join-Path $root $path), $text, [System.Text.UTF8Encoding]::new($false)) }
function RequireReplace($path, $old, $new) {
    $text = ReadText $path
    if (-not $text.Contains($old)) { throw "Pattern not found in $path`n$old" }
    WriteText $path ($text.Replace($old, $new))
}

# Start from the known-good r4 files in the current Git HEAD.
$files = @(
    'index.html',
    'src/app.js',
    'src/visual-effects.js',
    'version.json',
    'tests/modules.test.cjs',
    'tests/v045-release.test.cjs',
    'SolarTime_v0.45_Release.bat'
)
& git restore --source=HEAD --staged --worktree -- $files
if ($LASTEXITCODE -ne 0) { throw 'git restore failed' }

# Revision/cache keys: public version remains 0.45, internal revision becomes r5.
RequireReplace 'index.html' 'name="solar-time-revision" content="r4"' 'name="solar-time-revision" content="r5"'
RequireReplace 'index.html' 'src/visual-effects.js?v=0.45-r3' 'src/visual-effects.js?v=0.45-r5'
RequireReplace 'index.html' 'src/app.js?v=0.45-r4' 'src/app.js?v=0.45-r5'

# Runtime inspection revision only; all r4 app behavior (100% default, reset randomization,
# right-drag dolly, release notes) remains untouched.
RequireReplace 'src/app.js' "revision:'r4'" "revision:'r5'"

# Tiny stars should remain visually steady. Larger stars retain the slow irregular twinkle,
# rare rest period and rare cross flare already present in r4.
$visual = ReadText 'src/visual-effects.js'
$oldVisible = 'float visible=1.-rests*step(restVisible,restTime);'
$newVisible = 'float visible=1.-rests*step(restVisible,restTime);float lively=smoothstep(.30,.62,appearance.x);'
if (-not $visual.Contains($oldVisible)) { throw 'visual-effects visible pattern not found' }
$visual = $visual.Replace($oldVisible, $newVisible)
$oldIntensity = 'intensity=appearance.y*variation*visible;'
$newIntensity = 'intensity=appearance.y*mix(1.0,variation,lively)*mix(1.0,visible,lively);'
if (-not $visual.Contains($oldIntensity)) { throw 'visual-effects intensity pattern not found' }
$visual = $visual.Replace($oldIntensity, $newIntensity)
$oldFlare = 'flarePulse=step(.9985,fract(seed*.91337+appearance.y*.71))*flareWave*smoothstep(.50,.84,appearance.y)*visible;'
$newFlare = 'flarePulse=step(.9985,fract(seed*.91337+appearance.y*.71))*flareWave*smoothstep(.50,.84,appearance.y)*lively*mix(1.0,visible,lively);'
if (-not $visual.Contains($oldFlare)) { throw 'visual-effects flare pattern not found' }
$visual = $visual.Replace($oldFlare, $newFlare)
$visual = $visual.Replace('Solar Time v0.45 r3', 'Solar Time v0.45 r5')
WriteText 'src/visual-effects.js' $visual

# Update the version manifest.
$version = Get-Content (Join-Path $root 'version.json') -Raw | ConvertFrom-Json
$version.revision = 'r5'
WriteText 'version.json' (($version | ConvertTo-Json -Depth 4) + "`n")

# Module-order test cache keys.
$modules = ReadText 'tests/modules.test.cjs'
$modules = $modules.Replace('src/visual-effects\.js\?v=0\.45-r3', 'src/visual-effects\.js\?v=0\.45-r5')
WriteText 'tests/modules.test.cjs' $modules

# v0.45 test: update revision and validate the new tiny-star stabilization expression,
# instead of the older variation*visible expression that caused the reported failure.
$test = ReadText 'tests/v045-release.test.cjs'
$test = $test.Replace('r4', 'r5')
$test = $test.Replace('/intensity=appearance\.y\*variation\*visible/', '/lively=smoothstep\(\.30,\.62,appearance\.x\)/')
if (-not $test.Contains('lively=smoothstep')) { throw 'v045 test expectation could not be updated' }
WriteText 'tests/v045-release.test.cjs' $test

# Release BAT labels/commit message.
$bat = ReadText 'SolarTime_v0.45_Release.bat'
$bat = $bat.Replace('Release (r4)', 'Release (r5)')
$bat = $bat.Replace('Add right-drag camera dolly', 'Stabilize tiny star rendering')
$bat = $bat.Replace('r4 deployed', 'r5 deployed')
WriteText 'SolarTime_v0.45_Release.bat' $bat

Write-Host 'r5 repair patch applied on top of Git HEAD.' -ForegroundColor Green
