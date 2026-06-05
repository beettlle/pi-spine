# Task: SP-122 — Preflight plan validates pending scope only

**Created:** 2026-06-05
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** SP-109 fail-loud validation breaks `spine preflight` plan check (68 legacy PROMPT errors) blocking all new batches.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Preflight `plan` check should validate **pending** tasks (or explicit batch scope), not entire 100+ task backlog with historical invalid PROMPTs. Restore preflight pass while keeping fail-loud validation for `spine plan <ids>` and batch start.

**Source:** Post SP-109 land — `spine preflight` fails; requires `--skip-preflight` for batch start.

## Dependencies

- **None**

## File Scope

- `bin/spine-preflight.mjs`
- `src/planner/index.mjs`
- `tests/cli/spine-preflight.test.mjs`

## Steps

### Step 1: Scope preflight plan validation
- [ ] Preflight uses `spine plan pending` or equivalent, not `all`
- [ ] Invalid historical done tasks do not fail preflight

### Step 2: Testing & Verification
- [ ] FULL suite + coverage gate

### Step 3: Documentation & Delivery
- [ ] `.DONE`

## Completion Criteria
- [ ] `spine preflight` passes on pi-spine dogfood repo after SP-109

## Git Commit Convention
- `fix(SP-122): preflight plan validates pending scope only`

## Do NOT
- Weaken batch engine fail-loud validation

---

## Amendments (Added During Execution)
