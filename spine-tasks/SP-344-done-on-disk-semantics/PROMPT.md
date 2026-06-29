# Task: SP-344 — doneOnDisk semantics alignment

**Created:** 2026-06-28
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** `doneOnDisk: false` contradicts `doneFileFound: true` on succeeded tasks mid-batch.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #35**: align `doneOnDisk` and `doneFileFound` semantics — clarify lane worktree vs main checkout or rename fields.

**Required behavior:**

1. Make `doneOnDisk` and `doneFileFound` consistent or document distinction in JSON output.
2. Prefer explicit names (`doneInLane`, `doneOnMain`) if semantics differ.
3. Regression test in status-json suite.

**Closes:** [#35](https://github.com/beettlle/pi-spine/issues/35)

## Dependencies

- **Task:** SP-338

## Context to Read First

- GitHub issue #35
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/diagnosis.mjs`
- `src/batch/status-json.mjs`
- `tests/batch/status-json-progress.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/status-json-progress.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/status-json-progress.test.mjs` |

## Steps

### Step 0: Preflight: SP-136 mid-batch JSON example

- [ ] Preflight: SP-136 mid-batch JSON example

### Step 1: Align done flags

- [ ] Align done flags

### Step 2: Tests + delivery

- [ ] Tests + delivery

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #35 (`gh issue close 35`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #35 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-344): complete Step N — description`
- `fix(SP-344): description`
- `test(SP-344): description`

## Do NOT

- Expand scope beyond issue #35 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
