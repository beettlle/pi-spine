# Task: SP-716 — Unify secret redaction across channels

**Created:** 2026-08-22
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Security hardening; shared util extraction.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 2, Reversibility: 0

## Mission

Closes #260 — Extract `src/util/secret-redact.mjs` with unified key denylist and value patterns (`sk-`, `ghp_`, bearer tokens, etc.). Use in journal, worker-output, handoff, and metrics paths. Cap payload size by UTF-8 bytes, not string length.

## Dependencies

- **None**

## Context to Read First

- `src/batch/journal.mjs` — `redactSecrets`
- `src/batch/worker-output.mjs` — `redactWorkerOutput`
- `src/cli/handoff.mjs`
- `tests/batch/journal.test.mjs`
- GitHub #260

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/util/secret-redact.mjs`
- `src/batch/journal.mjs`
- `src/batch/worker-output.mjs`
- `src/cli/handoff.mjs`
- `tests/util/secret-redact.test.mjs`
- `tests/batch/journal-redaction-parity.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/util/secret-redact.test.mjs tests/batch/journal-redaction-parity.test.mjs` |
| fileScopeMustChange | `tests/util/secret-redact.test.mjs` |

## Steps

### Step 1: Shared redactor module

- [ ] Create `secret-redact.mjs` with key + value pattern policy
- [ ] Export `redactSecretsDeep` and byte-safe `capPayloadBytes`

### Step 2: Migrate callers

- [ ] journal.mjs, worker-output.mjs, handoff.mjs use shared module
- [ ] Metrics append path if applicable in scope

### Step 3: Testing & Verification

- [ ] Parity tests: same secret shape redacted identically across channels
- [ ] Run contract `testCommand` only

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — journal redaction policy if mentioned

## Completion Criteria

- [ ] Value-shaped secrets in `output`/`environment` redacted in journal
- [ ] UTF-8 byte cap for payload truncation
- [ ] Closes #260

## Do NOT

- Redact secrets in git commits or lane branches (#255 scope)
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-716): unify secret redaction across journal and worker output (#260)`
