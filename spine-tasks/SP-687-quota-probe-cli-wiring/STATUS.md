# Task Status: SP-687 — Wire runQuotaProbes into spine metrics quota

## Current State

**Overall Status:** 🟡 In Progress — Step 3

## Steps

### Step 0: Preflight
**Status:** ✅ Done
- [x] Confirm missing probe wiring and sync CLI path
  - `runQuotaReport` (quota-cli.mjs:88) called `buildQuotaSnapshot` with NO `probeResults`.
  - `bin/spine.mjs:219` called `runQuotaReport(...)` synchronously (no `await`).
  - QUICK-REFERENCE L508 documented `live` as "future probe adapters".
  - Baseline: typecheck green, 7/7 quota-cli tests green.
  - Impact (`runQuotaReport`, upstream): LOW, 0 tracked callers.

### Step 1: Wire probes into quota CLI
**Status:** ✅ Done
- [x] Async report + `runQuotaProbes` + `probeResults` + bin await
  - `runQuotaReport` now `async`; imports & `await`s `runQuotaProbes({authPath, fetch})` then
    passes `probeResults` into `buildQuotaSnapshot`.
  - `bin/spine.mjs` now `await runQuotaReport(...)`.
  - Probes fail closed → estimate/absent on missing creds/network error; no invented limits/keys.

### Step 2: Testing & Verification
**Status:** ✅ Done
- [x] Live-path regression in `tests/metrics/quota-cli.test.mjs`
  - New test: mocked fetch + fixture auth → `snapshotSource:"live"`, `pools.zai.source:"live"`,
    `tokensOut:12345`, `limit:50000`; asserts key/prompt never leak.
  - Existing tests now `await` + point `authPath` at absent file (deterministic, no network).
- [x] Contract `testCommand` green — typecheck clean, 8/8 quota-cli tests pass.

### Step 3: Documentation & Delivery
**Status:** 🟡 In Progress
- [ ] QUICK-REFERENCE `live` wording
- [ ] `.DONE`

## Discoveries

| Date | Finding |
|------|---------|
| 2026-07-25 | `runQuotaProbes` is fail-closed: missing auth → all probes `absent` with zero network calls, so existing estimate/absent assertions survive when tests point `authPath` at a non-existent file. |
| 2026-07-25 | `detect_changes` reports risk_level "high" — all 7 affected flows originate from `runQuotaReport` (the symbol intentionally modified); only caller (`bin/spine.mjs`) updated to `await`. Contained, expected. |
