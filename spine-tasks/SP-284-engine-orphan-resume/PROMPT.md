# Task: SP-284 — Engine orphan resume without manual pause

**Created:** 2026-06-18
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Batch reliability — dead attached engine leaves `phase: running`; resume blocked until operator discovers pause-then-resume workaround.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #7**: batch `20260618T191236` attached engine exited while `phase: running`. Diagnosis showed `worker_orphaned` then `engine_orphaned`. `batch resume --attached` and `resume --force` failed with `Cannot resume batch in phase running` until operator ran `batch pause` then `resume`.

**Required behavior:**
1. When batch engine PID is dead and diagnosis is `engine_orphaned` or `worker_orphaned` with terminal worker state, `batch resume --attached` (and `--force` when engine dead) must recover without requiring manual `pause` first.
2. Preserve pause semantics for intentional operator holds — do not auto-pause healthy running batches.
3. Add regression test from batch `20260618T191236` journal pattern (engine exit after lane work, resume opens gate).

**Closes:** [#7](https://github.com/beettlle/pi-spine/issues/7)

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `src/batch/resume-multi-validate.mjs` — `Cannot resume batch in phase running`
- `src/batch/resume-multi.mjs` — post-merge limbo fast path
- `src/batch/detached-start.mjs` — engine PID lifecycle
- `src/batch/diagnosis.mjs` — `engine_orphaned`, `worker_orphaned`
- `tests/batch/resume-engine-crash.test.mjs`
- GitHub issue #7; archived journal `.spine/runtime/20260618T191236/archive/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (fixture tests)

## File Scope

- `src/batch/resume-multi-validate.mjs`
- `src/batch/resume-multi.mjs`
- `src/batch/detached-start.mjs`
- `src/batch/diagnosis.mjs`
- `tests/batch/engine-orphan-resume.test.mjs` (new)
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/batch/resume-multi-validate.mjs, tests/batch/engine-orphan-resume.test.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/engine-orphan-resume.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Trace resume rejection path for `phase: running` + dead `enginePid`
- [ ] Document pause-then-resume workaround from issue #7 timeline

### Step 1: Dead-engine resume path

> **Plan-review checkpoint**

- [ ] Allow resume when engine PID absent/stale and diagnosis indicates orphan (not healthy attached engine)
- [ ] `--force` bypasses `phase: running` only when engine is confirmed dead (fail closed if PID alive)
- [ ] Reuse `finalizeBatchForIntegrate` / post-merge limbo when all tasks succeeded

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] `engine-orphan-resume.test.mjs`: dead engine + running phase → resume succeeds without pause
- [ ] Regression: `resume-engine-crash.test.mjs`, post-merge limbo tests
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Runbook: ENGINE ORPHANED dashboard → `batch resume --attached` (no pause step when fixed)
- [ ] Close GitHub issue #7: `gh issue close 7 --comment "Fixed in SP-284: dead engine resume no longer requires manual pause when phase is running."`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #7 closed with comment referencing SP-284
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-284): complete Step N — description`
- `fix(SP-284): description`
- `test(SP-284): description`

## Do NOT

- Auto-resume while engine PID is alive and batch is intentionally paused
- Skip integrate gate approval on recovery

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-18
**Issue:** Original M packet too large for reliable pi workers.
**Resolution:** Superseded — execution moved to SP-296, SP-297.

