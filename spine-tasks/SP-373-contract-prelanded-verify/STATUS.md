# SP-373: Contract verify pre-landed scope satisfaction — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #56 and SP-358/SP-359 PROMPT amendments
- [x] Trace verifyStubFileScopeMustChange and final verify paths

---

### Step 1: Pre-landed heuristic
**Status:** ✅ Complete

- [x] Implement satisfaction when scope paths unchanged vs merge-base but testCommand/artifacts pass
- [x] Regression tests for delivery-only STATUS.md tasks

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Note behavior in contract-template skill reference if needed via STATUS

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Pre-landed scope uses PROMPT intro commit + delivery spine-tasks changes for stub path | Implemented | contract-verify.mjs |
| contract-template.md unchanged — behavior mirrors SP-358/359 amendment pattern automatically | No doc update needed | STATUS Notes |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-30 | Step 0–1 | Pre-landed heuristic in verifyContract + verifyStubFileScopeMustChange |

---

## Blockers

*None*

---

## Notes

**Plan (Review Level 2):** When `fileScopeMustChange` paths are unchanged in lane diff but were modified on `main` since PROMPT intro, satisfy scope when `testCommand` and `artifactsMustExist` pass. Derive `promptRelPath` from spine-tasks delivery changes in lane diff. Stub lane-commit path additionally requires spine-tasks delivery changes in pending paths.
