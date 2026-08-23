# SP-716: Unify secret redaction across channels — Status

**Current Step:** Step 1: Shared redactor module
**Status:** In Progress
**Last Updated:** 2026-08-23
**Review Level:** 1
**Size:** S

---

## Plan (Review Level 1)

1. **New `src/util/secret-redact.mjs`** — single redaction policy:
   - `REDACT_KEY_PATTERN` = `/key|token|secret|password/i` (journal's existing denylist).
   - `SECRET_VALUE_PATTERNS` (frozen, replace-only): ENV-assignment (`OPENAI_API_KEY=...`), Bearer headers, DB conn strings, `DATABASE_URL=`, `sk-`, `ghp_`, `github_pat_`, `AKIA`, `xox*-`, generic `key:value`/`key=value` fallback. Ordered most-specific first so assignment matches are consumed whole (preserves `redactHandoffText("export GITHUB_TOKEN=ghp_deadbeef") === "export [REDACTED]"`).
   - `redactTextSecrets(text, extraPatterns)` — text channel redaction.
   - `redactSecretsDeep(value, {keyPattern, allowedKeys, extraPatterns})` — recursive key + value redaction (superset of journal's `redactSecrets`; value-shaped secrets in `output`/`environment` now redacted in journal payloads).
   - `capPayloadBytes(payload, maxBytes)` — UTF-8 **byte**-safe truncation (replaces string-length slice).
2. **Migrate callers** (keep all existing exported names/signatures):
   - `journal.mjs`: `redactSecrets`→delegate to `redactSecretsDeep`; `capPayloadSize`→delegate to `capPayloadBytes(payload, MAX_PAYLOAD_BYTES)`.
   - `worker-output.mjs`: drop local `BUILTIN_REDACT_PATTERNS`; `redactWorkerOutput` = `redactTextSecrets(text, config.denyPatterns)`.
   - `handoff.mjs`: drop local `SECRET_VALUE_PATTERN`; `redactHandoffText`→`redactTextSecrets`; `redactHandoffSecrets`→`redactSecretsDeep`; drop `redactSecrets` import.
   - `metrics.mjs`: drop local `redactMetricValue`; `sanitizeMetricRecord` = `redactSecretsDeep(record, {keyPattern: /key|token|secret|password|prompt/i, allowedKeys: USAGE_KEYS})`.
3. **Tests**: `tests/util/secret-redact.test.mjs` (unit: patterns, deep redaction, byte cap incl. multi-byte) + `tests/batch/journal-redaction-parity.test.mjs` (same secret corpus redacted identically across journal/worker-output/handoff).

**Blast radius (LOW):** gitnexus tools truncated string params (session bug); manual grep impact done — exported names kept, callers limited to handoff/issue-draft/worker-output internals + existing tests.
**Docs check:** `docs/adoption/operator-runbook.md` only mentions "redacted worker output" generically (line 919) — no pattern-level doc change needed.

---

## Step 1: Shared redactor module

**Status:** Completed

- [x] Create `secret-redact.mjs` with key + value pattern policy
- [x] Export `redactSecretsDeep` and byte-safe `capPayloadBytes`

## Step 2: Migrate callers

**Status:** Completed

- [x] journal.mjs, worker-output.mjs, handoff.mjs use shared module
- [x] Metrics append path if applicable in scope

## Step 3: Testing & Verification

**Status:** Completed

- [x] Parity tests: same secret shape redacted identically across channels
- [x] Run contract `testCommand` only

## Step 4: Documentation & Delivery

**Status:** Completed

- [x] Create `.DONE`

---

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-22 | Task staged | v2.15.0 release packet |
