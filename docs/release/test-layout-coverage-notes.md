# Coverage-safe metrics test layout

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
