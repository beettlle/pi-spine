# Task: TP-009 — Batch status and reconciliation CLI

**Created:** 2026-06-01
**Size:** L

## Review Level: 2 (Plan and Code)

**Assessment:** Core reconciliation engine drives every status surface; wrong diagnosis sends operators to pause instead of dismiss.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Implement batch reconciliation (FR-BATCH-12, FR-BATCH-13, FR-BATCH-14, NFR-OBS-04): derive operator-facing `diagnosis` from task records, git, `.DONE` files, and batch-state (`.spine/batch-state.json` or Taskplane `.pi/batch-state.json`) — not from raw `phase` alone. Expose `spine status [--diagnose] [--json]` and replace `/spine-status` stub with reconciled output including `headline`, `suggestedCommand`, and `alternatives[]`.

## Dependencies

- **TP-006** — preflight module and `runReconciliationCheck` stub in `src/batch/reconcile.mjs`

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD.md` — §7.9 FR-BATCH-12–14, §17.5, §18.3, §18.9, NFR-OBS-04/05
- `docs/incidents/20260531-phase0-taskplane-batch.md` — limbo symptoms and recovery
- `bin/spine-preflight.mjs` — preflight hook calling reconciliation (TP-006)
- `extensions/spine/slash-commands.ts` — `/spine-status` stub to replace

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/reconcile.mjs` (replace TP-006 stub)
- `src/batch/diagnosis.mjs` (new — taxonomy + suggested commands)
- `src/batch/readers/spine-state.mjs` (new)
- `src/batch/readers/taskplane-state.mjs` (new — read `.pi/batch-state.json`)
- `bin/spine-status.mjs` (new)
- `bin/spine-preflight.mjs`
- `bin/spine.mjs`
- `extensions/spine/slash-commands.ts`
- `tests/batch/reconcile.test.mjs` (new)
- `tests/fixtures/batch-state/**` (new — incident-derived JSON fixtures)

## Steps

### Step 0: Preflight

- [ ] Read FR-BATCH-12 through FR-BATCH-14 and §17.5 reconciliation algorithm
- [ ] Confirm TP-006 `runReconciliationCheck` stub signature and import paths
- [ ] List diagnosis taxonomy values from FR-BATCH-13

### Step 1: Implement reconciliation core

> **Plan-review checkpoint** — confirm diagnosis rules and fixture matrix before CLI wiring.

- [ ] Replace `src/batch/reconcile.mjs` with `reconcileBatch(ctx)` reading batch-state from `.spine/batch-state.json` first, then `.pi/batch-state.json` if present
- [ ] Create `src/batch/readers/spine-state.mjs` — parse pi-spine batch-state shape (v1 tolerant reader)
- [ ] Create `src/batch/readers/taskplane-state.mjs` — parse Taskplane batch-state for dogfood (tasks, segments, phase, mergeResults)
- [ ] Create `src/batch/diagnosis.mjs` — map reconciliation signals to FR-BATCH-13 taxonomy; export `buildSuggestedCommand(diagnosis)`
- [ ] Classify tasks: pending / running / terminal using records + task folder `.DONE` files
- [ ] Compare git: detect whether `baseBranch` (default `main`) already contains commits from orch branch pattern `orch/*-{batchId}` or `orch/cdelgado-{batchId}`
- [ ] Detect **limbo_stale:** all tasks terminal-success, `failedTasks=0`, `phase ∈ {stopped, failed, executing}`, `endedAt=null`, empty or missing `mergeResults`
- [ ] Detect **completed_manual:** limbo signals + git shows orch work already on `baseBranch`
- [ ] Detect **needs_retry**, **needs_merge**, **needs_integrate**, **running**, **paused**, **failed** per §17.5
- [ ] Export `runReconciliationCheck(ctx)` for preflight integration (same module)

