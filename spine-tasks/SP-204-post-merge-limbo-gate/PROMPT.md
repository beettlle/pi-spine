# Task: SP-204 — Post-merge limbo auto-gate

**Created:** 2026-06-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Operator wedge when all lanes merged but batch phase still `running` — integrate blocked (no gate).
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

When **all tasks terminal-success** and **wave merge completed** but batch `phase` is still `running` / `endedAt` null, spine should either:

1. Auto-call `openIntegrateGateAfterBatchComplete` from reconcile/diagnose recovery path, or
2. Diagnose as `needs_integrate` with a one-shot `spine batch resume --force` that only opens gate (no re-review).

**Incident:** Batch `20260612T011148` — merges done, operator `integrate` failed (`gateStatus: missing`) until manual resume.

## Dependencies

- **Task:** SP-200

## Context to Read First

**Tier 3:**
- `src/batch/reconcile.mjs` — `deriveDiagnosis`, limbo signals
- `src/batch/gate.mjs` — `openIntegrateGateAfterBatchComplete`
- `src/batch/engine.mjs` — happy-path gate open after merge
- Batch `20260612T011148` reconcile output

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/reconcile.mjs`
- `src/batch/resume-multi.mjs`
- `tests/batch/post-merge-limbo.test.mjs` (new)
- `docs/adoption/operator-runbook.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/reconcile.mjs`, `tests/batch/post-merge-limbo.test.mjs` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Define limbo predicate: mergeResults succeeded + all tasks succeeded + phase running
- [ ] Compare with existing `limbo_stale` / `needs_integrate` diagnoses

### Step 1: Auto-gate or fast resume path

> **Plan-review checkpoint**

- [ ] Implement gate open from merge-complete limbo (reconcile hint or resume fast path)
- [ ] Ensure no duplicate `gate.opened` events

### Step 2: Testing & Verification

- [ ] Fixture batch-state JSON + reconcile/diagnose test
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Runbook § for post-merge limbo
- [ ] Create `.DONE`

## Git Commit Convention

- `feat(SP-204): complete Step N — description`
