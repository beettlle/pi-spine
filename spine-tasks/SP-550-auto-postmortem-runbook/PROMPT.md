# Task: SP-550 — Proof post-mortem runbook section

**Created:** 2026-07-08
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only post-mortem template for proof runs.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Add automated post-mortem section to proof release docs: journal export command, open-issue delta table template, batch post-mortem path references (FR-STA-32).

Update `docs/release/automation-signoff-checklist.md` with post-mortem commit step linking to new section in `docs/release/v2.0.0-proof-runbook.md`.

## Dependencies

- SP-544
- SP-545
- SP-546
- SP-547
- SP-548
- SP-549

## File Scope

- `docs/release/v2.0.0-proof-runbook.md`
- `docs/release/automation-signoff-checklist.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/v2.0.0-proof-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm manifest tasks SP-546–549 `.DONE`

### Step 1: Write proof runbook

- [ ] Post-mortem template: batch id, waves, manual recovery count (target 0), issue delta
- [ ] Commands: `spine journal export`, `gh issue list` before/after
- [ ] Link manifest and signoff checklist

**Artifacts:**
- `docs/release/v2.0.0-proof-runbook.md`

### Step 2: Cross-link signoff checklist

- [ ] Add post-mortem checkbox referencing runbook section

**Artifacts:**
- `docs/release/automation-signoff-checklist.md` (modified)

### Step 3: Testing & Verification

- [ ] `spine tasks validate SP-550`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Operator can fill post-mortem from runbook without reading PRD

## Git Commit Convention

- `docs(SP-550): v2.0.0 proof post-mortem runbook section`

## Do NOT

- Run npm version / tag push (release operator Phase 6)
