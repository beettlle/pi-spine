# Task: SP-236 — Journal export markdown timeline

**Created:** 2026-06-12
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Markdown timeline format for incident reports.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-236-journal-export-markdown/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-08 (phase 2): Add `--format markdown` to journal export with human-readable timeline output. Document in runbook/README.

## Dependencies

- **Task:** SP-235

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `spine-tasks/CONTEXT.md`
- `bin/spine-journal.mjs`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-08

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-journal.mjs`
- `tests/batch/journal-export-markdown.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | bin/spine-journal.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/journal-export-markdown.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Draft markdown timeline output shape
- [ ] Review SP-235 jsonl export plumbing

### Step 1: Markdown export
> **Plan-review checkpoint**

- [ ] Implement markdown timeline formatter
- [ ] Regression test for markdown output shape
- [ ] Runbook feature summary
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% (when code changed)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Markdown journal export works
- [ ] Documented in runbook
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-236): complete Step N — description`
- `fix(SP-236): description`
- `test(SP-236): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)
