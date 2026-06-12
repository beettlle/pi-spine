# Task: SP-230 — Exit verification stub guard

**Created:** 2026-06-12
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Contract/worker wedge — stub worker can mark exit-verification tasks Done with a timestamp-only `.DONE` and no fileScope or audit artifacts.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Prevent **false-positive completion** of exit-verification tasks when `SPINE_WORKER_STUB=1`:

1. Tasks tagged as exit verification (SP-214, SP-220, SP-225 and future §8 exit packets) must **not** reach `.DONE` via stub unless `verifyContract()` passes (including `fileScopeMustChange` and any `artifactsMustExist`).
2. Stub `.DONE` content must not be accepted as terminal success when contract checks were skipped or file scope unchanged.
3. Engine lane commit / task.completed must fail closed when exit task contract is unsatisfied (mirror SP-199 placeholder guard).

**Incidents (SP-205–225 stress test):**
- Batch `20260612T204048` (SP-214): real pi crashed twice; stub retry created `.DONE` with body `Task: stub` only — no CONTEXT §8 checkoffs, no LOC audit, gate rejected by operator.
- Operator policy: do not mark exit tasks Done unless §8 criteria are actually satisfied.

**Required behavior:**
1. Detect exit-verification tasks from PROMPT (heading contains `exit verification` or explicit `## Exit verification` / Phase exit checklist step).
2. When worker mode is stub, still run full `verifyContract()` before accepting `.DONE` (no stub shortcut for exit tasks).
3. Fail with actionable worker output when stub would have bypassed contract (suggest real pi or operator-run verify CLI from SP-231).
4. Regression: stub SP-214-shaped fixture without fileScope changes → task.failed, no `.DONE` on main.

## Dependencies

- **Task:** SP-199
- **Task:** SP-115
- **Task:** SP-214 (incident source — do not mark SP-214 Done in this task)

## Context to Read First

**Tier 3:**
- `src/batch/contract-verify.mjs` — `verifyContract`, `shouldRunContractVerify`
- `src/batch/worker-host.mjs` — stub worker `.DONE` acceptance path
- `src/batch/engine-lanes.mjs` — post-worker contract verify hook
- Batch `20260612T204048` journal + `.DONE` stub artifact
- `spine-tasks/SP-214-ship-phase23-exit/PROMPT.md`
- `tests/batch/contract-verify.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `src/batch/worker-host.mjs`
- `src/batch/engine-lanes.mjs` (exit-task contract gate wiring only if needed)
- `tests/batch/exit-task-stub-guard.test.mjs` (new)
- `docs/adoption/operator-runbook.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/contract-verify.mjs`, `tests/batch/exit-task-stub-guard.test.mjs` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Reproduce stub SP-214 retry producing `.DONE` without fileScope changes
- [ ] List exit-verification task IDs and detection rule

### Step 1: Exit-task stub guard

> **Plan-review checkpoint**

- [ ] Implement exit-task detection + stub fail-closed contract path
- [ ] Ensure non-exit stub tasks unchanged (no regression on stub smoke waves)

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Fixture: exit task + stub + unchanged fileScope → failed, no `.DONE`
- [ ] Fixture: normal stub task still passes unchanged
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Runbook: exit tasks require real verification; stub isolation only for engine bugs
- [ ] Append resolved entry to `findings.md`
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Exit verification tasks cannot land stub-only `.DONE` without contract pass
- [ ] SP-214 re-run cannot false-complete on stub retry
- [ ] Tests green

## Git Commit Convention

- `feat(SP-230): complete Step N — description`

## Do NOT

- Mark SP-214, SP-220, or SP-225 Done in this task
- Block all stub workers globally
- Weaken contract verify for non-exit tasks

---

## Amendments (Added During Execution)
