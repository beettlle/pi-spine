# Task: SP-714 — Validate and uniquify batch IDs

**Created:** 2026-08-22
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Input validation at CLI boundaries; security hardening.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0

## Mission

Closes #258 — Add `validateBatchId(batchId)` with allowlist pattern; reject path traversal. Update `generateBatchId()` to append random suffix and loop until runtime dir absent. Call validation at every CLI `--batch` entry before `path.join` under `.spine/runtime/`.

## Dependencies

- **None**

## Context to Read First

- `src/batch/state.mjs` — `generateBatchId()`
- `src/cli/journal-follow.mjs` — `resolveFollowBatchId`
- GitHub #258

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/batch-id.mjs`
- `src/batch/state.mjs`
- `src/cli/journal-follow.mjs`
- `tests/batch/batch-id-validation.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-id-validation.test.mjs` |
| fileScopeMustChange | `tests/batch/batch-id-validation.test.mjs` |

## Steps

### Step 1: validateBatchId helper

- [ ] Add `src/batch/batch-id.mjs` with `validateBatchId` and `BATCH_ID_PATTERN`
- [ ] Reject `..`, `/`, `\\`, NUL, empty, and absolute paths
- [ ] Backward-compatible with existing archived IDs

### Step 2: generateBatchId uniquify

- [ ] Append random suffix (4 hex) or ms component
- [ ] Loop until `.spine/runtime/{id}` absent

### Step 3: Wire CLI validation

- [ ] Call `validateBatchId` in journal-follow and other `--batch` CLI paths before path joins

### Step 4: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 5: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — batch ID format if operator-facing

## Completion Criteria

- [ ] Path traversal rejected with clear error
- [ ] Concurrent `generateBatchId()` produces distinct IDs
- [ ] Scoped tests pass
- [ ] Closes #258

## Do NOT

- Break existing archived batch ID lookups
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-714): validate and uniquify batch IDs (#258)`
