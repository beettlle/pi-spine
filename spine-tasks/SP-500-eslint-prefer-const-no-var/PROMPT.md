# Task: SP-500 — Expand ESLint baseline rules

**Created:** 2026-07-05
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Add three standard ESLint rules and fix violations across many files. Mechanical fixes with wide file touch but low per-change risk; fully reversible.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-500-eslint-prefer-const-no-var/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Expand the ESLint baseline in `eslint.config.js` beyond the current four rules by enabling `prefer-const`, `no-var`, and `no-async-promise-executor`, then fix all resulting violations in scoped source, bin, and test files.

**Closes:** [#179](https://github.com/beettlle/pi-spine/issues/179)

## Dependencies

- **None**

## Context to Read First

**Tier 3 (load only if needed):**
- `eslint.config.js` — current flat config and scoped file globs
- `package.json` — lint script with `--max-warnings 0`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `eslint.config.js`
- `src/**/*.mjs`
- `bin/**/*.mjs`
- `tests/**/*.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run coverage:check` |
| fileScopeMustChange | `eslint.config.js` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Run `npm run lint` and confirm current baseline passes
- [ ] Temporarily enable one new rule locally to estimate violation count per rule
- [ ] Dependencies satisfied

### Step 1: Add ESLint rules

- [ ] Add `prefer-const: "error"`, `no-var: "error"`, and `no-async-promise-executor: "error"` to `eslint.config.js`
- [ ] Confirm rules apply only to scoped dirs (`src/`, `bin/`, `tests/`, `scripts/`)
- [ ] Run `npm run lint` and capture full violation list

**Artifacts:**
- `eslint.config.js` (modified)

### Step 2: Fix prefer-const violations

- [ ] Change `let` to `const` where bindings are never reassigned
- [ ] Refactor reassigned bindings only when necessary (avoid behavior changes)
- [ ] Run lint after batch: `npm run lint`

**Artifacts:**
- Multiple `src/`, `bin/`, `tests/` files (modified)

### Step 3: Fix no-var and no-async-promise-executor violations

- [ ] Replace `var` with `let` or `const` as appropriate
- [ ] Refactor async Promise executors to synchronous executors with async IIFE or named async functions
- [ ] Run lint: `npm run lint` — 0 errors, 0 warnings

**Artifacts:**
- Multiple `src/`, `bin/`, `tests/` files (modified)

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Run lint: `npm run lint` — 0 warnings, 0 errors
- [ ] Fix all failures
- [ ] Build passes

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #179: `gh issue close 179 --comment "ESLint prefer-const, no-var, no-async-promise-executor enabled — SP-500"`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `CONTRIBUTING.md` — mention expanded ESLint baseline if present
- `spine-tasks/CONTEXT.md` — log rule additions if discoveries warrant

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `npm run lint` produces 0 warnings and 0 errors with three new rules enabled
- [ ] No functional behavior changed (lint-driven refactors only)

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-500): complete Step N — description`
- **Bug fixes:** `fix(SP-500): description`
- **Tests:** `test(SP-500): description`
- **Hydration:** `hydrate: SP-500 expand Step N checkboxes`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Change runtime behavior beyond lint-required refactors
- Disable new rules instead of fixing violations

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
