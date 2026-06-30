# Task: SP-358 — Detached start land loop finalize

**Created:** 2026-06-29
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Detached `batch start` engine exits after merge without opening integrate gate; SP-348 resume fast path does not reliably recover — operator still needs manual finalize.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #41**: batch `20260629T210738` — detached engine completed tasks and merges but left `diagnosis: needs_integrate` with no integrate gate. `resume --force` spawned another engine without opening gate; manual `finalizeBatchForIntegrate` required.

**Required behavior:**

1. **Engine land loop:** Detached `engine.mjs` must call `finalizeBatchForIntegrate` (or equivalent) before process exit when all tasks succeeded and final wave merge completed.
2. **Resume fast path:** `resumeBatchDetached` / `validateResumeBatch` must detect `needs_integrate` + post-merge limbo and route synchronously to `finalizeResumePostMergeLimbo` without spawning a second stalled engine.
3. **Diagnosis:** When `postMergeLimbo: true`, `suggestedCommand` names a working one-shot recovery (`spine batch resume --force` that actually opens gate).
4. **Regression test:** Detached start fixture → merge complete → integrate gate opened without manual finalize API call.

**Closes:** [#41](https://github.com/beettlle/pi-spine/issues/41)

## Dependencies

- **Task:** SP-348, SP-359

## Context to Read First

- GitHub issue #41
- Batch `20260629T210738` journal and archive
- `src/batch/engine.mjs` — `finalizeBatchForIntegrate` call site
- `src/batch/detached-start.mjs` — `startBatchDetached`, `resumeBatchDetached`, `waitForDetachedBatchResume`
- `src/batch/resume.mjs` — `validateResumeBatch`, `postMergeLimbo` detection
- `src/batch/attached-runner.mjs` — `finalizeResumePostMergeLimbo`
- `tests/batch/post-merge-limbo-regression.test.mjs` — extend or add detached-start variant

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/engine.mjs`
- `src/batch/detached-start.mjs`
- `src/batch/resume.mjs`
- `src/batch/attached-runner.mjs`
- `tests/batch/detached-start-land-loop.test.mjs` (new)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/detached-start-land-loop.test.mjs tests/batch/post-merge-limbo-regression.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `spine-tasks/SP-358-detached-start-land-loop/STATUS.md` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/detached-start-land-loop.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reconstruct batch `20260629T210738` limbo timeline from journal
- [ ] Trace detached engine exit path after `batch.merge_completed`
- [ ] Confirm when `validateResumeBatch` sets `postMergeLimbo` vs skips SP-348 fast path

### Step 1: Engine finalize before detached exit

- [ ] Ensure `engine.mjs` awaits `finalizeBatchForIntegrate` before returning on successful batch completion
- [ ] Journal `batch.land_loop_finalized` when gate opens from engine path
- [ ] Clear `enginePid` after successful finalize

### Step 2: Resume detached fast path reliability

- [ ] Broaden `validateResumeBatch` to detect `needs_integrate` diagnosis with succeeded tasks + empty/failed merge only when post-merge limbo
- [ ] `resumeBatchDetached` must not spawn second engine when limbo finalize succeeds synchronously
- [ ] Update `suggestedCommand` in diagnosis for `postMergeLimbo`

### Step 3: Testing & Verification

- [ ] Regression: detached start → merge → gate record exists without manual finalize
- [ ] Regression: `resume --force` from limbo opens gate in-process
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Update `docs/adoption/operator-runbook.md` detached start recovery if commands change
- [ ] Close issue #41 (`gh issue close 41`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Detached batch completes land loop without manual finalize
- [ ] `resume --force` reliably recovers post-merge limbo
- [ ] Tests pass with coverage gate
- [ ] Issue #41 closed

## Git Commit Convention

- `feat(SP-358): complete Step N — description`
- `fix(SP-358): description`
- `test(SP-358): description`

## Do NOT

- Close GitHub issue without verified detached-start recovery on fixture
- Break SP-348 resume fast path for non-limbo resumes
- Silence limbo without journal + diagnosis record

---

## Amendments (Added During Execution)

- **2026-06-30:** Core implementation pre-landed on `main` (e722bb0). `fileScopeMustChange` targets delivery `STATUS.md`; `testCommand` + `artifactsMustExist` verify detached-start land loop behavior.
