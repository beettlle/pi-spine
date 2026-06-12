# Task: SP-228 — Attached batch land-loop completion

**Created:** 2026-06-12
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Attached `--attached` batches merge successfully but foreground engine does not finish gate open + terminal phase; operator must run `spine batch resume` (SP-204 partial fix).
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Ensure **`spine batch start … --attached`** (and attached resume) completes the full land loop before returning:

`batch merge completed` → `gate.opened` → (operator `gate approve` + `integrate` unchanged) → batch reaches terminal `completed` phase in attached waiter.

**Incidents (SP-205–225 stress test):**
- Batch `20260612T195913` (SP-210): attached CLI blocked >15m; journal shows `batch.merge_completed` but no `gate.opened`; diagnose `needs_integrate` / "merged but gate not opened — resume to complete land loop"; manual `spine batch resume` fixed it.
- Same post-merge limbo pattern after Waves 0–2 stub batches (operator recovered via gate approve + integrate + batch complete).

**Required behavior:**
1. After final wave merge in **attached foreground engine**, invoke the same finalize path as SP-204 resume (`finalizeResumedBatchForIntegrate` / `openIntegrateGateAfterBatchComplete`) without requiring a second CLI invocation.
2. Attached waiter must not exit success until batch phase is terminal (`completed`) **or** gate is opened and batch is in integratable limbo with explicit diagnose output (pick one policy; prefer full terminal `completed` matching detached `--wait-terminal`).
3. Idempotent: no duplicate `gate.opened` events if gate already exists.
4. Regression: stub attached single-task batch returns after gate open without manual `batch resume`.

## Dependencies

- **Task:** SP-204
- **Task:** SP-200

## Context to Read First

**Tier 3:**
- `src/batch/engine.mjs` — post-merge happy path
- `src/batch/resume-multi.mjs` — `finalizeResumedBatchForIntegrate`
- `src/batch/gate.mjs` — `openIntegrateGateAfterBatchComplete`
- `src/batch/detached-start.mjs` — attached vs detached waiter semantics
- `bin/spine-batch.mjs` — `--attached` argv wiring
- Batch `20260612T195913` journal (`batch.merge_completed` without subsequent gate in attached window)
- `tests/batch/post-merge-limbo.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine.mjs`
- `src/batch/resume-multi.mjs` (extract shared finalize helper if needed)
- `src/batch/detached-start.mjs` (attached wait path only if required)
- `tests/batch/attached-land-loop.test.mjs` (new)
- `docs/adoption/operator-runbook.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/engine.mjs`, `tests/batch/attached-land-loop.test.mjs` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Trace attached engine exit conditions after `batch.merge_completed`
- [ ] Compare with detached `--wait-terminal` gate-wait behavior

### Step 1: Attached finalize after merge

> **Plan-review checkpoint**

- [ ] Wire post-merge finalize into attached foreground path
- [ ] Share one helper with SP-204 resume fast path (no divergent gate logic)

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Stub attached batch: merge → gate.opened → batch.completed without manual resume
- [ ] Assert attached CLI exit code 0 and suggested next step is `gate approve` / `integrate`, not `batch resume`
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Runbook: attached land loop no longer requires manual resume after merge
- [ ] Append resolved entry to `findings.md`
- [ ] Create `.DONE`

## Completion Criteria

- [ ] `--attached` batch start returns after gate open (or terminal completed) following merge
- [ ] No manual `spine batch resume` needed for post-merge limbo on attached runs
- [ ] SP-204 resume fast path still works for detached/orphan recovery
- [ ] Tests green

## Git Commit Convention

- `feat(SP-228): complete Step N — description`

## Do NOT

- Auto-approve integrate gate or call `integrate` without operator
- Open gate when merge failed or tasks pending
- Break detached `--no-wait-terminal` quick-return semantics

---

## Amendments (Added During Execution)
