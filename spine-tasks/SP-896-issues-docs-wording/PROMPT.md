# Task: SP-896 — Docs: issue tracker ↔ packets wording

**Created:** 2026-11-23
**Size:** S
**Type:** llm

## Review Level: 0 (None)

**Risk:** Docs drift only.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Closes #387 — Update operator-facing docs and skills to forge-neutral “issue tracker ↔ packets” wording: `integrations.issues`, `--no-issue-sync`, `--issue-label`, journal `issues.synced` / `issues.sync_failed`. Cover operator-runbook, create-spine-tasks, release-operator §4.3c, and upstream-execution-workflow.

## Dependencies

- **Task:** SP-895

## Context to Read First

- GitHub #387 acceptance criteria (docs bullet)
- `docs/adoption/operator-runbook.md` — integrations / sync §
- `skills/spine-release-operator/SKILL.md` §4.3c
- `skills/create-spine-tasks/SKILL.md`
- `docs/adoption/upstream-execution-workflow.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `docs/adoption/upstream-execution-workflow.md`
- `docs/adoption/agent-orchestrated-waves.md`
- `skills/spine-release-operator/SKILL.md`
- `skills/create-spine-tasks/SKILL.md`
- `skills/spine-orchestrate-waves/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md`, `skills/spine-release-operator/SKILL.md`, `skills/create-spine-tasks/SKILL.md`, `docs/adoption/upstream-execution-workflow.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Grep docs/skills for `integrations.github`, `--no-github-sync`, `--github-label`, `github.issue_synced`
- [ ] Confirm SP-890–SP-895 code names match docs targets

### Step 1: Update wording

- [ ] Operator runbook: issues config + flags + journal
- [ ] release-operator §4.3c + create-spine-tasks + upstream-execution-workflow
- [ ] Touch agent-orchestrated-waves / spine-orchestrate-waves if they still say GitHub-only seam

### Step 2: Testing & Verification

- [ ] `rg -l 'integrations\\.issues|no-issue-sync|issue-label|issues\\.synced' docs/adoption skills/`
- [ ] Confirm no remaining operator docs teaching `integrations.github` as current config

### Step 3: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`
- `skills/spine-release-operator/SKILL.md`
- `skills/create-spine-tasks/SKILL.md`
- `docs/adoption/upstream-execution-workflow.md`

**Check If Affected:**
- `docs/adoption/agent-orchestrated-waves.md`
- `skills/spine-orchestrate-waves/SKILL.md`

## Completion Criteria

- [ ] Docs/skills use forge-neutral wording and new names
- [ ] #387 AC docs bullet satisfied
- [ ] `.DONE` present

## Git Commit Convention

- `docs(SP-896): issue tracker ↔ packets wording (#387)`

## Do NOT

- Change engine code
- Document GitLab/Bitbucket adapters as implemented
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
