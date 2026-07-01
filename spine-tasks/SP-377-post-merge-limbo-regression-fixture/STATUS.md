# SP-377: Post-merge limbo regression fixture — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #59 journal timeline
- [x] Compare with SP-348 regression tests

---

### Step 1: Fixture
**Status:** ✅ Complete

- [x] Materialize journal/batch-state fixture for 20260630T212050 orphan-after-merge
- [x] Test asserts postMergeLimbo + no gate until resume --force (may start red)

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

- [ ] Run targeted tests
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Link fixture path in STATUS.md

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Regression test pre-landed on main; fixture extracted to `tests/fixtures/batch-20260630T212050/orphan-after-merge.json` | Used as source of truth | `tests/helpers/batch-20260630T212050-fixture.mjs` |
| SP-348 uses inline seeds (batch 20260629T021550); SP-377 uses on-disk incident fixture per File Scope | Pattern divergence acceptable — #59 fixture is delivery artifact | `tests/batch/post-merge-limbo-regression.test.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-07-01 | Step 0 preflight | Issue #59 timeline: merge_completed lanes 1–3, orphan SIGTERM ~2m later, no gate until resume --force |
| 2026-07-01 | Step 1 fixture | `tests/fixtures/batch-20260630T212050/orphan-after-merge.json` + materializer helper |

---

## Blockers

*None*

---

## Notes

**Fixture path:** `tests/fixtures/batch-20260630T212050/orphan-after-merge.json`  
**Materializer:** `tests/helpers/batch-20260630T212050-fixture.mjs`  
**Regression test:** `tests/batch/post-merge-limbo-20260630.test.mjs`
