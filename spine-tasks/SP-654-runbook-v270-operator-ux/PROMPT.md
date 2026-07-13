# Task: SP-654 — Runbook v2.7.0 operator UX

**Created:** 2026-07-13
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only after code paths land.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Document operator-facing v2.7.0 paths in `docs/adoption/operator-runbook.md`: wrong-cwd / missing-config messaging (#202), template vs evidence command shapes + allowlisted `&&` Phase B (#160), `.pi/` gitignore / doctor hygiene, and PATH/`npm link` / `node bin/spine.mjs` reminders. Cross-link detached-first (#163/#185).

**Source:** [`docs/PRD-v2.7.0-operator-ux-evidence-handoff.md`](../../docs/PRD-v2.7.0-operator-ux-evidence-handoff.md) § FR-REL270-06

## Dependencies

- **Task:** SP-649
- **Task:** SP-650
- **Task:** SP-651
- **Task:** SP-653

## Context to Read First

- `docs/adoption/operator-runbook.md`
- GitHub #202 #160
- `docs/PRD-v2.7.0-operator-ux-evidence-handoff.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Add operator UX + evidence Phase B section

- [ ] Document wrong-cwd missing-config message / remediation (#202)
- [ ] Document Phase-A-safe template commands + allowlisted `&&` Phase B examples (#160)
- [ ] Document `.pi/` gitignore / doctor hygiene and PATH/`npm link` reminder

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; no coverage gate required)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Must Update docs modified
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — v2.7.0 operator UX + evidence Phase B

**Check If Affected:**
- None

## Completion Criteria

- [ ] Runbook covers #202, #160 Phase B narrow, doctor `.pi/` hygiene, PATH skew reminder

## Do NOT

- Change engine/CLI code
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `docs(SP-654): runbook v2.7.0 operator UX and evidence Phase B`
