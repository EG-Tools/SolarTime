# v0.66 — six-month choices and a neutral X

Baseline: `50c1300876a2cb59d02550ce73d01e42b87cd304` (v0.65 r1).
Approved scope: remember acceptance and rejection for six months, allow the
visitor to dismiss without deciding, and make cookie settings easy to reopen.

## User behavior

- New visitor: all four Google consent types start denied. The banner is shown.
- X (or Escape while focus is inside the banner): hide the current banner only.
  This writes no preference and is never acceptance. Without a saved choice,
  the next navigation/reload asks again. This does not change an existing choice
  when the visitor reopens Cookie settings and dismisses it.
- Accept / Reject: persist the explicit choice for six calendar months, equally.
  Ordinary visits, reads, reopening, X and language changes do not renew expiry.
- Display settings and Help both expose **Cookie settings**. Help is closed
  through the existing lifecycle before showing the banner. A focused dismissal
  restores focus to a usable control instead of a hidden button.
- Expiry: revoke optional consent and ask again. An expiry timer is clamped to
  the browser timer range; pageshow/visibility and per-event consent checks also
  cover suspended tabs. This does not reload the app or touch running alarms.

The UI's neutral dismissal is operationally denied for a visitor with no choice.
This is not a claim that this particular repeat-prompt policy is sufficient for
every legal jurisdiction or a Google-certified CMP. Existing advanced Google
Consent Mode still permits limited cookieless signals in denied mode; the custom
feature events remain blocked until consent. X is not a network-wide opt-out.

## Persistence and compatibility

Keep `solarTimeCookieConsentV1` as the existing preference key, but store schema-2
JSON `{schema, value, chosenAt, expiresAt}`. UTC calendar arithmetic clamps dates
such as August 31 to February 28/29 and preserves the time of day. Invalid,
expired, future-dated or unsupported-schema records never authorize tracking.
These fields are local consent preferences, not a tracking ID.

Older plain `granted` / `denied` records have no original date. Migrate once,
preserving their decision and setting the six-month window from that migration.
Successful migration is persisted and is not repeated on every load. Do not
invent the original consent date. If the migration cannot be stored, do not use
an undated legacy grant indefinitely. New explicit choices can work in memory
when storage is blocked but cannot be guaranteed to survive a reload.

Cross-tab storage handling synchronizes this consent key only. It is not the
previously deferred multi-window alarm synchronization. Revocation and expiry
use the existing event to update Google, Clarity and the feature collector.
The collector also checks the live preference at request and completion, so
expired pending music/shutdown actions do not generate feature events later.
Measurement errors still must not interrupt the actual feature.

## Translation and preservation

New keys: `cookieSettings`, `cookieDismiss`, `cookieChoiceNote` in the canonical
13 language files. Generate the existing runtime files and content-derived
cache keys using `npm run build:i18n`. Existing UI/timer/body/phase text is
unchanged; the old fingerprint test excludes exactly these three additions.
Previously pruned release history remains unchanged; only v0.66 is added.

The old whole-file consent hash is no longer applicable to this explicitly
approved edit. Its behavioral contract is replaced with dated-state/expiry tests;
all unrelated fixture hashes remain. Style preservation tests strip only the
new, marked cookie-control rules, checking every byte of pre-existing styles.
Do not broadly refresh golden hashes or disable old tests to force a pass.

Keep Google measurement/Ads IDs, existing events, music/alarm semantics and
volume, native shutdown files/API, 4K preview/reuse, shader/camera/card surfaces,
48 country/time mappings, AUTO control and all deferred work unchanged.
No DNS/bucket/Cloudflare account changes or native-helper reinstall are required.

## Validation

Node cases cover acceptance/rejection symmetry, repeated visits, exact expiry,
month-end/leap-day arithmetic, one-time legacy migration, invalid records,
storage failure, cross-tab revocation, initialization idempotence, and delayed
feature completion after expiry. Browser cases use the actual app controls in
three viewports and all 13 languages, then actual reloads/new-context visits at
a routed test origin. Google requests are never sent by these consent tests.
Physical iPhone behavior, legal compliance, and the user's GA account ingestion
are not established by the tests. Final CI and deployment evidence is recorded
in the pull request. Existing exact-main-SHA deployment gates remain unchanged.

References consulted:
- https://developers.google.com/tag-platform/security/guides/consent
- https://developers.google.com/tag-platform/security/concepts/consent-mode
- https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/comment-mettre-mon-site-web-en-conformite
