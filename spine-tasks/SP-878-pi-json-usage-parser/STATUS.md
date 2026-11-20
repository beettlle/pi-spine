# SP-878: Parse pi --mode json stream into usage totals — Status

**Current Step:** Step 1 — Parser module + fixture
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-20
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm pi JSON event fields for usage/cost
- [x] Sketch helper API

---

### Step 1: Parser module + fixture
**Status:** 🟡 In Progress

- [ ] Implement sumUsageFromPiJsonStream
- [ ] Add fixture + unit tests; omit when empty

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract testCommand
- [ ] Fix failures

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries in STATUS
- [ ] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Usage-bearing pi JSON events: `message_end` (`message.usage`, authoritative), `message_update` (top-level cumulative `usage`), `compaction_end` (`result.usage`), `tool_execution_end` (`result.usage`, nested model work) | `message_update` excluded (double-counts with `message_end`); other three summed | `~/.pi/agent/.../docs/json.md` |
| Usage shape `{input, output, cacheRead, cacheWrite, cacheWrite1h?, reasoning?, totalTokens, cost.total}`; `reasoning` already inside `output`; `cacheWrite1h` is a subset of `cacheWrite` | tokensIn = input + cacheRead + cacheWrite; tokensOut = output; never re-add `reasoning`/`cacheWrite1h` | `~/.pi/agent/.../docs/message-types.md` |
| Metric record keys `tokensIn`/`tokensOut`/`estimatedUsd` guarded by `Number.isFinite` in `buildTaskMetricRecord` | Parser returns bare/undefined-key fields so SP-879 can spread directly | `src/batch/metrics.mjs` |
| New `src/` files must not carry `@ts-nocheck` (arch guard); `tsconfig.batch.json` file list is out of scope so module is JSDoc-typed but untracked by tsc | Wrote strict JSDoc types anyway | `tests/arch/ts-nocheck-guard.test.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-20 | Step 0 preflight | Confirmed pi 1.5.2 JSON event shapes from local docs (`docs/json.md`, `docs/message-types.md`); API sketched (see Discoveries) |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
