# Task: SP-493 — Skill two-deliverable split test

**Created:** 2026-07-04
**Size:** S

## Review Level: 0 (None)

**Assessment:** Single-section skill documentation update adding a sizing heuristic to Step B Slice. No runtime code changes.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-493-skill-two-deliverable-split/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Every superseded composite task (SP-419, SP-428, SP-430, SP-436, SP-461) was split into exactly two children because it bundled two logically independent deliverables. The current rule ("Max 4 implementation steps → split") is necessary but insufficient.

Add a **two-deliverable test** to Step B Slice in the create-spine-tasks skill: if steps cluster into two independent deliverable groups with no data dependency, split into separate tasks even when step count is ≤4.

**Closes:** [#140](https://github.com/beettlle/pi-spine/issues/140)

## Dependencies

- **Task:** SP-492 (shared `SKILL.md` file scope — run serially after contract-template guidance lands)
- **Task:** SP-494 (stet Option A bootstrap — batch ordering)

## Context to Read First

**Tier 3 (load only if needed):**
- GitHub issue #140
- `skills/create-spine-tasks/SKILL.md` — Step B Slice section
- `spine-tasks/CONTEXT.md` — Phase 55 decomposition table (evidence)

## Environment

- **Workspace:** `skills/create-spine-tasks/`
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/create-spine-tasks/SKILL.md` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #140 acceptance criteria
- [ ] Read Step B Slice section in SKILL.md

### Step 1: Add two-deliverable split test to Step B

- [ ] Add rule to Step B Slice table/guidance:
  > **Two-deliverable test:** If your Steps can be grouped into two clusters with no data dependency between them, split into separate tasks even if the step count is ≤4. The #1 sizing mistake is bundling two independent deliverables in one M task.
- [ ] Include brief evidence reference (SP-419→466/467, SP-428→468/469, SP-430→470/471, SP-436→474/475, SP-461→478/479) — table or bullet list

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #140: `gh issue close 140 --comment "Two-deliverable split test added to Step B — SP-493"`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/SKILL.md` — Step B Slice section

## Completion Criteria

- [ ] All steps complete
- [ ] Two-deliverable test visible in Step B Slice guidance
- [ ] Issue #140 closed

## Git Commit Convention

- **Step completion:** `docs(SP-493): complete Step N — description`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Modify contract-template.md (covered by SP-492)
- Modify runtime spine code
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
