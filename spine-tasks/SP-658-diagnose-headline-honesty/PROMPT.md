# Task: SP-658 — Diagnose headline honesty

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Extend #195-class headline preference so orphan/gating outranks stale GitignoredDirtyWorktree remediation.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

**Closes:** [#205](https://github.com/beettlle/pi-spine/issues/205) (with SP-656 + SP-657 landed)

After SP-649 became `worker_orphaned`, diagnose continued to headline stale **pending_lane_land / gitignored** remediation even though the primary failure was orphan. Build on existing `#195` comment in `buildHeadline`: headline must equal the **latest primary failure**; drop stale `GitignoredDirtyWorktree` / merge-gitignored remediation once diagnosis is orphan or gate-ready.

**Source:** [`docs/release/post-mortem-v2.7.0-batch-20260713T171709.md`](../../docs/release/post-mortem-v2.7.0-batch-20260713T171709.md) §7 P0.3

## Dependencies

- **Task:** SP-657 (orphan heal path exists so diagnose scenarios stay consistent)

## Context to Read First

- GitHub issue #205
- `src/batch/diagnosis.mjs` (`buildHeadline`, gate-ready / mergeGitignored preference)
- `src/batch/diagnosis-merge-failure.mjs`
- `src/batch/diagnosis-pending-lane.mjs`
- Closed #195 / related diagnose tests
- Post-mortem §F3 / §7 P0.3

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis.mjs`
- `src/batch/diagnosis-merge-failure.mjs`
- `tests/batch/diagnosis-headline-honesty.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/diagnosis-headline-honesty.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis.mjs`, `tests/batch/diagnosis-headline-honesty.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read `buildHeadline` gate-ready / mergeGitignored branches
- [ ] Find existing #195 tests to extend rather than fork

### Step 1: Headline preference + tests

- [ ] Prefer orphan / gate-ready / latest primary failure over historical gitignored merge signals
- [ ] Keep gitignored detail in diagnose **signals**, not headline, when primary is orphan/gating
- [ ] Add tests: stale GitignoredDirtyWorktree + worker_orphaned → orphan headline

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Coverage gate (code change): `npm run coverage:check` (≥77% line coverage)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`
- [ ] Close GitHub issue #205 (`gh issue close 205`) when SP-656/657/658 criteria met

## Documentation Requirements

**Must Update:**
- None (narrative in SP-661)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-661

## Completion Criteria

- [ ] Orphan/gating primary diagnosis is not headlined as GitignoredDirtyWorktree remediation
- [ ] #205 closable after SP-656 + SP-657 + this packet
- [ ] Scoped tests green

## Do NOT

- Change dirty-check markers or graphify race (SP-656/659)
- Change orphan heal engine paths beyond diagnose inputs (SP-657)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-658): diagnose headline prefers latest primary failure (#205)`
