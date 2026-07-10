# Task: SP-577 — batch module split explore

**Created:** 2026-07-10
**Size:** S

## Review Level: 0 (None)

**Assessment:** Read-only explore verification for #117.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Verify explore findings at `spine-tasks/_explore/batch-module-split-v23/findings.md` (pre-staged). Update LOC counts if drifted. Link explore row in CONTEXT.md.

## Dependencies

- **Task:** SP-575

## File Scope

- `spine-tasks/_explore/batch-module-split-v23/findings.md`
- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `spine-tasks/_explore/batch-module-split-v23/findings.md` |

## Steps

### Step 0: Preflight

- [ ] Read handoff PRD and prior release manifest pattern
- [ ] Dependencies satisfied

### Step 1: Verify findings

- [ ] Complete deliverable per Mission
- [ ] Cross-check task table SP-574–595 in handoff §6

### Step 2: Testing & Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Deliverable complete per Mission

## Git Commit Convention

- `docs(SP-577): rel230 module split explore`

## Do NOT

- Set `Operator approved scope: yes` without human operator (SP-575 only)
- Modify `src/batch/**` implementation (SP-577 explore is read-only)
