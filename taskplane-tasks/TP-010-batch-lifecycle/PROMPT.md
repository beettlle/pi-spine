# Task: TP-010 — Batch dismiss and complete lifecycle

**Created:** 2026-06-01
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Mutates active batch state and archives snapshots; incorrect dismiss could hide real in-progress work.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement batch lifecycle completion commands (FR-BATCH-15, FR-BATCH-16, FR-BATCH-18 partial): `spine batch dismiss`, `spine batch complete`, `spine next`, and slash wrappers `/spine-dismiss`, `/spine-next`. Archive batch snapshots to `.spine/runtime/{batchId}/archive/` before clearing active state. Update `/spine` entry routing to offer the single best next action from reconciliation. Close GAP-UX-01, GAP-UX-02, GAP-UX-04.

## Dependencies

- **TP-009** — reconciliation engine, diagnosis taxonomy, shared status output

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD.md` — §7.9 FR-BATCH-15–18, §18.6 archive-first, §18.9 limbo recovery
- `src/batch/reconcile.mjs` — reconciliation entry (TP-009)
- `bin/spine-status.mjs` — status CLI (TP-009)
- `extensions/spine/slash-commands.ts` — `/spine`, `/spine-dismiss`, `/spine-next` stubs

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lifecycle.mjs` (new — dismiss, complete, archive)
- `src/batch/reconcile.mjs`
- `bin/spine-batch.mjs` (new)
- `bin/spine.mjs`
- `extensions/spine/slash-commands.ts`
- `tests/batch/lifecycle.test.mjs` (new)
- `tests/fixtures/batch-state/**` (extend)

## Steps

### Step 0: Preflight

- [ ] Read FR-BATCH-15, FR-BATCH-16, FR-BATCH-18 and §18.6 archive requirements
- [ ] Confirm TP-009 reconciliation exports used for pre-dismiss validation
- [ ] Confirm archive path convention: `.spine/runtime/{batchId}/archive/batch-state.json`

### Step 1: Implement archive-first lifecycle module

> **Plan-review checkpoint** — confirm dismiss vs complete rules and safety guards before CLI wiring.

- [ ] Create `src/batch/lifecycle.mjs` exporting `dismissBatch(ctx)` and `completeBatch(ctx)`
- [ ] **Archive-first:** copy current batch-state (from `.spine/` or `.pi/` reader) to `.spine/runtime/{batchId}/archive/batch-state.json` before any clear
- [ ] **dismissBatch:** allowed when reconciliation diagnosis is `limbo_stale`, `completed_manual`, or `aborted`; refuse when `running` with live lanes unless `--force` (fail loud with headline)
- [ ] **completeBatch:** allowed when all tasks terminal-success and merge satisfied OR `--detect-manual-merge` finds orch commits on `baseBranch` (FR-BATCH-16, §18.9)
- [ ] After dismiss/complete: remove active batch pointer (`.spine/batch-state.json`); write optional `.spine/runtime/{batchId}/history.json` summary with `endedAt`, `diagnosis`, `reason`
- [ ] Return §18.3 shape with `headline` and next suggested action (`spine preflight` or `spine plan all`)

**Artifacts:**
- `src/batch/lifecycle.mjs` (new)

### Step 2: spine batch CLI and slash commands

- [ ] Create `bin/spine-batch.mjs` with subcommands `dismiss` and `complete`; support `--batch ID`, `--reason`, `--detect-manual-merge`, `--json`
- [ ] Wire `spine batch dismiss|complete` and `spine next` in `bin/spine.mjs` — `spine next` prints or executes `suggestedCommand` from reconciliation (dry-run by default; `--execute` to run)
- [ ] Implement `/spine-dismiss` and `/spine-next` in `extensions/spine/slash-commands.ts`
- [ ] Update `/spine` handler (FR-BATCH-18): run reconciliation; route to plan / preflight / status / dismiss / complete / integrate hint based on diagnosis — never suggest pause for `limbo_stale` or `completed_manual`

**Artifacts:**
- `bin/spine-batch.mjs` (new)
- `bin/spine.mjs` (modified)
- `extensions/spine/slash-commands.ts` (modified)

### Step 3: Lifecycle test suite

- [ ] Create `tests/batch/lifecycle.test.mjs` using temp dirs and incident limbo fixture
- [ ] Assert dismiss archives batch-state before clearing active file
- [ ] Assert complete with `--detect-manual-merge` succeeds when git fixture shows merged orch branch
- [ ] Assert dismiss refused when diagnosis is `running` without `--force`
- [ ] Run targeted tests: `node --test tests/batch/lifecycle.test.mjs`

**Artifacts:**
- `tests/batch/lifecycle.test.mjs` (new)

### Step 4: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Run `npm test` (full suite)
- [ ] Manual smoke: with a test fixture batch-state, run `spine batch dismiss --reason test`; confirm archive exists; log in STATUS.md

### Step 5: Documentation & Delivery

- [ ] Update README.md with dismiss/complete/next commands and limbo recovery playbook
- [ ] Mark GAP-UX-01, GAP-UX-02, GAP-UX-04 **Closed** in `docs/compatibility/taskplane-gap-list.md`
- [ ] Update incident doc recovery section to reference `spine batch dismiss` instead of manual JSON surgery where applicable
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `README.md` — batch dismiss/complete/next, limbo recovery
- `docs/compatibility/taskplane-gap-list.md` — GAP-UX-01, 02, 04 → Closed
- `docs/incidents/20260531-phase0-taskplane-batch.md` — add pi-spine recovery path (Check If Affected)

## Completion Criteria

- [ ] FR-BATCH-15, FR-BATCH-16, FR-BATCH-18 implemented with passing tests
- [ ] Dismiss/complete always archive before clearing active state (§18.6)
- [ ] `/spine` never suggests pause for terminal limbo diagnoses
- [ ] Typecheck and tests pass

## Git Commit Convention

- **Step completion:** `feat(TP-010): complete Step N — description`

## Do NOT

- Implement full batch engine, journal append, or worker spawn
- Delete `.pi/batch-state.json` without archiving — pi-spine archives to `.spine/runtime/`; document if Taskplane file remains for operator cleanup
- Reimplement reconciliation logic — import from TP-009

---

## Amendments (Added During Execution)
