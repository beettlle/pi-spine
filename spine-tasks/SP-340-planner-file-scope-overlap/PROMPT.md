# Task: SP-340 — Planner file-scope overlap guard

**Created:** 2026-06-28
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Wave planner schedules parallel lanes with overlapping File Scope, causing predictable merge conflicts.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #31**: wave planner allows cross-lane file-scope overlap that causes merge failures when tasks succeed individually.

**Required behavior:**

1. Detect overlapping File Scope across lanes in same wave during `spine plan`.
2. Serialize conflicting tasks to same lane or warn with explicit overlap report.
3. Regression test: two tasks same file → single lane or plan warning.

**Closes:** [#31](https://github.com/beettlle/pi-spine/issues/31)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #31
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/planner/index.mjs`
- `src/planner/waves.mjs`
- `src/planner/file-scope.mjs`
- `tests/planner/file-scope-overlap.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/planner/file-scope-overlap.test.mjs` |
| fileScopeMustChange | `src/planner/waves.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/planner/file-scope-overlap.test.mjs` |

## Steps

### Step 0: Preflight: overlap examples from #31

- [ ] Preflight: overlap examples from #31

### Step 1: File-scope overlap detection

- [ ] File-scope overlap detection

### Step 2: Plan output warnings

- [ ] Plan output warnings

### Step 3: Tests + delivery

- [ ] Tests + delivery

### Step 4: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 5: Documentation & Delivery

- [ ] Close issue #31 (`gh issue close 31`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #31 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-340): complete Step N — description`
- `fix(SP-340): description`
- `test(SP-340): description`

## Do NOT

- Expand scope beyond issue #31 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
