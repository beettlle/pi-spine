# Task: SP-528 — CI flutter analyzer ubuntu fix

**Created:** 2026-07-07
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CI platform hygiene — flutter test stub or skip on ubuntu-latest.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix [#174](https://github.com/beettlle/pi-spine/issues/174): `flutter-analyzer-hygiene` test fails on **ubuntu-latest** CI when Flutter SDK unavailable or verifyContract integration differs. Fix or document platform skip (FR-STA-13).

**Closes:** [#174](https://github.com/beettlle/pi-spine/issues/174)

## Dependencies

- **None**

## Context to Read First

- [`tests/batch/flutter-analyzer-hygiene.test.mjs`](../../tests/batch/flutter-analyzer-hygiene.test.mjs)
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
- [`docs/PRD-v1.9.0-contract-guardrails-handoff.md`](../../docs/PRD-v1.9.0-contract-guardrails-handoff.md) §FR-STA-13

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/flutter-analyzer-hygiene.test.mjs`
- `.github/workflows/ci.yml`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/flutter-analyzer-hygiene.test.mjs` |
| fileScopeMustChange | `tests/batch/flutter-analyzer-hygiene.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read #174 CI failure logs — identify ubuntu-specific failure mode
- [ ] Confirm existing flutter stub pattern in test file (`installFlutterStubOnPath`)

### Step 1: CI hygiene fix

- [ ] Ensure integration tests use flutter stub on CI (no SDK required) OR skip with documented `skipIf` when `CI=true` and no flutter
- [ ] Update ci.yml if job matrix needs adjustment

### Step 2: Tests

- [ ] All flutter-analyzer-hygiene tests pass locally with stub
- [ ] CI parity: test does not require real Flutter on ubuntu-latest

### Step 3: Testing & Verification

- [ ] Run contract testCommand
- [ ] `npm run release:check` green

### Step 4: Documentation & Delivery

- [ ] Close #174
- [ ] Create `.DONE`

## Completion Criteria

- [ ] CI ubuntu-latest green for flutter-analyzer-hygiene (M-CTR-03)

## Do NOT

- Remove SP-458 engine hygiene behavior
- Require Flutter SDK in default CI

## Git Commit Convention

- `fix(SP-528): flutter-analyzer-hygiene CI on ubuntu-latest`
