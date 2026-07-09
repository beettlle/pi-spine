# Task: SP-561 — component maturity matrix

**Created:** 2026-07-09
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only CI audit with L0–L4 grading.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Create [#129](https://github.com/beettlle/pi-spine/issues/129): `docs/adoption/component-maturity-matrix.md` with evidence-based L0–L4 grading per component (tests, CI gating, cross-axis validation). Cite workflow files and test counts.

**Closes:** [#129](https://github.com/beettlle/pi-spine/issues/129)

## Dependencies

- **Task:** SP-553

## File Scope

- `docs/adoption/component-maturity-matrix.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/component-maturity-matrix.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Read issue #129 and Babysitter MATURITY-MATRIX reference

### Step 1: Author matrix

- [ ] Grade batch engine, journal, contract verify, dashboard, CLI, extensions
- [ ] Cite `.github/workflows/*.yml` and test file evidence

### Step 2: Testing & Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Link from operator runbook or docs/release/README.md
- [ ] Comment on #129
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Matrix published with per-component grades and evidence citations

## Git Commit Convention

- `docs(SP-561): component maturity matrix L0-L4`

## Do NOT

- Claim L4 without cross-axis test evidence
