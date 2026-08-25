# Task: SP-720 — Post-mortem v2.15.0 + release follow-on context

**Created:** 2026-08-25
**Size:** S

## Review Level: 0 (Docs Only)

**Assessment:** Documentation-only; no code changes.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Write `docs/release/post-mortem-v2.15.0.md` documenting the v2.15.0 minor release (SP-713–719, issues #257–#261, #263) and framing v2.16.0 scope (brutal-audit follow-on #264–#271 + #262). Follow the structure of `docs/release/post-mortem-v2.14.1.md`.

## Dependencies

- **None**

## Context to Read First

- `docs/release/post-mortem-v2.14.1.md` — template structure
- `spine-tasks/_authoring/release-v2.15.0/manifest.md` — v2.15.0 composition
- `spine-tasks/_authoring/release-v2.16.0/manifest.md` — v2.16.0 planned scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/post-mortem-v2.15.0.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `test -f docs/release/post-mortem-v2.15.0.md && grep -q 'v2.15.0' docs/release/post-mortem-v2.15.0.md && grep -q 'v2.16.0' docs/release/post-mortem-v2.15.0.md` |
| fileScopeMustChange | `docs/release/post-mortem-v2.15.0.md` |

## Steps

### Step 1: Draft post-mortem

- [ ] Summarize v2.15.0 waves, tasks, and issues closed (#257–#261, #263)
- [ ] Note operational lessons (detached batches, release:check, CI pre-tag, §4.3c issue close hygiene)
- [ ] Add section linking deferred brutal-audit items to v2.16.0 (#264–#271, #262)

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/release/post-mortem-v2.15.0.md` — primary deliverable

## Completion Criteria

- [ ] Post-mortem file exists with v2.15.0 and v2.16.0 follow-on context
- [ ] Contract testCommand passes
- [ ] `.DONE` created

## Do NOT

- Modify `src/`, `bin/`, or `tests/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `docs(SP-720): post-mortem v2.15.0 and v2.16.0 follow-on context`
