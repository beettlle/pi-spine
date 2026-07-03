# Task: SP-467 — Spine orchestrate slash command

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Slash command only; split from SP-419.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Add `/spine-orchestrate [pending|all] [--from-wave N]` emitting wave plan + outer-loop checklist from `spine plan` — no auto gate approve/integrate. Closes [#90](https://github.com/beettlle/pi-spine/issues/90) with SP-466.

## Dependencies

- **Task:** SP-418, SP-466

## Context to Read First

- GitHub issue #90
- `extensions/spine/slash-commands.ts`
- Parent split: SP-419
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `extensions/spine/slash-commands.ts`
- `package.json`
- `tests/extensions/spine-orchestrate-slash.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/extensions/spine-orchestrate-slash.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `extensions/spine/slash-commands.ts` |
| artifactsMustExist | `tests/extensions/spine-orchestrate-slash.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #90 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Slash command

- [ ] Add /spine-orchestrate with pending|all and --from-wave N
- [ ] Emit structured prompt: wave tasks + outer loop steps + skill link

### Step 2: Tests

- [ ] Add slash command unit test
- [ ] Verify no auto gate approve/integrate

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #90 (`gh issue close 90`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/agent-orchestrated-waves.md` — note slash surface

**Check If Affected:**
- `skills/spine-orchestrate-waves/SKILL.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #90 closed

## Git Commit Convention

- `feat(SP-467): complete Step N — description`
- `fix(SP-467): description`
- `hydrate: SP-467 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
