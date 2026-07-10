# Task: SP-593 — Empty PHASE23_GRANDFATHERED_OVER_500

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Final verification that all grandfathered modules are ≤500 LOC.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Remove all entries from `PHASE23_GRANDFATHERED_OVER_500` (or document borderline `resume.mjs` only). Ensure `bin/spine-cli/verify.mjs` `batch-loc-policy` passes. Run `node bin/spine-cli/verify.mjs` or equivalent.

**Closes:** #117

## Dependencies

- **Task:** SP-578
- **Task:** SP-579
- **Task:** SP-580
- **Task:** SP-581
- **Task:** SP-582
- **Task:** SP-583
- **Task:** SP-584
- **Task:** SP-585
- **Task:** SP-586
- **Task:** SP-587
- **Task:** SP-588
- **Task:** SP-589
- **Task:** SP-590
- **Task:** SP-591
- **Task:** SP-592

## File Scope

- `bin/spine-cli/verify.mjs`
- `tests/cli/phase23-exit-verify.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/cli/phase23-exit-verify.test.mjs` |
| fileScopeMustChange | `bin/spine-cli/verify.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-578–592 complete
- [ ] Run `wc -l src/batch/*.mjs` — all ≤500 or documented

### Step 1: Empty grandfather list

- [ ] Set `PHASE23_GRANDFATHERED_OVER_500` to `[]` or borderline-only
- [ ] `batch-loc-policy` check passes

### Step 2: Testing & Verification

- [ ] `node --test tests/cli/phase23-exit-verify.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Grandfather list empty; verify green

## Git Commit Convention

- `refactor(SP-593): empty PHASE23_GRANDFATHERED_OVER_500`

## Do NOT

- Remove LOC policy entirely
