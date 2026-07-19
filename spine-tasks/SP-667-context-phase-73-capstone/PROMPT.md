# Task: SP-667 — CONTEXT Phase 73 capstone

## Mission

Phase 73 capstone for v2.9.0 release. Update `CONTEXT.md` with the new phase block.

## Do NOT

- Do NOT modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Dependencies

- **Task:** SP-663
- **Task:** SP-664
- **Task:** SP-665
- **Task:** SP-666

## Context to Read First

- `spine-tasks/CONTEXT.md`

## File Scope

- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
| --- | --- |
| testCommand | `true` |
| fileScopeMustChange | `spine-tasks/CONTEXT.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: CONTEXT.md update

- Add Phase 73 — v2.9.0 release block with SP-663 through SP-667.
- Update `Next Task ID` to SP-668.

**Plan-review checkpoint**
> `spine_review_step {"step": 0, "type": "plan"}`

### Step 1: Testing & Verification

- [ ] Check format.

**Code review checkpoint**
> `spine_review_step {"step": 1, "type": "code"}`

## Completion Criteria

- `CONTEXT.md` reflects the Phase 73 release.
- Worker creates `.DONE`.

## Git Commit Convention

- `docs(SP-667): ...`
