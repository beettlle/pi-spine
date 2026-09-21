# Task: SP-760 — Allow bare python3 in gate evidence executables

**Created:** 2026-09-21
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Expands evidence allowlist first-token set; keep fail-closed for shell metacharacters and non-allowlisted executables.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0
**Problem theory:** #199 / SP-638 allowed project-local `.venv/bin/python*` only. Consumer configs using bare `python3 -m pytest …` still hit `evidence executable not allowed: python3`; doctor warns evidence-safe on v2.21.0.

## Mission

Closes #290 — Add bare `python3` (and `python` if needed for parity) to `ALLOWED_EVIDENCE_EXECUTABLES` so gate evidence and doctor evidence-safe checks accept PATH-resolved interpreters used by Python consumers. Keep shell metacharacter rejection and project-local interpreter rules intact. Update unit tests and a brief operator note path owned by docs tasks if File Scope stays code-only.

## Dependencies

- **None**

## Context to Read First

- `src/batch/evidence-command.mjs` — `ALLOWED_EVIDENCE_EXECUTABLES`, `ALLOWED_PROJECT_LOCAL_INTERPRETERS`
- `src/doctor/evidence-config-warn.mjs`
- `tests/batch/evidence.test.mjs`
- GitHub #290 (regression / incomplete fix of #199)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/evidence-command.mjs`
- `tests/batch/evidence.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/evidence.test.mjs` |
| fileScopeMustChange | `src/batch/evidence-command.mjs`, `tests/batch/evidence.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm bare `python3 -m pytest` is rejected by `parseEvidenceCommandArgv` / `assertSafeEvidenceCommand` today
- [ ] Confirm `.venv/bin/python3` still accepted via project-local rule
- [ ] Dependencies satisfied

### Step 1: Allow bare python3 (and python if parity)

- [ ] Add `python3` to `ALLOWED_EVIDENCE_EXECUTABLES` (add `python` only if tests/docs require PATH parity)
- [ ] Keep rejecting unknown executables and shell metacharacters
- [ ] Unit tests: bare `python3 …` allow; still reject `bash` / metachar chains

**Artifacts:**
- `src/batch/evidence-command.mjs` (modified)
- `tests/batch/evidence.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (runbook evidence table may be updated in SP-765/SP-766 only if listed there)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — #199 row still says bare python rejected
- `docs/stet-overview.md` — evidence allowlist prose

## Completion Criteria

- [ ] Bare `python3 …` parses for gate evidence
- [ ] Doctor evidence-safe no longer warns solely for bare python3
- [ ] Closes #290

## Git Commit Convention

- `fix(SP-760): allow bare python3 for gate evidence (#290)`

## Do NOT

- Re-enable arbitrary shell metacharacters
- Remove project-local venv interpreter path checks
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
