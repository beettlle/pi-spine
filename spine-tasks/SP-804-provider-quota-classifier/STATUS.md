# SP-804: Provider quota error classifier — Status

**Current Step:** Step 4: Documentation & Delivery
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-09
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Notes — Plan (Review Level 1)

Approach: pure scanner in `src/batch/provider-quota.mjs`. Find all `\d{3}[: ]?{` candidates in `output`, extract each JSON object with balanced-brace scanning (string-aware) + `JSON.parse`; skip unparseable. Status is required to match each rule exactly (z.ai 429 + top-level `code` "1308"/"1310"; Kimi 403 + `error.type` "permission_error" + message contains "usage limit"; Kimi 429 + `error.type` "rate_limit_error" + message contains "currently overloaded") so unrelated 4xx/5xx never match. Last candidate wins; no candidates → null. `poolId` via `resolvePoolId(model)`; `resetAtRaw` from text after "reset at"; `resetAt` always null; message truncated to 300. Plan deviation: the neighbour `// @ts-nocheck` header turned out to be forbidden for new files (SP-750 arch guard) — module is typed via JSDoc only; see Discovery 1.

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Pool ids confirmed — `zai/glm-5.3` → `zai`, `kimi-coding/k3` → `kimi-coding` (`POOL_PREFIXES` in `src/metrics/quota-snapshot.mjs`); unknown/`inherit` → `unknown`
- [x] Module absent — neither `src/batch/provider-quota.mjs` nor `tests/batch/provider-quota.test.mjs` exists
- [x] Dependencies satisfied — task has none

### Step 1: Classifier
**Status:** ✅ Done

- [x] `classifyProviderQuotaError` implemented — pure, no I/O; imports only `resolvePoolId`
- [x] JSDoc typedef `ProviderQuotaError`/`ProviderQuotaKind`; module is not in `tsconfig.batch.json` include list (see Discovery 1), so it is typed via JSDoc only, matching repo JS modules not yet migrated to checked status

### Step 2: Tests
**Status:** ✅ Done

- [x] Four real fixtures classify as specified (z.ai 1308/1310, Kimi 403 billing, Kimi 429 overloaded)
- [x] Negative cases return `null` (stub text, 500, 403 without "usage limit", z.ai unknown code, `""`, `undefined`, `null`, malformed JSON)
- [x] Last-payload-wins (incl. trailing unmatched payload → `null`), unknown-model pool `unknown`, message truncation

### Step 3: Testing & Verification
**Status:** ✅ Done

- [x] `npm run lint` — pass
- [x] Contract `testCommand` — pass (30/30 tests, exit 0)
- [x] Coverage gate — pass: 2785/2785 tests, line coverage 90.09% ≥ 77%; `provider-quota.mjs` 100% lines / 90.16% branch / 100% functions
- [x] Fix all failures — ts-nocheck guard failure fixed (removed directive, Discovery 1); sequence-detached-poll timing flake was environmental (Discovery 2)

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `tests/arch/ts-nocheck-guard.test.mjs` (SP-750) forbids new `// @ts-nocheck` in `src/` — "Do not allowlist new files — remove the directive and type the module properly". The neighbour `@ts-nocheck` headers are legacy-allowlisted. Removed the directive; module carries full JSDoc types instead (it is not in `tsconfig.batch.json`, so tsc does not check it either way). |
| 2 | `tests/batch/sequence-detached-poll.test.mjs` timing tests ("hard-caps at maxWaitMs") are flaky on this loaded box under the full coverage suite: failed with elapsed 2.1–4.0s vs a 300ms cap in three runs, while the same suite's first run and isolated runs pass. Proven environmental: a clean-tree stash (change removed) also failed the gate with 3 different timing tests (`reviewer-artifact-early-honor` 300s stall). Final run passed clean: 2785/2785, 90.09% ≥ 77%. |
| 3 | Full-suite runs regenerate `.spine/rules-manifest.json` (`generatedAt` only). Reset to HEAD before commits to honour the "do not modify `.spine/`" constraint. |
## Blockers

_None._
