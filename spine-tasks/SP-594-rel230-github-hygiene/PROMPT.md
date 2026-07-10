# Task: SP-594 — v2.3.0 GitHub backlog hygiene

**Created:** 2026-07-10
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only release harness task.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Close #117 and #116 on GitHub with landed commit SHAs from SP-578–593. Comment on each issue with task IDs and verify links.

## Dependencies

- **Task:** SP-593

## File Scope

- `spine-tasks/SP-594-rel230-github-hygiene/STATUS.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `spine-tasks/SP-594-rel230-github-hygiene/STATUS.md` |

## Steps

### Step 0: Preflight

- [ ] Read handoff PRD and prior release manifest pattern
- [ ] Dependencies satisfied

### Step 1: Execute

- [ ] Complete deliverable per Mission
- [ ] Cross-check task table SP-574–595 in handoff §6

### Step 2: Testing & Verification

- [ ] `spine tasks validate SP-594`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Deliverable complete per Mission

## Git Commit Convention

- `docs(SP-594): rel230 github hygiene`

## Do NOT

- Set `Operator approved scope: yes` without human operator (SP-575 only)
- Modify `src/batch/**` implementation (SP-577 explore is read-only)
