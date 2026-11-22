# Task: SP-883 — Thin-packet authoring conventions

**Created:** 2026-11-22
**Size:** S
**Type:** llm

## Review Level: 0 (None)

**Risk:** Docs/skill drift only — no engine behavior change unless advisory validate is added.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #385 — Codify thin-packet authoring: keep narrative in the GitHub issue; keep Contract, File Scope, Steps, and Do NOT authoritative in the packet. Document the fat-context anti-pattern and add a create-spine-tasks DoR checklist item. Optionally wire an advisory (warn-only) `spine tasks validate` hint when Context to Read First looks like an unbounded issue dump — or document explicit deferral with rationale.

## Dependencies

- **None**

## Context to Read First

- GitHub #385 (parent epic #382)
- `skills/create-spine-tasks/SKILL.md` — Mission `Closes`/`Partial`, neverLoad, Cost-aware authoring
- `docs/adoption/upstream-execution-workflow.md` — dual-layer intake vs packets
- `src/tasks/packet/validate-prompt.mjs` — only if adding advisory validate

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/prompt-template.md`
- `docs/adoption/upstream-execution-workflow.md`
- `src/tasks/packet/validate-prompt.mjs`
- `tests/tasks/validate-prompt-advisory.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/create-spine-tasks/SKILL.md`, `docs/adoption/upstream-execution-workflow.md` |
| fileScopeMustNotChange | `src/batch/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Read #385 ACs and current skill DoR / Context guidance
- [ ] Decide advisory validate vs documented deferral

### Step 1: Document thin-packet conventions

- [ ] Add thin-packet vs fat-context guidance + examples (short Mission + `#N` pointer)
- [ ] Add create-spine-tasks DoR checklist item
- [ ] Cross-link neverLoad and upstream-execution-workflow
- [ ] Advisory validate (warn) OR deferral note with rationale

### Step 2: Testing & Verification

- [ ] `rg -l 'thin.packet|fat-context|Context to Read First' skills/create-spine-tasks docs/adoption`
- [ ] If advisory code added: run scoped node test; else note docs-only

### Step 3: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/SKILL.md`
- `docs/adoption/upstream-execution-workflow.md`

**Check If Affected:**
- `skills/create-spine-tasks/references/prompt-template.md`

## Completion Criteria

- [ ] Skill/docs describe thin-packet vs fat-context
- [ ] DoR checklist item present
- [ ] Advisory validate shipped or deferral documented
- [ ] Contract paths changed; `.DONE` present

## Git Commit Convention

- `docs(SP-883): thin-packet conventions for issue↔packet seam (#385)`

## Do NOT

- Move Contract / File Scope into issue bodies
- Hard-fail validate on any issue link
- Change engine Contract schema
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
