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

- `src/cli/wait.mjs`
- `src/batch/diagnosis.mjs`

## File Scope

- `src/cli/wait.mjs`
- `tests/cli/wait.test.mjs`

## Contract

| Field | Value |
| --- | --- |
| testCommand | `node --test tests/cli/wait.test.mjs` |
| fileScopeMustChange | `src/cli/wait.mjs` |
| fileScopeMustNotChange | `src/batch/diagnosis.mjs` |

## Steps

### Step 0: Batch-scoped wait

- Modify `src/cli/wait.mjs` so `spine wait` targets the specific batch ID it was started with.
- If the batch state is archived or replaced while waiting, `wait` should exit promptly with a distinct status (e.g. `archived` or `superseded`) and non-ambiguous message.

**Plan-review checkpoint**
> `spine_review_step {"step": 0, "type": "plan"}`

### Step 1: Update tests

- Update `tests/cli/wait.test.mjs` to simulate the batch archiving under a wait.

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

- **Path typo correction (worker).** The original PROMPT referenced `src/batch/wait.mjs`, `src/batch/diagnose.mjs`, and `tests/batch/wait.test.mjs` — none of which exist. The `spine wait` implementation lives at `src/cli/wait.mjs` (built in SP-362; sibling SP-360 `spine watch` confirms `src/cli/` + `tests/cli/` is the convention), and the diagnosis module is `src/batch/diagnosis.mjs`. Context-to-Read-First, File Scope, Contract, and Step path references were corrected to the real paths so the contract `testCommand`/`fileScopeMustChange`/`fileScopeMustNotChange` resolve against files that actually exist. No change to Mission, steps, or scope.
