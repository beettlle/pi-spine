# Task: SP-486 — Eliminate 74 lint warnings and enforce zero-warnings policy

**Created:** 2026-07-03
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Bulk removal of unused imports/variables/params across many files; low novelty (existing patterns), no security surface, fully reversible. Wide blast radius due to file count but each change is mechanical.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-486-lint-zero-warnings/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

CI produces 74 ESLint `no-unused-vars` warnings that clutter GitHub annotations. All 74 are `no-unused-vars` violations: unused imports (~15), unused exported functions (~30), unused local variables (~20), and unused function params (~9).

Fix all warnings and add `--max-warnings 0` to the lint script in `package.json` so future warnings fail the build, enforcing the zero-warnings policy from `critical-rules-quick-reference.mdc` section 11.

**Closes:** [#137](https://github.com/beettlle/pi-spine/issues/137)

## Dependencies

- **None**

## Context to Read First

**Tier 3 (load only if needed):**
- `.eslintrc.cjs` or `eslint.config.*` — current ESLint configuration

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/*.mjs`
- `src/**/*.mjs`
- `tests/**/*.mjs`
- `package.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Run `npm run lint` locally and capture the full list of warnings
- [ ] Categorize warnings: unused imports, unused exports, unused locals, unused params
- [ ] Identify which files have multiple warnings

### Step 1: Fix unused imports and local variables

- [ ] Remove unused `import` statements (e.g., `path`, `fs`, `os` imports not used)
- [ ] Remove or use unused local variables (e.g., `levelLabel`, `folder`, `stallConfig`)
- [ ] For variables that are destructured but unused, remove them from the destructuring
- [ ] Run lint after each batch of files: `npm run lint`

**Artifacts:**
- Multiple `bin/*.mjs` and `src/**/*.mjs` files (modified)

### Step 2: Fix unused function params and exports

- [ ] Prefix unused callback/handler params with `_` (e.g., `_folderPath`, `_force`, `_ctx`)
- [ ] For truly dead exported functions, determine if they are planned for future use
- [ ] Delete dead exports that have no callers and no planned use
- [ ] For exports planned for future use, prefix with `_` or add `// eslint-disable-next-line no-unused-vars` with a ticket reference
- [ ] Run lint: `npm run lint`

**Artifacts:**
- Multiple `src/**/*.mjs` and `tests/**/*.mjs` files (modified)

### Step 3: Enforce --max-warnings 0

- [ ] Update `package.json` lint script to include `--max-warnings 0`
- [ ] Verify `npm run lint` now exits non-zero on any warning
- [ ] Verify CI workflow uses `npm run lint` (check `.github/workflows/ci.yml`)

**Artifacts:**
- `package.json` (modified)

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Run lint: `npm run lint` — 0 warnings, 0 errors
- [ ] Fix all failures
- [ ] Build passes

### Step 5: Documentation & Delivery

- [ ] Note zero-warnings policy enforcement in CONTEXT.md discoveries
- [ ] "Check If Affected" docs reviewed

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `CONTRIBUTING.md` — mention --max-warnings 0 enforcement if present

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `npm run lint` produces 0 warnings and 0 errors
- [ ] `--max-warnings 0` enforced in package.json lint script
- [ ] No functional behavior changed (only dead code removal and param renames)
- [ ] Documentation updated

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-486): complete Step N — description`
- **Bug fixes:** `fix(SP-486): description`
- **Tests:** `test(SP-486): description`
- **Hydration:** `hydrate: SP-486 expand Step N checkboxes`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Change any runtime behavior — only remove dead code and rename unused params

---

## Amendments (Added During Execution)
