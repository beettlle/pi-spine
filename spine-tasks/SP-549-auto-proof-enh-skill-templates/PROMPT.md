# Task: SP-549 — create-spine-tasks skill template hygiene

**Created:** 2026-07-08
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only skill template updates; no engine changes.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Update create-spine-tasks skill templates to close authoring hygiene gaps:

1. **#144:** Documentation Requirements paths must appear in File Scope (add explicit rule + template example)
2. **#145:** Remove dead boilerplate from prompt template (Canonical Task Folder, separate Build passes checkbox, Tier 2/3 labels, mid-step test checkboxes)

**Closes:** [#144](https://github.com/beettlle/pi-spine/issues/144), [#145](https://github.com/beettlle/pi-spine/issues/145)

## Dependencies

- SP-543

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/prompt-template.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/create-spine-tasks/references/prompt-template.md` |

## Steps

### Step 0: Preflight

- [ ] Read issues #144 and #145

### Step 1: File Scope / Documentation Requirements rule (#144)

- [ ] Add normative rule in SKILL.md Step 4 / prompt-template
- [ ] Example showing doc paths duplicated in File Scope when listed under Documentation Requirements

**Artifacts:**
- `skills/create-spine-tasks/SKILL.md` (modified)
- `skills/create-spine-tasks/references/prompt-template.md` (modified)

### Step 2: Remove dead boilerplate (#145)

- [ ] Remove or mark optional: Canonical Task Folder block, Tier labels, Build passes duplicate, mid-step test checkboxes
- [ ] Keep Testing & Verification step requirement (SP-075)

**Artifacts:**
- `skills/create-spine-tasks/references/prompt-template.md` (modified)

### Step 3: Testing & Verification

- [ ] `spine tasks validate SP-549`

### Step 4: Documentation & Delivery

- [ ] Close #144 and #145
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Template matches patterns used by SP-430+ good tasks
- [ ] Doc paths in Documentation Requirements also in File Scope rule documented

## Git Commit Convention

- `docs(SP-549): create-spine-tasks template hygiene (#144, #145)`

## Do NOT

- Change spine engine validate logic (future task if needed)
