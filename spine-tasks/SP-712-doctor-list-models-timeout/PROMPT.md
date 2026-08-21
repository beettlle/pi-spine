# Task: SP-712 — Doctor ETIMEDOUT on --list-models is advisory

**Created:** 2026-08-19
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Doctor check behavior change; mirror advisory pattern from quota-risk / attached-orphan.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #256 — When `spawnSync("pi", ["--list-models"])` returns ETIMEDOUT (slow catalog fetch), doctor must **not** hard-fail with misleading `pi login` suggestion. Treat ETIMEDOUT as advisory (`ok: true, warning: true`) with detail naming timeout. Optionally increase timeout modestly; preflight must not fail solely on slow `--list-models`. Distinct from #97 auth failures.

## Dependencies

- **None**

## Context to Read First

- `src/doctor/run-doctor-checks.mjs` — `checkModelProvider` (~169–201)
- `src/doctor/attached-orphan-risk.mjs` — advisory warn pattern
- `tests/doctor/model-id-validation.test.mjs` — doctor test style
- GitHub #256, #97

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/doctor/run-doctor-checks.mjs`
- `tests/doctor/list-models-timeout.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/doctor/list-models-timeout.test.mjs` |
| fileScopeMustChange | `tests/doctor/list-models-timeout.test.mjs` |

## Amendments

### Amendment 1 — 2026-08-20 (operator)

**Issue:** Preflight `prelanded-file-scope` — `src/doctor/run-doctor-checks.mjs` already changed on `main` (SP-710 Wave 0 evidence-config-warn wiring).
**Resolution:** Redirected `fileScopeMustChange` to the new timeout test only. File Scope still allows edits to `run-doctor-checks.mjs` for the ETIMEDOUT advisory (#256).

## Steps

### Step 0: Preflight

- [ ] Confirm ETIMEDOUT currently maps to `ok: false` + `pi login`
- [ ] Confirm preflight fails on any `!entry.ok` doctor row

### Step 1: Advisory ETIMEDOUT handling

- [ ] Detect `result.error?.code === "ETIMEDOUT"` (or err.code ETIMEDOUT in catch)
- [ ] Return `{ ok: true, warning: true, detail: "…", suggestedCommand: "retry spine doctor" }` — not `pi login`
- [ ] Keep genuine auth / no-models cases as hard fail where appropriate
- [ ] Unit test with mocked spawnSync timeout path

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — doctor ETIMEDOUT vs auth failure

## Completion Criteria

- [ ] ETIMEDOUT on `--list-models` is advisory, not blocking
- [ ] `pi login` not suggested for timeout-only failures
- [ ] Scoped tests pass
- [ ] Closes #256

## Do NOT

- Mask real auth failures as warnings
- Hard-fail preflight on ETIMEDOUT
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-712): doctor ETIMEDOUT on list-models is advisory (#256)`
