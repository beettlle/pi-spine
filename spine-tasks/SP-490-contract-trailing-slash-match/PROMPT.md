# Task: SP-490 — Contract trailing-slash match

**Created:** 2026-07-03
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Single-module fix in the contract verifier. Requires understanding of `fileScopeMustChange` matching logic and test coverage for the new behavior.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-490-contract-trailing-slash-match/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Fix the contract verifier so that a `fileScopeMustChange` value ending in `/` (e.g., `src/domain/types/`) matches any changed file under that directory prefix. Currently the verifier does not match files inside the directory — only exact file paths or proper globs work. When a `fileScopeMustChange` value ends with `/`, treat it as a prefix match against all changed file paths (i.e., `changedPaths.some(p => p.startsWith(pattern))`).

**Closes:** [#118](https://github.com/beettlle/pi-spine/issues/118)

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `spine-tasks/CONTEXT.md`

**Tier 3 (load only if needed):**
- `src/batch/contract-verify.mjs` — contract verification logic

## Environment

- **Workspace:** `src/batch/`
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `tests/batch/contract-verify.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm test -- tests/batch/contract-verify.test.mjs tests/batch/contract-verify-scoped.test.mjs` |
| fileScopeMustChange | `src/batch/contract-verify.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Read `src/batch/contract-verify.mjs` to understand current `fileScopeMustChange` matching logic
- [ ] Dependencies satisfied

### Step 1: Fix trailing-slash prefix matching

- [ ] In `src/batch/contract-verify.mjs`, locate the `fileScopeMustChange` verification logic
- [ ] When a pattern ends with `/`, treat it as a directory prefix: match any changed path that starts with the pattern value
- [ ] When a pattern does not end with `/`, preserve existing behavior (exact match or glob)
- [ ] Run targeted tests: `npm test -- tests/batch/contract-verify.test.mjs`

**Artifacts:**
- `src/batch/contract-verify.mjs` (modified)

### Step 2: Add test coverage

- [ ] Add test case: `fileScopeMustChange: "src/domain/types/"` matches when files under `src/domain/types/` are changed
- [ ] Add test case: `fileScopeMustChange: "src/domain/types/"` fails when no files under that prefix are changed
- [ ] Add test case: existing exact-path and glob behavior is preserved (regression)
- [ ] Run targeted tests: `npm test -- tests/batch/contract-verify.test.mjs`

**Artifacts:**
- `tests/batch/contract-verify.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #118: `gh issue close 118 --comment "Trailing-slash prefix matching added — SP-490"`

## Documentation Requirements

**Must Update:**
- None (behavior fix; contract template already shows directory patterns)

**Check If Affected:**
- `skills/create-spine-tasks/references/contract-template.md` — mention trailing-slash behavior if not already clear

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `fileScopeMustChange: "src/dir/"` matches files under `src/dir/`
- [ ] Existing exact-path and glob matching unchanged

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `fix(SP-490): complete Step N — description`
- **Bug fixes:** `fix(SP-490): description`
- **Tests:** `test(SP-490): description`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Change `fileScopeMustNotChange` behavior (only fix `fileScopeMustChange`)

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
