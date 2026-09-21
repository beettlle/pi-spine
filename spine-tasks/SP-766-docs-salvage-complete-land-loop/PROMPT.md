# Task: SP-766 — Document salvage→complete land loop after post-DONE review fail

**Created:** 2026-09-21
**Size:** S

## Review Level: 0 (None)

**Risk:** Documentation only; no runtime code.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** Operators still treat post-DONE plan-review spawn failure as needs_retry and dismiss --force after salvage integrate.

## Mission

Document the land-loop recovery for post-DONE plan-review spawn failure (#291) and salvage `--integrate` → `batch complete` without `dismiss --force` (#292). Update operator runbook salvage / diagnose sections and QUICK-REFERENCE. Note multi-lane journal laneNumber preservation (#287) only if salvage multi-lane guidance is still wrong after SP-761.

## Dependencies

- **Task:** SP-762
- **Task:** SP-763
- **Task:** SP-765 (serialize shared docs File Scope)

## Context to Read First

- `Parent split: SP-762 / SP-763 — classification + complete heal`
- `docs/adoption/operator-runbook.md` — salvage / diagnose
- `docs/QUICK-REFERENCE.md`
- GitHub #291, #292

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-762/SP-763 `.DONE` behavior on main
- [ ] Dependencies satisfied

### Step 1: Document salvage land loop

- [ ] Runbook: post-DONE plan-review spawnFailed → salvage, not forced worker retry
- [ ] Runbook: after salvage --integrate, `spine batch complete` (no dismiss --force)
- [ ] QUICK-REFERENCE: short recovery row for the same path

**Artifacts:**
- `docs/adoption/operator-runbook.md` (modified)
- `docs/QUICK-REFERENCE.md` (modified)

### Step 2: Testing & Verification

- [ ] Contract `testCommand` is `true` (docs-only)
- [ ] Spot-check command sequences

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — salvage→complete *(also in File Scope)*

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` — include if File Scope lists it (it does)

## Completion Criteria

- [ ] Docs describe salvage-oriented recovery for post-DONE plan-review spawnFailed
- [ ] Docs describe complete after salvage integrate without dismiss --force

## Git Commit Convention

- `docs(SP-766): salvage-to-complete land loop after post-DONE review fail (#291 #292)`

## Do NOT

- Change `src/**` behavior
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
