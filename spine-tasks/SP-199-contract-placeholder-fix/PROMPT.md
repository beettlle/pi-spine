# Task: SP-199 — Contract placeholder resolution (root cause)

**Created:** 2026-06-11
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Root-cause fix for SP-193 batch contract false failures — generated packets used literal `see File Scope` and em-dash placeholders that verify treated as real globs.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Close the **contract placeholder** gap exposed when batch `20260611T225006` (SP-193) failed `contract.verified` despite a complete implementation:

1. **Parser** — `parseContract()` now resolves `see File Scope` and treats `—` as empty (landed in hotfix on `main`; add regression coverage if missing).
2. **Generator** — `scripts/generate-phase22-packets.mjs` emits concrete file-scope paths and empty cells instead of placeholders (hotfix landed; verify no other generators repeat the pattern).
3. **Validate-time guard** — `validateContract()` should warn/error in `required` mode when a contract table still contains unresolved placeholders after parse (e.g. `see File Scope` with empty File Scope section).
4. **Packet migration** — Bulk-update existing `spine-tasks/SP-*` PROMPT.md contract tables (Phase 22 + wedge epic) to concrete paths or empty cells; no literal `see File Scope` / `—` path tokens remain.
5. **Verify integration** — Add `contract-verify` test using SP-193-shaped PROMPT + git diff fixture; document incident in `findings.md`.

**Incident:** `contract.verified` failed with `no matching changes for see File Scope`, `missing —`, and unparseable coverage — triggered unnecessary REVISE rework on SP-193.

## Dependencies

- **Task:** SP-193

## Context to Read First

**Tier 3:**
- `src/tasks/packet/parse-prompt.mjs` — `parseContract`, `resolveContractFileScopeReferences`
- `src/tasks/packet/validate-contract.mjs`
- `src/batch/contract-verify.mjs`
- `scripts/generate-phase22-packets.mjs`
- Batch `20260611T225006` journal (`contract.verified`, `task.verdict_recorded`)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/tasks/packet/parse-prompt.mjs`
- `src/tasks/packet/validate-contract.mjs`
- `scripts/generate-phase22-packets.mjs`
- `scripts/coverage-parse.mjs`
- `spine-tasks/SP-*/PROMPT.md` (contract table rows only)
- `tests/tasks/contract-parse.test.mjs`
- `tests/batch/contract-verify.test.mjs`
- `tests/coverage/policy.test.mjs`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/tasks/packet/parse-prompt.mjs`, `src/tasks/packet/validate-contract.mjs`, `scripts/generate-phase22-packets.mjs`, `scripts/coverage-parse.mjs`, `tests/tasks/contract-parse.test.mjs`, `tests/batch/contract-verify.test.mjs`, `tests/coverage/policy.test.mjs` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Confirm hotfix parser/generator changes on `main`; list remaining PROMPT.md files with `see File Scope` or `—` in contract tables
- [ ] Read batch `20260611T225006` journal contract failure events

### Step 1: Validate-time guards

> **Plan-review checkpoint**

- [ ] Add validateContract warnings/errors for unresolved placeholders
- [ ] Ensure planner/validate path surfaces warnings in `spine plan`

### Step 2: Packet migration + tests

> **Code review checkpoint**

- [ ] Migrate Phase 22 / wedge epic PROMPT contract tables to concrete paths
- [ ] Add contract-verify integration test with SP-193-shaped fixture
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Note SP-193 contract incident in `findings.md`
- [ ] Create `.DONE` when complete

## Testing

- `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- `npm run coverage:check` — ≥77%
- Grep: no `see File Scope` in contract tables under `spine-tasks/`

## Completion Criteria

- [ ] No staged SP-* packet uses literal `see File Scope` or em-dash path placeholders in contract tables
- [ ] validateContract fails or warns on placeholder misuse in required mode
- [ ] Tests green; coverage ≥77%

## Git Commit Convention

- `feat(SP-199): complete Step N — description`

## Do NOT

- Remove contract verification or flip `contract.mode` back to optional
- Change unrelated PROMPT mission/steps text during migration
