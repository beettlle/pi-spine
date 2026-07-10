# Task: SP-601 — Extract lane-dirty-check commit paths

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Second half of lane-dirty-check.mjs bisection — thin shim ≤500 LOC.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Move gitignored sanitization + `resolvePostLaneCommitPorcelain` + lane commit validation remainder. Thin `lane-dirty-check.mjs` ≤500 LOC.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-583

## File Scope

- `src/batch/lane-dirty-check.mjs`
- `src/batch/lane-dirty-check-git.mjs`
- `tests/batch/gitignored-auto-clean.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/gitignored-auto-clean.test.mjs` |
| fileScopeMustChange | `src/batch/lane-dirty-check.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-583 complete

### Step 1: Complete split

- [ ] Move remainder; thin `lane-dirty-check.mjs` ≤500 LOC
- [ ] Preserve all public exports via re-export

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/gitignored-auto-clean.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `lane-dirty-check.mjs` ≤500 LOC; API unchanged

## Git Commit Convention

- `refactor(SP-601): complete lane-dirty-check.mjs split`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
