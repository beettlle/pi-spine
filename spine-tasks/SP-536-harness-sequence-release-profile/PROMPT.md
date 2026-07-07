# Task: SP-536 — Harness sequence release profile

**Created:** 2026-07-07
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Sequence runner release profile — wave caps, gate-only loop, `--auto-approve-gate` safety for release scope.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement FR-STA-25: wire a **release sequence profile** for `spine run sequence` with wave caps, gate-only operator loop, and documented `--auto-approve-gate` safety ([#54](https://github.com/beettlle/pi-spine/issues/54) Partial). Release operator Phase 4 uses this profile for v1.10.0 execution.

**Partial:** [#54](https://github.com/beettlle/pi-spine/issues/54)

## Dependencies

- **Task:** SP-388 (`spine run sequence` CLI — Done)
- **Task:** SP-535 (release manifest format)

## Context to Read First

- [`docs/PRD-v1.10.0-release-harness-handoff.md`](../../docs/PRD-v1.10.0-release-harness-handoff.md) §FR-STA-25
- [`src/batch/sequence.mjs`](../../src/batch/sequence.mjs)
- [`src/cli/sequence.mjs`](../../src/cli/sequence.mjs)
- [`src/doctor/sequence-safety.mjs`](../../src/doctor/sequence-safety.mjs)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/sequence.mjs`
- `src/cli/sequence.mjs`
- `src/doctor/sequence-safety.mjs`
- `bin/spine-run.mjs`
- `tests/batch/sequence-release-profile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/sequence-release-profile.test.mjs` |
| fileScopeMustChange | `src/batch/sequence.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read SP-390 auto-approve safety and sequence CLI from SP-388
- [ ] Confirm SP-535 manifest example lists release scope waves

### Step 1: Release profile

- [ ] Add release profile constants: max wave size, gate-only pause points, dry-run flag support
- [ ] `spine run sequence <scope> --dry-run` prints wave plan without starting batches
- [ ] Document `--auto-approve-gate` guardrails in doctor/sequence-safety

### Step 2: Tests

- [ ] `tests/batch/sequence-release-profile.test.mjs`: dry-run wave plan; auto-approve safety check

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Cross-link `docs/release/manifest-v1.10.0-example.md`
- [ ] Create `.DONE`

## Completion Criteria

- [ ] `spine run sequence` supports release profile with dry-run and gate-only loop
- [ ] Auto-approve gate safety validated for release scope

## Do NOT

- Re-implement SP-388 CLI wiring
- Enable npm publish without operator approval

## Git Commit Convention

- `feat(SP-536): sequence release profile for harness`
