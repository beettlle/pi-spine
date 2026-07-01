# Task: SP-401 — Merge blocked resume and wave skip recovery

**Created:** 2026-07-01
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Resume FSM + multi-wave loop behavior; operator recovery without hand-editing batch state.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix **GitHub issue #66**: after a lane→orch merge conflict, operators can recover from `merge_blocked` without hand-editing `.spine/batch-state.json`, and resume must not re-run workers or re-merge waves that already have `mergeResults.status === succeeded`.

**Observed (batch `20260701T031142`):**

1. Phase `merge_blocked` → `spine batch resume --force` returns `Cannot resume batch in phase merge_blocked` (`resume-multi-validate.mjs` resumable guard).
2. Operator manually sets `mergeResults[0].status=succeeded` and `phase=paused` on orch branch.
3. Resume re-executes wave 0 workers (`executeResumeWave`) even though wave 0 merge already succeeded — `alreadyMerged` skip runs only **after** worker execution (`resume-multi.mjs` ~109–171).

**Required behavior:**

1. Documented recovery: resolve git conflict on `orch/spine-*`, then `spine batch resume --force` (or dedicated subcommand) transitions to runnable state.
2. Resume loop skips `executeResumeWave` when wave has succeeded `mergeResults` entry and all wave tasks are terminal (`succeeded`/`skipped`).
3. `spine status --diagnose` suggests recovery commands for `merge_blocked` (no silent hand-edit path).

**Closes:** [#66](https://github.com/beettlle/pi-spine/issues/66)

## Dependencies

- **Task:** SP-356 (terminal `merge_blocked` phase FSM — already on `main`)

## Context to Read First

- GitHub issue #66
- `src/batch/resume-multi-validate.mjs` (`validateMultiTaskResume`, `findResumableWave`)
- `src/batch/resume-multi.mjs` (resume wave loop, `alreadyMerged` check)
- `src/batch/merge/wave-merge-state.mjs` (`succeededWaveMergeIndices`, `findFirstWaveNeedingMerge`)
- `src/batch/lifecycle.mjs` (`recordMergeBlocked`)
- `tests/batch/merge-blocked-phase.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume-multi-validate.mjs`
- `src/batch/resume-multi.mjs`
- `src/batch/reconcile.mjs`
- `src/batch/diagnosis.mjs`
- `tests/batch/merge-blocked-resume.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/merge-blocked-resume.test.mjs tests/batch/merge-blocked-phase.test.mjs` |
| fileScopeMustChange | `spine-tasks/SP-401-merge-blocked-resume-recovery/STATUS.md` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/merge-blocked-resume.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #66 and batch `20260701T031142` recovery timeline
- [ ] Trace `validateMultiTaskResume` resumable phases vs `merge_blocked`
- [ ] Trace `resume-multi.mjs` wave loop: worker execution before `alreadyMerged`

### Step 1: merge_blocked resume path

- [ ] Allow resume from `merge_blocked` when `--force` and orch git is mergeable (or operator resolved conflict)
- [ ] Transition phase to `paused` or `running` with `suggestedCommand` in diagnose output
- [ ] Optionally record `batch.merge_resumed` journal event after blocked recovery

### Step 2: Skip succeeded waves on resume

- [ ] Before `executeResumeWave`, skip wave when `succeededWaveMergeIndices` includes `waveIndex` and `waveTasksAllTerminal`
- [ ] Ensure `findResumableWave` / `startWave` advances past succeeded merges to first pending work or pending merge
- [ ] Do not re-merge waves with existing `mergeResults.status === succeeded`

### Step 3: Testing & Verification

- [ ] Add `tests/batch/merge-blocked-resume.test.mjs` fixture modeled on issue #66 (succeeded wave 0 merge + pending wave 1)
- [ ] Assert resume does not re-invoke workers for succeeded wave 0
- [ ] Assert `merge_blocked` + `--force` resumes after simulated orch resolution
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 4: Documentation & Delivery

- [ ] Add merge_blocked recovery steps to `docs/adoption/operator-runbook.md` § troubleshooting (or merge recovery section)
- [ ] Close issue #66
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — merge_blocked recovery (git resolve → resume)

**Check If Affected:**
- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] All steps complete
- [ ] No hand-edit of `batch-state.json` required for standard merge_blocked recovery
- [ ] Issue #66 closed

## Git Commit Convention

- `feat(SP-401): complete Step N — description`
- `fix(SP-401): description`
- `test(SP-401): description`

## Do NOT

- Remove terminal `merge_blocked` phase (SP-356 behavior stays)
- Auto-resolve git merge conflicts without operator action
- Change in-batch wave scheduling for non-resume paths unless required for parity

---

## Amendments (Added During Execution)
