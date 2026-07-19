# Task: SP-665 — Show running task title in dashboard

## Mission

Closes #214

Include the PROMPT.md task title next to the running task ID in the dashboard lanes table (Running cell).
The engine already parses `prompt.title` in `src/tasks/packet/parse-prompt.mjs`, but it's not surfaced in the dashboard UI.

## Do NOT

- Do NOT modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Dependencies

- **None**

## Context to Read First

- `src/dashboard/snapshot.mjs`
- `src/dashboard/public/dashboard.js`

## File Scope

- `src/dashboard/snapshot.mjs`
- `src/dashboard/public/dashboard.js`
- `src/dashboard/public/dashboard.css`
- `tests/dashboard/ui-contract.test.mjs`

## Contract

| Field | Value |
| --- | --- |
| testCommand | `node --test tests/dashboard/ui-contract.test.mjs` |
| fileScopeMustChange | `src/dashboard/public/dashboard.js` |

## Steps

### Step 0: Dashboard Snapshot Payload

- Include each lane's running task title in the dashboard snapshot payload. Graceful fallback if unparseable.

**Plan-review checkpoint**
> `spine_review_step {"step": 0, "type": "plan"}`

### Step 1: UI updates

- Update the Running cell rendering in `src/dashboard/public/dashboard.js` to show `▶ SP-### — Title`.
- Update ARIA labels.

**Code review checkpoint**
> `spine_review_step {"step": 1, "type": "code"}`

### Step 2: Testing & Verification

- [ ] Tests pass
- [ ] Coverage ≥ 77%

**Code review checkpoint**
> `spine_review_step {"step": 2, "type": "code"}`

## Completion Criteria

- Running cell in dashboard shows the task title.
- Worker creates `.DONE`.

## Git Commit Convention

- `feat(SP-665): ...`
- `fix(SP-665): ...`
