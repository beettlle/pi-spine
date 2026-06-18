# Task: SP-281 — Attached batch integrate gate limbo (SP-280 follow-up)

**Created:** 2026-06-18
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Land-loop regression — SP-280 landed but batch `20260618T000943` still required manual `batch resume` to open integrate gate after last-wave merge on an attached engine.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #4**: batch `20260618T000943` (SP-278, SP-279, SP-280) completed all tasks and last-wave merges but stayed at `needs_integrate` with **no integrate gate** until operator ran `node bin/spine.mjs batch resume --attached` (~5.5 minutes after `batch.merge_completed`).

**Required behavior:**
1. When all tasks succeed and the last wave merge completes on an **attached** batch engine, call `finalizeBatchForIntegrate` idempotently — gate opens without manual resume.
2. Cover multi-wave plans where wave 1 has a single dependent task (SP-279 after SP-278) — not only wave-0-only batches.
3. Add regression fixture/tests from journal `.spine/runtime/20260618T000943/` (archived after land loop).
4. If global `spine` vs repo `node bin/spine.mjs` mismatch blocks resume, surface in `spine doctor` or resume diagnostics (do not silently no-op).

**Closes:** [#4](https://github.com/beettlle/pi-spine/issues/4)

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `spine-tasks/SP-280-post-merge-gate-auto-open/PROMPT.md`
- `spine-tasks/SP-228-attached-land-loop-complete/PROMPT.md`
- `src/batch/post-merge-limbo.mjs` — `finalizeBatchForIntegrate`, `isPostMergeLimbo`
- `src/batch/engine.mjs` — last-wave merge + completion path
- `src/batch/resume-multi.mjs` — resume limbo fast path
- `src/batch/diagnosis.mjs` — `needs_integrate` messaging
- `tests/batch/post-merge-limbo.test.mjs`
- GitHub issue #4 body; archived journal under `.spine/runtime/20260618T000943/archive/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (stub / fixture tests)

## File Scope

- `src/batch/post-merge-limbo.mjs`
- `src/batch/engine.mjs`
- `src/batch/diagnosis.mjs`
- `src/batch/resume-multi.mjs`
- `tests/batch/post-merge-limbo.test.mjs`
- `tests/batch/attached-gate-limbo.test.mjs` (new)
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/batch/engine.mjs, tests/batch/attached-gate-limbo.test.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/attached-gate-limbo.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Reconstruct timeline from issue #4: last `batch.merge_completed` @ 02:17:02Z, gate missing until resume @ 02:22:43Z
- [ ] Trace attached engine exit path after wave-1 merge — confirm whether `finalizeBatchForIntegrate` was skipped, deferred, or ran against stale state
- [ ] Compare with SP-280 tests — identify gap (multi-wave wave-1-only final task, attached `--skip-preflight`, engine still in review phase)

### Step 1: Fix attached last-wave finalize

> **Plan-review checkpoint**

- [ ] Ensure `finalizeBatchForIntegrate` runs when post-merge limbo conditions hold after the **last** wave merge, including attached batches and multi-wave dependency chains
- [ ] If finalize is blocked while a lane is in review, queue finalize after terminal review events (do not leave `phase: running` with all tasks succeeded)
- [ ] Idempotent gate open — second finalize must not duplicate evidence or corrupt batch-state

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Add `attached-gate-limbo.test.mjs` using journal patterns from batch `20260618T000943` (wave 0 + wave 1, SP-279 last)
- [ ] Extend `post-merge-limbo.test.mjs` if shared helpers change
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook — when to use `node bin/spine.mjs` vs global `spine`; attached gate limbo symptoms
- [ ] Close GitHub issue #4: `gh issue close 4 --comment "Fixed in SP-281: attached multi-wave batch auto-opens integrate gate after last merge without manual resume."`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — attached batch land loop / gate limbo

**Check If Affected:**
- `src/batch/diagnosis.mjs` — `needs_integrate` guidance

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #4 closed with comment referencing SP-281
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-281): complete Step N — description`
- `fix(SP-281): description`
- `test(SP-281): description`

## Do NOT

- Remove manual `batch resume` for paused/failed/orphaned batches
- Auto-integrate to `main` without gate approval
- Regress SP-280 single-wave finalize behavior

---

## Amendments (Added During Execution)
