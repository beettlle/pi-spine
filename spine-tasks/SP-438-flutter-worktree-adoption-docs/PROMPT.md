# Task: SP-438 — Flutter worktree adoption docs

**Created:** 2026-07-02
**Size:** M

## Review Level: 0 (None)

**Assessment:** Consumer adoption docs for #78/#80.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Document Flutter/reaprime lane worktree pitfalls: gitignored pubspec assets (#80), worktreeSetupHook symlink pattern, scoped testCommand, analyzer pollution from build/SourcePackages (#78). Add optional `spine init` hook template. Partial closes #78 and #80 (engine fixes remain separate if needed).
**GitHub:** [#78](https://github.com/beettlle/pi-spine/issues/78) (partial)

## Dependencies

- **Task:** SP-420 (cross-model-authoring-docs)

## Context to Read First

- GitHub issue #78
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/flutter-worktree-guide.md`
- `docs/adoption/operator-runbook.md`
- `templates/spine-worktree-setup-flutter.sh`
- `docs/adoption/bootstrap-checklist.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #78 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Guide

- [ ] Create docs/adoption/flutter-worktree-guide.md
- [ ] Cover gitignored assets, hook symlink, analyze scope

### Step 1: Templates + links

- [ ] Add optional flutter worktree setup script template
- [ ] Cross-link from runbook, bootstrap, cross-model docs (SP-420)

### Step 2: Issue updates

- [ ] Comment on #78/#80 with doc path; close if acceptance met

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/flutter-worktree-guide.md` — new guide
- `docs/adoption/operator-runbook.md` — Flutter section link

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-438): complete Step N — description`
- `fix(SP-438): description`
- `hydrate: SP-438 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
