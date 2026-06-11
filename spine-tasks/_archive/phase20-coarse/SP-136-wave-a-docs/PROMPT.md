# Task: SP-136 — Wave A doc completion

**Created:** 2026-06-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only delta checklist; no src changes.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-136-wave-a-docs/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Finalize Wave A adoption docs (upstream workflow, README, bootstrap cross-links) per FR-UXB-01 delta checklist.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **None**

## Context to Read First

**Tier 3:**
- `docs/adoption/upstream-execution-workflow.md`
- `docs/PRD-v2.0-implementation-handoff.md`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/upstream-execution-workflow.md`
- `docs/adoption/bootstrap-checklist.md`
- `README.md`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (none)

### Step 1: Verify decision tree and spine-native command sequence

- [ ] Verify decision tree and spine-native command sequence

### Step 2: README Documentation table links workflow doc

- [ ] README Documentation table links workflow doc

### Step 3: Explicit: pi-spine does not invoke zero-pi

- [ ] Explicit: pi-spine does not invoke zero-pi

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Update: docs/adoption/upstream-execution-workflow.md
- [ ] Update: docs/adoption/bootstrap-checklist.md
- [ ] Update: README.md
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- `docs/adoption/upstream-execution-workflow.md`
- `docs/adoption/bootstrap-checklist.md`
- `README.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-136

## Git Commit Convention

- `feat(SP-136): complete Step N — description`
- `fix(SP-136): description`

## Do NOT

- Re-specify finished prose — delta only

---

## Amendments (Added During Execution)
