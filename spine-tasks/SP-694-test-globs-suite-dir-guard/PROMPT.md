# Task: SP-694 — Guard TEST_GLOBS covers every tests suite directory

**Created:** 2026-08-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Add discovery guard so new `tests/<dir>/*.test.mjs` suites cannot be omitted from both TEST_GLOBS and package.json test.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #246 — Bidirectional parity already requires `TEST_GLOBS` to match `package.json` test globs exactly, but it does **not** discover new directories under `tests/` that are missing from both lists (the v2.12.1 metrics suite gap). Add a guard that fails when a non-empty `tests/<dir>/` containing `*.test.mjs` is absent from `TEST_GLOBS` (allow-list for intentional exclusions if any). Document the allow-list mechanism briefly. Cross-link post-mortem §F5 is optional (read-only) if the test comment cites #246.

## Dependencies

- **None**

## Context to Read First

- `scripts/coverage-policy.mjs` — `TEST_GLOBS`
- `tests/coverage/policy.test.mjs` — existing parity tests
- `package.json` — `scripts.test`
- GitHub #246
- `docs/release/post-mortem-v2.12.1.md` — §F5 (read-only)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `scripts/coverage-policy.mjs`
- `tests/coverage/policy.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/coverage/policy.test.mjs` |
| fileScopeMustChange | `scripts/coverage-policy.mjs`, `tests/coverage/policy.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm bidirectional parity test exists but does not scan suite directories
- [ ] List current `tests/*/` dirs that contain `*.test.mjs` and map to `TEST_GLOBS`

### Step 1: Suite-directory discovery guard

- [ ] Add allow-list constant (empty or documented exclusions) in `coverage-policy.mjs` if needed
- [ ] Add test(s) in `policy.test.mjs` that fail when a non-empty suite dir under `tests/` with `*.test.mjs` is missing from `TEST_GLOBS` (and therefore from package.json via existing parity)
- [ ] Document allow-list usage in a short comment above the constant/test
- [ ] Do not break existing metrics / bidirectional parity tests

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- _(none — comment/docstring in coverage-policy or policy.test is sufficient)_

**Check If Affected:**
- `docs/release/post-mortem-v2.12.1.md` — §F5 already tracks #246

## Completion Criteria

- [ ] New suite directories under `tests/` cannot be omitted from TEST_GLOBS without a failing test
- [ ] Allow-list mechanism documented if used
- [ ] Existing parity tests still pass

## Do NOT

- Remove or weaken bidirectional TEST_GLOBS ↔ package.json parity
- Add broad `tests/**/*.test.mjs` without understanding coverage tooling implications unless that is the chosen allow-listed approach
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `test(SP-694): guard TEST_GLOBS covers every suite directory (#246)`
