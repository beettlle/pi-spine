# SP-878: Parse pi --mode json stream into usage totals — Status

**Current Step:** Complete — all steps done
**Status:** ✅ Complete
**Last Updated:** 2026-11-20
**Review Level:** 1
**Review Counter:** 1
**Iteration:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm pi JSON event fields for usage/cost
- [x] Sketch helper API

---

### Step 1: Parser module + fixture
**Status:** ✅ Complete

- [x] Implement sumUsageFromPiJsonStream
- [x] Add fixture + unit tests; omit when empty

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract testCommand
- [x] Fix failures

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries in STATUS
- [x] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand failed (exit 1): stet: rule budget of 1000 tokens dropped 187 rule section(s) from review prompts (e.g. ["critical-rules-quick-reference.mdc: 10.  | advisory — noted, not blocking | contract review step |
| Final review REVISE: input guard accepted non-iterable plain objects (`{}`), deferring failure to `for...of`'s generic "not iterable" TypeError instead of the documented module error; missing test case would have caught it | Fixed: shared `assertStreamInput` helper checks `typeof input[Symbol.iterator] === "function"`; both exports now use it; added `{}` cases for `sumUsageFromPiJsonStream` and `extractTextFromPiJsonStream` to the TypeError test; Contract testCommand re-run exits 0 | `.reviews/final-20261120T214326.md` |
| reviewCommand failed (exit 1): d33409a  src/batch/pi-json-usage.mjs:182  ERROR  The input guard accepts any object (e.g. a plain object, Buffer, or non-iterable | resolved by REVISE fix above (guard now rejects non-iterables with the documented TypeError) | contract review step |
| Usage-bearing pi JSON events: `message_end` (`message.usage`, authoritative), `message_update` (top-level cumulative `usage`), `compaction_end` (`result.usage`), `tool_execution_end` (`result.usage`, nested model work) | `message_update` excluded (double-counts with `message_end`); other three summed | `~/.pi/agent/.../docs/json.md` |
| Usage shape `{input, output, cacheRead, cacheWrite, cacheWrite1h?, reasoning?, totalTokens, cost.total}`; `reasoning` already inside `output`; `cacheWrite1h` is a subset of `cacheWrite` | tokensIn = input + cacheRead + cacheWrite; tokensOut = output; never re-add `reasoning`/`cacheWrite1h` | `~/.pi/agent/.../docs/message-types.md` |
| Metric record keys `tokensIn`/`tokensOut`/`estimatedUsd` guarded by `Number.isFinite` in `buildTaskMetricRecord` | Parser returns bare/undefined-key fields so SP-879 can spread directly | `src/batch/metrics.mjs` |
| New `src/` files must not carry `@ts-nocheck` (arch guard); `tsconfig.batch.json` file list is out of scope so module is JSDoc-typed but untracked by tsc | Wrote strict JSDoc types anyway | `tests/arch/ts-nocheck-guard.test.mjs` |
| API: `sumUsageFromPiJsonStream(string \| string[] \| Iterable<string>) → {tokensIn?, tokensOut?, estimatedUsd?}` and `extractTextFromPiJsonStream(same) → string[]` (log tee). Keys omitted when unreported; reported zeros kept; non-finite/negative counters ignored; malformed JSONL records skipped. tokensIn = input + cacheRead + cacheWrite (no `cacheWrite1h` re-add); tokensOut = output (no `reasoning` re-add) | Delivered in module JSDoc | `src/batch/pi-json-usage.mjs` |
| Counting sources: assistant `message_end` `message.usage`, successful `compaction_end` `result.usage`, `tool_execution_end` nested `result.usage` (pi docs: not part of main usage → no double-count). `message_update` cumulative snapshots deliberately excluded → truncated streams under-count, never over-count | Delivered in module header + fixtures | `tests/fixtures/pi-json-stream/` |
| `docs/adoption/operator-runbook.md` metrics section documents consumer commands (`spine metrics show/quota`), not the parser producer; unaffected until SP-879/SP-880 wire spawn | Checked — no update needed | `docs/adoption/operator-runbook.md` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-20 | Step 0 preflight | Confirmed pi 1.5.2 JSON event shapes from local docs (`docs/json.md`, `docs/message-types.md`); API sketched (see Discoveries) |
| 2026-11-20 | Step 1 | `src/batch/pi-json-usage.mjs` + 3 fixtures + 16 unit tests implemented |
| 2026-11-20 | Step 2 | Contract testCommand exits 0: lint clean, tsc ×2 clean, 25 tests pass (16 parser + phase23-exit-verify + ts-nocheck-guard) |
| 2026-11-20 | Step 3 | Discoveries recorded; runbook checked (not affected); .DONE created |
| 2026-11-20 | REVISE (final review) | Fixed input guards via shared `assertStreamInput` (`Symbol.iterator` check); added non-iterable-object test cases; Contract testCommand exits 0; committed + .DONE recreated |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
