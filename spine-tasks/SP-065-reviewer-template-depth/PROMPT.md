# Task: SP-065 — Reviewer template depth

**Created:** 2026-06-03
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Substantially expands reviewer standing orders — build/typecheck gates, structured REVISE, inline rubric, fresh-spawn policy, and 77% coverage — but scoped to one template.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Expand `templates/agents/reviewer.md` into a complete spine-native reviewer contract. Code reviews must run project `testing.build` and typecheck commands from `.spine/spine-config.json` before issuing **APPROVE**. **REVISE** verdicts must cite specific files, line ranges, and missing tests. Include an inline **Review Levels 0–3** rubric, enforce **fresh-spawn-only** review (no `wait_for_review` polling — write output file and exit), and verify **≥77% line coverage** on changed code paths when SP-061 policy applies.

## Dependencies

- **Task:** SP-061 (77% coverage policy — reviewer must reference same threshold)

## Context to Read First

**Tier 3:**
- `templates/agents/reviewer.md` (current)
- `templates/agents/worker.md` — worker review expectations (read-only; do not edit)
- `skills/create-spine-tasks/SKILL.md` — review levels
- `docs/PRD.md` §7.6 (FR-REV-01–06)
- `templates/spine-config.json` — `testing.build`, typecheck fields

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/agents/reviewer.md`

## Steps

### Step 0: Preflight

- [ ] Read SP-061 reviewer coverage text (if landed)
- [ ] Read spine-config testing command shape

### Step 1: Build + typecheck gate

> **Plan-review checkpoint**

- [ ] Code review section: run `testing.build` and typecheck from `.spine/spine-config.json` (or documented fallback) **before** APPROVE on code reviews
- [ ] Fail closed: if build/typecheck fails, REVISE with command output summary

**Artifacts:**
- `templates/agents/reviewer.md` (modified)

### Step 2: REVISE structure + review level rubric

> **Code review checkpoint**

- [ ] **REVISE** must list blocking issues with file paths, line references, and missing test names/paths
- [ ] Add inline **Review Levels 0–3** rubric table (aligned with create-spine-tasks skill)
- [ ] Plan review section: evaluate step plan against PROMPT outcomes (unchanged spirit, clearer structure)

**Artifacts:**
- `templates/agents/reviewer.md` (modified)

### Step 3: Fresh spawn + coverage

- [ ] Document **fresh-spawn-only**: reviewer writes verdict to requested output path and exits — no waiting for worker, no `wait_for_review`
- [ ] Code review: verify **≥77% line coverage** on changed/in-scope modules (SP-061); REVISE when coverage or tests insufficient
- [ ] Preserve FR-REV-02 JSON verdict block contract

**Artifacts:**
- `templates/agents/reviewer.md` (modified)

### Step 4: Testing & Verification

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Self-review: reviewer template is actionable without external Taskplane docs

## Documentation Requirements

**Must Update:**
- `templates/agents/reviewer.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] Build/typecheck gate, structured REVISE, review level rubric, fresh-spawn-only, and 77% coverage check documented
- [ ] FR-REV-02 verdict contract preserved
- [ ] Full test suite green

## Git Commit Convention

- **Step completion:** `feat(SP-065): complete Step N — description`

## Do NOT

- Edit worker template (SP-062/063)
- Implement runtime review spawn changes (template only)
- Lower 77% coverage threshold

## Amendments

_(Workers only.)_
