# GMSE #133 closeout verification — 2026-11-20

This note is the fresh-evidence record for
4444J99/generative-multimedia-spatial-environment#133 ("Heal the dependency
and runtime family with reproducible application verification"). It is a
one-take verification record, not a solidified verdict: it reports what was
observed at the head named below, and where live evidence disagrees with it,
the evidence wins and this note gets revised.

- **Verified at head:** `61db0865613db16fe27f31425232e7c38286d2cb` (main, merge of
  PR #199, 2026-11-20T20:51:53Z). Main checks at that head: 14/14 success,
  0 failing.
- **Verified by:** ranked-queue-build run, 2026-11-20 18:15 EST, executing the
  #133 closeout plan (posted 2026-11-17, verified then at `a17dd998`).
  Re-verified at the fresh head per the plan; the plan's claims still held.
- **Method:** fresh clone at the head above; `npm ci` at the root and in all
  four exhibit directories; carrier versions re-read from the five lockfiles
  against `docs/verification/2026-10-25-dependency-pr-reconciliation.json`
  (the Oct 25 source-owned receipt — not edited by this run); acceptance
  suite run locally with Node v24.22.1 (repo floor: engines `node ^24.15.0`,
  `.nvmrc` 24.19.0).
- **Source receipt:** `docs/verification/2026-10-25-dependency-pr-reconciliation.json`
  (observed 2026-10-25, Node 24.19.0). All 20 member PRs are closed unmerged;
  their versions reached main through successor merges.

## Per-member no-loss verdicts (plan step 6)

Every row is at or above its requested minimum in the lockfiles, or names the
newer merged bump that supersedes it. Versions shown are the distinct values
across the five lockfiles (root + audio-orb, gemini-ink-studio,
p5js-playground, synthwave-space).

| Member PR | Package | Requested | On main (lockfiles) | Verdict |
|---|---|---|---|---|
| #122 | socket.io-parser | ≥4.2.7 | 4.2.7 | ≥ requested |
| #130 | @humanfs/node | ≥0.16.8 | 0.16.8 | ≥ requested |
| #132 | js-yaml | ≥4.3.2 | 4.3.2 | ≥ requested |
| #148 | immutable | ≥3.8.4 | 4.3.9 | ≥ requested (scoped 4.3.9 replaces vulnerable 3.x per the receipt) |
| #149 | brace-expansion | ≥1.1.21 | 1.1.21 | ≥ requested |
| #159 | source-map-js | ≥1.2.2 | 1.2.2 | ≥ requested |
| #160 | source-map-js | ≥1.2.2 | 1.2.2 | ≥ requested |
| #161 | source-map-js | ≥1.2.2 | 1.2.2 | ≥ requested |
| #162 | source-map-js | ≥1.2.2 | 1.2.2 | ≥ requested |
| #163 | source-map-js | ≥1.2.2 | 1.2.2 | ≥ requested |
| #166 | vitest | ≥5.0.5 | 5.1.0 | ≥ requested (newer merged bump) |
| #169 | vite | ≥8.3.3 | 8.3.8 | ≥ requested (newer merged bump) |
| #171 | vite | ≥8.3.3 | 8.3.8 | ≥ requested (newer merged bump) |
| #173 | undici | ≥8.12.3 | 8.12.3 | ≥ requested |
| #177 | vite | ≥8.3.5 | 8.3.8 | ≥ requested (newer merged bump) |
| #178 | vite | ≥8.3.5 | 8.3.8 | ≥ requested (newer merged bump) |
| #179 | vite | ≥8.3.5 | 8.3.8 | ≥ requested (newer merged bump) |
| #135 | — (intention record) | — | — | Node/CI floor, full-root audit, direct semver, scoped Immutable/parser repairs, stricter lock validator, toolchain tests — all present at this head (see acceptance suite below) |
| #157 | — (intention record) | — | — | Four upstream-verified action revisions updated field-wise across current workflows; current trusted-checkout/publication gates intact |
| #180 | — (intention record) | — | — | Manifest updates across five directories retained; React peers resolve compatibly; P5 latest tag |

**Result: 17/17 carriers pass, 0 below minimum, 0 absent. No carrier is
below its requested minimum, so no new defect was filed from step 3.**

## Acceptance suite at the fresh head (plan step 4)

- `npm ci` at all five roots: exit 0 each; `git status` clean afterwards —
  no lock drift.
- `npm run validate:package-lock`: exit 0 ("Package lock metadata, ranges,
  resolution ancestry, and integrity pass").
- `npm run test:unit` (vitest): **1479 passed, 0 failed** (58 files; Sep 13
  baseline was 1,222 — the suite grew and all of it passes).
- `tests/toolchain/lock-contract.test.js`: **13 passed, 0 failed**.
- `npm run build:exhibits`: exit 0 — all four bundles built.
- `npm run test:publication`: **36 passed, 0 failed**.
- Governance tests (`node --test tests/governance/*.test.cjs`): **11 passed,
  0 failed** under Node v24.22.1.
- `npm test` (Playwright e2e): **no local verdict — environment-blocked**.
  Two attempts: first run 351 failed / 135 skipped with the
  `chromium_headless_shell-1255` binary missing from this VM; after
  installing it, the re-run gave **29 passed / 322 failed / 135 skipped**
  over 52.5 minutes, dominated by environment errors, not test assertions:
  109 failures are `firefox-1572` binary missing (only the chromium shell
  was installed; the cache holds firefox-1497/1538), and ~110 are
  "Target page, context or browser has been closed" — browsers dying
  mid-test under this VM's limits (1.5 shared CPUs). The same suite is
  **green in CI at this exact head** (Browser and accessibility tests:
  chromium, firefox, Mobile Chrome — all success, verified live), so the
  local failures are not a code signal. The closeout PR's CI run at its head
  is the honest-green gate for e2e; the one-line change itself touches only
  a CI workflow file and cannot affect browser behavior.
- `npm audit` at all five roots: **not observable in this environment** —
  the sandbox registry proxy rejects the audit endpoint (`403 Forbidden,
  POST /-/npm/v1/security/audits/quick not permitted by policy`,
  `zz_managed_internal_spaces_package_registries`). No vulnerability count
  was produced locally, and none is claimed here. The audit step is covered
  by CI instead: `.github/workflows/ci-cd.yml:74` runs
  `npm audit --audit-level=moderate`, so the honest-green gate at the
  closeout PR head exercises it.
- `npm run verify:publication`: **fails at this head** — see below; this is
  the one acceptance item that does not pass, and it is pre-existing.

## The one inconsistency (plan step 5) — fixed in the closeout PR

`.github/workflows/stewardship.yml` pinned `node-version: '22'` while the
repo floor is Node 24 (engines `^24.15.0`, `.nvmrc` 24.19.0) and every other
workflow pins 24 or `.nvmrc` (`ci-cd.yml`, `validate-dependencies.yml` use
`node-version-file: '.nvmrc'`; `public-source.yml` pins `24.19.0`;
`ace-manifest.yml` pins `24`). The job runs only
`node --test tests/governance/*.test.cjs` — plain `node:test` + `fs`, no
Node-22-specific API, and no comment justifies the pin. The governance tests
pass 11/11 under Node v24.22.1, so the pin is a leftover, not intentional.

Fix (one line): `node-version: '22'` →
`node-version-file: '.nvmrc'`, matching `ci-cd.yml` and
`validate-dependencies.yml` and keeping `.nvmrc` the single source of truth.
The stewardship job itself is unchanged.

## What does not pass — and why #133 stays open

`npm run verify:publication` fails at this head because
`publication-needs.json` deliberately records status `blocked`: all four AI
exhibits need safe credential and runtime verification (server-issued
short-lived credentials / server generation endpoints with abuse controls /
verified no-credential entry states). That gate is by design —
`docs/verification/publication-artifact.md` says changing it requires review
plus the evidence listed in `publication-needs.json` — and the evidence lives
at https://github.com/organvm-ii-poiesis/a-mavs-olevm/issues/94 (successor
#144). This is a product-scope gap, not a dependency gap, and it is outside
what the #133 closeout can fix.

Follow-up: https://github.com/4444J99/generative-multimedia-spatial-environment/issues/200
("verify:publication still blocked at main — four AI exhibits need
credential/runtime verification"), opened 2026-11-20 as the #133 plan's
step-7 follow-up. **#133 is not closed by this closeout.** It closes only
when #200 is resolved (or the gate is deliberately re-scoped with review)
and a post-merge default verification verdict is posted, per the repo's
stewardship rule that a PR merging alone does not close an issue's
obligation.
