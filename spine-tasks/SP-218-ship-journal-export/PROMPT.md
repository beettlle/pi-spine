# Task: SP-218 — Journal export CLI

**Created:** 2026-06-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** New CLI subcommand reading batch journal; markdown/jsonl output.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-218-ship-journal-export/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-08: Implement `spine journal export --batch <batchId> [--format markdown|jsonl] [--output path]`. Reads `.spine/runtime/<batchId>/journal/events.jsonl`. Markdown timeline for incident reports. Exit non-zero when journal missing.

## Dependencies

- **Task:** SP-214

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `bin/spine-journal.mjs`
- `src/batch/journal.mjs`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-08

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-journal.mjs`
- `src/batch/journal.mjs`
- `tests/batch/journal-export.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `bin/spine-journal.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/journal-export.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Review journal event schema
- [ ] Draft markdown output shape

### Step 1: Implement export
> **Plan-review checkpoint**

- [ ] Add export subcommand with markdown and jsonl formats
- [ ] Discover active batch when --batch omitted (if specified in PRD)
- [ ] Regression test for markdown output shape
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Runbook and README feature summary
- [ ] Create `.DONE`

## Completion Criteria

- [ ] journal export CLI works
- [ ] Regression test covers markdown shape
- [ ] Documented in runbook
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-218): complete Step N — description`
- `fix(SP-218): description`
- `test(SP-218): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-12
**Issue:** Size decomposition split journal export into two S tasks.
**Resolution:** Superseded — execution moved to SP-235 (jsonl) and SP-236 (markdown). This packet closed administratively.
