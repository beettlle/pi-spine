# Task: SP-422 — Doctor validates canonical pi model ids

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Settings/doctor validation; affects reviewer spawn.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Reject or normalize pi TUI display labels like `gemini-3.1-pro-preview [google]` in `spine settings set agents.reviewer.model` and `spine doctor`. Validate against canonical `provider/model` ids from `pi --list-models`. Closes #76.
**Closes:** [#76](https://github.com/beettlle/pi-spine/issues/76)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #76
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/model-id.mjs`
- `src/doctor/agent-models.mjs`
- `src/cli/settings-set.mjs`
- `tests/doctor/model-id-validation.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/doctor/model-id-validation.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #76 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Preflight

- [ ] Capture failing label from reaprime repro (#76)

### Step 1: Model id resolver

- [ ] Add helper to resolve display label → canonical id (or fail with hint)
- [ ] Wire into settings set and doctor checks

### Step 2: Tests

- [ ] Test display label rejected or mapped
- [ ] Test canonical id passes

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #76 (`gh issue close 76`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — agent model pin examples

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #76 closed

## Git Commit Convention

- `feat(SP-422): complete Step N — description`
- `fix(SP-422): description`
- `hydrate: SP-422 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
