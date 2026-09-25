# v0.58 r1 alarm/music validation

Implementation commit: `0d45016918a7987c1ee5d357f4c8e1d9fe768a38`.
Verified run: https://github.com/EG-Tools/SolarTime/actions/runs/36105668533
Artifact: `alarm-music-verification`, ID `10850629852`.

- Full Node suite with locked dependencies: **299 passed, 0 failed, 0 skipped**.
- Cloudflare static-site build: **passed**.
- Nine additional checks execute the actual MusicPlayer and TimerController with simulated DOM/audio/clock dependencies.
- Music is switched OFF, paused and muted before the first alarm tone. The shared music button and now-playing UI are synchronized.
- Stopping or snoozing the alarm does not resume music. A deliberate manual music restart still works; the next snoozed alarm switches it OFF again.
- Arming/cancelling a future alarm and previewing an alarm sound leave music untouched.
- Default/custom alarm sounds, music already OFF, pending play/fade and hidden-tab behavior are covered.
- Fixed snooze reading the prior input duration rather than the requested five minutes.

The Windows shutdown helper and Cloudflare receipt API are unchanged from the working v0.57 r1 release. No native helper reinstall is needed for this change. Automated audio substitutes do not constitute a physical-speaker test on the user's PC.

At this record's creation the v0.58 candidate is in PR #9; it is not a statement that production or Cloudflare has already been updated. Any public-delivery check that compares the candidate's v0.58 files with the still-live v0.57 Worker remains pending/failing until the new release is actually deployed. Do not mislabel that check as a source-test failure or hide it.

The follow-up commit removes the one-time patch writer and the obsolete PR-specific Cloudflare deployment job; the alarm implementation stays unchanged. Future Cloudflare deployments use the main-only workflow described in `cloudflare-github-deployment.md`.
