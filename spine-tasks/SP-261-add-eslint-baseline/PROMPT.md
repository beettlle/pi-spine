# Task: SP-261 — Add ESLint baseline for pi-spine

**Created:** 2026-06-17
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Introduce ESLint with a minimal ruleset and CI script; first-time tooling addition.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Add ESLint (and optional Prettier config if low-friction) to catch issues tests miss. Ship a **baseline** config that passes on current code without mass autofix churn — warn-or-error only on new/changed patterns where possible.

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

```bash
spine settings set agents.worker.model cursor/auto
spine settings set agents.reviewer.model google/gemini-3.1-pro-preview
```

## Context to Read First

- `package.json` — existing scripts (`typecheck`, `test`)
- `tsconfig.json` — extension TypeScript scope
- `.cursor/rules/javascript-3-brutal-audit.mdc` — if present via standards

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** npm network for devDependencies

## File Scope

- `package.json`
- `package-lock.json`
- `eslint.config.js`
- `.prettierrc` (optional — create only if Prettier added)
- `scripts/lint.mjs` (optional wrapper)
- `.github/workflows/**` (only if CI workflow exists and lint step is in scope)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `eslint.config.js`, `package.json` |
| minLineCoverage | 77 |
| artifactsMustExist | `eslint.config.js` |

## Steps

### Step 0: Preflight

- [ ] Confirm no existing ESLint config in repo
- [ ] Choose flat config (`eslint.config.js`) for ESLint 9+ compatibility
- [ ] Scope: `src/`, `bin/`, `tests/`, `scripts/` — exclude `node_modules`, `.worktrees`

### Step 1: ESLint setup
> **Plan-review checkpoint**

- [ ] Add `eslint` devDependency (verify package on npm registry before pin)
- [ ] Add `npm run lint` script — runs eslint on scoped dirs
- [ ] Baseline rules: `no-unused-vars`, `no-undef`, `eqeqeq`, `no-throw-literal` — tune to pass current tree
- [ ] Optional: add `prettier` + `eslint-config-prettier` if no mass reformat required
- [ ] Call `spine_review_step` after step

### Step 2: CI and docs hook
> **Code review checkpoint**

- [ ] Wire `npm run lint` into existing CI workflow if `.github/workflows` has test job (minimal diff)
- [ ] Document `npm run lint` in operator runbook developer section (one paragraph)
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] `npm run lint` exits 0 on clean tree
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] List enabled rules in STATUS.md for future tightening
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — add `npm run lint` to dev verification commands

**Check If Affected:**
- `README.md` — contributing / verification section

## Completion Criteria

- [ ] `npm run lint` exists and passes
- [ ] No mass unrelated formatting churn in application code
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-261): complete Step N — description`
- `chore(SP-261): description`

## Do NOT

- Enable aggressive style rules that require reformatting entire repo
- Disable tests or coverage gate
- Add ESLint to `extensions/` TypeScript without verifying parser support

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-17
**Issue:** Original M packet too large for reliable pi workers.
**Resolution:** Superseded — execution moved to SP-272, SP-273.

