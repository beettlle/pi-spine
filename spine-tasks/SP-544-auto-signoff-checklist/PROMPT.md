# Task: SP-544 — Automation signoff checklist

**Created:** 2026-07-08
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only gates-only exit criteria checklist.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Create `docs/release/automation-signoff-checklist.md` — operator attestation checklist for v2.0.0 gates-only proof per PRD §8 (FR-STA-33).

Include checkboxes for: single autonomous/sequence session, zero manual pause/retry/resume --force, gate approve + publish only, manifest scope `.DONE`, `release:check` green, open-issue delta negative, post-mortem committed, CONTEXT Phase 62 complete.

**Source:** [`docs/PRD-v2.0.0-automation-proof-handoff.md`](../../docs/PRD-v2.0.0-automation-proof-handoff.md) §8–§9

## Dependencies

- None

## File Scope

- `docs/release/automation-signoff-checklist.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/automation-signoff-checklist.md` |

## Steps

### Step 0: Preflight

- [ ] Read PRD §8 exit criteria and release-operator Phase 5–6

### Step 1: Write checklist

- [ ] Gates-only attestation section (M-AUTO-01)
- [ ] Issue delta table template (M-AUTO-02)
- [ ] release:check + plan empty verification (M-AUTO-03, M-AUTO-04)
- [ ] Link to manifest and operator runbook recovery (should not be needed)

**Artifacts:**
- `docs/release/automation-signoff-checklist.md`

### Step 2: Testing & Verification

- [ ] `spine tasks validate SP-544`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Checklist covers all PRD §8 items with measurable verification commands

## Git Commit Convention

- `docs(SP-544): automation signoff checklist for v2.0.0 proof`

## Do NOT

- Implement gate script (SP-545)
