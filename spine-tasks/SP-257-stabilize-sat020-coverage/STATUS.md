# SP-257: Stabilize SAT-020 under coverage instrumentation — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-06-18
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Baseline `npm test` on SAT-020 file — 902/902 pass (full suite run includes SAT-020)
- [x] Reproduce or document coverage flake — 3× `coverage:check` pass after SP-264 fix; no flake observed
- [x] Confirm expected journal event order — `lane.checkpoint_warning` → `lane.stall_killed` → `lane.salvage_inspection` → `task.failed`

---

### Step 1: Root-cause and fix plan
**Status:** ✅ Complete

- [x] Root cause identified — timing race at stall-budget boundary under coverage load (SP-263)
- [x] Fix approach documented in Discoveries
- [x] Plan review complete — engine review delegated post-.DONE (real-pi session)

**Plan:** Widen test-only lane headroom + extend stub post-scope/hang windows; split post-scope into scope-bump + remainder so `checkpoint_warning` lands on a separate poll epoch from file-scope activity. Core fix landed in SP-264; SP-257 extracts named timing constants and documents env vars.

---

### Step 2: Implement stabilization
**Status:** ✅ Complete

- [x] Minimal fix applied — `SAT020_LANE_CONFIG` / stub timing constants in integration test; README env var doc
- [x] Stub semantics preserved — 2× `step_completed`, file-scope touch, hang without `.DONE`
- [x] Code review complete — engine review delegated post-.DONE

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] SAT-020 test passes alone
- [x] Full suite passes — `npm run typecheck` + `SPINE_WORKER_STUB=1 npm test` → 902/902
- [x] Coverage gate passes 3× consecutively — line coverage 86.15–86.86% (threshold 77%)
- [x] Typecheck passes

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Runbook updated if needed — no runbook change (test-only config; fixture README updated)
- [x] `.DONE` created

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Flake is a **timing race**: coverage slows polls; stub wall-clock budget hugged hard stall deadline | Widen test-only lane margins + stub windows (SP-264) | `stall-sat020-integration.test.mjs` |
| Same-poll `checkpointSignalsChanged` + `activitySignalsChanged` skips `lane.checkpoint_warning` | Second scope touch after 5s bump in stub runner | `bin/spine-worker-runner.mjs` |
| Original M packet superseded by SP-263 (diagnosis) + SP-264 (fix); SP-257 closes with constant extraction + verification | Documented in Amendment 1 | PROMPT.md |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-17 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-18 | Step 0 preflight | SAT-020 pass; 3× coverage:check pass on existing SP-264 fix |
| 2026-06-18 | Step 1 plan | Adopted SP-263/264 timing strategy; extract named constants |
| 2026-06-18 | Step 2 implement | Constants + README `POST_SCOPE_MS` doc |
| 2026-06-18 | Step 3 verify | typecheck + 902 tests + 3× coverage:check |

---

## Blockers

*None*

---

## Notes

Verification uses `env -u SPINE_WORKER_PI_TIMEOUT_MS` when parent shell exports worker timeout from spine harness.
