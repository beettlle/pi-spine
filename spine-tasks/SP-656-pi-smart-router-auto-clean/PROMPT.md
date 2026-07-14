# Task: SP-656 — `.pi-smart-router` auto-clean markers

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Extend existing GITIGNORED_ARTIFACT_MARKERS / auto-clean roots (mirror `.review/` / #189).
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

**Partial:** [#205](https://github.com/beettlle/pi-spine/issues/205)

During v2.7.0 batch `20260713T171709`, SP-652 failed lane land with `GitignoredDirtyWorktree` on worktree-only `.pi-smart-router/state.db-shm` and `.pi-smart-router/state.db-wal`. These paths are not in `GITIGNORED_ARTIFACT_MARKERS` / auto-clean roots (same class as closed #189 for `.review/`).

Add `.pi-smart-router/` markers to **both** marker lists (`lane-dirty-check.mjs` and `lane-dirty-check-commit.mjs`) so `sanitizeGitignoredArtifactsBeforeLaneCommit` / root listing treat them like `.review/` and `graphify-out/`.

**Source:** [`docs/release/post-mortem-v2.7.0-batch-20260713T171709.md`](../../docs/release/post-mortem-v2.7.0-batch-20260713T171709.md) §7 P0.1

## Dependencies

- **None**

## Context to Read First

- GitHub issue #205
- `src/batch/lane-dirty-check.mjs` (`GITIGNORED_ARTIFACT_MARKERS`, `sanitizeGitignoredArtifactsBeforeLaneCommit`)
- `src/batch/lane-dirty-check-commit.mjs` (duplicate markers — keep in sync)
- `tests/batch/gitignored-auto-clean.test.mjs`
- `docs/release/post-mortem-v2.7.0-batch-20260713T171709.md` §F2 / §7

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lane-dirty-check.mjs`
- `src/batch/lane-dirty-check-commit.mjs`
- `tests/batch/gitignored-auto-clean.test.mjs`
- `tests/batch/pi-smart-router-dirty.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/gitignored-auto-clean.test.mjs tests/batch/pi-smart-router-dirty.test.mjs` |
| fileScopeMustChange | `src/batch/lane-dirty-check.mjs`, `tests/batch/pi-smart-router-dirty.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm `.pi-smart-router/` absent from both marker arrays
- [ ] Confirm `.review/` pattern to mirror

### Step 1: Add markers + tests

- [ ] Add `/.pi-smart-router/` and `.pi-smart-router/` to both `GITIGNORED_ARTIFACT_MARKERS` arrays
- [ ] Add/extend tests: path match + sanitize cleans worktree-only `.pi-smart-router` (shm/wal or state.db)
- [ ] Keep `lane-dirty-check.mjs` and `lane-dirty-check-commit.mjs` marker lists identical for this entry

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Coverage gate (code change): `npm run coverage:check` (≥77% line coverage)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`
- [ ] Do **not** close #205 (SP-658 closes)

## Documentation Requirements

**Must Update:**
- None (narrative in SP-661)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-661

## Completion Criteria

- [ ] `.pi-smart-router/` treated as gitignored auto-clean artifact on both marker lists
- [ ] Scoped tests prove match + sanitize
- [ ] #205 remains open until SP-657/658 land

## Do NOT

- Change graphify regenerate-race logic (SP-659)
- Change diagnose/orphan heal (SP-657/658)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Close #205 from this packet

## Git Commit Convention

- `fix(SP-656): auto-clean .pi-smart-router gitignored artifacts (#205)`
