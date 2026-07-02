# Task: SP-426 — Contract verify maxBuffer fix

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Single spawnSync option change + error surfacing.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Increase `runContractTestCommand` maxBuffer (or stream output) so full `flutter test` is not killed at 256KB with exit 255. Surface ENOBUFS with clear operator message. Closes #86.
**Closes:** [#86](https://github.com/beettlle/pi-spine/issues/86)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #86
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `tests/batch/contract-verify-buffer.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-verify-buffer.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #86 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Buffer fix

- [ ] Raise maxBuffer or use spawn+stream aggregation
- [ ] Detect buffer overflow → explicit error text

### Step 1: Tests

- [ ] Simulate large stdout without killing child
- [ ] Assert overflow message mentions scoped testCommand

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #86 (`gh issue close 86`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — testCommand output limits

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #86 closed

## Git Commit Convention

- `feat(SP-426): complete Step N — description`
- `fix(SP-426): description`
- `hydrate: SP-426 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
