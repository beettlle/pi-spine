# Task: TP-049 — Operator runbook for real projects

**Created:** 2026-06-02
**Size:** S

## Review Level: 0 (None)

**Assessment:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Consolidate **daily operator procedures** learned from Phase 8 land loops and Phase 9 dogfood into one external-team runbook.

Deliverables:
1. **`docs/adoption/operator-runbook.md`** — sections: install, preflight, start/monitor, land loop, gate races, resume/dismiss/complete, dashboard, Taskplane coexistence, troubleshooting (`node bin/spine.mjs` vs global spine)
2. **README** — link runbook under Adoption
3. **Update CONTEXT** — Phase 9 execution policy references runbook

**Success:** New operator can run a batch on consumer repo using only runbook + bootstrap checklist.

## Dependencies

- **TP-048** — real-pi lessons captured

## Context to Read First

**Tier 3:** `taskplane-tasks/CONTEXT.md` execution policy, `docs/adoption/real-project-readiness.md`, stub-free report

## File Scope

- `docs/adoption/operator-runbook.md` (new)
- `README.md`
- `taskplane-tasks/CONTEXT.md`

## Steps

### Step 1: Draft runbook

- [ ] All sections with copy-paste commands
- [ ] Land loop diagram (ascii or mermaid)

### Step 2: Cross-link + CONTEXT update

- [ ] README + readiness doc links
- [ ] CONTEXT Phase 9 policy points to runbook

### Step 3: Verification

- [ ] Peer review: another reader can follow without chat history
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (no regressions)

## Completion Criteria

- [ ] operator-runbook.md complete
- [ ] README linked

## Do NOT

- Do not duplicate entire PRD — link to PRD for normative behavior

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-043): local install doctor check`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
