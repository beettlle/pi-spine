# Task: SP-315 — Engine orphan retry recovery

**Created:** 2026-06-20
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Diagnosis reports `engine_orphaned` / `worker_orphaned` with dead PIDs, but batch state keeps `phase: running` and task `status: running` — advertised `batch retry` path is unusable without obscure pause/resume dance.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #20**: batch `20260620T175645` — attached engine died while SP-311 was `running`. Diagnosis correctly identified orphan, but recovery commands failed:

- `batch resume --force` → "Cannot resume batch in phase running"
- `batch pause` + `batch retry SP-311` → "Task SP-311 is running — only failed tasks can be retried"

**Required behavior:**

1. **Reconcile on orphan:** When `detectOrphanRunning` finds dead engine or lane worker PID while task is `running`, transition task to `failed` (or dedicated orphan terminal state) and journal `task.failed` / `lane.died` if missing.
2. **Retry path:** `spine batch retry <taskId>` succeeds when diagnosis is `engine_orphaned`/`worker_orphaned` and worker PID is dead, without requiring operator to discover pause + resume.
3. **Resume --force:** Allow `batch resume --force` when engine PID is dead despite `phase: running`.
4. **Diagnosis alignment:** `suggestedCommand` must match commands that actually succeed.
5. **Regression test:** Fixture from batch `20260620T175645` journal (orphanRunning + task still running + retry blocked).

**Closes:** [#20](https://github.com/beettlle/pi-spine/issues/20)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #20 (full recovery command trap table)
- `src/batch/orphan-detect.mjs` — `detectOrphanRunning`
- `src/batch/reconcile.mjs` — diagnosis vs state reconciliation
- `src/batch/retry.mjs` — retry allowed phases/statuses
- `src/batch/resume-multi-validate.mjs` — resume when phase running
- `spine-tasks/SP-309-batch-resume-orphan-recovery/PROMPT.md` — prior attached resume fix (#13)
- `spine-tasks/SP-115-orphan-diagnosis-taxonomy/PROMPT.md` — orphan taxonomy

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/reconcile.mjs`
- `src/batch/retry.mjs`
- `src/batch/resume-multi-validate.mjs`
- `src/batch/diagnosis.mjs`
- `tests/batch/engine-orphan-retry-recovery.test.mjs` (new)
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/engine-orphan-retry-recovery.test.mjs` |
| fileScopeMustChange | `src/batch/reconcile.mjs`, `src/batch/retry.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/engine-orphan-retry-recovery.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reconstruct issue #20 timeline from journal (orphanRunning, task running, retry failures)
- [ ] Trace `detectOrphanRunning` → diagnosis without state mutation
- [ ] List retry/resume guards that block orphan recovery

### Step 1: Reconcile orphan running tasks to retryable state

- [ ] On dead engine/worker PID with task `running`, reconcile to `failed` + journal events
- [ ] Allow `batch retry` when diagnosis is orphan and PID dead
- [ ] Allow `resume --force` when engine PID dead despite `phase: running`
- [ ] Align `suggestedCommand` in diagnosis with working recovery path

### Step 2: Testing & Verification

- [ ] Regression test from issue #20 journal pattern
- [ ] Assert retry succeeds after orphan without manual pause
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook — orphan recovery vs retry (when to use each)
- [ ] Close issue #20 (`gh issue close 20`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — engine/worker orphan retry recovery

**Check If Affected:**

- `docs/EXECUTION-FLOW.md` — failure taxonomy table

## Completion Criteria

- [ ] Orphan with dead PID transitions task out of `running`
- [ ] `batch retry` works without pause/resume workaround
- [ ] Diagnosis suggestedCommand matches working commands
- [ ] Tests pass with coverage gate
- [ ] Issue #20 closed

## Git Commit Convention

- `feat(SP-315): complete Step N — description`
- `fix(SP-315): description`
- `test(SP-315): description`

## Do NOT

- Remove `worker_orphaned` for live-PID orphan cases
- Broaden retry to reset tasks that are genuinely still running
- Change `.DONE` contract semantics

---

## Amendments (Added During Execution)
