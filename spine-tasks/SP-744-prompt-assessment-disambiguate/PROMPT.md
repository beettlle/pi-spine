# Task: SP-744 — Disambiguate PROMPT Assessment field

**Created:** 2026-09-04
**Size:** S

## Review Level: 0 (None)

**Assessment:** Authoring docs/templates only; no mass rewrite of historical packets; validators keep accepting legacy Assessment.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Closes #281 — Disambiguate overloaded PROMPT `**Assessment:**` in authoring guidance/templates: separate severity/blast (`**Risk:**`) from problem theory / working diagnosis (`**Problem theory:**`). Update spine task-authoring rule and create-spine-tasks prompt template. Do **not** mass-rewrite historical `spine-tasks/**/PROMPT.md`. Validate tooling must keep accepting legacy `**Assessment:**` alone.

## Dependencies

- **None**

## Context to Read First

- GitHub #281 — Assessment disambiguation brief
- `skills/create-spine-tasks/references/prompt-template.md` — current `**Assessment:**` line
- `.cursor/rules/spine-task-authoring.mdc` — authoring guidance
- Related: #278 diagnose “Assessment” naming collision

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/references/prompt-template.md`
- `.cursor/rules/spine-task-authoring.mdc`
- `templates/tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/create-spine-tasks/references/prompt-template.md`, `.cursor/rules/spine-task-authoring.mdc` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm current template uses overloaded `**Assessment:**`
- [ ] Confirm no validator requires only the new field names

### Step 1: Template + authoring rule

- [ ] Prefer additive fields: `**Risk:**` (blast/severity) and `**Problem theory:**` (working diagnosis) — or document one canonical meaning and deprecate the other
- [ ] Update `prompt-template.md` with an example using the unambiguous fields
- [ ] Update `spine-task-authoring.mdc` accordingly
- [ ] Note: legacy `**Assessment:**` alone remains valid

### Step 2: Optional adoption note

- [ ] Brief note in `templates/tasks/CONTEXT.md` or adoption authoring checklist if present — otherwise STATUS defers with rationale
- [ ] Do **not** rewrite historical PROMPT.md packets

### Step 3: Testing & Verification

- [ ] Confirm template + rule show unambiguous fields and legacy acceptance
- [ ] Optional: `spine tasks validate` on a sample docs packet still passes with legacy Assessment if present

### Step 4: Documentation & Delivery

- [ ] Template + authoring rule updated
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `skills/create-spine-tasks/references/prompt-template.md` — Risk / Problem theory (or documented canonical meaning)
- `.cursor/rules/spine-task-authoring.mdc` — same guidance

**Check If Affected:**

- `templates/tasks/CONTEXT.md` — optional one-line authoring note

## Completion Criteria

- [ ] New authoring docs/templates use unambiguous fields
- [ ] Legacy `**Assessment:**` still documented as accepted
- [ ] One example in docs/template
- [ ] Closes #281
- [ ] `.DONE` created

## Do NOT

- Mass-rewrite historical `spine-tasks/**/PROMPT.md`
- Change prompt parse / validate to reject legacy `**Assessment:**`
- Implement diagnose packet fields (SP-745)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `docs(SP-744): disambiguate PROMPT Assessment (#281)`
