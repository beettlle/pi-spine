# Task: SP-497 — DRY SIZE_LINE_RE parser

**Created:** 2026-07-05
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Mechanical DRY refactor extracting a duplicated regex and parser into one module. Three call sites with identical behavior; low novelty and fully reversible.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-497-dry-size-line-parser/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

The `SIZE_LINE_RE` regex and size-line parsing logic are duplicated in `parse-prompt.mjs`, `task-packet-size.mjs`, and `task-stall-budget.mjs`. Extract a shared constant and parser to `src/tasks/packet/size-line.mjs` and update all consumers to import from the single source of truth.

**Closes:** [#182](https://github.com/beettlle/pi-spine/issues/182)

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `spine-tasks/CONTEXT.md`

**Tier 3 (load only if needed):**
- `src/tasks/packet/parse-prompt.mjs` — primary consumer of size parsing
- `src/doctor/task-packet-size.mjs` — doctor size warnings
- `src/batch/task-stall-budget.mjs` — stall timeout by size

## Environment

- **Workspace:** `src/tasks/packet/`
- **Services required:** None

## File Scope

- `src/tasks/packet/size-line.mjs`
- `src/tasks/packet/parse-prompt.mjs`
- `src/doctor/task-packet-size.mjs`
- `src/batch/task-stall-budget.mjs`
- `tests/doctor/task-packet-size.test.mjs`
- `tests/batch/task-stall-budget.test.mjs`
- `tests/tasks/contract-parse.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/doctor/task-packet-size.test.mjs tests/batch/task-stall-budget.test.mjs tests/tasks/contract-parse.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `src/tasks/packet/size-line.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Confirm identical `SIZE_LINE_RE` in all three consumer modules
- [ ] Dependencies satisfied

### Step 1: Create shared size-line module

- [ ] Add `src/tasks/packet/size-line.mjs` exporting `SIZE_LINE_RE` and `parseSizeLineFromMarkdown(markdown)` (or equivalent shared API)
- [ ] Preserve existing return shape: `"S"|"M"|"L"|"XL"|null` with uppercase normalization
- [ ] Run targeted tests: `npm test -- tests/tasks/contract-parse.test.mjs`

**Artifacts:**
- `src/tasks/packet/size-line.mjs` (new)

### Step 2: Refactor consumers

- [ ] Replace local `SIZE_LINE_RE` in `parse-prompt.mjs` with import from `size-line.mjs`
- [ ] Replace local regex/parser in `task-packet-size.mjs` with shared import
- [ ] Replace local regex/parser in `task-stall-budget.mjs` with shared import (keep `parseTaskSizeFromMarkdown` as thin wrapper if needed for public API stability)
- [ ] Run targeted tests: `npm test -- tests/doctor/task-packet-size.test.mjs tests/batch/task-stall-budget.test.mjs`

**Artifacts:**
- `src/tasks/packet/parse-prompt.mjs` (modified)
- `src/doctor/task-packet-size.mjs` (modified)
- `src/batch/task-stall-budget.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #182: `gh issue close 182 --comment "Shared SIZE_LINE_RE parser extracted — SP-497"`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — log DRY refactor if discoveries warrant

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Single `SIZE_LINE_RE` definition in `src/tasks/packet/size-line.mjs`
- [ ] All three consumers import shared module; no duplicate regex literals remain

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `refactor(SP-497): complete Step N — description`
- **Bug fixes:** `fix(SP-497): description`
- **Tests:** `test(SP-497): description`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Change size parsing semantics (refactor only)

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
