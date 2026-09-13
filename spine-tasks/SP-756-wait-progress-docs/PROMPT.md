# Task: SP-756 — Document wait progress + agent outer-loop guidance (P2)

**Created:** 2026-09-13
**Size:** S

## Review Level: 0 (None)

**Risk:** Documentation and skill text only; no runtime code.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** Operators still assume silent `spine wait` is hung; skills should describe start/progress/match lines and when to prefer `--json` vs `spine watch`.

## Mission

Closes #286 — After SP-753/SP-754 land, document human-mode wait start/progress/match behavior and agent outer-loop guidance in QUICK-REFERENCE and the release/orchestrate skills. Update runbook wait table rows only if this task's File Scope includes the runbook path below.

## Dependencies

- **Task:** SP-753
- **Task:** SP-754

## Context to Read First

- `Parent split: SP-753 / SP-754 — wait headlines + progress`
- `docs/QUICK-REFERENCE.md` — wait examples
- `skills/spine-release-operator/SKILL.md` — detached wait pattern
- `skills/spine-orchestrate-waves/SKILL.md` — wait recipe
- GitHub #286 — P2 acceptance

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/QUICK-REFERENCE.md`
- `skills/spine-release-operator/SKILL.md`
- `skills/spine-orchestrate-waves/SKILL.md`
- `skills/spine-autonomous-operator/references/agent-shell-batch-policy.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/QUICK-REFERENCE.md`, `skills/spine-release-operator/SKILL.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-753/SP-754 `.DONE` and wait stdout behavior on `main`
- [ ] Dependencies satisfied

### Step 1: Document wait UX

- [ ] QUICK-REFERENCE: note human-mode start/progress/match lines; when to use `--json`
- [ ] spine-release-operator: detached wait guidance mentions progress (not “silent until exit”)
- [ ] spine-orchestrate-waves: wait recipe mentions liveness output
- [ ] agent-shell-batch-policy: one short note on quiet-stdout agent hosts vs wait progress

**Artifacts:**
- `docs/QUICK-REFERENCE.md` (modified)
- `skills/spine-release-operator/SKILL.md` (modified)

### Step 2: Testing & Verification

- [ ] Contract `testCommand` is `true` (docs-only)
- [ ] Spot-check linked examples still use valid `--until` lists

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/QUICK-REFERENCE.md` — wait progress / `--json` guidance *(also in File Scope)*
- `skills/spine-release-operator/SKILL.md` — detached wait progress note *(also in File Scope)*

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — leave to a follow-up if not in File Scope

## Completion Criteria

- [ ] Docs/skills describe non-silent human wait
- [ ] Closes #286

## Git Commit Convention

- `docs(SP-756): wait progress and agent outer-loop guidance (#286)`

## Do NOT

- Change `src/cli/wait.mjs`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
