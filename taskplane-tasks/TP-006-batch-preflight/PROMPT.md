# Task: TP-006 — Implement batch preflight

**Created:** 2026-05-31
**Size:** M

## Review Level: 1 (Plan review before code)

**Assessment:** New preflight gate before any batch; touches CLI, extension wiring, and git/doctor checks that block orchestration starts.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement batch preflight (FR-BATCH-11) so operators must pass `spine preflight` before starting a batch: `spine doctor` green, clean git working tree, no active batch, valid tasks root, parseable `dependencies.json`, and a **stub** `runPreflightPlanCheck` hook that TP-008 will complete to print the wave plan.

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `pi-spine-PRD.md` — §7.9 FR-BATCH-11, §15.2 CLI commands
- `bin/spine.mjs` — existing `doctor` wiring
- `extensions/spine/slash-commands.ts` — stub handlers to replace for preflight-related commands
- `docs/compatibility/taskplane-gap-list.md` — GAP-PREFLIGHT-01

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-preflight.mjs` (new)
- `bin/spine.mjs`
- `extensions/spine-orchestrator.ts`
- `extensions/spine/slash-commands.ts`
- `tests/spine-preflight.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Read FR-BATCH-11 and list each required check explicitly
- [ ] Confirm `spine doctor` exit codes and output shape in this repo
- [ ] Confirm where active batch state will live (`.spine/batch-state.json` per PRD §22.3)

### Step 1: Implement preflight checks module

> **Plan-review checkpoint** — confirm check order, failure messages, and exit codes before wiring CLI.

- [ ] Create `bin/spine-preflight.mjs` exporting `runBatchPreflight(options)` and individual check helpers
- [ ] **Doctor check:** invoke existing doctor logic; fail preflight when doctor fails
- [ ] **Git clean check:** fail when working tree has uncommitted changes; list up to 20 dirty paths
- [ ] **No active batch check:** fail when `.spine/batch-state.json` indicates an active batch (or equivalent v1 stub reader)
- [ ] **Tasks root check:** validate configured tasks root exists and contains discoverable task folders
- [ ] **Dependencies JSON check:** parse `{tasksRoot}/dependencies.json`; validate schema version and task IDs
- [ ] **Plan check stub:** export `runPreflightPlanCheck(ctx)` that returns a structured placeholder (e.g. `{ status: 'stub', message: 'Wave plan available after TP-008' }`) — TP-008 replaces this to print waves

**Artifacts:**
- `bin/spine-preflight.mjs` (new)

### Step 2: Wire CLI and pi slash command

- [ ] Add `spine preflight` subcommand in `bin/spine.mjs` (human-readable summary; `--json` for automation)
- [ ] Update `/spine` slash handler in `extensions/spine/slash-commands.ts` to run or recommend preflight before batch execution
- [ ] Update `extensions/spine-orchestrator.ts` if needed to import shared preflight entry (no batch engine yet)

**Artifacts:**
- `bin/spine.mjs` (modified)
- `extensions/spine/slash-commands.ts` (modified)
- `extensions/spine-orchestrator.ts` (modified)

### Step 3: Add preflight tests

- [ ] Create `tests/spine-preflight.test.mjs` covering each check with temp-dir fixtures (doctor mocked or skipped where environment-dependent)
- [ ] Assert stub `runPreflightPlanCheck` is callable and returns expected placeholder shape
- [ ] Run targeted tests: `node --test tests/spine-preflight.test.mjs`

**Artifacts:**
- `tests/spine-preflight.test.mjs` (new)

### Step 4: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Run `npm test` (full suite)
- [ ] Manual smoke: `node bin/spine.mjs preflight` on clean repo; log outcome in STATUS.md

### Step 5: Documentation & Delivery

- [ ] Update README.md with `spine preflight` usage and FR-BATCH-11 checklist
- [ ] Update GAP-PREFLIGHT-01 status in `docs/compatibility/taskplane-gap-list.md`
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `README.md` — document `spine preflight` and pre-batch policy
- `docs/compatibility/taskplane-gap-list.md` — GAP-PREFLIGHT-01 → **Partial** (wave plan completes in TP-008)

## Completion Criteria

- [ ] All FR-BATCH-11 checks implemented except wave plan printing (stub only; completed in TP-008)
- [ ] `spine preflight` exits non-zero on any failed check
- [ ] Typecheck and tests pass

## Git Commit Convention

- **Step completion:** `feat(TP-006): complete Step N — description`

## Do NOT

- Implement the planner or real wave plan (TP-008)
- Implement batch start, worktrees, or worker execution
- Modify task parsers (TP-007)

---

## Amendments (Added During Execution)
