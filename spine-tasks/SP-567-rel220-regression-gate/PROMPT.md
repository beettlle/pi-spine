# Task: SP-567 — v2.2.0 regression gate script

**Created:** 2026-07-09
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Extend existing release-proof-gate for v2.2.0 manifest path.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 2

## Mission

Extend [`scripts/release-proof-gate.sh`](../../scripts/release-proof-gate.sh) to validate v2.2.0 release prerequisites: manifest on disk, handoff PRD present, prior manifest checks preserved.

**Closes:** FR-REL220-01 (partial)

## Dependencies

- **Task:** SP-566

## File Scope

- `scripts/release-proof-gate.sh`
- `tests/cli/release-proof-gate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/cli/release-proof-gate.test.mjs` |
| fileScopeMustChange | `scripts/release-proof-gate.sh` |

## Steps

### Step 0: Preflight

- [ ] Read SP-554 / v2.1.0 gate pattern
- [ ] Read `docs/release/manifest-v2.2.0.md`

### Step 1: Gate script

- [ ] Add v2.2.0 manifest path detection
- [ ] Check `docs/PRD-v2.2.0-backlog-drain-handoff.md` exists
- [ ] Preserve v2.0.0 / v2.1.0 manifest checks

### Step 2: Tests

- [ ] Extend `release-proof-gate.test.mjs` for v2.2.0 manifest path

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `./scripts/release-proof-gate.sh` exits 0 on clean repo

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Gate script validates v2.2.0 manifest + handoff before release batch

## Git Commit Convention

- `feat(SP-567): v2.2.0 release regression gate`

## Do NOT

- Block publish on non-blocking P1 warn checks
