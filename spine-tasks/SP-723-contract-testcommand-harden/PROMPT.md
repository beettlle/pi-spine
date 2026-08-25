# Task: SP-723 — Harden contract testCommand execution

**Created:** 2026-08-25
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Input hardening at contract verify boundary; security.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0

## Mission

Closes #268 — Reject `$`, backticks, `;`, `|`, `&&`, `||` in PROMPT `testCommand` at parse or contract-verify time (before shell spawn). Distinct error message from #254 gate evidence path. Update `tests/batch/contract-exec.test.mjs`. Docs already in SP-721.

## Dependencies

- **None**

## Context to Read First

- `src/batch/contract-exec.mjs` — runContractTestCommand
- `src/batch/evidence-command.mjs` — #254 pattern to mirror (do not change)
- GitHub #268, #254

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-exec.mjs`
- `src/tasks/packet/parse-prompt.mjs`
- `tests/batch/contract-exec.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/contract-exec.test.mjs` |
| fileScopeMustChange | `tests/batch/contract-exec.test.mjs` |

## Steps

### Step 1: Reject dangerous metachars

- [ ] Reject `$`, backticks, `;`, `|`, `&&`, `||` before shell spawn
- [ ] Emit distinct error copy from #254 gate evidence path
- [ ] Prefer parse-time validation; fail closed at contract verify if needed

### Step 2: Tests

- [ ] Cover rejection cases in `tests/batch/contract-exec.test.mjs`
- [ ] Keep happy-path valid testCommand fixtures green

### Step 3: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/stet-overview.md` — SP-721 owns primary doc update

## Completion Criteria

- [ ] Metachar/`$` rejected before shell spawn
- [ ] Distinct error from #254 path
- [ ] Closes #268
- [ ] `.DONE` created

## Do NOT

- Change gate evidence command path (#254)
- Remove shell entirely without documented escape hatch
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `fix(SP-723): harden contract testCommand metachar rejection (#268)`
