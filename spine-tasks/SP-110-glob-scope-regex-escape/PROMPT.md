# Task: SP-110 — Fix glob scope regex escape bug

**Created:** 2026-06-05
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** One-line bug in escapeRegexChar emits literal `${ch}`. High impact for dotted paths, trivial fix.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Fix `escapeRegexChar` in `src/planner/scope.mjs` to properly escape regex metacharacters. Add regression tests for scopes with `.`, `(`, `)`, `+`.

**Source:** SP-107 audit Finding #2 (HIGH).

## Dependencies

- **None**

## File Scope

- `src/planner/scope.mjs`
- `tests/planner/scope-glob-escape.test.mjs` (new)

## Steps

### Step 1: Fix and test
- [ ] Replace broken template literal with `\\` + ch escape
- [ ] Tests: `src/foo.bar/**`, `docs/(api)/**`, existing `TP-*` scopes unchanged
- [ ] Call `spine_review_step` (plan)

### Step 2: Testing & Verification
- [ ] FULL suite + coverage gate

## Completion Criteria
- [ ] escapeRegexChar verified by unit tests
- [ ] No lane affinity regressions

## Git Commit Convention
- `fix(SP-110): glob scope regex escape in planner`

## Do NOT
- Change lane packing algorithm beyond escape fix

---

## Amendments (Added During Execution)
