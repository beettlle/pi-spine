# Task: SP-235 — Journal export jsonl CLI

**Created:** 2026-06-12
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** jsonl export subcommand and missing-journal exit code.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-235-journal-export-jsonl/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-08 (phase 1): Add `spine journal export --batch <batchId> --format jsonl [--output path]`. Read `.spine/runtime/<batchId>/journal/events.jsonl`. Exit non-zero when journal missing.

## Dependencies

- **Task:** SP-214

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `spine-tasks/CONTEXT.md`
- `bin/spine-journal.mjs`
- `src/batch/journal.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-journal.mjs`
- `src/batch/journal.mjs`
- `tests/batch/journal-export-jsonl.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | bin/spine-journal.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/journal-export-jsonl.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Review journal event schema
- [ ] Draft jsonl export CLI flags

### Step 1: Jsonl export
> **Plan-review checkpoint**

- [ ] Add export subcommand with jsonl format
- [ ] Exit non-zero when journal missing
- [ ] Unit test jsonl output
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% (when code changed)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] jsonl journal export works
- [ ] Regression test passes
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-235): complete Step N — description`
- `fix(SP-235): description`
- `test(SP-235): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)
