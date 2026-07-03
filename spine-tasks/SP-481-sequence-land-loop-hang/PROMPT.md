# Task: SP-481 — Sequence land loop hang after integrate.started

**Created:** 2026-07-03
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Touches core integrate path called by sequence runner; hang leaves operators stranded after every wave. Fix adds timeout + failure-path journal event to existing function.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Canonical Task Folder

```
spine-tasks/SP-481-sequence-land-loop-hang/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Fix the sequence land loop hang where `integrateOrchToBase` emits `integrate.started` but never emits `integrate.completed` or `integrate.failed`, causing `spine run sequence` to block indefinitely after each wave. The root cause is `syncPlumbingMergePathsToWorktree` spawning unbounded per-file git subprocesses with no timeout, and the post-merge checkout/reset path potentially blocking on git locks or credential prompts.

After this fix, the land loop must either complete within a configurable timeout or emit `integrate.failed` with a clear diagnosis so the sequence can halt gracefully instead of hanging.

**Closes:** [#114](https://github.com/beettlle/pi-spine/issues/114)

## Dependencies

- **None**

## Context to Read First

**Tier 3 (load only if needed):**
- `src/batch/integrate.mjs` — main integrate function with journal events
- `src/batch/integrate-worktree.mjs` — `syncPlumbingMergePathsToWorktree` per-file loop
- `src/batch/sequence.mjs` — `runSequenceWaveLandLoop` caller

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/integrate.mjs`
- `src/batch/integrate-worktree.mjs`
- `tests/batch/integrate-timeout.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-timeout.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `src/batch/integrate.mjs`, `src/batch/integrate-worktree.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/integrate-timeout.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist (`src/batch/integrate.mjs`, `src/batch/integrate-worktree.mjs`)
- [ ] Understand current `syncPlumbingMergePathsToWorktree` per-file loop and git subprocess calls
- [ ] Confirm `integrate.started` / `integrate.completed` / `integrate.failed` journal event call sites

### Step 1: Add timeout to syncPlumbingMergePathsToWorktree

- [ ] Add a configurable timeout (default 60s) to git subprocess calls inside `syncPlumbingMergePathsToWorktree`
- [ ] If any individual git subprocess exceeds timeout, abort the sync loop and return a failure indicator
- [ ] Ensure partial sync state does not leave the worktree in an unrecoverable state (best-effort cleanup)
- [ ] Run targeted tests: `npm test -- tests/batch/integrate-worktree`

**Artifacts:**
- `src/batch/integrate-worktree.mjs` (modified)

### Step 2: Emit integrate.failed on post-merge hang

- [ ] In `integrateOrchToBase`, wrap the post-merge block (syncPlumbingMergePathsToWorktree + checkout/reset) in a try/catch that emits `integrate.failed` with `{ timeout: true, error }` on failure
- [ ] Ensure the function returns `{ ok: false }` with a clear `failureClass` (e.g. `"IntegrateTimeout"`) so `runSequenceWaveLandLoop` can halt gracefully
- [ ] When sync fails but merge already landed on the ref, include `mergeCommitLanded: true` in the journal event so operators know data is safe
- [ ] Run targeted tests: `npm test -- tests/batch/integrate`

**Artifacts:**
- `src/batch/integrate.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Add test: sync timeout triggers `integrate.failed` journal event
- [ ] Add test: successful integrate still emits `integrate.completed` (regression)
- [ ] Add test: partial sync failure returns `{ ok: false, failureClass: "IntegrateTimeout" }`
- [ ] Fix all failures

**Artifacts:**
- `tests/batch/integrate-timeout.test.mjs` (new)

### Step 4: Documentation & Delivery

- [ ] Update operator runbook with new `IntegrateTimeout` failure class and recovery steps
- [ ] Check if `docs/adoption/operator-runbook.md` needs a new troubleshooting entry

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — add IntegrateTimeout diagnosis and recovery

**Check If Affected:**
- `docs/design/batch-lifecycle.md` — new failure path from integrate

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `integrate.failed` emitted within timeout when post-merge sync hangs
- [ ] Sequence land loop receives `{ ok: false }` and halts gracefully (no indefinite hang)
- [ ] Documentation updated

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-481): complete Step N — description`
- **Bug fixes:** `fix(SP-481): description`
- **Tests:** `test(SP-481): description`
- **Hydration:** `hydrate: SP-481 expand Step N checkboxes`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Change the happy-path integrate behavior (only add timeout/failure handling)

---

## Amendments (Added During Execution)
