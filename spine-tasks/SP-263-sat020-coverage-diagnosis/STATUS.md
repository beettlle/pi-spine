# SP-263: SAT-020 coverage flake diagnosis — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-06-17
**Review Level:** 1
**Review Counter:** 1
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Baseline npm test pass
- [x] Coverage flake rate recorded

**Evidence:**
- Isolated SAT-020: `SPINE_SUPPRESS_JOURNAL_ATTACH=1 node --experimental-strip-types --test tests/batch/stall-sat020-integration.test.mjs` → 2/2 pass (~49s).
- `npm test -- tests/batch/stall-sat020-integration.test.mjs` runs full suite (881 tests); SAT-020 passes; unrelated `worker-pi-timeout.test.mjs` failures (2) fail the run.
- `npm run coverage:check` ×5: SAT-020 **4/5 pass, 1/5 fail** (~20% flake); full gate **0/5 pass** (unrelated `worker-pi-timeout` failures every run).

---

### Step 1: Root-cause analysis
**Status:** ✅ Complete

- [x] Root cause documented
- [x] Fix plan for SP-264
- [x] Plan review complete

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Targeted tests pass

**Evidence:**
- `npm run typecheck` → exit 0
- Contract `testCommand` (isolated SAT-020) → 2/2 pass
- `npm run coverage:check` → SAT-020 pass on verification run; gate exit 1 due to unrelated `worker-pi-timeout.test.mjs` (2 failures); line-coverage line not reached because run aborts on test failures

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] STATUS.md updated
- [x] .DONE created

---


## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| 1 | plan | 1 | APPROVE | `.reviews/1-20260617T172246.md` |

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| SAT-020 flake is a **timing race** at stall-budget boundary under coverage load, not a missing salvage/stall engine bug | Fix in SP-264 (test harness margins) | `tests/batch/stall-sat020-integration.test.mjs` |
| Flaky failure omits `lane.checkpoint_warning` but includes `lane.stall_warning` → `lane.stall_killed` → `lane.salvage_inspection` → `task.failed` | SP-264 must preserve required event order | failure journal in Step 1 |
| Test lane `stallTimeoutMinutes: 0.5` (30s) matches stub wall-clock budget `1+4+10+15s` hang ≈30s; coverage instrumentation + full-suite CPU load shrinks poll/signal margin | Widen test-only timeouts in SP-264 | `stall-sat020-integration.test.mjs` cfg |
| `worker-pi-timeout.test.mjs` fails independently (expects 180m/10800000ms, code emits 120m/7200000ms) | Out of SP-263 scope; blocks `coverage:check` exit 0 | `tests/batch/worker-pi-timeout.test.mjs` |

### SP-264 fix plan (handoff)

1. **Preferred:** In `stall-sat020-integration.test.mjs` only, widen sub-minute lane config headroom (e.g. `stallTimeoutMinutes: 1.0`, `stallGraceAfterProgressMinutes: 0.8`, keep `checkpointWarningMinutes: 0.02`) so host polls can emit `lane.checkpoint_warning` before hard stall under coverage.
2. **Optional complement:** Slightly reduce `SPINE_WORKER_STUB_SAT020_HANG_MS` (e.g. 12_000) if total stub duration still hugs hard deadline.
3. **Do not** change production default stall timeouts or weaken `.DONE` / stall-kill semantics.
4. **Verify:** `npm run coverage:check` passes **3 consecutive** runs with SAT-020 journal order unchanged.

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-17 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-17 | Step 0 preflight | SAT-020 isolated pass; coverage SAT-020 4/5 |
| 2026-06-17 | Step 1 root-cause | Timing race documented for SP-264 |

---

## Blockers

*None*

---

## Notes

### Root-cause detail (Step 1)

**Classification:** Timing race under wall-clock stall budgets when V8 coverage instrumentation runs.

**Mechanism:**
- SAT-020 test sets aggressive lane config: `checkpointWarningMinutes: 0.02`, `stallTimeoutMinutes: 0.5`, `stallGraceAfterProgressMinutes: 0.4`, `extendGraceOnFileScope: false`.
- Stub sequence (`bin/spine-worker-runner.mjs`): `sleep 1` → 2× `task.step_completed` → `sleep 4` → file-scope touch → `sleep 10` → hang `SPINE_WORKER_STUB_SAT020_HANG_MS` (15_000).
- Host emits `lane.checkpoint_warning` only when file-scope activity is detected **and** `now - lastCheckpointAt >= checkpointWarningMs` (`worker-host.mjs` / `heartbeat.mjs`).
- Hard stall deadline `startedAt + stallTimeoutMs` is **30s**, matching total stub duration. Under coverage, poll/signal observation can reach stall deadline with `lane.stall_warning` + kill before `lane.checkpoint_warning` is recorded.

**Representative flake assertion:**
```
missing lane.checkpoint_warning in journal: …, task.step_completed, task.step_completed,
lane.stall_warning, lane.stall_killed, lane.died, lane.salvage_inspection, task.failed, …
```

**Not the cause:** Missing salvage events, wrong classification, or absent `task.step_completed` (all present on failure).
