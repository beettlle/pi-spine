# Task: TP-014 — Orchestration journal + batch-state hardening (Phase 2/3)

**Created:** 2026-06-01
**Size:** L

## Review Level: 2 (Plan and Code)

**Assessment:** Formalizes the control-plane audit trail and batch-state cache contract. Bad journal writes or state/journal drift break recovery, resume (Phase 3), and operator trust.
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 1 (redaction), Reversibility: 1

## Mission

Harden pi-spine **orchestration journal** and **batch-state cache** per PRD §10–§11 and FR-JRN. TP-012/TP-013 introduced append-only `events.jsonl` and minimal events; this task aligns entries with **schema v1** (`eventId`, `schemaVersion`, ISO timestamps, `correlationId`), enforces write rules (W1–W5), adds operator tooling (`spine journal replay`, `spine state validate`), archives completed batches to **batch-history**, and enriches reconciliation from journal tail.

**In scope:** journal module upgrade (redaction, 32KB payload cap, fsync), normalized event types, `correlationId` on lane/task chains, `spine journal replay --batch {id}`, `spine state validate` for active/archived batch-state, append terminal snapshot to `.spine/batch-history.json` on complete/dismiss, reconciliation reads last N journal events for diagnosis hints, tests + README.

**Out of scope (defer):** rebuild `batch-state.json` purely from journal (PRD v1.1); multi-lane registry files; segment frontier; `/spine-resume` engine; dashboard.

**Success:** After a `spine batch start` run, `spine journal replay --batch {id}` prints an ordered timeline; `spine state validate` passes; complete/dismiss appends history; reconciliation cites journal tail when useful; **55+** tests pass; `spine plan all` shows TP-014 in wave 6.

## Dependencies

- **TP-013** — checkpoint heartbeat and `lane.heartbeat` events on `main`

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md` — Option B; TP-014 is next

**Tier 3:**
- `docs/PRD.md` — §9.4 layout, §10.1–10.2, §11 (FR-JRN), W1–W5, §11.4 replay, §17.5 reconciliation + journal
- `src/batch/journal.mjs`, `src/batch/state.mjs`, `src/batch/lifecycle.mjs`, `src/batch/reconcile.mjs`, `src/batch/engine.mjs`
- `docs/incidents/20260531-phase0-taskplane-batch.md` — why audit trail matters

## Environment

- **Workspace:** pi-spine repo root
- **Requires:** Node ≥22, git

## File Scope

- `src/batch/journal.mjs` (extend — schema v1, redaction, fsync)
- `src/batch/state.mjs` (validate helpers)
- `src/batch/lifecycle.mjs` (batch-history append, `batch.dismissed` journal)
- `src/batch/reconcile.mjs` (journal tail hints)
- `src/batch/engine.mjs` (correlationId, W1 phase events)
- `bin/spine-journal.mjs` (new — replay subcommand)
- `bin/spine-state.mjs` (new — validate subcommand) or extend `bin/spine.mjs`
- `bin/spine.mjs` (wire commands)
- `tests/batch/journal.test.mjs` (new)
- `tests/batch/state-validate.test.mjs` (new)
- `README.md` (journal replay + state validate)

## Steps

### Step 0: Preflight

- [ ] Read PRD §10–§11 and FR-JRN
- [ ] Confirm `spine preflight` passes on clean `main`
- [ ] Inventory current journal event types emitted by engine (TP-012/TP-013)

### Step 1: Journal schema v1

> **Plan-review checkpoint** — agree on event shape migration (backward-compatible read of legacy lines).

- [ ] Extend `appendJournalEvent` to emit PRD §10.2 fields: `schemaVersion`, `eventId`, ISO `timestamp`, optional `correlationId`, `laneId`, `taskId`, `payload`
- [ ] Map existing engine types (`batch.started`, `lane.provisioned`, `lane.heartbeat`, …) into normalized `type` + `payload`
- [ ] Implement W3 (32KB cap) and W4 (redaction filter for keys matching `/key|token|secret|password/i`)
- [ ] Implement W5 (`fsync` after append before engine continues)
- [ ] `readJournalEvents` tolerates legacy lines without `schemaVersion`

**Artifacts:** `src/batch/journal.mjs`, `tests/batch/journal.test.mjs`

### Step 2: correlationId and W1/W2 lane pairing

- [ ] Generate `correlationId` per lane at `lane.provisioned` / worker start; attach to subsequent lane/task events
- [ ] Ensure each batch `phase` transition writes exactly one journal event (W1)
- [ ] Pair lane lifecycle: provision → heartbeat/stall → terminal (`lane.completed` or `lane.died` on failure)

**Artifacts:** `src/batch/engine.mjs`, `src/batch/worker-host.mjs` (if needed)

### Step 3: batch-state validate + batch-history

- [ ] Add `validateBatchState(state)` — schema v1 required fields, counter consistency, lane/task cross-refs
- [ ] CLI: `spine state validate [--batch ID]` — active `.spine/batch-state.json` or archived path
- [ ] On `complete` / `dismiss`: append summary entry to `.spine/batch-history.json` (PRD §11.2); journal `batch.dismissed` where applicable
- [ ] Fail loud on corrupt state with suggested repair command

**Artifacts:** `src/batch/state.mjs`, `src/batch/lifecycle.mjs`, `bin/spine-state.mjs`, tests

### Step 4: `spine journal replay`

- [ ] CLI: `spine journal replay --batch {id} [--json]`
- [ ] Human table: time | type | lane | task | summary (PRD §11.4)
- [ ] JSON mode for tooling; exit non-zero if journal missing

**Artifacts:** `bin/spine-journal.mjs`, `bin/spine.mjs`

### Step 5: Reconciliation enrichment

- [ ] Load journal tail (bounded, e.g. last 50 events) in `reconcileBatch` when batch dir exists
- [ ] Surface last `lane.stall_warning`, `task.failed`, or `batch.failed` in `--diagnose` details (no behavior change to suggestedCommand unless clear)

**Artifacts:** `src/batch/reconcile.mjs`, `tests/batch/reconcile.test.mjs` (extend if needed)

### Step 6: Documentation and dogfood

- [ ] README: journal replay, state validate, batch-history location
- [ ] Update `taskplane-tasks/CONTEXT.md`: TP-014 staged → done; **Next Task ID: TP-015** (Phase 3 theme TBD)
- [ ] Run `npm test` twice; `spine preflight`; dogfood: `spine journal replay --batch` on last archived batch

## Documentation Requirements

**Must Update:**
- `README.md`
- `taskplane-tasks/CONTEXT.md` — after completion

**Check If Affected:**
- `docs/PRD.md` — only if implementation diverges (note in STATUS Discoveries)

## Completion Criteria

- [ ] Journal events match schema v1 for new batches; legacy events still readable
- [ ] `spine journal replay --batch {id}` works on archived runtime dirs
- [ ] `spine state validate` passes on healthy completed batch archive
- [ ] `batch-history.json` receives entry on complete/dismiss
- [ ] Typecheck + full `npm test` pass
- [ ] `spine plan all` includes TP-014 in wave 6 after TP-013

## Git Commit Convention

- **Step completion:** `feat(TP-014): complete Step N — description`

## Do NOT

- Implement journal-only batch-state rebuild (v1.1)
- Implement multi-lane parallel engine (Phase 3)
- Implement `/spine-resume` or atomic retry (Phase 3)
- Break Taskplane `.pi/batch-state.json` reconciliation reader

---

## Amendments (Added During Execution)
