# Task: SP-848 — Authoring guidance: stet in reviewCommand, strictness by size

**Created:** 2026-11-01
**Size:** S

## Review Level: 0 (None)

**Risk:** Docs-only. Authors who keep chaining stet onto `testCommand` spend the test timeout on review and lose the blocking/advisory policy.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** `.cursor/rules/spine-task-authoring.mdc` (~106-114) already shows `reviewCommand` for stet. `skills/create-spine-tasks/references/contract-template.md` (296 lines) has no `reviewCommand` row or guidance, so skill-driven authoring never adds it. Neither file says which strictness to pick per size or that the gate now ignores findings below `warning` / confidence `0.8` (SP-846, `SPINE_STET_MIN_SEVERITY` / `SPINE_STET_MIN_CONFIDENCE`).

## Mission

Packet authors using either the skill template or the authoring rule put stet in `reviewCommand` with a size-appropriate strictness:

1. **Contract template** — Add `reviewCommand` to the field table and one code-task example: `bash scripts/spine-stet-contract-run.sh <lenient|default|strict> SP-###`. State: runs once after `testCommand` passes, never retries, bounded by `contract.reviewTimeoutMs`, policy `contract.reviewPolicy` (`blocking` default / `advisory`); never chain stet onto `testCommand`; docs-only and `Type: execute` packets omit it.
2. **Strictness guidance** (both files) — S → `lenient` or `default`; M → `default`; security-sensitive → `strict`. The gate blocks only findings at `warning` or above with confidence ≥ 0.8 (env overrides above).
3. **Authoring rule** — Keep the existing example; add the strictness line and the threshold note.

## Dependencies

- **None**

## Context to Read First

- `skills/create-spine-tasks/references/contract-template.md` (whole file)
- `.cursor/rules/spine-task-authoring.mdc` 95-125

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/references/contract-template.md`
- `.cursor/rules/spine-task-authoring.mdc`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/create-spine-tasks/references/contract-template.md`, `.cursor/rules/spine-task-authoring.mdc` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `scripts/**` |

## Steps

### Step 0: Preflight

- [ ] Read both files; note every Contract table and example that would need a `reviewCommand` row

### Step 1: Contract template

- [ ] `reviewCommand` field row and code-task example
- [ ] Semantics: once, after passing `testCommand`, no retries, `contract.reviewTimeoutMs`, `contract.reviewPolicy`
- [ ] Omit for docs-only and `Type: execute`

**Artifacts:**
- `skills/create-spine-tasks/references/contract-template.md` (modified)

### Step 2: Strictness and threshold guidance

- [ ] Strictness by size in both files
- [ ] Threshold note (`warning` / 0.8, env overrides) in both files

**Artifacts:**
- `.cursor/rules/spine-task-authoring.mdc` (modified)

### Step 3: Testing & Verification

- [ ] `rg -l 'contract-template.md|spine-task-authoring.mdc' tests/` and run only the hits with `node --experimental-strip-types --test --test-reporter=dot <files>` (none → note "no tests reference these docs")
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-848-stet-reviewcommand-authoring/.DONE`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/references/contract-template.md` — `reviewCommand`
- `.cursor/rules/spine-task-authoring.mdc` — strictness + threshold

**Check If Affected:**
- `skills/create-spine-tasks/SKILL.md` (do not edit; SP-855 edits it in a later batch)

## Completion Criteria

- [ ] Both authoring sources show stet in `reviewCommand` with strictness guidance
- [ ] No example chains stet onto `testCommand`

## Git Commit Convention

- `docs(SP-848): stet reviewCommand and strictness guidance for packet authors`

## Do NOT

- Edit `skills/create-spine-tasks/SKILL.md`, `scripts/`, `src/`, or `bin/`
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
