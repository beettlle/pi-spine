# Task: SP-488 — Contract failed false positive docs

**Created:** 2026-07-03
**Size:** S

## Review Level: 0 (None)

**Assessment:** Documentation-only task adding a known-issue section to the operator runbook. No code changes, no security surface.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-488-contract-failed-false-positive-docs/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Document the known `contract_failed` false-positive behavior that occurs when `testCommand` runs inside a worker environment where `SPINE_IS_WORKER=1` is set. Tests calling `startBatch` internally hit the `nested_batch_spawn_blocked` guard and fail — even though the worker's code changes are correct. Add a "Contract `testCommand` false positives in worker environment" section to the operator runbook with symptom, cause, diagnosis steps, resolution, and prevention guidance. Also add a note in `spine-tasks/CONTEXT.md` so LLM workers encountering this issue can find the explanation quickly.

**Closes:** [#132](https://github.com/beettlle/pi-spine/issues/132)

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `spine-tasks/CONTEXT.md`

**Tier 3 (load only if needed):**
- `docs/adoption/operator-runbook.md` — target file for the new section

## Environment

- **Workspace:** `docs/adoption/`, `spine-tasks/`
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Add operator runbook section

- [ ] Add a section titled "Contract `testCommand` false positives in worker environment" to the **Troubleshooting** area of `docs/adoption/operator-runbook.md`
- [ ] Cover: symptom (`contract_failed` after all steps complete + `.DONE` written + code review APPROVE), cause (`SPINE_IS_WORKER=1` triggers `nested_batch_spawn_blocked` in pre-existing tests), diagnosis steps (`spine status --diagnose`, check STATUS.md, check journal `contract.verified` events), resolution (`spine batch retry`), prevention (scope `testCommand` to task-relevant tests)
- [ ] Reference observed incidents: SP-451 and SP-435 in batch `20260703T183108`

### Step 2: Add CONTEXT.md worker note

- [ ] Add a brief note under a discoverable heading in `spine-tasks/CONTEXT.md` (e.g., in the Execution policy section) noting that the full test suite may have pre-existing failures under `SPINE_IS_WORKER=1` and pointing workers to the runbook section

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #132: `gh issue close 132 --comment "Documented in operator-runbook.md — SP-488"`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — new troubleshooting section for contract false positives

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — worker-facing note about SPINE_IS_WORKER=1

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Operator runbook has a findable section for contract false positives
- [ ] CONTEXT.md has a worker-facing note

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `docs(SP-488): complete Step N — description`
- **Bug fixes:** `fix(SP-488): description`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
