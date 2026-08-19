# Task: SP-707 — Post-mortem v2.14.0

**Created:** 2026-08-19
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only release post-mortem; no product code.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Write `docs/release/post-mortem-v2.14.0.md` mirroring the structure of `docs/release/post-mortem-v2.13.0.md`. Capture what shipped (SP-703–SP-706, #120 partial, #213 closed, CI no-signal docs), stabilization rules that held (F1 scope approval, F7 pin held, F8 push/sync, F-C docs via SP-704), publish path (tag `v2.14.0`, Release workflow), and the **consumer bug backlog** (#252–#256) discovered post-ship from git-ai batch `20260815T223806` — staged as SP-708–SP-712 in v2.14.1.

## Dependencies

- **None**

## Context to Read First

- `docs/release/post-mortem-v2.13.0.md` — structural model
- `spine-tasks/_authoring/release-v2.14.0/manifest.md` — scope, waves, publish checklist
- GitHub #252–#256 — consumer findings (read-only)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/post-mortem-v2.14.0.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/post-mortem-v2.14.0.md` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `tests/**` |

## Steps

### Step 0: Preflight

- [ ] Read v2.14.0 manifest publish checklist and batch `20260815T171647` post-mortem
- [ ] Confirm #252–#256 are open and map to SP-708–SP-712

### Step 1: Write post-mortem

- [ ] Create `docs/release/post-mortem-v2.14.0.md` with executive summary, scope table, chronology, failure taxonomy (held vs open), engineering backlog, do-not-reintroduce, appendix
- [ ] Document consumer issues as **post-ship findings**, not release blockers
- [ ] Point v2.14.1 manifest at SP-708–SP-712 for bug fixes

### Step 2: Testing & Verification

- [ ] Confirm post-mortem exists and references correct SP-IDs, issues, and tag `v2.14.0`
- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only full suite)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/release/post-mortem-v2.14.0.md`

## Completion Criteria

- [ ] Post-mortem follows v2.13.0 structure
- [ ] Consumer bugs #252–#256 documented with SP-708–SP-712 pointers
- [ ] No `src/**` or `bin/**` edits

## Do NOT

- Edit product code
- Close GitHub issues (bug-fix tasks own closure)
- Edit `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `docs(SP-707): post-mortem v2.14.0 release`
