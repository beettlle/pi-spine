# Task: SP-318 — Shared atomic write utility

**Created:** 2026-06-20
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Extract shared tmp+rename write helpers from existing settings and rules-manifest code; low blast radius, established pattern.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Create shared atomic file write utilities for pi-spine orchestration artifacts.

Extract writeJsonAtomic and writeTextAtomic into new src/fs/atomic-write.mjs using the pattern from writeSpineConfigAtomic in src/cli/settings-set.mjs.

Refactor existing callers in settings-set.mjs and discover.mjs to use the shared util with no behavior change.

Add unit tests covering write, rename, cleanup on failure, and unique temp suffixes.

## Dependencies

-1. **None**

## Context to Read First

- `src/cli/settings-set.mjs`
- `src/config/cursor-rules/discover.mjs`
- `skills/create-spine-tasks/references/contract-template.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/fs/atomic-write.mjs`
- `src/cli/settings-set.mjs`
- `src/config/cursor-rules/discover.mjs`
- `tests/fs/atomic-write.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/fs/atomic-write.test.mjs` |
| fileScopeMustChange | `src/fs/atomic-write.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/fs/atomic-write.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read existing atomic write implementations in settings-set and discover
- [ ] Confirm no other callers need migration in this task

### Step 1: Implement shared atomic write module

- [ ] Create src/fs/atomic-write.mjs with writeJsonAtomic and writeTextAtomic
- [ ] Refactor settings-set.mjs and discover.mjs to use shared util
- [ ] Preserve existing fsync/rename semantics

### Step 2: Testing & Verification

- [ ] Add tests/fs/atomic-write.test.mjs
- [ ] Run FULL test suite: npm run typecheck && SPINE_WORKER_STUB=1 npm test
- [ ] Run coverage gate: npm run coverage:check — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Create .DONE

## Documentation Requirements

**Must Update:**

- None

**Check If Affected:**

- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] Shared atomic write module exists
- [ ] Existing callers refactored without behavior change
- [ ] Tests pass with coverage gate

## Git Commit Convention

- `feat(SP-318): complete Step N — description`
- `fix(SP-318): description`
- `test(SP-318): description`

## Do NOT

- Change journal append-only semantics
- Add new npm dependencies

---

## Amendments (Added During Execution)
