# SP-817: Replace micromatch with picomatch — Status

**Current Step:** Step 4: Documentation & Delivery
**Status:** 🟢 Steps 0–3 complete
**Last Updated:** 2026-10-10
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Audit baseline recorded
- [x] Call sites listed
- [x] Dependencies satisfied

### Step 1: Swap dependency + call sites
**Status:** ✅ Complete

- [x] Dependency + lockfile (`picomatch@^4.0.7` in, `micromatch` out; lockfile refreshed)
- [x] Call sites; contract-exec.mjs at 500 (net change 0 — file was 499 lines before and after; committed as 1:1 line replacements in 2d0eaa16)
- [x] Types (`types/picomatch.d.ts` added, `types/micromatch.d.ts` deleted, tsconfig.batch.json updated)

### Step 2: Regression test
**Status:** ✅ Complete

- [x] Matcher cases (dotfile `.github/**` incl. dot:false contrast, `**` across dirs, array patterns, negative match — committed as 7151fb16)

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint` — clean (0 errors, 0 warnings)
- [x] Run Contract `testCommand` — exit 0; typecheck clean, micromatch grep empty, 68/68 tests pass
- [x] `npm audit --omit=dev` shows 0 high — "found 0 vulnerabilities" (see Discoveries #4)
- [x] Run matcher-adjacent tests — 53/53 pass (select, validate-contract-warn, stub-contract-enforcement, lane-merge-out-of-scope, contract-base-satisfied)
- [x] Run full suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test` — 2839/2839 pass, 0 fail
- [x] Coverage gate: `npm run coverage:check` — 90.37% line coverage (threshold 77%), pass
- [x] Fix all failures — none required

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Baseline `npm audit --omit=dev`: 2 high — `braces *` (stack-exhaustion DoS, GHSA-vfj7-8cjw-p6xm) via `micromatch >=0.2.0`. |
| 2 | 7 `micromatch.isMatch` call sites confirmed via rg (contract-exec, file-scope ×4, validate-contract ×2, contract-prelanded, discover, match-globs ×2, contract-parse). |
| 3 | Plan (Review Level 1): swap dep in package.json, npm install, rewrite each `micromatch.isMatch(s, p, opts)` as `picomatch(p, opts)(s)` keeping `{ dot: true }` explicit, new `types/picomatch.d.ts` ambient module declaration, delete `types/micromatch.d.ts`, update tsconfig.batch.json, add regression cases to file-scope-overlap test. contract-exec.mjs net line change 0. |
| 4 | Post-swap `npm audit --omit=dev`: **found 0 vulnerabilities** (baseline was 2 high via `braces` through `micromatch`). `brace-expansion` not flagged; no transitive override needed. |
| 5 | `contract-exec.mjs` was 499 lines before the swap (PROMPT said 500 — approximation); 499 after, net change 0, invariant satisfied via 1:1 line replacements. |
| 6 | `match-globs.mjs` and `discover.mjs` call sites originally passed no options to `micromatch.isMatch`; migrated as `picomatch(pattern)` with no options to preserve exact behaviour (`{ dot: true }` kept only where it existed). |

## Blockers

_None._
