# SP-852: Worker rules loader skips an oversize rule and keeps loading — Status

**Current Step:** Done
**Status:** ✅ Complete
**Last Updated:** 2026-11-03
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `loadContextDocEntries`; report the blast radius in STATUS
- [x] `rg -n "remaining paths omitted|truncated" tests/` — list assertions that change

**Blast radius (GitNexus, upstream):** risk HIGH (expected — loader sits on every worker prompt). 3 direct callers at depth 1: `buildWorkerContext`, `buildWorkerContextAsync` (both `src/config/worker-context.mjs`), `buildReviewerContext` (`src/config/reviewer-context.mjs`). Depth 2: `buildReviewerSystemPrompt`, `buildWorkerTailPrompt`. Depth 3: `buildAgentSessionWorkerPrompt`, `runStepReview`. 3 processes affected, 2 modules (Config direct, Batch indirect). Accepted: caller-visible change is the shape of `skipped` only; `ok`/`entries`/`truncated`/`bytesUsed`/`byteCap` semantics preserved.

**`rg` findings — assertions that change:**
- `tests/config/worker-context.test.mjs:48` — `result.skipped.some((entry) => /docs\/c\.md/.test(entry))` (string match) → rewritten for `{ path, reason }` objects.
- `tests/config/worker-context.test.mjs:163` — `loaded.truncated === true` still holds after the fix; extended with skipped-shape assertions.
- `tests/config/reviewer-context.test.mjs:98` — `result.truncated === true` still holds; no change needed.
- Literal marker `"remaining paths omitted"` is asserted nowhere in tests; sole occurrence was `src/config/worker-context.mjs:105` (removed).

### Step 1: Skip and continue
**Status:** ✅ Complete

- [x] Oversize path skipped with reason `byte_cap`; loop continues
- [x] `truncated` and marker text reflect skipped paths

**Artifacts:**
- `src/config/worker-context.mjs` (modified)

### Step 2: Tests
**Status:** ✅ Complete

- [x] Oversize first / middle / all fit, at worker and reviewer caps
- [x] `skipped` lists path, reason, size

**Artifacts:**
- `tests/config/worker-context.test.mjs`, `tests/config/reviewer-context.test.mjs` (modified)

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-852-worker-rules-skip-oversize/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `skipped` entries are now `{ path, reason: "never_load"\|"missing"\|"byte_cap", sizeBytes? }` objects (was bare strings + generic marker). No src consumer parses the strings; only test assertions needed updating. | Done | `src/config/worker-context.mjs` |
| Full-suite runs leak `SPINE_IS_WORKER=1` into spawn-based batch tests → nested-batch guard trips → 61 failures (same 61 as pre-session `coverage-run.tap.log`). PROMPT env rule (unset `SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER`) must be honored: clean-env full suite is 3213/3213 green. | Noted | `scripts/run-coverage.mjs`, `scripts/worker-verify.sh` |
| `docs/design/cursor-rules-discovery.md` describes the byte cap only as a bound ("32 KiB byte cap at load", reviewer 16 KiB); no stale skip-semantics text found. SP-855 owns the file; left untouched. | Deferred to SP-855 | `docs/design/cursor-rules-discovery.md` |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |
| 2026-11-03 | Step 0 preflight | Blast radius HIGH accepted; rg assertions listed above |
| 2026-11-03 | Step 1 skip-and-continue | `loadContextDocEntries` records `{path, reason: "byte_cap", sizeBytes}` and continues; `truncated` = any cap skip; committed `fix(SP-852)` |
| 2026-11-03 | Step 2 tests | 6 new scenario tests (worker+reviewer caps) + shape assertions; 22/22 green; committed |
| 2026-11-03 | Step 3 verification | Contract `testCommand` green (lint, typecheck, 5 suites); `worker-verify.sh` exit 0 (full stub suite); `coverage:check` exit 0 — 3213/3213, line coverage 91.30% ≥ 77% |
| 2026-11-03 | Step 4 delivery | Discoveries logged; `.DONE` created |

## Completion Criteria

- [x] One oversize rule no longer drops later rules that fit (verified: 72.5 KB rule skipped, 12.8 KB neighbor loads — the #337 shape)

## Blockers

*None*
