# Task: SP-661 — Runbook v2.8.0 dogfood land

**Created:** 2026-07-13
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only after code paths land.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Document operator-facing v2.8.0 dogfood-land lessons in `docs/adoption/operator-runbook.md`: recovery order for `GitignoredDirtyWorktree` (F1) vs post-DONE orphan (F3), diagnose headline honesty, `graphify-out` re-clean race, single resume owner / no dual engines (F4), and restate detached-first + never background `--attached` (#163). Cross-link [`docs/release/post-mortem-v2.7.0-batch-20260713T171709.md`](../../docs/release/post-mortem-v2.7.0-batch-20260713T171709.md).

**Source:** Phase 72 / SP-REL280; post-mortem §7 P1

## Dependencies

- **Task:** SP-656
- **Task:** SP-657
- **Task:** SP-658
- **Task:** SP-659
- **Task:** SP-660

## Context to Read First

- `docs/adoption/operator-runbook.md`
- `docs/release/post-mortem-v2.7.0-batch-20260713T171709.md`
- GitHub #205 #206 #207
- `spine-tasks/_authoring/release-v2.8.0/manifest.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Add v2.8.0 dogfood land section

- [ ] Document F1 graphify regenerate / re-clean behavior (#206)
- [ ] Document `.pi-smart-router` auto-clean (#205 partial)
- [ ] Document post-DONE orphan auto-heal + diagnose headline honesty (#205)
- [ ] Document single resume owner (#207) and detached-first (#163)
- [ ] Link post-mortem for deep timeline

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; no coverage gate required)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Must Update docs modified
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — v2.8.0 dogfood land / F1–F4 recovery

**Check If Affected:**
- None

## Completion Criteria

- [ ] Runbook covers #205/#206/#207 operator-facing behavior and detached-first reminder

## Do NOT

- Change engine/CLI code
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `docs(SP-661): runbook v2.8.0 dogfood land recovery (#205 #206 #207)`
