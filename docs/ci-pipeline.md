# Verification and deployment consolidation (items 1–5)

This maintenance change does not modify the v0.58 r1 application, UI, rendering,
Windows helper, helper hash or receipt API. No helper reinstall is required.

## Verification (no production writes)

`Verify Solar Time` runs on pushes, PRs and manual requests:

- Four complete Node test/build combinations: Ubuntu/Windows × Node 22/24.
- The Windows 22 job also executes the existing PowerShell 5.1 integration tests
  with a mocked shutdown command. It never shuts down a real computer.
- Independent UI and tiny-star browser jobs (`fail-fast: false`). UI failure
  cannot prevent the other browser suite from running.
- A final `verified` job fails unless every required job succeeded.

Two redundant standalone full-suite workflows were removed. The platform matrix
and all existing tests remain. Public-site comparisons do not run on candidate
PRs: the deployed production version can legitimately be older than the candidate.

Release-note browser checks derive the current version from `version.json`, check
full translated items against the source catalog, test older/newer boundaries and
retain independent historical content assertions. No fixed latest version, current
item count or number of navigation clicks is used.

## Failure evidence

Browser failures preserve completed assertions, exception/stack trace, bounded
console/page-error messages, a screenshot, DOM snapshot and Playwright trace when
an active page is available. Browser-launch failures still produce a JSON error
report. Actions uploads diagnostic artifacts even when the test failed. Each
browser job has a distinct artifact name; one result cannot overwrite the other.
`diagnostics-selftest.py` deliberately raises an assertion and verifies that all
four kinds of evidence were captured. Its expected-failure JSON is not a failed
product test. Production tokens are not supplied to test jobs.

## Production gate (automatic and manual)

`Deploy Cloudflare` runs after successful main verification or manually on main.
Both entry points require the latest verification run for the exact current main
SHA, every required platform/browser/native-containing job, and `verified` to have
succeeded. PR runs, stale commits, failed/cancelled/skipped/pending runs and missing
credentials cannot authorize deployment. The current main SHA is rechecked before
remote writes and before Pages publication. No full unit suite is repeated here.

Order: verification → preflight → build → R2 helper upload/byte check → Worker
publication/verification → Pages artifact publication → Pages public byte check.
v0.59 uses the shared deployment module for Actions and local CLI aliases.
Identical helper objects are hash-checked and skipped; a deployment round trip
checks a separate diagnostic R2 record and removes it before Pages publication.

`Public shutdown delivery` is now an explicit read-only manual production audit,
with independent helper/Worker/Pages jobs. It does not deploy or block a PR.

## One-time repository administrator action

In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
Keep the existing `solartime.app` custom domain and HTTPS settings unchanged. The
editor connection cannot change repository administration settings. Until this is
done, GitHub's legacy branch publisher can still publish main outside the new gate;
the new production workflow therefore refuses to deploy and records
`PAGES_SETTING_REQUIRED` rather than claiming the gate is fully active.

After switching Source, run **Actions → Deploy Cloudflare → Run workflow → main**.
If the latest main verification has not passed, run `Verify Solar Time` on main
first; successful completion triggers deployment automatically. No extra API token
is needed beyond the existing `CLOUDFLARE_API_TOKEN` repository secret.

The new Pages package includes the runtime allowlist and generated CDN assets,
not repository tools, tests, source helpers or credentials. Read-only public checks
continue comparing the expected 53 runtime files and the existing official icon.

## Limits and recovery

Repository administrators can still change settings or upload directly; this gate
protects the supported Actions paths, not all administrator actions. The two cloud
providers cannot publish atomically; a failure after Worker publication is reported
as incomplete, and a rerun of the same verified SHA can complete publication.
Older verification runs stay failed as historical evidence; failures are not hidden.
Local CLI entry points use the same deployment implementation as of v0.59,
with local verification rather than the GitHub exact-main gate. See optimization-v059.md.
