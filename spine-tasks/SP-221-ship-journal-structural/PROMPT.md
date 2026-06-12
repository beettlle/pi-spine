# Task: SP-221 — Journal structural rebuild (core)

**Created:** 2026-06-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Extend rebuildBatchStateFromJournal without cache seed for structural fields.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-221-ship-journal-structural/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-10 (phase 1): Extend `rebuildBatchStateFromJournal()` to derive structural batch fields without cache seed per PRD §11.4 v2.2. Incident fixture regression tests and Babysitter limitations doc are **SP-240**.

## Dependencies

- **Task:** SP-220

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `src/batch/journal-rebuild.mjs`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-10

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/journal-rebuild.mjs`
- `src/batch/journal.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/journal-rebuild.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read PRD §11.4 v2.2 structural fields list
- [ ] Review SP-174 rebuild core

### Step 1: Structural rebuild
> **Plan-review checkpoint**

- [ ] Implement cache-seed-free structural derivation
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Structural rebuild without cache seed where specified
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-221): complete Step N — description`
- `fix(SP-221): description`
- `test(SP-221): description`

## Do NOT

- Add incident fixture tests (SP-240)
- If scope exceeds M, record v2.3 deferral in CONTEXT — do not XL this packet

---

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-12
**Issue:** Original M packet bundled core rebuild, fixtures, and limitations doc.
**Resolution:** Fixtures + limitations moved to SP-240; SP-221 is core implementation only.
