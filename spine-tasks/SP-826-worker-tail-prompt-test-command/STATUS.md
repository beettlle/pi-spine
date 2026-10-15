# SP-826: Worker tail prompt names Contract testCommand and sends worker.md once — Status

**Current Step:** Done
**Status:** ✅ Complete
**Last Updated:** 2026-10-10
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Tail/args tests listed
- [x] Dependencies satisfied

### Step 1: Tail prompt changes
**Status:** ✅ Complete

- [x] Contract `testCommand` instruction
- [x] `includeAgentInclude` option
- [x] Runner passes `false`; runner is 498 lines (≤ 500)

### Step 2: Tests
**Status:** ✅ Complete

- [x] Tail text and include cases
- [x] Single `worker.md` occurrence

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Lint (`npm run lint` exit 0) and `npm run typecheck` exit 0
- [x] Contract `testCommand` passing — 50 unit tests green (dot reporter), stet review exit 0 with 0 active findings after triage (full suite runs at post-integrate `release:check`)
- [x] Fix all failures (no unit/lint/typecheck failures; 6 stet findings triaged, none real defects)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact on `buildWorkerTailPrompt`: LOW risk; upstream callers = `buildAgentSessionWorkerPrompt` (agent-session-worker.mjs, keeps `includeAgentInclude` default true per Mission) and `buildWorkerPiArgs` (bin/spine-worker-runner.mjs, not indexed by GitNexus; found via rg at bin/spine-worker-runner.mjs:122). |
| 2 | Tail/args assertions: `tests/batch/worker-prompt.test.mjs` (tail text, agent include), `tests/agents/worker-runner.test.mjs` (pi args), `tests/batch/worker-prompt-rules.test.mjs` and `tests/agents/template-drift.test.mjs` (call `buildWorkerTailPrompt` but do not assert `run npm test` or `@worker.md`), `tests/config/worker-context.test.mjs` uses "Always run npm test." only as a fixture standard body, not a tail assertion. All are in the Contract run; no file outside File Scope must change. |
| 3 | Dependencies: SP-828 artifacts present (`scripts/spine-stet-contract-run.sh`, `.review/config.toml`); SP-829 satisfied — `tests/batch/worker-prompt-rules.test.mjs` passes (6 tests, exit 0). |
| 4 | Stet triage (6 findings, 0 real defects): `036cb03` false_positive — Mission mandates `includeAgentInclude: false` in the runner because `worker.md` is already sent via `--append-system-prompt`; exactly-once test passes. `06d4730`/`9dafa80` false_positive — **stet reviewer bug: stale/split hunks** — `includeAgentInclude` is declared in the destructuring signature (worker-prompt.mjs:51) and consumed in `agentAppend` (line 61); eslint no-unused-vars and tsc typecheck both pass. `d4b35ec` wrong_suggestion — falling back to `npm test` contradicts the Mission (full suite banned in workers; Contract validation already requires a testCommand). `a626749` false_positive — `buildWorkerPiArgs` passes `workerAgentPath` as a standalone argv element (no combined arg exists); test verified green against the real implementation. `5da158d` false_positive — `fs.existsSync` guards both include paths and `/wt` is a pre-existing fixture pattern in the same file; test passes. |
| 5 | Stet reviewer bugs to record: stale-hunk findings on multi-hunk diffs (06d4730, 9dafa80) — reviewer claimed a declared-and-used parameter was dead/undefined. |

## Blockers

_None._
