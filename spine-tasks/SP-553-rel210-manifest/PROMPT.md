# Task: SP-553 — v2.1.0 release manifest

**Created:** 2026-07-09
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only manifest authoring from operator-approved scope.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Write operator-approved release manifest at `docs/release/manifest-v2.1.0.md` using [release-manifest-template.md](../../skills/spine-release-operator/references/release-manifest-template.md).

**Operator scope (draft — approve before batch):**

| Bucket | Tasks |
|--------|-------|
| Infrastructure | SP-552, SP-553, SP-554 |
| Bug | SP-555, SP-560 |
| Enhancement | SP-556, SP-557, SP-559, SP-562 |
| Documentation | SP-558, SP-561, SP-563 |
| Sign-off | SP-564 |

**Target version:** v2.1.0 (minor bump from 2.0.0 per [`PRD-v2.1.0-backlog-drain-handoff.md`](../../docs/PRD-v2.1.0-backlog-drain-handoff.md))

## Dependencies

- **Task:** SP-552

## File Scope

- `docs/release/manifest-v2.1.0.md`
- `spine-tasks/_authoring/release-v2.1.0/manifest.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/manifest-v2.1.0.md` |

## Steps

### Step 0: Preflight

- [ ] Read release-manifest-template and PRD §5–§7
- [ ] Confirm open-issue baseline (29)

### Step 1: Author manifest

- [ ] Fill composition audit
- [ ] List SP-552–564 with issue mapping
- [ ] Document deferred issues
- [ ] Set **Operator approved scope: yes** with date (after operator review)

**Artifacts:**
- `docs/release/manifest-v2.1.0.md`
- `spine-tasks/_authoring/release-v2.1.0/manifest.md`

### Step 2: Testing & Verification

- [ ] `spine tasks validate SP-553`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Manifest complete with task/issue mapping and wave snapshot

## Git Commit Convention

- `docs(SP-553): v2.1.0 release manifest`

## Do NOT

- Bump package.json version
- Include #117, #43, #120–127 epics in scope
