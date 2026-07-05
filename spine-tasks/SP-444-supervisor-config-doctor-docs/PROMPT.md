# Task: SP-444 — Supervisor config doctor and docs

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Config wiring + docs; completes #71.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Wire `agents.supervisor.enabled`, `pollIntervalMs`, `autoNudge` into settings/doctor; update runbook §Supervisor deferred → opt-in supervisor. Closes #71.
**Closes:** [#71](https://github.com/beettlle/pi-spine/issues/71)

## Dependencies

- **Task:** SP-440 (supervisor-spawn-mvp)

## Context to Read First

- GitHub issue #71
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/settings-fields.mjs`
- `src/doctor/supervisor.mjs`
- `templates/spine-config.json`
- `docs/adoption/operator-runbook.md`
- `tests/doctor/supervisor-config.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 SPINE_SUPPRESS_JOURNAL_ATTACH=1 node --experimental-strip-types --test tests/doctor/supervisor-config.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #71 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Settings + doctor

- [ ] Add editable supervisor fields
- [ ] Doctor warns enabled + missing template or bad model

### Step 1: Docs + close

- [ ] Update runbook supervisor section
- [ ] Close #71

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #71 (`gh issue close 71`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — supervisor opt-in

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #71 closed

## Git Commit Convention

- `feat(SP-444): complete Step N — description`
- `fix(SP-444): description`
- `hydrate: SP-444 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
