# Task: SP-638 — Evidence allow venv python

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Extend evidence allowlist for project-local interpreters; security-sensitive path checks.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0

## Mission

**Closes:** [#199](https://github.com/beettlle/pi-spine/issues/199)

Gate evidence currently rejects `.venv/bin/python` with `evidence executable not allowed: python`. Allow project-local interpreters under relative paths such as `.venv/bin/python` (and similarly `venv/bin/python`) while remaining fail-closed for arbitrary absolute/outside-project executables. Prefer a preflight or clear error when `collectTestEvidence` is on but the command would still be rejected.

**Source:** [`docs/PRD-v2.6.0-consumer-resume-handoff.md`](../../docs/PRD-v2.6.0-consumer-resume-handoff.md) §6 FR-REL260-04

**Related:** #160 (SP-639 scripts executor)

## Dependencies

- **None**

## Context to Read First

- `src/batch/evidence-command.mjs` — `ALLOWED_EVIDENCE_EXECUTABLES`, `parseEvidenceCommandArgv`
- `tests/batch/evidence.test.mjs`
- GitHub #199

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/evidence-command.mjs`
- `tests/batch/evidence.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/evidence.test.mjs` |
| fileScopeMustChange | `src/batch/evidence-command.mjs`, `tests/batch/evidence.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm `.venv/bin/python -m unittest …` is rejected today
- [ ] Review allowlist security boundaries

### Step 1: Allow project-local python paths

- [ ] Accept relative project paths whose basename is an allowed interpreter (`python`, `python3`) under `.venv/` or `venv/` (document exact rule in code comments)
- [ ] Keep rejecting bare `python` and outside-project absolute paths
- [ ] Unit tests cover allow + reject cases

### Step 2: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-641 owns operator docs
- `templates/spine-config.json` — SP-639 may touch scripts path

## Completion Criteria

- [ ] `.venv/bin/python …` parses for evidence
- [ ] Bare `python` still rejected
- [ ] #199 closable

## Do NOT

- Implement scripts/ executor (SP-639)
- Enable arbitrary shell metacharacters (Phase B of #160)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-638): allow project-local python for gate evidence (#199)`
