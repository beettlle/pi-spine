# Task: SP-652 — Gitignore `.pi/` entry

**Created:** 2026-07-13
**Size:** S

## Review Level: 0 (None)

**Assessment:** One-line `.gitignore` hygiene matching `SPINE_GITIGNORE_ENTRIES`.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Doctor reports `.gitignore has spine runtime entries (missing 1 entry)` because the repo `.gitignore` lacks `.pi/` while [`SPINE_GITIGNORE_ENTRIES`](../../src/config/spine-init-constants.mjs) requires it. Add `.pi/` to `.gitignore` (under the pi-spine runtime header if present) so `spine doctor` is green for this check without telling operators to re-run `spine init` on the engine repo itself.

## Dependencies

- **None**

## Context to Read First

- `.gitignore`
- `src/config/spine-init-constants.mjs` (`SPINE_GITIGNORE_ENTRIES`)
- `src/doctor/run-doctor-checks.mjs` (gitignore check)
- `docs/PRD-v2.7.0-operator-ux-evidence-handoff.md` § FR-REL270-04

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `.gitignore`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `.gitignore` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm doctor missing entry is `.pi/`
- [ ] Confirm `.pi/` is in `SPINE_GITIGNORE_ENTRIES`

### Step 1: Add `.pi/` to `.gitignore`

- [ ] Append `.pi/` with other spine runtime entries
- [ ] Verify doctor no longer reports missing gitignore entry for this path

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (gitignore-only; no coverage gate required)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — only if documenting doctor cleanup

## Completion Criteria

- [ ] `.gitignore` contains `.pi/`
- [ ] Doctor gitignore check no longer flags missing `.pi/`

## Do NOT

- Change `SPINE_GITIGNORE_ENTRIES` list shape without need
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Delete leftover worktrees (operator ops, not this packet)

## Git Commit Convention

- `chore(SP-652): add .pi/ to gitignore for doctor parity`
