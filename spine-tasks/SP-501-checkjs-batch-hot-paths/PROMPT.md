# Task: SP-501 — Enable checkJs on batch hot paths

**Created:** 2026-07-05
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Flip `checkJs` on in `tsconfig.batch.json` and resolve tsc errors in four scoped batch modules with minimal JSDoc; replace `@type {any}` casts on batch-state in those files. Extends partial SP-275 delivery.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Canonical Task Folder

```
spine-tasks/SP-501-checkjs-batch-hot-paths/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Enable `checkJs: true` in `tsconfig.batch.json` for the batch hot-path slice (engine, worker-host, worktree, spine-config-load). Fix all resulting `tsc` errors with minimal JSDoc — no runtime behavior changes. Replace `@type {any}` casts on batch-state reads/writes in those modules with proper typedefs or narrow casts. Extend `tests/config/typecheck-batch.test.mjs` to assert `checkJs: true` in config.

**Closes:** [#178](https://github.com/beettlle/pi-spine/issues/178) (supersedes partial SP-275 — `checkJs: false` still in `tsconfig.batch.json`)

## Dependencies

- **Task:** SP-500 (ESLint baseline must land before batch hot-path typecheck work)

## Context to Read First

**Tier 2 (area context):**
- `spine-tasks/CONTEXT.md`

**Tier 3 (load only if needed):**
- `tsconfig.batch.json` — current batch typecheck scope
- `spine-tasks/SP-275-batch-jsdoc-typecheck/PROMPT.md` — prior per-file `@ts-check` slice

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tsconfig.batch.json`
- `src/batch/engine.mjs`
- `src/batch/worker-host.mjs`
- `src/batch/worktree.mjs`
- `src/config/spine-config-load.mjs`
- `tests/config/typecheck-batch.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && npm test -- tests/config/typecheck-batch.test.mjs` |
| fileScopeMustChange | `tsconfig.batch.json`, `tests/config/typecheck-batch.test.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Run `npm run typecheck` and note current baseline (batch pass with `checkJs: false`)
- [ ] Dependencies satisfied

### Step 1: Enable checkJs and fix tsc errors

- [ ] Set `checkJs: true` in `tsconfig.batch.json` (keep existing `include` list)
- [ ] Resolve all `tsc` errors in `engine.mjs`, `worker-host.mjs`, `worktree.mjs`, `spine-config-load.mjs` with minimal `@param`/`@returns`/typedef JSDoc only where required
- [ ] Replace `@type {any}` casts on batch-state access in those four modules with proper types or narrow casts (no new runtime logic)
- [ ] Run targeted check: `npm run typecheck`

**Artifacts:**
- `tsconfig.batch.json` (modified)
- `src/batch/engine.mjs`, `src/batch/worker-host.mjs`, `src/batch/worktree.mjs`, `src/config/spine-config-load.mjs` (modified)

### Step 2: Extend typecheck-batch regression test

- [ ] Assert `tsconfig.batch.json` has `compilerOptions.checkJs === true`
- [ ] Keep existing hot-path include and `// @ts-check` per-file assertions
- [ ] Run targeted tests: `npm test -- tests/config/typecheck-batch.test.mjs`

**Artifacts:**
- `tests/config/typecheck-batch.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #178: `gh issue close 178 --comment "checkJs enabled on batch hot paths — SP-501"`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — one-line note on batch checkJs scope if not already documented

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `npm run typecheck` passes with `checkJs: true`
- [ ] No `@type {any}` on batch-state in the four hot-path modules
- [ ] `typecheck-batch.test.mjs` asserts `checkJs: true`

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-501): complete Step N — description`
- **Bug fixes:** `fix(SP-501): description`
- **Tests:** `test(SP-501): description`

## Do NOT

- Expand checkJs scope beyond the four listed hot-path modules
- Change runtime behavior — JSDoc/types only
- Type entire `review.mjs` or other batch god-files in this slice
- Skip tests
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
