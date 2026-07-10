# Task: SP-584 — Extract journal-rebuild-structural.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** First half of journal-rebuild.mjs bisection per FR-SHIP-02.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `journal-rebuild-structural.mjs` — `rebuildBatchStateFromJournal` structural derivation. Leave drift reconcile for SP-602.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-577
- **Task:** SP-599 (wave gate — batch prior second halves landed)

## File Scope

- `src/batch/journal-rebuild.mjs`
- `src/batch/journal-rebuild-structural.mjs`
- `tests/batch/reconcile-done-inlane-terminal.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/reconcile-done-inlane-terminal.test.mjs` |
| fileScopeMustChange | `src/batch/journal-rebuild-structural.mjs`, `src/batch/journal-rebuild.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for journal-rebuild.mjs
- [ ] List public exports to preserve

### Step 1: Extract journal-rebuild-structural.mjs

- [ ] Create module ≤500 LOC
- [ ] Re-export from journal-rebuild.mjs

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/reconcile-done-inlane-terminal.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] First-half extract complete; second half deferred to paired task

## Git Commit Convention

- `refactor(SP-584): extract journal-rebuild-structural.mjs`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
- Change runtime behavior
