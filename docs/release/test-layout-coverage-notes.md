# Coverage-safe metrics test layout

This document records **coverage-safe test layout** guidance and the **approved publish strategy** for the recurring class of V8 full-suite coverage-attribution quirks that affect `npm run release:check`:

- [#222 family](#context) — legacy module-path narrative; test-layout guidance.
- [FR-SHIP-06 — slash-commands V8 under-report (#245)](#fr-ship-06-slash-commands-v8-under-report-245) — canonical module (`extensions/spine/slash-commands.ts`); approved long-term strategy.

## Context

- Issue: [#222](https://github.com/beettlle/pi-spine/issues/222)
- Affected module: `src/batch/slash-commands.ts`
- Affected tests: `tests/batch/run-metrics.test.mjs`

`slash-commands.ts` achieved full V8 coverage in isolation, but the full-suite `release:check` run reported the module as uncovered after the usage-redaction asserts for `appendTaskMetric` were placed in a **separate** test file under `tests/batch/` (`run-metrics-usage-redaction.test.mjs`). Moving the asserts back into the owning suite (`run-metrics.test.mjs`) restored the coverage report.

## Known commits

- `c5e7d70e` — isolated usage-redaction asserts into a separate file; coverage collapsed.
- `b691e64a` — folded asserts back into `tests/batch/run-metrics.test.mjs`; coverage stayed green.

## Guidance

Do **not** isolate small metrics or redaction unit tests into new test files that correlate with unrelated module coverage collapse under `release:check`. Prefer keeping the asserts in the owning suite (`tests/batch/run-metrics.test.mjs`) until a minimal fixture proves the V8 coverage attribution problem is fixed.

If a future change genuinely needs a new test file, verify the full `npm run release:check` coverage gate still reports `slash-commands.ts` (and any other affected modules) as covered before merging.

## Stance

This is currently treated as a **tooling / V8 coverage-attribution quirk**, not a proven product coverage hole. The redaction and usage-count behavior itself has always been covered by the inlined tests; the collapse was in how the coverage tool attributed those tests to source modules. Root-cause investigation belongs on the tooling side unless a product bug is reproduced with a minimal fixture.

> Path note: the `#222` narrative above uses a legacy module path (`src/batch/slash-commands.ts`). The product module gated by `release:check` today is `extensions/spine/slash-commands.ts`; the FR-SHIP-06 section below is canonical.

## FR-SHIP-06: slash-commands V8 under-report (#245)

- Issue: [#245](https://github.com/beettlle/pi-spine/issues/245) — V8 full-suite under-reports `slash-commands.ts` line %; isolation re-verify is mitigation only.
- Canonical module: `extensions/spine/slash-commands.ts`.
- Per-file floor: `FILE_COVERAGE_THRESHOLDS["extensions/spine/slash-commands.ts"] = 70` ([`scripts/coverage-policy.mjs`](../../scripts/coverage-policy.mjs)).
- Isolation re-verify owning suites: `FILE_COVERAGE_VERIFY_TESTS["extensions/spine/slash-commands.ts"]` → `tests/extensions/*.test.mjs`, `tests/slash-commands.test.mjs`, `tests/spine-settings-slash.test.mjs`.
- Cross-ref: [post-mortem v2.12.1 §F6](post-mortem-v2.12.1.md).

### Symptom

`npm run release:check` runs the full test suite under V8 line coverage with the broad `COVERAGE_INCLUDES` set. For `extensions/spine/slash-commands.ts`, the **full-suite** run under-reports line coverage to ~19.90%, far below the 70% floor. Running the **owning suites** with a narrow include of only that module reports ~90.46% — the product code is covered; the discrepancy is in how Node's V8 coverage attribution assigns lines to modules across a large combined run.

| Mode | Reported line % |
|------|-----------------|
| Full suite (broad `COVERAGE_INCLUDES`) | ~19.90% |
| Owning suites + narrow include of `slash-commands.ts` only | ~90.46% |
| Aggregate in-scope after fix | ~89% |

### Isolation re-verify (current publish mitigation)

`scripts/run-coverage.mjs` (`reverifyFileCoverageFailure`) catches per-file floor failures from the full-suite run and **re-checks each failing module against only its owning suites with a narrow include** (`FILE_COVERAGE_VERIFY_TESTS`). If the isolated re-check meets the floor, the gate passes; otherwise it fails closed. This is **belt-and-suspenders for publish** — it unblocks shipping without weakening the per-file floor and **does not** fix the underlying V8 attribution.

### Approved strategy (recorded v2.12.2)

1. **Keep isolation re-verify.** It is the required publish gate for FR-SHIP-06 and must not be removed or bypassed.
2. **Do not weaken the per-file floor.** `FILE_COVERAGE_THRESHOLDS["extensions/spine/slash-commands.ts"]` stays at 70%; lowering it would hide a real coverage floor rather than fix attribution.
3. **Root-cause V8 attribution is deferred follow-up** ([#245](https://github.com/beettlle/pi-spine/issues/245)), not part of the publish path. A proven attribution fix is **preferred** over indefinitely relying on isolation re-verify, but until such a fix lands and is verified against `release:check`, isolation re-verify remains the source of truth for the publish decision.
4. **Full-suite % can lie.** Operators must not trust the raw full-suite line % for this module in isolation; the isolation re-verify result — i.e. the `release:check` exit code — is authoritative.

See the [earlier `#222` family notes](#context) for the same symptom's test-layout guidance: do not split owning-suite asserts into new test files that correlate with coverage collapse, and re-run full `release:check` whenever the test layout changes.
