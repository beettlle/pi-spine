# Task: SP-554 — v2.1.0 regression gate script

**Created:** 2026-07-09
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Extend existing release-proof-gate for v2.1.0 manifest path.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 2

## Mission

Extend [`scripts/release-proof-gate.sh`](../../scripts/release-proof-gate.sh) (or add `scripts/release-v210-gate.sh`) to validate v2.1.0 release prerequisites: manifest on disk, handoff PRD present, spine doctor/preflight green.

**Closes:** FR-REL210-01 (partial)

## Dependencies

- **Task:** SP-553

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

- [ ] Read SP-545 / `release-proof-gate.sh` v2.0.0 pattern
- [ ] Read `docs/release/manifest-v2.1.0.md`

### Step 1: Gate script

- [ ] Add `RELEASE_MANIFEST` env or detect v2.1.0 manifest path
- [ ] Check `docs/PRD-v2.1.0-backlog-drain-handoff.md` exists
- [ ] Preserve v2.0.0 proof manifest check (both manifests or version flag)

### Step 2: Tests

- [ ] Extend `release-proof-gate.test.mjs` for v2.1.0 manifest path

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `./scripts/release-proof-gate.sh` (or v210 variant) exits 0 on clean repo

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Gate script validates v2.1.0 manifest + handoff before release batch

## Git Commit Convention

- `feat(SP-554): v2.1.0 release regression gate`

## Do NOT

- Block publish on non-blocking P1 warn checks
