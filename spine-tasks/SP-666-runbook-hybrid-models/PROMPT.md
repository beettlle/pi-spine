# Task: SP-666 — Runbook hybrid models

## Mission

Closes #210

Document operator patterns for hybrid models (cheaper worker + stronger reviewer and vice versa) using existing `agents.worker.model` / `agents.reviewer.model` settings.

## Do NOT

- Do NOT modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Dependencies

- **None**

## Context to Read First

- `docs/adoption/operator-runbook.md`

## File Scope

- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
| --- | --- |
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Runbook documentation

- Add an operator-facing doc section with concrete hybrid recipes using spine `agents.*.model` knobs.
- Point to existing cross-model notes.

**Plan-review checkpoint**
> `spine_review_step {"step": 0, "type": "plan"}`

### Step 1: Testing & Verification

- [ ] Ensure Markdown renders correctly.

**Code review checkpoint**
> `spine_review_step {"step": 1, "type": "code"}`

## Completion Criteria

- `docs/adoption/operator-runbook.md` includes hybrid model documentation.
- Worker creates `.DONE`.

## Git Commit Convention

- `docs(SP-666): ...`
