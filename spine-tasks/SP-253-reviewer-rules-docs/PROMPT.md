# Task: SP-253 — Reviewer rules docs + FR-REV-08

**Created:** 2026-06-14
**Size:** S

## Review Level: 0 (None)

**Assessment:** Documentation-only; captures FR-REV-08 and reviewer rules design after implementation lands.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Document reviewer Cursor rules auto-selection: PRD FR-REV-08, design doc reviewer section, scope table, CLI examples, and cross-ref to worker FR-WORK-05.

## Dependencies

- **Task:** SP-251 (review spawn integration)
- **Task:** SP-252 (CLI preview)

## Context to Read First

- `docs/design/cursor-rules-discovery.md`
- `docs/PRD.md` — §7.5, §7.6
- `src/config/reviewer-context.mjs`
- `src/cli/rules.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/design/cursor-rules-discovery.md`
- `docs/PRD.md`
- `skills/create-spine-tasks/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/design/cursor-rules-discovery.md`, `docs/PRD.md` |

## Steps

### Step 0: Preflight

- [ ] SP-251 + SP-252 complete
- [ ] Read landed implementation (reviewer-context, review.mjs, CLI)

### Step 1: Design doc
> **Plan-review checkpoint**

- [ ] Add reviewer section to `cursor-rules-discovery.md`: profile, scope table, 16 KiB cap, journal `reviewer.rules_selected`
- [ ] CLI examples: `spine rules select --role reviewer --review-type code --task <id>`
- [ ] Cross-ref worker FR-WORK-05

### Step 2: PRD + skill
> **Code review checkpoint**

- [ ] PRD §7.6: **FR-REV-08** — reviewer bounded Cursor rules injection
- [ ] Update `create-spine-tasks` SKILL Tier 4 note if reviewer rules affect authoring guidance
- [ ] `spine_review_step` after step (optional at Level 0 — skip if Review Level 0)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify doc links and FR IDs are consistent
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/design/cursor-rules-discovery.md`
- `docs/PRD.md`

**Check If Affected:**
- `skills/create-spine-tasks/SKILL.md`

## Completion Criteria

- [ ] All steps complete
- [ ] FR-REV-08 documented with accurate behavior
- [ ] Full test suite still passes

## Git Commit Convention

- `docs(SP-253): complete Step N — description`

## Do NOT

- Change application code
- Duplicate worker-only discovery content

---

## Amendments (Added During Execution)
