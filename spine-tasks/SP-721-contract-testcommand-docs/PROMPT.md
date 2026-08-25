# Task: SP-721 — Docs: contract testCommand vs gate evidence hardening

**Created:** 2026-08-25
**Size:** S

## Review Level: 0 (Docs Only)

**Assessment:** Documentation-only companion to #268.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Partial #268 — Document that PROMPT Contract `testCommand` execution differs from gate evidence commands (#254): shell vs hardened `execFileSync` allowlist. Update `docs/stet-overview.md` and a short operator-runbook note so authors know metachar/`$` rules for contract vs gate paths. Code hardening is SP-723.

## Dependencies

- **None**

## Context to Read First

- `docs/stet-overview.md` — current contract/gate narrative
- `docs/adoption/operator-runbook.md` — operator-facing contract authoring
- GitHub #268, #254

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/stet-overview.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `grep -q 'contract testCommand' docs/stet-overview.md && grep -q 'gate evidence' docs/stet-overview.md` |
| fileScopeMustChange | `docs/stet-overview.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 1: Document dual execution models

- [ ] In `docs/stet-overview.md`, contrast Contract `testCommand` (shell) vs gate evidence (#254 hardened path)
- [ ] Add operator-runbook note: avoid `$`, backticks, `;`, `|`, `&&`, `||` in PROMPT testCommand once SP-723 lands
- [ ] Cross-link #268 / SP-723 for the code change

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/stet-overview.md` — contract vs gate evidence execution models
- `docs/adoption/operator-runbook.md` — authoring note for testCommand metachars

**Check If Affected:**
- `skills/create-spine-tasks/references/contract-template.md` — only if wording conflicts

## Completion Criteria

- [ ] Docs clearly separate contract vs gate evidence execution
- [ ] Contract testCommand passes
- [ ] `.DONE` created

## Do NOT

- Implement code hardening (SP-723)
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `docs(SP-721): contract testCommand vs gate evidence (#268)`
