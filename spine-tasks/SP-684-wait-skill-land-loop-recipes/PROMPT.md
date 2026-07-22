# Task: SP-684 — Wait/skill land-loop recipes after #221

**Created:** 2026-07-22
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs/skills-only alignment with SP-683 diagnose fix; no product code.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #221 — After SP-683 makes taxonomy `needs_integrate` match gate-pending land loops, update release/orchestrate skill wait recipes and agent-orchestrated-waves docs so default `--until` lists are correct. Prefer taxonomy-only wait (`needs_integrate`) now that reconcile is fixed; optionally note land-loop pseudos (`gate_open`, `needs_approval`, `post_merge_limbo`) as belt-and-suspenders already documented in the operator runbook.

**Parent split:** SP-683 owns engine diagnose; this task owns skill/doc wait recipe text.

## Dependencies

- **Task:** SP-683 (diagnose fix must land so docs describe the corrected behavior)

## Context to Read First

- `Parent split: SP-683 — reconcile gate-pending needs_integrate`
- `skills/spine-release-operator/SKILL.md` — wait recipes
- `skills/spine-orchestrate-waves/SKILL.md` — wait recipes
- `docs/adoption/agent-orchestrated-waves.md`
- `docs/adoption/operator-runbook.md` — existing land-loop wait notes
- GitHub #221 acceptance criterion 4

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/spine-release-operator/SKILL.md`
- `skills/spine-orchestrate-waves/SKILL.md`
- `docs/adoption/agent-orchestrated-waves.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/spine-release-operator/SKILL.md`, `docs/adoption/agent-orchestrated-waves.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-683 behavior: gate-pending land loop diagnoses `needs_integrate`
- [ ] Inventory current wait `--until` lists in the three File Scope docs

### Step 1: Align wait recipes with taxonomy needs_integrate

- [ ] Update default wait recipes so operators/agents wake on `needs_integrate` for gate-pending land loops (no requirement to list only pseudos)
- [ ] Cross-link operator-runbook land-loop pseudos if still useful as optional extras
- [ ] Keep recipes detached-first / no `--attached` in agent shells (#163)

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; no coverage gate checkbox)
- [ ] Spot-check that skill text matches SP-683 diagnose behavior

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `skills/spine-release-operator/SKILL.md`
- `skills/spine-orchestrate-waves/SKILL.md`
- `docs/adoption/agent-orchestrated-waves.md`

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] Release/orchestrate/agent-wave wait recipes reflect taxonomy `needs_integrate` for gate-pending land loops
- [ ] #221 AC4 satisfied

## Do NOT

- Change `src/**` or `bin/**` diagnose logic (SP-683)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip the Testing step

## Git Commit Convention

- `docs(SP-684): align wait recipes with needs_integrate (#221)`
