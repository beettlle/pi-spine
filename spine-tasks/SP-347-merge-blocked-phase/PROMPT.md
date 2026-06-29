# Task: SP-347 — Merge blocked terminal phase

**Created:** 2026-06-28
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** After merge failure, batch stays `phase: merging` with stale `enginePid` — misleading terminal state.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #38**: `recordMergeBlocked` sets `phase: merging` and `endedAt` but engine exits; status shows active merge for 30+ minutes.

**Required behavior:**

1. Terminal phase `merge_blocked` (not `merging`) when engine exits after merge failure.
2. Clear stale `enginePid`; emit `batch.merge_blocked` journal event.
3. Attached mode prints failure headline before exit.
4. Regression test from batch `20260628T062636` pattern.

**Closes:** [#38](https://github.com/beettlle/pi-spine/issues/38)

## Dependencies

- **Task:** SP-338

## Context to Read First

- GitHub issue #38
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/engine-lanes/merge.mjs`
- `src/batch/lifecycle.mjs`
- `src/batch/diagnosis.mjs`
- `src/batch/attached-runner.mjs`
- `tests/batch/merge-blocked-phase.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/merge-blocked-phase.test.mjs` |
| fileScopeMustChange | `src/batch/lifecycle.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/merge-blocked-phase.test.mjs` |

## Steps

### Step 0: Preflight: batch 20260628T062636 state snapshot

- [ ] Preflight: batch 20260628T062636 state snapshot

### Step 1: merge_blocked phase + clear enginePid

- [ ] merge_blocked phase + clear enginePid

### Step 2: Attached failure output

- [ ] Attached failure output

### Step 3: Tests + delivery

- [ ] Tests + delivery

### Step 4: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 5: Documentation & Delivery

- [ ] Close issue #38 (`gh issue close 38`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #38 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-347): complete Step N — description`
- `fix(SP-347): description`
- `test(SP-347): description`

## Do NOT

- Expand scope beyond issue #38 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