**Artifacts:**
- `src/batch/reconcile.mjs` (modified)
- `src/batch/diagnosis.mjs` (new)
- `src/batch/readers/spine-state.mjs` (new)
- `src/batch/readers/taskplane-state.mjs` (new)

### Step 2: spine status CLI and /spine-status slash command

- [ ] Create `bin/spine-status.mjs` with human-readable headline + suggested command; `--json` for automation; `--diagnose` for verbose signal breakdown; `--verbose` for segment frontier (NFR-OBS-05 opt-in)
- [ ] Wire `spine status` subcommand in `bin/spine.mjs`
- [ ] Replace `/spine-status` stub in `extensions/spine/slash-commands.ts` to call shared reconciliation entry
- [ ] When no batch-state exists, print healthy idle state with suggested next action (`spine plan all` or `spine preflight`)

**Artifacts:**
- `bin/spine-status.mjs` (new)
- `bin/spine.mjs` (modified)
- `extensions/spine/slash-commands.ts` (modified)

### Step 3: Complete FR-BATCH-17 preflight integration

- [ ] Update `bin/spine-preflight.mjs` to call real `runReconciliationCheck`
- [ ] When diagnosis is `limbo_stale` or `completed_manual`, fail preflight with §18.3 JSON shape (`headline`, `suggestedCommand: spine batch dismiss`)
- [ ] When diagnosis is `running` or `paused` (healthy active batch), fail with appropriate resume/pause message — not generic "batch exists"
- [ ] Extend `tests/spine-preflight.test.mjs` with limbo fixture

**Artifacts:**
- `bin/spine-preflight.mjs` (modified)
- `tests/spine-preflight.test.mjs` (modified)

### Step 4: Reconciliation test suite

- [ ] Add fixtures under `tests/fixtures/batch-state/` derived from incident `20260531T165700` (all succeeded + stopped + empty merge)
- [ ] Create `tests/batch/reconcile.test.mjs` — one test per FR-BATCH-13 diagnosis (minimum: `limbo_stale`, `completed_manual`, `needs_retry`, `running`, idle-no-batch)
- [ ] Assert output includes `diagnosis`, `headline`, `suggestedCommand` per §18.3
- [ ] Run targeted tests: `node --test tests/batch/reconcile.test.mjs tests/spine-preflight.test.mjs`

**Artifacts:**
- `tests/fixtures/batch-state/**` (new)
- `tests/batch/reconcile.test.mjs` (new)

### Step 5: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Run `npm test` (full suite)
- [ ] Manual smoke: `node bin/spine.mjs status --diagnose` on repo with no active batch; log outcome in STATUS.md

### Step 6: Documentation & Delivery

- [ ] Update README.md with `spine status` and reconciliation UX
- [ ] Update GAP-UX-01, GAP-UX-02, GAP-UX-03 status in `docs/compatibility/taskplane-gap-list.md` → **Partial** (dismiss/complete in TP-010)
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `README.md` — `spine status`, diagnosis fields, Taskplane `.pi/batch-state.json` support
- `docs/compatibility/taskplane-gap-list.md` — GAP-UX-01–03 → Partial

**Check If Affected:**
- `docs/incidents/20260531-phase0-taskplane-batch.md` — add pointer to `spine status --diagnose` recovery path if not already present

## Completion Criteria

- [ ] FR-BATCH-12, FR-BATCH-13, FR-BATCH-14 implemented with passing tests
- [ ] FR-BATCH-17 preflight limbo block uses real reconciliation
- [ ] `/spine-status` and `spine status` share one reconciliation implementation (NFR-OBS-04)
- [ ] Typecheck and tests pass

## Git Commit Convention

- **Step completion:** `feat(TP-009): complete Step N — description`

## Do NOT

- Implement `spine batch dismiss` or `complete` (TP-010)
- Implement batch engine, journal writer, or worker execution
- Modify planner or task parsers (TP-007, TP-008)

---

## Amendments (Added During Execution)
