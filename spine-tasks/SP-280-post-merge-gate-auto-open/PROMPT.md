# Task: SP-280 — Post-merge integrate gate auto-open

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Land-loop gap — merges complete but integrate gate missing until manual `batch resume` (SP-204 limbo path incomplete on normal engine exit).
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #3**: batch `20260617T231658` finished 5/5 tasks and lane merges, but `spine gate status` returned **no integrate gate** until operator ran `spine batch resume`, which then opened the gate and completed the land loop.

**Required behavior:** When the detached engine finishes the last wave merge and all tasks succeeded (`isPostMergeLimbo` conditions), it must **automatically** call the same finalize path as resume (`openIntegrateGateAfterBatchComplete` + `phase: completed`) without requiring `spine batch resume`.

**Closes:** [#3](https://github.com/beettlle/pi-spine/issues/3)

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `spine-tasks/SP-204-post-merge-limbo-gate/PROMPT.md`
- `src/batch/post-merge-limbo.mjs` — `isPostMergeLimbo`, `finalizeResumedBatchForIntegrate`
- `src/batch/engine.mjs` — batch completion + `openIntegrateGateAfterBatchComplete`
- `src/batch/resume-multi.mjs` — resume limbo finalize path
- `tests/batch/post-merge-limbo.test.mjs`
- GitHub issue #3 body; journal `.spine/runtime/20260617T231658/journal/events.jsonl`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/post-merge-limbo.mjs`
- `src/batch/engine.mjs`
- `tests/batch/post-merge-limbo.test.mjs`
- `src/batch/diagnosis.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/batch/post-merge-limbo.mjs, tests/batch/post-merge-limbo.test.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Reproduce limbo conditions from issue #3: `phase: running`, all tasks `succeeded`, `mergeResults` populated, no gate
- [ ] Trace engine exit path after `mergeWaveLanesToOrch` — confirm where gate open is skipped

### Step 1: Auto-finalize on engine completion

> **Plan-review checkpoint**

- [ ] Extract shared `finalizeBatchForIntegrate` (or reuse `finalizeResumedBatchForIntegrate` with `resumed: false`) callable from both resume and normal engine completion
- [ ] Invoke from `engine.mjs` end-of-batch path when post-merge limbo would apply — idempotent gate open
- [ ] Ensure diagnosis no longer recommends resume when engine already finalized

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Extend `post-merge-limbo.test.mjs`: simulated batch state after merge → gate opened + `phase: completed` without resume
- [ ] Regression: existing resume limbo tests still pass
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook land-loop section if resume is no longer required for this case
- [ ] Close GitHub issue #3: `gh issue close 3 --comment "Fixed in SP-280: engine auto-opens integrate gate after post-merge limbo without batch resume."`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — post-merge limbo / gate auto-open

**Check If Affected:**
- `src/batch/diagnosis.mjs` — limbo messaging

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #3 closed with comment referencing SP-280
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-280): complete Step N — description`
- `fix(SP-280): description`
- `test(SP-280): description`

## Do NOT

- Remove manual `batch resume` for genuinely paused/failed batches
- Auto-integrate to `main` without gate approval
- Touch worker review tool behavior (SP-278)

---

## Amendments (Added During Execution)
