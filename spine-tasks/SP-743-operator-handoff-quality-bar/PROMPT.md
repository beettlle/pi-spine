# Task: SP-743 — Operator handoff quality bar

**Created:** 2026-09-04
**Size:** S

## Review Level: 0 (None)

**Assessment:** Documentation + Cursor operator rule only; no engine code.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Closes #282 — Document the operator handoff quality bar: incomplete handoff = missing any of Situation / Background / Assessment / Recommendation (spine vocabulary, not a product rename to SBAR). Update the operator runbook and `spine-operator-cursor` so agents follow diagnose `suggestedCommand` instead of inventing recovery. Cross-link #278 / #279 for structured fields when available.

## Dependencies

- **None**

## Context to Read First

- GitHub #282 — handoff quality bar brief
- `docs/adoption/operator-runbook.md` — diagnose / recovery sections
- `.cursor/rules/spine-operator-cursor.mdc` — Upstream bug reports + anti-patterns
- Optional: `templates/agents/supervisor.md` — one-line pointer only

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `.cursor/rules/spine-operator-cursor.mdc`
- `templates/agents/supervisor.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md`, `.cursor/rules/spine-operator-cursor.mdc` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Locate diagnose / recovery / upstream-bug sections in the runbook
- [ ] Locate Upstream bug reports + Critical anti-patterns in `spine-operator-cursor.mdc`

### Step 1: Runbook handoff packet subsection

- [ ] Add “Operator handoff packet” subsection: Situation / Background / Assessment / Recommendation (spine terms)
- [ ] Define incomplete handoff = missing any of the four
- [ ] Cross-link #278 / #279 for when structured fields land

### Step 2: Operator rule + optional supervisor pointer

- [ ] Add anti-pattern: do not invent recovery when diagnose Recommendation (`suggestedCommand`) is present
- [ ] Reinforce incomplete-handoff definition under Upstream bug reports or Critical anti-patterns
- [ ] Optional: one-line pointer in `templates/agents/supervisor.md`

### Step 3: Testing & Verification

- [ ] Confirm Must Update paths exist and contain the new subsection / anti-pattern
- [ ] Run full suite when convenient: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; Contract is `true`)

### Step 4: Documentation & Delivery

- [ ] Runbook + operator rule updated
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — Operator handoff packet subsection
- `.cursor/rules/spine-operator-cursor.mdc` — incomplete handoff anti-pattern

**Check If Affected:**

- `templates/agents/supervisor.md` — optional one-line pointer

## Completion Criteria

- [ ] Runbook has handoff packet subsection with four roles
- [ ] Operator rule forbids guessing past `suggestedCommand`
- [ ] Closes #282
- [ ] `.DONE` created

## Do NOT

- Implement diagnose `background[]` / `assessmentReason` (SP-745 / #278)
- Implement issue-draft/handoff SBAR render (SP-746 / #279)
- Rename public API fields to SBAR
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `docs(SP-743): operator handoff quality bar (#282)`
