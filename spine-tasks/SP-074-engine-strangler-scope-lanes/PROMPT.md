# Task: SP-074 — Engine strangler: scope + lane modules

**Created:** 2026-06-03
**Size:** L

## Review Level: 2 (Plan + Code)

**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 2

## Mission

Extract scope and lane execution from `engine.mjs` (1016 lines) into `engine-scope.mjs` and `engine-lanes.mjs`. No behavior change.

## Dependencies

- **Task:** SP-075

## File Scope

- `src/batch/engine.mjs`
- `src/batch/engine-scope.mjs` (new)
- `src/batch/engine-lanes.mjs` (new)
- `tests/batch/engine*.test.mjs`

## Steps

### Step 1: Extract scope module
> **Plan-review checkpoint**
- [ ] Move scope/wave helpers; `spine_review_step`

### Step 2: Extract lane module
> **Code review checkpoint**
- [ ] Move lane run wiring; target engine.mjs <700 lines; `spine_review_step`

### Step 3: Testing & Verification
- [ ] All engine tests pass; coverage ≥77%

### Step 4: Documentation & Delivery
- [ ] Module headers; log merge/phase follow-up

## Do NOT
- Change merge policy or phase FSM here

---

## Amendments (Added During Execution)
