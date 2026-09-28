# v0.64 r1 — Google Ads base tag and release-history retention

Approved baseline: `20204d2d1bbcbe96af85c4a276b6d270637d5a4c` (v0.63 r1).

## Google tag

`src/google-analytics.js` remains the sole Google loader for index/about/privacy/terms.
It adds the requested `AW-18454135815` destination alongside `G-4MP85CMH64`, using
one asynchronous gtag.js script. Repeat owner initialization is idempotent, and
an already present Google loader is reused. Loading remains restricted to
`solartime.app` and `www.solartime.app`; preview and local hosts are excluded.

`src/consent.js` is unchanged and executes first. The four Consent Mode v2 defaults
remain denied; saved choices and subsequent accept/reject/reset continue through
the same owner. This preserves the existing advanced-mode behavior: denied does
not mean that Google receives no cookieless signals. The privacy notice now
explicitly describes the Ads tag and this distinction. This change does not prove
compliance with every jurisdiction or verify settings in the Google Ads account.

Only the base destination is configured. No conversion label/action/value,
purchase/donation event, enhanced-conversion user data, ad budget or campaign is
invented or enabled by this change. Google-side detection/reporting must be checked
in the owner's account; source and browser-shim tests cannot prove ingestion.

Official implementation references:
- https://developers.google.com/tag-platform/gtagjs/configure
- https://developers.google.com/tag-platform/security/guides/consent
- https://support.google.com/google-ads/answer/7548399

## One-time removal, not a recurring deletion rule

Of the 44 existing release entries, remove the oldest 22 (v0.14 through v0.39).
Keep all 22 newer entries (v0.40 through v0.63) byte-for-byte at the canonical
object level and add v0.64 in the existing 13 languages: 23 entries after this release.
The version range has historical gaps; the record count, not numeric subtraction,
determines the 50% removal. This is half the entries, not half the text bytes.

Delete complete localized records from `i18n/releases.json`; regenerate
`src/release-notes.js`. Remove 88 obsolete per-language release fallback allowances
(116 -> 28) and corresponding retired hash-only test entries. Do not move deleted
translations into another loaded file or hide them with a display-only filter.
Retained translations are checked against pre-edit hashes. Runtime release payload
is 219,769 -> 167,360 UTF-8 bytes (52,409 bytes / 23.8% less), including the new note;
this is uncompressed source size, not measured network savings or application speed.
The retained UI/timer language bundles themselves remain unchanged.

The existing Git commit history and unrelated development documents are not erased
or rewritten. `tests/fixtures/release-retention-v064.json` stores only version IDs,
counts and hashes for the retention contract, not deleted translation text.
Future releases may add new entries normally; tests do not hard-code a forever
maximum of 23 or delete more history without an explicit request.

## Validation and boundaries

Tests cover one/no Google loader, two exactly-once destinations, restored and
changed consent order, unapproved hosts, missing consent owner, and no fabricated
conversion events. The production-origin browser test routes Google requests to a
local shim: it sends no test traffic to Google. Actual Google account ingestion,
Tag Assistant approval and physical iPhone behavior are outside these assertions.

History checks cover retained source hashes, every language's oldest/newest
navigation, removed generation/allowlist references and deterministic i18n outputs.
Existing CI and same-main-commit production gates remain unchanged. Final CI and
public deployment status is recorded in the pull request after verification.

Keep textures/4K loading, shaders, camera, audio/volumes, native shutdown helper,
48 country/time mappings, fixed AUTO and all explicitly deferred work unchanged.
No Windows helper reinstall or Cloudflare account/DNS setting change is required.
