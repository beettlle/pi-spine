# Task: SP-866 — Operator notes: gate streak fail-closed + integrate gate line

**Created:** 2026-11-18
**Size:** S
**Type:** llm

## Review Level: 0 (None)

**Risk:** Docs-only. Operators may mistrust a successful integrate when the banner still says approval required, or miss streak-lock recovery for #314.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** SP-824 closed the fail-closed/journal half of #314; SP-868 adds streak locking. SP-871 fixes the post-integrate gate banner. This packet documents both operator-facing behaviors.

## Mission

Operators reading the runbook understand gate streak and integrate messaging:

1. **Gate streak (#314 / SP-868)** — After a rejection, streak reset must fail closed; when reset I/O is unreliable, auto-approve stays locked until recovered. Note that streak read-modify-write is lock-protected (SP-868).
2. **Integrate banner (#359 / SP-871)** — After a successful approved integrate, output must not print `Gate: approval required before integrate`. Show approved / omit the line; `→ spine batch complete` remains correct.
3. Cross-link SP-824 (prior Partial #314) and the v2.32 code packets.

Docs only — code is SP-868 / SP-871.

## Dependencies

- **Task:** SP-865 (same runbook file — serialize to avoid merge conflict)

## Context to Read First

- GitHub #314, #359
- `docs/adoption/operator-runbook.md` gate / integrate / land-loop sections
- `spine-tasks/SP-824-gate-streak-reset-fail-closed/PROMPT.md` (Partial #314)
- `spine-tasks/_authoring/release-v2.32.0/manifest.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None


## File Scope

- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `scripts/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-865 landed or same-lane serialization; locate gate streak + integrate output docs

### Step 1: Gate streak + integrate banner docs

- [ ] Document streak fail-closed / lock (#314 remainder)
- [ ] Document post-success integrate gate line (#359)
- [ ] Cross-link SP-868 / SP-871

### Step 2: Testing & Verification

- [ ] `rg -l 'operator-runbook.md' tests/` and run only hits (none → note "no tests reference this doc")
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-866-runbook-gate-streak-integrate/.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — gate streak + integrate gate line

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` (record gaps; do not edit)

## Completion Criteria

- [ ] Runbook covers #314 remainder + #359 operator messaging
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `docs(SP-866): runbook gate streak lock and integrate gate line`

## Do NOT

- Edit `src/` or `bin/`
- Implement #314/#359 code
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
