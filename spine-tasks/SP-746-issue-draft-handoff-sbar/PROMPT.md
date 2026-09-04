# Task: SP-746 — issue-draft and handoff SBAR-shaped sections

**Created:** 2026-09-04
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** CLI markdown renderers only; soft dep on SP-745 fields with journal-derived fallback.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #279 — Extend `spine issue-draft` and operator handoff markdown to render ordered Situation / Background / Assessment / Recommendation sections (spine vocabulary; SBAR-shaped). Map from diagnose packet fields when present (`background` / `assessmentReason` from SP-745 / #278); if absent, derive Background from journalTail + phase + pendingTasks. Empty Background must show explicit `(none)`. Preserve secret redaction.

## Dependencies

- **Task:** SP-745 (diagnose additive fields available for mapping; fallback required if missing)

## Context to Read First

- GitHub #279 — issue-draft/handoff SBAR sections
- `src/cli/issue-draft.mjs` — `formatIssueDraftMarkdown`, `formatDiagnosisBlock`
- `src/cli/handoff.mjs` — `assembleHandoffData`, `renderHandoffMarkdown`
- `tests/cli/issue-draft.test.mjs`, `tests/cli/spine-handoff.test.mjs`
- Parent: SP-745 — diagnose `background` / `assessmentReason`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/cli/issue-draft.mjs`
- `src/cli/handoff.mjs`
- `tests/cli/issue-draft.test.mjs`
- `tests/cli/spine-handoff.test.mjs`
- `tests/cli/handoff-autowrite.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/cli/issue-draft.test.mjs tests/cli/spine-handoff.test.mjs tests/cli/handoff-autowrite.test.mjs tests/cli/spine-issue.test.mjs` |
| fileScopeMustChange | `src/cli/issue-draft.mjs`, `src/cli/handoff.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-745 `.DONE` on main (or fields present on current diagnose output)
- [ ] Read current issue-draft and handoff markdown shapes

### Step 1: Handoff + issue-draft section order

- [ ] Ordered sections: Situation, Background, Assessment, Recommendation
- [ ] Keep Expected/Actual for bug drafts
- [ ] Map diagnose fields when present; else derive Background from journalTail + phase + pendingTasks
- [ ] Empty Background → explicit `(none)`
- [ ] Preserve secret redaction

### Step 2: Tests

- [ ] Assert section order
- [ ] Assert fallback when #278 fields are missing
- [ ] Assert `(none)` for empty Background

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- (none — CLI behavior; runbook gate/handoff quality owned by SP-743 / #280)

**Check If Affected:**

- `docs/adoption/operator-runbook.md` — only if issue-draft/handoff CLI flags are documented; prefer STATUS note

## Completion Criteria

- [ ] Issue-draft and handoff export include the four sections
- [ ] Empty Background is explicit `(none)`
- [ ] Secrets still redacted
- [ ] Tests assert section order + fallback
- [ ] Closes #279
- [ ] `.DONE` created

## Do NOT

- Wait for #278 only and ship without fallback (fallback is required)
- Block on mandatory gate synthesis (#280)
- Rename diagnose public API fields
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `feat(SP-746): issue-draft and handoff SBAR sections (#279)`
