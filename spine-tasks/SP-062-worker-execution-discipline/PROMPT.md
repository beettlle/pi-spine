# Task: SP-062 — Worker execution discipline

**Created:** 2026-06-03
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Expands the canonical worker standing orders with resume algorithm, checkbox discipline, file-scope guardrails, and context-limit behavior — high leverage but confined to one template file.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Expand `templates/agents/worker.md` so pi-spine workers have explicit, spine-native execution discipline: how to resume after scheduler re-invocation, when to tick STATUS checkboxes, how to honor **FR-WORK-06** (File Scope), how to exit cleanly on context limit (**FR-WORK-04**), and where projects inject overrides (**FR-WORK-08**). Do **not** import Taskplane’s `.DONE` prohibition language — spine already documents `.DONE` + auto-commit behavior honestly.

## Dependencies

- **Task:** SP-061 (code coverage policy may add worker text; merge without duplicating coverage sections)

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `templates/agents/worker.md` (current)
- `docs/PRD.md` §7.5 (FR-WORK-01–08)
- `bin/spine-worker-runner.mjs`, `src/batch/agent-session-worker.mjs` (inline hints — deduped in SP-067)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/agents/worker.md`

## Steps

### Step 0: Preflight

- [ ] Read current `templates/agents/worker.md` and PRD FR-WORK-01–08
- [ ] Confirm SP-061 coverage sections (if landed) — do not rewrite them here

### Step 1: Resume algorithm

> **Plan-review checkpoint**

- [ ] Add a **Resume algorithm** section: worker reads STATUS.md → finds first incomplete step → continues from there; never restart completed steps
- [ ] Document single-session goal (FR-WORK-01): work through all incomplete steps until done or context limit
- [ ] Clarify scheduler re-invocation is expected after context-limit exit (FR-WORK-04)

**Artifacts:**
- `templates/agents/worker.md` (modified)

### Step 2: Checkbox + File Scope discipline

> **Code review checkpoint**

- [ ] Add **Immediate checkbox rule**: mark each checkbox complete in STATUS.md as soon as the outcome is done — not batched at step end
- [ ] Document **FR-WORK-06 File Scope**: no edits outside `## File Scope` without a PROMPT amendment; cite the section heading workers must obey
- [ ] Keep existing checkpoint / stall / spine tool guidance coherent with new sections

**Artifacts:**
- `templates/agents/worker.md` (modified)

### Step 3: Context limit + project customization header

- [ ] Add **FR-WORK-04 context limit** behavior: persist STATUS, commit in-progress work, exit 0; do not create `.DONE` prematurely
- [ ] Add **Project customization header** comment block at top (below YAML frontmatter): projects override via `.spine/agents/worker.md` appended after base template (FR-WORK-08)
- [ ] Explicitly **omit** Taskplane `.DONE` prohibition imports

**Artifacts:**
- `templates/agents/worker.md` (modified)

### Step 4: Testing & Verification

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Self-review: new sections are scannable, non-contradictory with existing checkpoint discipline

## Documentation Requirements

**Must Update:**
- `templates/agents/worker.md` — all deliverables above

**Check If Affected:**
- None (runner dedup is SP-067)

## Completion Criteria

- [ ] All steps complete
- [ ] Worker template documents resume, checkbox, file scope, context limit, and customization header
- [ ] No Taskplane `.DONE` prohibition text imported
- [ ] Full test suite green

## Git Commit Convention

- **Step completion:** `feat(SP-062): complete Step N — description`
- **Docs:** `docs(SP-062): expand worker execution discipline`

## Do NOT

- Edit `bin/spine-worker-runner.mjs` or `src/batch/agent-session-worker.mjs` (SP-067)
- Import Taskplane `.DONE` prohibition wording
- Add review-level table or L2 commit→review ordering (SP-063)
- Expand scope beyond `templates/agents/worker.md`

## Amendments

_(Workers only.)_
