# Task: SP-119 — Require Testing step in docs-only task packets

**Created:** 2026-06-05
**Size:** S

## Review Level: 0 (None)

**Assessment:** SP-118 batch failure from missing Testing step in PROMPT; skill/template gap for Review Level 0 tasks.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Update `create-spine-tasks` skill and prompt template so **every** task packet includes a `### Step N: Testing & Verification` step before `## Completion Criteria`, including docs-only Review Level 0 tasks. Prevents SP-075 worker rejections at launch.

**Source:** Batch 20260605T191325 — SP-118 `prompt_parse_failed`.

## Dependencies

- **None**

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/prompt-template.md`

## Steps

### Step 1: Skill and template updates

- [ ] Document: Review Level 0 docs-only tasks still need Testing step (may skip coverage gate checkbox)
- [ ] Template: Testing step must appear inside `## Steps` before `## Completion Criteria`
- [ ] Add checklist item in Definition of Ready

### Step 2: Testing & Verification

- [ ] Run `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test` (no product code change expected)

### Step 3: Documentation & Delivery

- [ ] STATUS.md complete
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Skill explicitly forbids omitting Testing step for docs-only tasks
- [ ] Template example shows correct section order

## Git Commit Convention

- `docs(SP-119): require Testing step for docs-only task packets`

## Do NOT

- Change validatePrompt rules in this task

---

## Amendments (Added During Execution)
