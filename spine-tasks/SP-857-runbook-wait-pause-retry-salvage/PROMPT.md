# Task: SP-857 — Runbook: multi-lane spine wait + pause/retry + salvage land-loop recovery

**Created:** 2026-11-16
**Size:** S
**Type:** llm

## Review Level: 0 (None)

**Risk:** Docs-only. Stale recovery recipes recreate the v2.30.0 dogfood dead-ends (#375/#376/#374).
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** Operator runbook still documents wait/pause/retry/salvage paths that omit the sibling-lane wait wake (#375), the pause→retry `stale_engine_pid` / false-attached resume dead-end (#376), and the post-salvage complete/dismiss regression (#374). Code fixes land in SP-860–SP-862; this packet documents the intended operator path.

## Mission

Operators reading the runbook can recover multi-lane waves without waking under live siblings, without fighting `stale_engine_pid` / attached-engine ownership, and without `--force` dismiss after a successful salvage integrate:

1. **`spine wait`** — Document that for multi-lane waves, `needs_retry` must not wake while sibling lanes are still `running` (SP-860 / #375). Prefer `--until completed,needs_integrate,failed,aborted` until the wave is quiet, then add `needs_retry` only when diagnose shows no live workers.
2. **Pause / retry / resume** — Document the #376 recovery: after pause+retry, detached resume must not be blocked by a false "Attached batch engine already running"; if diagnose shows `stale_engine_pid`, follow the SP-861 suggestedCommand (do not kill blindly). Prefer detached `resume` / `resume --force`; `--attached` only in a persistent human TTY.
3. **Salvage land loop** — After `salvage --lane N --integrate` + gate approve + successful land, `spine batch complete` / `dismiss` (without `--force`) must work when no unresolved failures remain (SP-862 / #374). Keep the existing "salvage is last resort / unreviewed" warning.
4. **Release-gate cross-link** — One short pointer to `docs/release/npm-publish.md` for git-ai `refs/notes` / peer 1.5.2 notes (SP-858 owns that file).

## Dependencies

- **None** (documents intended SP-860–SP-862 behavior; no file overlap with those packets)

## Context to Read First

- GitHub #375, #376, #374
- `docs/adoption/operator-runbook.md` sections on `spine wait`, pause/retry, salvage (#292 / SP-763 text ~1598–1620), detached-first policy
- `spine-tasks/_authoring/release-v2.31.0/manifest.md`

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
| fileScopeMustNotChange | `src/**`, `bin/**`, `scripts/**` |

## Steps

### Step 0: Preflight

- [ ] Locate runbook sections for `spine wait`, pause/retry, and salvage complete; list sentences that contradict #375/#376/#374

### Step 1: Wait + pause/retry + salvage docs

- [ ] Multi-lane wait wake rule (#375)
- [ ] Pause/retry/resume without stale_engine_pid / false attached ownership (#376)
- [ ] Post-salvage complete/dismiss without `--force` when heal applies (#374)

**Artifacts:**
- `docs/adoption/operator-runbook.md` (modified)

### Step 2: Testing & Verification

- [ ] `rg -l 'operator-runbook.md' tests/` and run only the hits with `node --experimental-strip-types --test --test-reporter=dot <files>` (none → note "no tests reference this doc")
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-857-runbook-wait-pause-retry-salvage/.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — wait / pause-retry / salvage recovery

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` (record gaps in Discoveries; do not edit unless a one-line wait recipe is clearly wrong)

## Completion Criteria

- [ ] Runbook states multi-lane `needs_retry` wait must not wake under live sibling workers
- [ ] Runbook documents pause/retry/resume without requiring `--force` dismiss for the #376 class
- [ ] Runbook states post-salvage `complete`/`dismiss` succeed without `--force` when only salvaged failures remain

## Git Commit Convention

- `docs(SP-857): runbook wait pause-retry salvage recovery for v2.31`

## Do NOT

- Edit `src/`, `bin/`, or `scripts/`
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
