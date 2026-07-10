# Task: SP-576 — v2.3.0 regression gate script

**Created:** 2026-07-10
**Size:** S

## Review Level: 0 (None)

**Assessment:** Release gate script extension.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Extend `scripts/release-proof-gate.sh` for v2.3.0: add `RELEASE_GATE_VERSION=2.3.0`, manifest path `manifest-v2.3.0.md`, handoff PRD path. Update default version comment.

## Dependencies

- **Task:** SP-575

## File Scope

- `scripts/release-proof-gate.sh`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/scripts/release-proof-gate.test.mjs` |
| fileScopeMustChange | `scripts/release-proof-gate.sh` |

## Steps

### Step 0: Preflight

- [ ] Read handoff PRD and prior release manifest pattern
- [ ] Dependencies satisfied

### Step 1: Extend release-proof-gate.sh

- [ ] Complete deliverable per Mission
- [ ] Cross-check task table SP-574–595 in handoff §6

### Step 2: Testing & Verification

- [ ] `bash -n scripts/release-proof-gate.sh`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Deliverable complete per Mission

## Git Commit Convention

- `docs(SP-576): rel230 regression gate`

## Do NOT

- Set `Operator approved scope: yes` without human operator (SP-575 only)
- Modify `src/batch/**` implementation (SP-577 explore is read-only)
