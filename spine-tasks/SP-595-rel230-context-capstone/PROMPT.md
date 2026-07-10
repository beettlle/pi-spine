# Task: SP-595 — CONTEXT Phase 65 capstone

**Created:** 2026-07-10
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only release harness task.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Update `spine-tasks/CONTEXT.md`: Phase 65 table (SP-574–594 Done), exit criteria, Next Task ID → SP-596. Mark Phase 65 complete when all deps landed.

## Dependencies

- **Task:** SP-594

## File Scope

- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `spine-tasks/CONTEXT.md` |

## Steps

### Step 0: Preflight

- [ ] Read handoff PRD and prior release manifest pattern
- [ ] Dependencies satisfied

### Step 1: Execute

- [ ] Complete deliverable per Mission
- [ ] Cross-check task table SP-574–595 in handoff §6

### Step 2: Testing & Verification

- [ ] `spine tasks validate SP-595`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Deliverable complete per Mission

## Git Commit Convention

- `docs(SP-595): rel230 context capstone`

## Do NOT

- Set `Operator approved scope: yes` without human operator (SP-575 only)
- Modify `src/batch/**` implementation (SP-577 explore is read-only)
