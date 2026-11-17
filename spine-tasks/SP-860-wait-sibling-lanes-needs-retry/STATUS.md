# SP-860: wait sibling lanes needs_retry — Status

**Current Step:** Step 2 (Tests)
**Status:** 🟡 In Progress — Step 2
**Last Updated:** 2026-11-16
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `reconciliationMatchesUntil` / wait poll; report blast radius in STATUS
- [x] `rg -n "reconciliationMatchesUntil|needs_retry" tests/cli/`

### Step 1: Wait match gate
**Status:** ✅ Complete

- [x] Do not match `needs_retry` while any sibling task is still running
- [x] Match once siblings are terminal

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Sibling-running vs sibling-terminal cases

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract `testCommand` passing
- [ ] All failures fixed

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| GitNexus impact `reconciliationMatchesUntil` upstream: **CRITICAL** (212 impacted, 149 processes, 18 modules) but depth-1 direct callers = 1 (`runSpineWait`); production consumer is only `bin/spine-cli/wait.mjs` → `handleWait`. Gate change is contained to the wait CLI surface. | accepted with warning | src/cli/spine-wait.mjs |
| Non-verbose `reconcileBatch` result exposes no task statuses (`signals` only when `ctx.verbose`); reconcile computes `signals.hasRunningTasks` from `classifiedTasks.some(classification === "running")` — the live task status reconcile itself uses. Fix: wait poll passes `verbose: true`; match helper prefers `signals.hasRunningTasks`, falls back to `RUNNING_PHASES.has(phase)` for injected/non-verbose results. | chosen approach | src/cli/spine-wait.mjs |
| `deriveDiagnosis` `hasFailedTasks` branch (reconcile-diagnosis.mjs) returns `needs_retry`/`worker_done_missing`/`needs_replan` on first terminal-failure task with no running-sibling consideration — the #375 root cause. Gate exactly these three partial-failure diagnoses; `failed`/`completed`/`needs_integrate`/`aborted`/pseudos untouched. | scoped | src/cli/spine-wait.mjs |
| Orphan reconcile heals zombie `running` bits via retry/resume paths (PID checks), so a stuck running bit converges — gate is not a permanent wedge; `--timeout` bounds waits. | noted | src/batch/reconcile-orphan.mjs |
| Existing fixture `needs-retry-batch.json` has all tasks terminal (phase "paused") → gate does not fire; fabricated needs_retry results in wait.test.mjs supersede tests lack `phase`/`signals` → fallback matches as today; superseded guard preempts match anyway. Existing suites stay green. | verified | tests/cli/wait.test.mjs |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |

## Blockers

*None*
