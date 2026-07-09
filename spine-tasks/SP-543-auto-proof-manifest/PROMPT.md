# Task: SP-543 — v2.0.0 proof release manifest

**Created:** 2026-07-08
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only manifest authoring from operator-approved scope.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Write operator-approved proof release manifest at `docs/release/manifest-v2.0.0-proof.md` using [release-manifest-template.md](../../skills/spine-release-operator/references/release-manifest-template.md).

**Operator-approved scope (2026-07-08):**

| Bucket | Task | Issue | Title |
|--------|------|-------|-------|
| Infrastructure | SP-544 | — | automation signoff checklist |
| Infrastructure | SP-545 | — | release-proof-gate script |
| Bug | SP-546 | #119 | best-of-n external repos |
| Bug | SP-547 | #161 | dashboard retry-then-succeed display |
| Bug | SP-548 | #134 | subprocess heartbeat observability |
| Enhancement | SP-549 | #144, #145 | create-spine-tasks skill template hygiene |
| Sign-off | SP-550, SP-551 | — | postmortem + CONTEXT capstone |

**Target version:** v2.0.0 (automation proof — minor bump from 1.10.1 per [`PRD-v2.0.0-automation-proof-handoff.md`](../../docs/PRD-v2.0.0-automation-proof-handoff.md))

**Source:** [`docs/PRD-v2.0.0-automation-proof-handoff.md`](../../docs/PRD-v2.0.0-automation-proof-handoff.md)

## Dependencies

- None

## File Scope

- `docs/release/manifest-v2.0.0-proof.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/manifest-v2.0.0-proof.md` |

## Steps

### Step 0: Preflight

- [ ] Read release-manifest-template and PRD §5–§10
- [ ] Record open-issue baseline count via `gh issue list --repo beettlle/pi-spine --state open --json number | jq length`

### Step 1: Author manifest

- [ ] Fill composition audit (docs 1, bugs 3, enh 1, total ≤8)
- [ ] List SP-543–551 with wave order (wave 0: SP-543–545; wave 1: SP-546–548; wave 2: SP-549; wave 3: proof sequence; wave 4: SP-550–551)
- [ ] Document deferred issues with one-line rationale
- [ ] Mark **Operator approved scope: yes** with date

**Artifacts:**
- `docs/release/manifest-v2.0.0-proof.md`

### Step 2: Testing & Verification

- [ ] `spine tasks validate SP-543`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Manifest complete with operator-approved task/issue mapping
- [ ] Composition audit PASS for minor/proof profile

## Git Commit Convention

- `docs(SP-543): v2.0.0 proof release manifest`

## Do NOT

- Author SP-546–551 PROMPT changes (already staged)
- Include #117, #120–129 epics in scope
