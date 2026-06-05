# Task: SP-115 — Orphan diagnosis taxonomy (worker_orphaned)

**Created:** 2026-06-05
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Lane orphan collapses into generic needs_retry — operator UX gap.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Add `worker_orphaned` diagnosis kind distinct from `needs_retry`. Enrich headlines from worker output log when no task.failed journal (FR-STALL-01 artifact).

**Source:** SP-106 Findings #2, #11 (MEDIUM).

## Dependencies

- **Task:** SP-111 (PID-less orphan detect landed first)

## File Scope

- `src/batch/diagnosis.mjs`
- `src/batch/reconcile.mjs`
- `tests/batch/diagnosis-orphan-taxonomy.test.mjs` (new)

## Steps

### Step 1: Taxonomy
- [ ] Add worker_orphaned to DIAGNOSIS_TAXONOMY
- [ ] Map lane orphan in deriveDiagnosis
- [ ] buildSuggestedCommand prefers abort when ghost running cluster

### Step 2: Headline enrichment
- [ ] Inspect worker output log tail when launching-phase orphan

### Step 3: Testing & Verification
- [ ] FULL suite + coverage gate

## Completion Criteria
- [ ] Orphan lane diagnosis ≠ needs_retry
- [ ] Dashboard/diagnose shows distinct kind

## Git Commit Convention
- `feat(SP-115): worker_orphaned diagnosis taxonomy`

## Do NOT
- Break existing needs_retry for segment drift

---

## Amendments (Added During Execution)
