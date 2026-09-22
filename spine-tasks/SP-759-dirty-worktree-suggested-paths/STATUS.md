# SP-759: DirtyWorktree suggestedCommand from actual dirty paths — Status

**Current Step:** Step 1 — Path-aware DirtyWorktree suggestedCommand
**Status:** 🟡 In Execution
**Last Updated:** 2026-09-21
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm DirtyWorktree branch always emits extension/coverage today
- [x] Locate dirty paths on diagnosis ctx / failure payload
- [x] Dependencies satisfied

### Step 1: Path-aware DirtyWorktree suggestedCommand
**Status:** ✅ Complete

- [x] Prefer actual dirty paths when present
- [x] Fallback generic status + retry when unknown
- [x] Only mention extension/coverage when in dirty set
- [x] Unit tests for path-aware / fallback / coverage cases

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint
- [x] Run Contract testCommand
- [x] Fix all failures

### Step 3: Documentation & Delivery
**Status:** 🟡 In Progress

- [x] Discoveries logged
- [ ] Create .DONE

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `diagnosis-failure-class.test.mjs` (outside File Scope) asserted the removed hardcoded `git checkout -- extension/coverage && spine batch retry SP-001` in 2 places | Updated as logically required by the #288 behavior change; renamed test to fallback semantics | `tests/batch/diagnosis-failure-class.test.mjs:52,174` |
| Plain DirtyWorktree `task.failed` journal payloads carry no structured path array (only `output` text); gitignored failures already carry `gitignoredPaths` | Added `ctx.dirtyPaths` / `ctx.laneWorktree` builder support following the gitignored-repair ctx pattern; journal→ctx plumbing (reconcile-batch/reconcile-diagnosis, out of scope) can flow later without builder changes | `src/batch/diagnosis-primary-failure.mjs` |
| `docs/adoption/operator-runbook.md:893` DirtyWorktree row still shows the old hardcoded command | Checked per PROMPT; docs deferred to SP-765 per Documentation Requirements | `docs/adoption/operator-runbook.md` |
| `npm test` inside a worker session fails 43 batch-engine integration tests on the SP-482 nested-batch guard (`SPINE_IS_WORKER=1`) | Environmental, not code: with the var unset the full suite passes 2626/2626 (exit 0) | full suite run |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-21 | Task staged | PROMPT.md and STATUS.md created for v2.22.0 |
| 2026-09-21 | Step 0 preflight | Hardcoded coverage hint confirmed (`diagnosis-primary-failure.mjs:68-73`); dirty path sources located; committed de462ccf |
| 2026-09-21 | Plan review (step 1) | Skipped per SP-195 — engine-owned review after .DONE (skipped=true, spawnFailed=false) |
| 2026-09-21 | Step 1 implemented | `buildDirtyWorktreeSuggestedCommand`: path-aware checkout hint (cap 5), `git -C <laneWorktree> status --porcelain` fallback; 4 new tests |
| 2026-09-21 | Step 2 verification | lint exit 0; typecheck exit 0; Contract testCommand 25/25 pass; scoped pair 35/35; full `npm test` 2626/2626 (worker guard vars unset) |
| 2026-09-21 | detect_changes | LOW risk, 0 affected processes, only intended symbols touched |

---

## Blockers

*None*

---

## Notes

- DirtyWorktree headline text ("clean coverage artifacts, then retry") left unchanged — mission targets `suggestedCommand` only; Do NOT forbids touching detection/fail criteria.
- Closes #288 via the suggestedCommand change; completion criteria in PROMPT satisfied.
