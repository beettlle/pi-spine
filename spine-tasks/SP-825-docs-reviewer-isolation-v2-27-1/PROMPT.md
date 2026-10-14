# Task: SP-825 — Docs: reviewer extension isolation and review-failure recovery (v2.27.1)

**Created:** 2026-10-10
**Size:** S

## Review Level: 0 (None)

**Risk:** Docs only. Wrong recovery guidance would send operators back to unreviewed salvage.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Closes #334 — Document the v2.27.1 reviewer isolation, the new review-failure classification, the re-review recovery path, and the doctor check, and replace the salvage-first guidance for post-`.DONE` review failures.

1. **Operator runbook** (`docs/adoption/operator-runbook.md`):
   - In `### Agent model pins` (~544): reviewers now spawn with `pi -ne` (no user extensions) by default. Opt out with `spine settings set agents.reviewer.loadUserExtensions true` (also valid per profile under `agents.profiles.<name>.reviewer`). Workers are unchanged.
   - Rewrite `### Salvage → complete land loop after post-DONE plan-review spawn failure (#291, #292)` (~1539) so a review that produced no verdict (`*_review_spawn_failed`, `*_review_timeout`, `*_review_provider_error`) is recovered by re-running the review (`spine batch retry <taskId>`, which resumes at the review, then `spine batch resume`). Salvage becomes a last resort that lands unreviewed work and needs explicit operator sign-off. Note the #331 caveat: a retried post-hoc plan review can still reject finished work.
   - Add a subsection near `### Final review spawn timeout` (~1962): `### Reviewer provider errors (*_review_provider_error)` — what the reason means, where the provider message is (`review.failed` `providerMessage`, reviewer output log), and that `spine doctor` lists pi extensions that register `context`, `context_with_system`, or `before_provider_request` hooks (warning only when `loadUserExtensions` is `true`). Cite the v2.27.0 pi-headroom incident in one sentence.
2. **Release operator skill** (`skills/spine-release-operator/SKILL.md`): in Phase 4, one short paragraph: reviewers no longer load user extensions by default (v2.27.1, #334), so extension overrides are needed only when `agents.reviewer.loadUserExtensions` is `true`; review spawn or provider failures with `.DONE` in the lane are recovered with re-review, not salvage.

## Dependencies

- **Task:** SP-819 (reviewer `-ne` + `loadUserExtensions`)
- **Task:** SP-820 (`*_review_provider_error`)
- **Task:** SP-821 (re-review diagnose guidance)
- **Task:** SP-822 (doctor check)

## Context to Read First

- GitHub #334
- STATUS Discoveries of `spine-tasks/SP-819-reviewer-spawn-no-extensions`, `spine-tasks/SP-820-reviewer-provider-error-class`, `spine-tasks/SP-821-review-failure-rereview-diagnose`, and `spine-tasks/SP-822-doctor-context-hook-extensions` (final names, reasons, headlines)
- `docs/adoption/operator-runbook.md` 540-620, 1500-1600, 1955-2060
- `skills/spine-release-operator/SKILL.md` Phase 4

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `skills/spine-release-operator/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md`, `skills/spine-release-operator/SKILL.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Read the merged code for SP-819–SP-822 and record the exact key name, exit reasons, headline text, and doctor check label in Discoveries
- [ ] Dependencies satisfied

### Step 1: Operator runbook

- [ ] Agent model pins: reviewer `-ne` default + opt-out
- [ ] Post-DONE review failure section rewritten (re-review first)
- [ ] Reviewer provider errors subsection

**Artifacts:**
- `docs/adoption/operator-runbook.md` (modified)

### Step 2: Release operator skill

- [ ] Phase 4 paragraph

**Artifacts:**
- `skills/spine-release-operator/SKILL.md` (modified)

### Step 3: Testing & Verification

- [ ] Run the full suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Every command in the new text matches a real CLI command or settings key (`spine settings show agents.reviewer.loadUserExtensions` succeeds)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`
- `skills/spine-release-operator/SKILL.md`

**Check If Affected:**
- `README.md` (configuration table, if it lists reviewer keys)

## Completion Criteria

- [ ] Runbook documents reviewer isolation, the opt-out key, provider-error classification, the doctor check, and re-review recovery
- [ ] No remaining runbook text recommends `salvage --integrate` as the first step after a post-`.DONE` review spawn failure
- [ ] Closes #334

## Git Commit Convention

- `docs(SP-825): reviewer isolation and re-review recovery (#334)`

## Do NOT

- Edit code, tests, or `README.md` (advisory only)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- **2026-10-14 (operator, v2.27.1 readiness):** Preflight flags `skills/spine-release-operator/SKILL.md` as pre-landed: `f39c87d1` (#342, token-cost authoring and operator guidance) rewrote parts of it after this packet was authored. None of this packet's content is on `main` (no reviewer `-ne`, `loadUserExtensions`, `*_review_provider_error`, or re-review guidance in the skill), so `fileScopeMustChange` stays as written. SP-828 (release wave 0) also edits `docs/adoption/operator-runbook.md` §8.1 (stet); leave that section as SP-828 left it. Build the Phase 4 paragraph on the post-#342 skill text.
