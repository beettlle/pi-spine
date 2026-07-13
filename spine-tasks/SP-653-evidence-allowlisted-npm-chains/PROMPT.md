# Task: SP-653 — Evidence allowlisted npm chains

**Created:** 2026-07-13
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Evidence execution security surface; allowlisted `&&` only — medium novelty + security sensitivity.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 1

## Mission

**Partial:** [#160](https://github.com/beettlle/pi-spine/issues/160) Phase B (narrow)

Extend [`src/batch/evidence-command.mjs`](../../src/batch/evidence-command.mjs) so evidence commands may chain allowlisted executables (`npm`, `node`, `npx`, `pnpm`, `yarn`) with `&&` only. Reject `;`, `|`, redirects, backticks, and `$` expansion fail-closed. Keep Phase A `scripts/` validated-script path unchanged. Do **not** implement Phase C (`testing.review` slot).

After chains work, optionally restore template `testing.build`/`testing.test` to `npm run typecheck && npm test` **only if** SP-651’s regression test is updated to expect Phase B acceptance — otherwise leave Phase-A-safe template and document chain examples in SP-654.

## Dependencies

- **None** (may land parallel with SP-651; if restoring template `&&`, coordinate after SP-651 or update its test in this task’s File Scope)

## Context to Read First

- GitHub issue #160 (Phase B)
- `src/batch/evidence-command.mjs`
- `src/batch/contract-verify.mjs` (shell parity reference for `testCommand` only — do not copy unrestricted shell)
- `tests/batch/evidence.test.mjs`
- `docs/PRD-v2.7.0-operator-ux-evidence-handoff.md` § FR-REL270-05

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/evidence-command.mjs`
- `tests/batch/evidence.test.mjs`
- `tests/batch/evidence-allowlisted-chains.test.mjs`
- `templates/spine-config.json` (optional restore of `&&` after chains land)
- `tests/config/template-evidence-commands.test.mjs` (only if template restored)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/evidence.test.mjs tests/batch/evidence-allowlisted-chains.test.mjs` |
| fileScopeMustChange | `src/batch/evidence-command.mjs`, `tests/batch/evidence-allowlisted-chains.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Document current metacharacter rejection rules
- [ ] Define allowlist + `&&`-only chain grammar (positive tests + reject matrix)

### Step 1: Implement allowlisted `&&` chains

- [ ] Parse/validate multi-segment allowlisted commands joined by `&&`
- [ ] Execute segments sequentially fail-closed (stop on first non-zero)
- [ ] Keep scripts/ Phase A path working
- [ ] Reject other shell metacharacters / expansions

### Step 2: Testing & Verification

- [ ] Add `tests/batch/evidence-allowlisted-chains.test.mjs` (accept `npm run typecheck && npm test`; reject `|`, `;`, `>`, `$VAR`)
- [ ] Extend `tests/batch/evidence.test.mjs` if needed
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Coverage gate (code change): `npm run coverage:check` (≥77% line coverage)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`
- [ ] Comment on #160 that Phase B narrow shipped; Phase C still open (do not close #160)

## Documentation Requirements

**Must Update:**
- None (narrative in SP-654)

**Check If Affected:**
- `docs/stet-overview.md` — Approach 2 gate evidence
- `docs/adoption/operator-runbook.md` — SP-654

## Completion Criteria

- [ ] Allowlisted `&&` chains execute for evidence build/test
- [ ] Non-allowlisted / other metacharacters still rejected
- [ ] Phase A scripts/ path unchanged
- [ ] #160 remains open with Phase B note (Phase C deferred)

## Do NOT

- Enable full `/bin/sh -c` for arbitrary evidence strings
- Implement `testing.review` slot (Phase C)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `feat(SP-653): allow allowlisted && chains in gate evidence (#160 Phase B)`
