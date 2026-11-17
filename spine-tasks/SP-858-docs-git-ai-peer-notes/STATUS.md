# SP-858: Docs git-ai peer notes — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-17
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Find existing release-check / pre-publish sections; note where git-ai and peer version belong

### Step 1: Docs
**Status:** ✅ Complete

- [x] git-ai `refs/notes` hazard + SP-859 ignore + temporary workaround
- [x] Peer `pi-coding-agent` 1.5.2 note for this release

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Contract `testCommand` passing — `true` (trivially passes; run logged below)
- [x] All failures fixed — no failures caused by this task. `rg -l 'npm-publish\.md|operator-runbook\.md' tests/` → 4 hits: 3 runnable test files pass 8/8 (`preversion-hook`, `release-workflow`, `adoption-doc-merge`); 4th hit is fixture `tests/fixtures/scenarios/registry.json`, whose consumer `tests/fixtures/scenario-registry.test.mjs` fails 3 assertions **pre-existing at base 8ef2a341 / HEAD~1** (verified by re-running with the original doc) — out of File Scope, not introduced here

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| npm-publish.md peer row/checklist said dev pin `^1.0.1` but package.json + lockfile are `^1.4.0`/1.4.0 since SP-854 (v2.30.0, ad96c638) — stale doc | Fixed in Step 1 (precondition for an accurate 1.5.2 peer note) | docs/release/npm-publish.md |
| `tests/fixtures/scenarios/registry.json` contains scenario `v181-batch-20260705T210857` that `tests/fixtures/scenario-registry.test.mjs` expected-list lacks → 3 pre-existing failures at base commit | Out of File Scope (tests/fixtures/**); not caused by SP-858; surfaced to engine for a hygiene follow-up | tests/fixtures/scenario-registry.test.mjs |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |
| 2026-11-17 | Step 0 preflight + Step 1 docs | git-ai note (#372 → release flow step 1 + checklist), peer 1.5.2 note (Version floors + checklist), stale `^1.0.1` pin corrected → committed `eb0758c7` |
| 2026-11-17 | Step 2 verification | `rg -l` hits: 3 test files 8/8 pass; scenario-registry failure pre-existing at base (verified); Contract `testCommand` `true` → pass (foreground) |

## Blockers

*None*
