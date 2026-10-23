# Offline media repair implementation plan

**Goal:** Repair issue #181 without changing the registration code owned by PR #138.

**Architecture:** The existing root-scoped `sw.js` owns application and media strategies. The old nested script becomes a cache-neutral unregistering worker. Keep the current shell v5 and media v1 stores because their formats and precached shell bytes remain compatible; remove only older numbered versions of these exact families.

**Spec:** GitHub issue #181 and the scoped repair request of October 23, 2026.

**Constraints:** No merge, deployment, media modification, dependency update, or `js/main.js` edit. Preserve subpath hosting, offline navigation, fragments, historical local sources and the configured R2 host. Unknown caches must survive.

## Steps

- [x] Add production-worker event tests for root media routing, fresh/stale thumbnail and JSON strategies, audio fallback/ranges, video bypass, cache ownership and retirement. Run against baseline and observe the defects.
- [x] Integrate media handling into `sw.js`; restrict cleanup to stale owned versions; retire only the exact legacy registration. Keep management messages scoped to the media stores. Replace the nested worker with a no-fetch, no-cache retirement script.
- [x] Add real Playwright lifecycle tests with a local HTTP server, root and subpath installations, preserved sentinel caches, offline fallback and catalogue scripts, upgrade/retirement, local audio; exercise CDN routing and opaque responses in unit tests and retain live CORS browser acceptance as a documented gap. Run focused and complete unit verification and repository validation.
- [x] Review the diff, record browser/CI limitations and publish a separate reviewable PR referencing #181 and #138. Do not close the issue before default acceptance.

## Review focus

Range/206 audio must not poison complete-object caching; opaque media must remain playable; video/HLS must never enter shell cache; cache matching must not read unrelated stores; retirement must not unregister another worker. Browser tests use real requests, not Playwright request interception, so fetches can originate in a service worker.

## Progress

Baseline: `4dbbcd77ce410645382f8903558aa3756c4df91d`. PR #138 remains open at `3b816051226c68e6c0f71b6bff792253ed974733`; no worker repair found among open PRs. This fresh checkout uses branch `work/fix/offline-media-181`. Inline execution follows the user's explicit implementation request.

Independent review: future versions, denied storage and zero-TTL freshness repaired with failing-then-passing tests. Final verification: 1,289 units / 43 files; three focused Chromium cases; validate and changed-file formatting pass. No production acceptance is inferred. The direct scoped issue and repository source are the authority here; the private memory packet was not accessed or needed for this repair.
