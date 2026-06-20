# Task: SP-313 — Worker exit without .DONE diagnosis

**Created:** 2026-06-20
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Fast worker death (`pi exited but .DONE was not created`, ~10s, zero scoped files) is misreported as `worker_orphaned` / generic `needs_retry` — operator cannot distinguish launch failure, early pi exit, and true orphan stall.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #18**: batch `20260620T014612` — SP-019 failed in ~10s with journal `task.failed` output `pi exited but .DONE was not created`, `changedFileCount: 0`, `salvageable: false`. Issue title says `worker_orphaned` but `spine status --diagnose` surfaced `needs_retry` without citing the worker-output log tail.

**Required behavior:**

1. **Failure taxonomy:** When worker runner exits with "pi exited but .DONE was not created" (or equivalent early incomplete exit), classify as distinct diagnosis (e.g. `worker_incomplete` or `worker_done_missing`) — not `worker_orphaned` and not ambiguous `needs_retry`.
2. **Diagnosis headline:** `spine status --diagnose` must cite `workerOutputLogPath` and last meaningful lines from worker output when `changedFileCount === 0`.
3. **Suggested command:** Prefer `spine batch retry <taskId>` with pointer to worker log; do not suggest orphan-resume paths when worker PID already exited cleanly with incomplete artifact.
4. **Regression test:** Fixture reproducing batch `20260620T014612` journal pattern (lane.died → task.failed with done-missing output, 0 scoped files).

**Closes:** [#18](https://github.com/beettlle/pi-spine/issues/18)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #18 (full diagnose dump and journal events)
- `bin/spine-worker-runner.mjs` — `.DONE` gate after pi exit
- `src/batch/diagnosis.mjs` — taxonomy, headlines, suggested commands
- `src/batch/reconcile.mjs` — deriveDiagnosis, orphan vs terminal failure
- `src/batch/salvage.mjs` — salvage inspection when worker dies early
- `spine-tasks/SP-115-orphan-diagnosis-taxonomy/PROMPT.md` — prior orphan taxonomy

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/diagnosis.mjs`
- `src/batch/reconcile.mjs`
- `src/batch/worker-host.mjs` (if exit reason propagation needed)
- `tests/batch/worker-exit-no-done.test.mjs` (new)
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/worker-exit-no-done.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis.mjs`, `src/batch/reconcile.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/worker-exit-no-done.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reconstruct issue #18 timeline from journal (`lane.died`, `task.failed`, 0 scoped files)
- [ ] Confirm worker output string `pi exited but .DONE was not created` path from runner to journal
- [ ] List current diagnosis branches that conflate early exit with `worker_orphaned`

### Step 1: Taxonomy and diagnosis surfacing

- [ ] Add distinct diagnosis kind for done-missing / early incomplete worker exit
- [ ] Map `task.failed` payload (`output`, `exitCode`, `doneFound: false`, `changedFileCount: 0`) in reconcile/diagnosis
- [ ] Enrich headline with worker log ref + tail snippet; set actionable `suggestedCommand`

### Step 2: Testing & Verification

- [ ] Regression test from issue #18 journal pattern
- [ ] Assert diagnosis ≠ `worker_orphaned` for fast done-missing exit
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook — early worker exit without `.DONE` vs orphan stall
- [ ] Close issue #18 (`gh issue close 18`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — worker incomplete exit troubleshooting

**Check If Affected:**

- `docs/EXECUTION-FLOW.md` — failure taxonomy table

## Completion Criteria

- [ ] Fast pi exit without `.DONE` has distinct diagnosis (not worker_orphaned)
- [ ] Diagnose cites worker output log for 0-scoped-file failures
- [ ] Tests pass with coverage gate
- [ ] Issue #18 closed

## Git Commit Convention

- `feat(SP-313): complete Step N — description`
- `fix(SP-313): description`
- `test(SP-313): description`

## Do NOT

- Change `.DONE` contract semantics (worker must still create `.DONE`)
- Broaden scope to fix underlying SP-019 task failure in stet repo
- Remove `worker_orphaned` for true dead-PID orphan cases

---

## Amendments (Added During Execution)
