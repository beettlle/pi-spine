# Task: SP-566 — v2.2.0 release manifest

**Created:** 2026-07-09
**Size:** S

## Review Level: 0 (None)

**Assessment:** Operator manifest for Phase 64 scope approval.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Write [`docs/release/manifest-v2.2.0.md`](../../docs/release/manifest-v2.2.0.md) from [`docs/PRD-v2.2.0-backlog-drain-handoff.md`](../../docs/PRD-v2.2.0-backlog-drain-handoff.md) §5–§6. Mirror [`docs/release/manifest-v2.1.0.md`](../../docs/release/manifest-v2.1.0.md) format.

Record **Operator approved scope: pending** until human sign-off.

## Dependencies

- **Task:** SP-565

## File Scope

- `docs/release/manifest-v2.2.0.md`
- `spine-tasks/_authoring/release-v2.2.0/manifest.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/manifest-v2.2.0.md` |

## Steps

### Step 0: Preflight

- [ ] Read handoff PRD §5–§6 and manifest-v2.1.0 template
- [ ] Confirm open-issue baseline 22

### Step 1: Author manifest

- [ ] Composition audit table (minor profile)
- [ ] Selected tasks SP-565–573 with issue mapping
- [ ] Release scope ID string
- [ ] Sequence runner commands

**Artifacts:**
- `docs/release/manifest-v2.2.0.md`

### Step 2: Testing & Verification

- [ ] `spine tasks validate SP-566`

### Step 3: Documentation & Delivery

- [ ] Sync `_authoring/release-v2.2.0/manifest.md` pointer
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Manifest ready for operator approval gate

## Git Commit Convention

- `docs(SP-566): v2.2.0 release manifest`

## Do NOT

- Set `Operator approved scope: yes` without human operator
