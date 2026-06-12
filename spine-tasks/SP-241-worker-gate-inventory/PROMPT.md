# Task: SP-241 — Worker manual gate inventory

**Created:** 2026-06-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Inventory supported gate kinds and decide implement vs document not_supported.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-241-worker-gate-inventory/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-13 (phase 1): Inventory supported vs not_supported manual gate kinds in `spine_request_gate`. Record decision for SP-224 (implement minimal kinds or document permanent limitation).

## Dependencies

- **Task:** SP-220

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `src/worker-tools/request-gate.mjs`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-13

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/design/**`
- `spine-tasks/SP-224-ship-worker-gate-story/PROMPT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read worker tool registration
- [ ] List gate kinds referenced in PRD/runbook

### Step 1: Inventory and decision
> **Plan-review checkpoint**

- [ ] Document supported vs not_supported kinds
- [ ] Record implement vs document decision in SP-224 PROMPT amendments or design note

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Gate inventory complete with clear decision for SP-224
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-241): complete Step N — description`
- `fix(SP-241): description`
- `test(SP-241): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)
