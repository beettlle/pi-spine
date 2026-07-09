# Task: SP-565 — v2.2.0 backlog drain handoff PRD

**Created:** 2026-07-09
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only handoff PRD for Phase 64 semver release.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Author `docs/PRD-v2.2.0-backlog-drain-handoff.md` — implementation decomposition spec for v2.2.0 post-v2.1 backlog drain (Phase 64, SP-565–573). Mirror structure of [`docs/PRD-v2.1.0-backlog-drain-handoff.md`](../../docs/PRD-v2.1.0-backlog-drain-handoff.md).

Record **fail-closed** as the #190 design decision (§1 executive summary).

**Source:** release plan; open issues triage at manifest time (baseline 22).

## Dependencies

- **None**

## File Scope

- `docs/PRD-v2.2.0-backlog-drain-handoff.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/PRD-v2.2.0-backlog-drain-handoff.md` |

## Steps

### Step 0: Preflight

- [ ] Read v2.1.0 handoff and stabilization roadmap for pattern
- [ ] Record open-issue baseline via `gh issue list --repo beettlle/pi-spine --state open --json number | jq length`

### Step 1: Author handoff PRD

- [ ] Executive summary with #190 fail-closed decision
- [ ] GitHub issue intake table (§5)
- [ ] Task decomposition SP-565–573 (§6)
- [ ] Wave order and exit criteria

**Artifacts:**
- `docs/PRD-v2.2.0-backlog-drain-handoff.md`

### Step 2: Testing & Verification

- [ ] `spine tasks validate SP-565`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Handoff PRD complete with issue mapping and exit criteria

## Git Commit Convention

- `docs(SP-565): v2.2.0 backlog drain handoff PRD`

## Do NOT

- Create SP-566–573 packets (separate staging)
- Confuse with `PRD-v2.2-ship-readiness-handoff.md` (Phase 23–26 — landed)
