# v0.61 r1 — fixed AUTO and 13 shared-language regions

Baseline: `140c45702cbc865104e987f90a67177ce8e8d59e` (v0.60 r2).
Only the user-requested language menu and regional additions are in scope.

## Menu

AUTO is the first radio-menu option, outside `language-scroll`. A flex-sized
country-list area owns its scrolling and both scroll cues. Existing menu width,
maximum height and common surface remain. Long country labels wrap rather than
being clipped. Wheel scrolling and keyboard focus never scroll the AUTO row away;
Home/End and arrow navigation still traverse all options with the existing owner.

## Reused copy and regional clocks

35 existing entries become 48 entries. The 13 language bundles are unchanged.
No new country-specific locale requests or translation files are added.

| Code | Country | Existing copy | Representative time zone | Earth-view city |
|---|---|---|---|---|
| NO | Norway | English | Europe/Oslo | Oslo |
| SE | Sweden | English | Europe/Stockholm | Stockholm |
| DK | Denmark | English | Europe/Copenhagen | Copenhagen |
| FI | Finland | English | Europe/Helsinki | Helsinki |
| IS | Iceland | English | Atlantic/Reykjavik | Reykjavik |
| MT | Malta | English | Europe/Malta | Valletta |
| PH | Philippines | English | Asia/Manila | Manila |
| MY | Malaysia | English | Asia/Kuala_Lumpur | Kuala Lumpur |
| ZA | South Africa | English | Africa/Johannesburg | Johannesburg |
| NG | Nigeria | English | Africa/Lagos | Lagos |
| GH | Ghana | English | Africa/Accra | Accra |
| DO | Dominican Republic | Spanish | America/Santo_Domingo | Santo Domingo |
| GT | Guatemala | Spanish | America/Guatemala | Ciudad de Guatemala |

Time zones and representative coordinates follow IANA tzdb zone.tab, checked
against the current published table. These are representative cities, not national
centroids or claims that a multilingual country has only one language.

Sources:
- https://data.iana.org/time-zones/tzdb/zone.tab
- https://data.iana.org/time-zones/tzdb/backward

Manual selection uses the selected country's existing copy, time zone, region
label, saved preference and the shared Earth-view action. DST is handled by the
browser's Intl/time-zone database, not by a fixed UTC offset. Automatic mode keeps
its established independent browser-language and device-time-zone behavior.
Explicit country zones identify the new regions; compatible locale hints can
disambiguate Berlin (NO/SE/DK), Singapore (MY) or Abidjan (IS/GH) aliases.
A generic English locale and a shared canonical time zone alone cannot reliably
identify a country; the manual country selection remains available. No IP lookup,
geolocation permission or external locale-detection service was added. Malaysian
Asia/Kuching is recognized in automatic mode; manual MY uses Kuala Lumpur.

## Validation scope

New tests cover all 13 metadata/copy mappings, unchanged language-bundle count,
old country ordering, winter/summer clocks, midnight rollover, DST transitions,
time-zone aliases, country locale fallbacks and preservation of known foreign
country zones. Browser checks cover selection, shared locale fetch reuse,
persistence, region/time, Earth action coordinates, wheel scrolling, keyboard
navigation and fixed AUTO hit-testing across desktop and compact/installed-mode
simulations. Actual physical iPhone testing is not claimed.

The existing CI and production gate remain unchanged. The native shutdown helper,
its hash/protocol, audio behavior/volumes, artwork, renderer, camera implementation
and Cloudflare API/config are unchanged. No helper reinstall is needed. Deferred
items 17/18/19/21/22/24 and unapproved 25/26 are not implemented by this release.
The PR and deployment records contain the final verification and publication status.
