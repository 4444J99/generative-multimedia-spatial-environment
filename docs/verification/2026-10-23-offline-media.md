# Offline media repair — issue #181

Base: `4dbbcd77ce410645382f8903558aa3756c4df91d`, inspected October 23, 2026. Open PRs #100, #104, #135, #136, #138 and #141 were rechecked, including their complete changed-file lists. None owns either worker. PR #138 owns `js/main.js`; this repair leaves it byte-identical to base.

## Result and boundaries

The existing root registration and deployment scope remain unchanged. `sw.js` now routes eligible same-origin and `https://media.etceter4.com` requests through the media strategies: network-first audio, cache-first thumbnails, waveforms and metadata with TTL and stale offline fallback. Current `etceter4-v5` and `media-cache-v1-*` stores remain compatible and survive updates. Cleanup removes only lower numbered versions of the exact owned families; newer versions, unknown suffixes and unrelated stores survive. Audio previously cached by the old root implementation remains readable offline from that owned shell store.

Video, HLS segments/manifests and subtitles stream without entering shell or media caches. Original photograph exclusions remain. Complete audio is bounded by actual bytes even without Content-Length. Range/206 responses never become complete cached objects; offline single ranges are synthesized from complete cached audio, including suffix/open-ended ranges and unsatisfiable 416 responses. Opaque CDN responses pass through online without reconstruction or caching. Quota and cache-read errors preserve healthy network delivery.

The nested worker URL remains as a retirement script: skip waiting, unregister its own registration, never claim clients, intercept fetches or touch CacheStorage. An existing old worker must actually fetch this updated script before it retires. Serving the script at its historical URL is therefore necessary during rollout. The worker cannot recover data deleted before this repair.

Registration follow-up for PR #138: remove its redundant `MediaServiceWorker.js` registration and periodic update timer when that file's writer is reconciled. That edit is deliberately excluded here. Until then, repeated registration of the historical URL installs the cache-neutral retirement script and unregisters it again. Management commands now target the controlling root worker; CLEAR_ALL_CACHES means only the four media stores.

## Verification

- Baseline unit suite: 1,258 passed / 42 files.
- Final unit suite: 1,289 passed / 43 files, including 31 production-worker event regressions. The initial implementation failed 20 of the original 23 new cases, including cache preservation, media routing, ranges and retirement. Additional failing cases covered future-version preservation, denied storage, zero TTL and historical root-cached audio before their fixes.
- Native Chromium: two lifecycle cases passed at `/` and `/a-mavs-olevm/`. They install the actual root worker, update its script bytes, update a previously installed legacy registration to the actual retirement script, preserve stored sentinel bodies, remove stale versions, fetch the original `ogod/ogodtracks/01 I.mp3`, cache it in the audio family, and play/seek it offline using the browser audio decoder. Cached fragments, offline navigation fallback and catalogue scripts also pass. No Playwright request interception or forced controller/lifecycle state is used.
- Existing `source-catalogue.spec.js` first-install offline-catalogue regression passed unchanged. Combined focused browser run: 3 passed.
- `npm run validate`: passed with 57 existing lint warnings and no errors; formatting passed. Changed worker/test formatting, `node --check sw.js` and `git diff --check` passed. `npm run validate:package-lock` passed with 10 warnings; manifests/lockfile are unchanged.
- Independent agent review identified newer-cache deletion, cache-read failure, zero-TTL handling and test gaps. The material code findings were fixed with regression coverage. Cache write rejection, measured-byte eviction and positive CORS/opaque routing have focused unit evidence.

Reproduce with `npm ci --ignore-scripts`, `npm run test:unit`, `npm run validate`, then `npm test -- tests/e2e/offline-media.spec.js tests/e2e/source-catalogue.spec.js --project=chromium --grep 'real worker lifecycle|first service-worker'` on a host with the standard Playwright Chromium installed.

The standard Chromium download was unavailable in this execution environment. Browser proof used Chromium 153 from the npm-distributed `@sparticuz/chromium` package through a temporary Playwright configuration pointing at its extracted executable. GPU acceleration was disabled; TLS validation was not disabled. An initial launch without those GPU flags failed in this host. Early update probes correctly waited on outstanding response streams because the test had not consumed their bodies; consuming the responses fixed the fixture, without forcing worker activation. No browser-runtime package or configuration change is included in the PR.

## Remaining acceptance

These are local source and browser proofs, not a production rollout. Live R2/CDN delivery, real cross-origin CORS/opaque behavior in a browser, Safari/iPhone, Firefox, hosted exact-head checks and human repository review remain unverified. The cross-origin unit tests cover routing and response preservation, not live network configuration. Full navigation/chamber acceptance remains coordinated with PR #138; only the existing offline navigation/fallback and catalogue cases were run here. No merge, deployment, publication, issue closure or original-media modification is part of this repair.
