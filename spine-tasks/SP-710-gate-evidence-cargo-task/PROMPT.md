# Task: SP-710 — Gate evidence allow cargo/task + safe PATH prefix

**Created:** 2026-08-19
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Allowlist extension in evidence-command; must stay fail-closed on shell injection.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0

## Mission

Closes #254 — Integrate-gate evidence collection rejects Rust/go-task consumers because `ALLOWED_EVIDENCE_EXECUTABLES` omits `cargo` and `task`, and `assertSafeEvidenceCommand` rejects any `$`. Extend allowlist for `cargo` and `task` first tokens. Allow a documented safe `PATH="…"` prefix for project-local toolchain paths (e.g. `$HOME/.cargo/bin`) without opening general shell variable expansion. Add preflight/doctor advisory when `testing.test`/`testing.build` would be rejected.

## Dependencies

- **None**

## Context to Read First

- `src/batch/evidence-command.mjs` — `ALLOWED_EVIDENCE_EXECUTABLES`, `assertSafeEvidenceCommand`, `SHELL_METACHAR_PATTERN`
- `tests/batch/evidence.test.mjs` — existing allowlist tests
- GitHub #254, closed #199 (python allowlist precedent)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/evidence-command.mjs`
- `tests/batch/evidence-cargo-task.test.mjs`
- `src/doctor/evidence-config-warn.mjs`
- `src/doctor/run-doctor-checks.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/evidence-cargo-task.test.mjs tests/batch/evidence.test.mjs` |
| fileScopeMustChange | `src/batch/evidence-command.mjs`, `tests/batch/evidence-cargo-task.test.mjs`, `src/doctor/evidence-config-warn.mjs`, `src/doctor/run-doctor-checks.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read #254 rejection messages and git-ai evidence artifacts pattern
- [ ] Confirm `.venv/python` precedent in evidence-command

### Step 1: Extend evidence allowlist

- [ ] Add `cargo` and `task` to allowed first-token executables
- [ ] Parse documented `PATH="…"` prefix (bounded allowlist: `$HOME/.cargo/bin`, project-relative paths) before the main command; reject other `$` expansions
- [ ] Tests: `cargo test`, `task test`, PATH-prefixed cargo; reject `$(…)` and arbitrary `$VAR`

### Step 2: Preflight advisory

- [ ] Add advisory doctor check when spine-config `testing.*` would fail `assertSafeEvidenceCommand` at gate time
- [ ] Return `ok: true, warning: true` — non-blocking

### Step 3: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — evidence command allowlist for non-npm consumers

## Completion Criteria

- [ ] `cargo` / `task` evidence commands accepted when safe
- [ ] Documented PATH prefix works; arbitrary `$` still rejected
- [ ] Advisory doctor warning for misconfigured testing commands
- [ ] Closes #254

## Do NOT

- Enable `shell: true` or arbitrary shell pipelines
- Allow unbounded `$` variable expansion
- Hard-fail doctor on advisory check
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-710): gate evidence cargo/task allowlist (#254)`
