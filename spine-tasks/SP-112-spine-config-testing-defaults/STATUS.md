# SP-112: Spine-config testing defaults — Status

**Current Step:** Complete
**Status:** ✅ Done
**Last Updated:** 2026-06-05
**Review Level:** 1
**Review Counter:** 1
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Read source audit report(s)
- [x] Dependencies satisfied

### Step 1: Defaults and dogfood config
**Status:** ✅ Complete
- [x] Template defaults: test/build/testWithCoverage from package.json patterns
- [x] Refresh pi-spine dogfood config
- [x] Call `spine_review_step` (plan) — APPROVE

### Step 2: Doctor warning
**Status:** ✅ Complete
- [x] Doctor check: empty testing + evidence gates → warn/fail per SP-080 policy

### Step 3: Testing & Verification
**Status:** ✅ Complete
- [x] FULL suite + coverage gate

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Dogfood uses split build/test commands (`npm run typecheck`, `npm test`) while init template uses combined `npm run typecheck && npm test` — intentional mirror of package.json scripts | Documented | `.spine/spine-config.json` vs `templates/spine-config.json` |
| Two pre-existing flaky tests fail intermittently under full suite load (`cli-startup`, `stale-path readSpineCliVersion`) — unrelated to SP-112 | Noted | `tests/dashboard/cli-startup.test.mjs`, `tests/doctor/stale-path.test.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-05 | Task staged from Phase 20 audit synthesis | PROMPT.md created |
| 2026-06-05 | Step 1: template + dogfood + init defaults | Committed f2191c9 |
| 2026-06-05 | Step 1 plan review | APPROVE (.reviews/1-20260605T191423.md) |
| 2026-06-05 | Step 2: doctor warning + tests | Committed f2fb79c |
| 2026-06-05 | Step 3: npm test (564/566 pass, 2 flaky unrelated) + coverage 83.23% | SP-112 tests 7/7 pass |
