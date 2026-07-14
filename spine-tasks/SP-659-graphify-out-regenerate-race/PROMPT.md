# Task: SP-659 — `graphify-out` regenerate-after-clean race

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Markers already include `graphify-out/`; harden sanitize/land against post-commit hook re-dirty (race).
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

**Closes:** [#206](https://github.com/beettlle/pi-spine/issues/206)

During v2.7.0, SP-654/655 completed Steps then failed land with `GitignoredDirtyWorktree` on `graphify-out/**` despite markers — files regenerated after auto-clean (post-commit hooks). Heal after manual `git clean -fdX` + retry worked; product must re-clean (or equivalently make land race-safe) after hook churn so fail-closed land succeeds without operator surgery.

Depends on SP-656 so marker/list edits on `lane-dirty-check*.mjs` do not collide.

**Source:** [`docs/release/post-mortem-v2.7.0-batch-20260713T171709.md`](../../docs/release/post-mortem-v2.7.0-batch-20260713T171709.md) §7 P0.4 / §F1

## Dependencies

- **Task:** SP-656 (marker list ownership on dirty-check modules)

## Context to Read First

- GitHub issue #206
- `src/batch/lane-dirty-check.mjs` (`sanitizeGitignoredArtifactsBeforeLaneCommit`)
- `src/batch/lane-commit.mjs` (GitignoredDirtyWorktree fail path)
- `tests/batch/graphify-out-dirty.test.mjs`, `tests/batch/gitignored-auto-clean.test.mjs`
- Closed #113 / SP-463 (markers exist; race remains)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lane-dirty-check.mjs`
- `src/batch/lane-commit.mjs`
- `tests/batch/graphify-out-dirty.test.mjs`
- `tests/batch/graphify-out-regenerate-race.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/graphify-out-dirty.test.mjs tests/batch/graphify-out-regenerate-race.test.mjs` |
| fileScopeMustChange | `spine-tasks/SP-659-graphify-out-regenerate-race/STATUS.md`, `tests/batch/graphify-out-regenerate-race.test.mjs` |

## Amendments

- **2026-07-13 (operator):** After SP-656 landed, `src/batch/lane-dirty-check.mjs` was already changed on main (`.pi-smart-router` markers). Redirected `fileScopeMustChange` to STATUS.md + the new race fixture so preflight `prelanded-file-scope` clears. Race-safe re-clean implementation may still edit File Scope paths including `lane-dirty-check.mjs` / `lane-commit.mjs`.

## Steps

### Step 0: Preflight

- [ ] Confirm `graphify-out/` already in markers
- [ ] Trace sanitize → porcelain recheck → GitignoredDirtyWorktree fail

### Step 1: Race-safe re-clean

- [ ] After sanitize (and any commit hooks that may regenerate ignored artifacts), re-clean marked roots or re-check porcelain and sanitize again before fail-closed land
- [ ] Prefer minimal change in dirty-check/commit path — do not disable hooks repo-wide
- [ ] Fixture: regenerate `graphify-out/**` after first clean → land/sanitize succeeds without operator `git clean -fdX`

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Coverage gate (code change): `npm run coverage:check` (≥77% line coverage)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`
- [ ] Close GitHub issue #206 (`gh issue close 206`) when criteria met

## Documentation Requirements

**Must Update:**
- None (narrative in SP-661)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-661

## Completion Criteria

- [ ] Regenerated `graphify-out/**` after auto-clean does not fail-close land when marked
- [ ] #206 closable
- [ ] Scoped tests green

## Do NOT

- Remove `graphify-out/` from markers
- Change `.pi-smart-router` markers ownership beyond what SP-656 already landed
- Quarantine unrelated hook systems outside lanes without evidence
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-659): re-clean graphify-out after post-commit regen (#206)`
