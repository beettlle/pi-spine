# Task: SP-713 — Post-mortem v2.14.1 + brutal-audit release context

**Created:** 2026-08-22
**Size:** S

## Review Level: 0 (Docs Only)

**Assessment:** Documentation-only; no code changes.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Write `docs/release/post-mortem-v2.14.1.md` documenting the v2.14.1 patch release (SP-707–712, issues #252–#256) and framing v2.15.0 scope (brutal-audit P0/P1 hardening #257–#261, #263). Follow the structure of `docs/release/post-mortem-v2.14.0.md`.

## Dependencies

- **None**

## Context to Read First

- `docs/release/post-mortem-v2.14.0.md` — template structure
- `spine-tasks/_authoring/release-v2.14.1/manifest.md` — v2.14.1 composition
- `spine-tasks/_authoring/release-v2.15.0/manifest.md` — v2.15.0 planned scope
- GitHub issues #257–#261, #263

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/post-mortem-v2.14.1.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `test -f docs/release/post-mortem-v2.14.1.md && grep -q 'v2.14.1' docs/release/post-mortem-v2.14.1.md && grep -q 'brutal audit' docs/release/post-mortem-v2.14.1.md` |
| fileScopeMustChange | `docs/release/post-mortem-v2.14.1.md` |

## Steps

### Step 1: Draft post-mortem

- [ ] Summarize v2.14.1 waves, tasks, and issues closed (#252–#256)
- [ ] Note operational lessons (detached batches, release:check gates, CI pre-tag)
- [ ] Add section linking brutal audit (2026-08-22) to v2.15.0 scope (#257–#261, #263)

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/release/post-mortem-v2.14.1.md` — primary deliverable

## Completion Criteria

- [ ] Post-mortem file exists with v2.14.1 and brutal-audit context
- [ ] Contract testCommand passes
- [ ] `.DONE` created

## Do NOT

- Modify `src/`, `bin/`, or `tests/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `docs(SP-713): post-mortem v2.14.1 and v2.15.0 audit context`
