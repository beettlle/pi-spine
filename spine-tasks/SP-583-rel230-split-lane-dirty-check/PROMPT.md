# Task: SP-583 — Extract lane-dirty-check-git.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** First half of lane-dirty-check.mjs bisection per FR-SHIP-02.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `lane-dirty-check-git.mjs` — porcelain parsing, symlink drift, path-in-scope helpers. Leave gitignored remediation + `resolvePostLaneCommitPorcelain` for SP-601.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-577
- **Task:** SP-599 (wave gate — batch prior second halves landed)

## File Scope

- `src/batch/lane-dirty-check.mjs`
- `src/batch/lane-dirty-check-git.mjs`
- `tests/batch/gitignored-auto-clean.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/gitignored-auto-clean.test.mjs` |
| fileScopeMustChange | `src/batch/lane-dirty-check-git.mjs`, `src/batch/lane-dirty-check.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for lane-dirty-check.mjs
- [ ] List public exports to preserve

### Step 1: Extract lane-dirty-check-git.mjs

- [ ] Create module ≤500 LOC
- [ ] Re-export from lane-dirty-check.mjs

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/gitignored-auto-clean.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] First-half extract complete; second half deferred to paired task

## Git Commit Convention

- `refactor(SP-583): extract lane-dirty-check-git.mjs`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
- Change runtime behavior
