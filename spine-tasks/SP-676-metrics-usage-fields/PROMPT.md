# Task: SP-676 — Run-metrics usage fields

**Created:** 2026-07-20
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Additive JSONL fields + redaction fix; existing readers must stay compatible.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0

## Mission

Partial #208 — When pi/session or worker-host exposes usage, append optional additive fields on task metric records (e.g. `tokensIn`, `tokensOut`, optional `estimatedUsd`, `role`). Fix redaction so usage count keys are preserved while API-key-like keys still redact. Missing usage must omit/null — never invent costs.

## Dependencies

- **None**

## Context to Read First

- `src/batch/metrics.mjs` — sanitize + append writers
- `tests/batch/run-metrics.test.mjs`
- GitHub #208 acceptance criteria
- Parent note: `REDACT_KEY_PATTERN` currently matches `/token/i` and would destroy `tokensIn` — must narrow

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/metrics.mjs`
- `tests/batch/run-metrics.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/run-metrics.test.mjs` |
| fileScopeMustChange | `src/batch/metrics.mjs`, `tests/batch/run-metrics.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Map current metric record shape and sanitize behavior
- [ ] Identify where usage could be sourced (worker host / review spawn) without inventing data

### Step 1: Schema + redaction

- [ ] Allow optional usage fields on task (and reviewer when feasible) records
- [ ] Narrow redaction: redact `apiKey`/`accessToken`/`secret`/prompt bodies; **do not** redact `tokensIn`/`tokensOut`/`estimatedUsd`
- [ ] Tests: present usage round-trips; missing usage omitted; secrets still redacted

### Step 2: Wire capture when available

- [ ] If an existing call site already has usage numbers, pass them into append helpers
- [ ] If no source exists yet, keep writers ready and document “omit when absent” — do not fake data
- [ ] Keep append-only JSONL and doctor metrics checks green

### Step 3: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 4: Documentation & Delivery

- [ ] Create `.DONE` (operator docs in SP-677 / SP-682)

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` — SP-682

## Completion Criteria

- [ ] Additive usage fields safe under sanitize
- [ ] Partial #208 write-path complete
- [ ] No fake costs

## Do NOT

- Depend on another beettlle package
- Embed a full provider pricing SDK
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-676): additive usage fields on run-metrics (#208)`
