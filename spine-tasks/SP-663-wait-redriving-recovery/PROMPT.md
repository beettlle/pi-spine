# Task: SP-663 — wait redriving recovery

## Mission

Closes #215

Fix a bug where `spine wait` (or operator resume-monitor) wakes up and re-drives recovery prompts after the batch was already integrated by another parallel operator session. `spine wait` should record `batchId` at start, and on exit, print diagnosis for **that** id (batch-scoped) rather than the newly active batch.

## Do NOT

- Do NOT modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Do NOT add external dependencies.

## Dependencies

- **None**

## Context to Read First

- `src/batch/wait.mjs`
- `src/batch/diagnose.mjs`

## File Scope

- `src/batch/wait.mjs`
- `tests/batch/wait.test.mjs`

## Contract

| Field | Value |
| --- | --- |
| testCommand | `node --test tests/batch/wait.test.mjs` |
| fileScopeMustChange | `src/batch/wait.mjs` |
| fileScopeMustNotChange | `src/batch/diagnose.mjs` |

## Steps

### Step 0: Batch-scoped wait

- Modify `src/batch/wait.mjs` so `spine wait` targets the specific batch ID it was started with.
- If the batch state is archived or replaced while waiting, `wait` should exit promptly with a distinct status (e.g. `archived` or `superseded`) and non-ambiguous message.

**Plan-review checkpoint**
> `spine_review_step {"step": 0, "type": "plan"}`

### Step 1: Update tests

- Update `tests/batch/wait.test.mjs` to simulate the batch archiving under a wait.

**Code review checkpoint**
> `spine_review_step {"step": 1, "type": "code"}`

### Step 2: Testing & Verification

- [ ] `npm test` passes
- [ ] `npm run coverage:check` ensures ≥77% line coverage

**Code review checkpoint**
> `spine_review_step {"step": 2, "type": "code"}`

## Completion Criteria

- `spine wait` exits gracefully if the active batch is archived, and its output is strictly scoped to the batch it waited on.
- Worker creates `.DONE`.

## Git Commit Convention

- `feat(SP-663): ...`
- `fix(SP-663): ...`

## Amendments
