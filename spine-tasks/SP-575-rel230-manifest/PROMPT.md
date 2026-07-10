# Task: SP-575 — v2.3.0 release manifest

**Created:** 2026-07-10
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only release harness task.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Verify [`docs/release/manifest-v2.3.0.md`](../../docs/release/manifest-v2.3.0.md) (pre-staged draft). Update wave plan snapshot from `spine plan` output. Record **Operator approved scope: pending** until human sign-off.

## Dependencies

- **Task:** SP-574

## File Scope

- `docs/release/manifest-v2.3.0.md`
- `spine-tasks/_authoring/release-v2.3.0/manifest.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/manifest-v2.3.0.md` |

## Steps

### Step 0: Preflight

- [ ] Read handoff PRD and prior release manifest pattern
- [ ] Dependencies satisfied

### Step 1: Author manifest

- [ ] Complete deliverable per Mission
- [ ] Cross-check task table SP-574–595 in handoff §6

### Step 2: Testing & Verification

- [ ] `spine tasks validate SP-575`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Deliverable complete per Mission

## Git Commit Convention

- `docs(SP-575): rel230 manifest`

## Do NOT

- Set `Operator approved scope: yes` without human operator (SP-575 only)
- Modify `src/batch/**` implementation (SP-577 explore is read-only)
