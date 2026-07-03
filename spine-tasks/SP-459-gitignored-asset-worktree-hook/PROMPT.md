# Task: SP-459 — Gitignored asset worktree hook

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Init template for worktreeSetupHook symlinks.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Add optional `spine init` template hook symlinking gitignored pubspec assets from `SPINE_PROJECT_ROOT` into lane worktrees ([#80](https://github.com/beettlle/pi-spine/issues/80)).
**Closes:** [#80](https://github.com/beettlle/pi-spine/issues/80)

## Dependencies

- **Task:** SP-438 (adoption docs land first)

## Context to Read First

- GitHub issue #80
- `templates/spine-config.json`, `src/init/`
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/spine-config.json`
- `bin/spine-init.mjs`
- `src/config/worktree-setup-hook.mjs`
- `tests/init/worktree-setup-hook-template.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/init/worktree-setup-hook-template.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `templates/spine-config.json` |
| artifactsMustExist | `tests/init/worktree-setup-hook-template.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #80 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Template hook

- [ ] Commented worktreeSetupHook example for gitignored assets
- [ ] Document SPINE_PROJECT_ROOT symlink pattern

### Step 2: Init wiring

- [ ] Ensure template copied on spine init
- [ ] Doctor warns when Flutter pubspec assets missing in lane

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #80 (`gh issue close 80`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — gitignored asset hook

**Check If Affected:**
- `spine-tasks/SP-438-flutter-worktree-adoption-docs/PROMPT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #80 closed

## Git Commit Convention

- `feat(SP-459): complete Step N — description`
- `fix(SP-459): description`
- `hydrate: SP-459 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
