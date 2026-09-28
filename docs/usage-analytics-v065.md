# v0.65 — site visits and actual feature use

Baseline: `f7d5ab3c22b21a23977b1c540126872f4c192daa` (v0.64 r1).
User request: understand both site visits and feature usage. Preserve the previous
Ads base-tag integration and the one-time release-history cleanup.

## Two separate measurements

Visits use the existing GA4 configuration `G-4MP85CMH64`, which sends page views
by default. `src/google-analytics.js` and `src/consent.js` remain byte-identical.
Do not add a second page_view call, loader, session identifier or fingerprint.
GA4 reports users, sessions and views separately; repeated views are not unique
people. GA4 geography is not the country chosen in the SolarTime menu.

Feature use is emitted by `src/usage-analytics.js` only on the existing approved
production domains and only after analytics consent. Its explicit `send_to`
points to the existing GA4 measurement ID, not the configured Ads destination.
No new external library, background timer, polling, replay queue, or storage is
added. Measurement failures are swallowed and never gate app actions.

## Event vocabulary

| Event | Actual trigger | Optional detail |
| --- | --- | --- |
| `solar_music_play` | User turns music on and playback succeeds | None |
| `solar_music_stop` | User turns enabled music off | None |
| `solar_body_select` | A different valid celestial-body card opens | `body_id` |
| `solar_body_track` | Body tracking / body feature-view command starts | `body_id` |
| `solar_region_view` | User activates the region-view button | None |
| `solar_alarm_set` | Valid alarm set or rescheduled | `sound_type`: default/custom |
| `solar_alarm_cancel` | An enabled alarm is cancelled | None |
| `solar_alarm_snooze` | Five-minute snooze is scheduled | None |
| `solar_shutdown_set` | Windows returns a successful scheduling receipt | None |
| `solar_shutdown_cancel` | Windows returns successful pending-shutdown cancellation | None |
| `solar_help_open` | Help is opened | None |
| `solar_language_change` | Explicit menu choice is successfully applied | `selection_mode`: auto/manual |
| `solar_zen_on` / `solar_zen_off` | Viewing mode actually changes | None |
| `solar_eclipse_view` | Available eclipse navigation starts | `body_id`: moon/europa |
| `solar_alignment_view` | Available alignment navigation starts | None |

A tracking command does not claim a 4K texture has finished loading. Alarm set
does not prove future playback on a suspended device. Shutdown set means Windows
confirmed scheduling, not that the PC has already powered off.

Invalid input, native failure/uncertainty/superseded results, automatic playlist
advance/recovery, alarm-forced music OFF, language/lifecycle refreshes, page restore,
and frame-by-frame drawing do not generate corresponding success events. Snooze
is its own event, not both snooze and alarm_set. An asynchronous operation captures
consent when requested and must finish within the same consent epoch. Actions
before consent or spanning revocation/regrant are dropped, not replayed later.

Custom payloads contain only fixed event names and the allowlisted enums above.
They never include sound filenames, file contents, timer input/deadline, camera
coordinates, native receipt IDs, email, user identifiers, free text or arbitrary
URLs. The collector's fixed params do not remove the standard technical fields
that GA4 itself handles. Existing advanced consent mode can still send limited
cookieless Google signals even when feature-use events are blocked. The privacy
notice describes both behaviors without claiming universal legal compliance.

## Where the owner checks results

In Google Analytics, select SolarTime's existing property. Use the Realtime
report's event-name card for initial confirmation; Events reporting for each
`solar_...` event's event count and users. No custom dimension is required just
to distinguish these event names. Optional event-scoped custom definitions for
`body_id`, `sound_type` and `selection_mode` make those parameters available in
normal custom reports/explorations. These Google account settings are not changed
by a code deployment. Standard reports can lag behind Realtime.

Visit reporting remains the existing Pages/screens, acquisition, user geography
and device reporting. Do not sum per-feature user counts as unique users: one
person may use several features. Consent rejection, blocking and failed delivery
mean analytics is not a census of all visitors. No pre-deployment usage history
can be reconstructed by these new hooks.

## Google Ads conversion boundary

The user supplied the lead-form conversion destination
`AW-18454135815/H5o0COOSjYkdEIeIz99E`. It is NOT emitted by this implementation:
SolarTime does not have the specified successful lead-form submission here.
Neither page views nor every button click are falsely reported as submitted
leads. The Ads base destination remains configured. A chosen real business event
can later be marked as a GA4 key event and used to create a linked Ads conversion;
that requires the owner's account configuration and an explicit goal decision.
No campaign, budget, primary conversion, enhanced-conversion user data or user
identity setting is modified. Source/browser tests do not prove Google ingestion.

## Verification

Unit tests cover event enums, explicit routing, no bootstrap events, repeat init,
missing/denied consent, asynchronous once-only completion, revoke/regrant, data
minimization, blocked analytics and native/music success/failure timing. Browser
UI tests use a memory sink and routed/local fixtures; they do not send synthetic
events to the live Google account. Existing full CI and exact-main-SHA deployment
gates remain unchanged. Final results belong in the PR after all checks finish.

All 13 language release notes are generated from the existing canonical i18n
source. Existing translation text and the v0.64 deletion contract are preserved;
no further half-history deletion is performed.

Keep original textures/4K progressive loading, shaders, camera, rendering,
existing audio timing/volume, native helper/hash/protocol, country/time mappings,
fixed AUTO, CSS and the deferred 17/18/19/21/22/24 and 25/26 work unchanged.
A Windows helper reinstall is not required.

Official implementation references (checked 2026-09-28):
- https://developers.google.com/analytics/devguides/collection/ga4/views
- https://developers.google.com/analytics/devguides/collection/ga4/events
- https://developers.google.com/tag-platform/gtagjs/routing
- https://developers.google.com/tag-platform/security/concepts/consent-mode
- https://support.google.com/analytics/answer/9322688
