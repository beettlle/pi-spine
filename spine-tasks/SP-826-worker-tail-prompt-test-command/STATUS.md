# SP-826: Worker tail prompt names Contract testCommand and sends worker.md once — Status

**Current Step:** Step 3: Testing & Verification
**Status:** 🟡 In Progress
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
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand` passing (full suite runs at post-integrate `release:check`)
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact on `buildWorkerTailPrompt`: LOW risk; upstream callers = `buildAgentSessionWorkerPrompt` (agent-session-worker.mjs, keeps `includeAgentInclude` default true per Mission) and `buildWorkerPiArgs` (bin/spine-worker-runner.mjs, not indexed by GitNexus; found via rg at bin/spine-worker-runner.mjs:122). |
| 2 | Tail/args assertions: `tests/batch/worker-prompt.test.mjs` (tail text, agent include), `tests/agents/worker-runner.test.mjs` (pi args), `tests/batch/worker-prompt-rules.test.mjs` and `tests/agents/template-drift.test.mjs` (call `buildWorkerTailPrompt` but do not assert `run npm test` or `@worker.md`), `tests/config/worker-context.test.mjs` uses "Always run npm test." only as a fixture standard body, not a tail assertion. All are in the Contract run; no file outside File Scope must change. |
| 3 | Dependencies: SP-828 artifacts present (`scripts/spine-stet-contract-run.sh`, `.review/config.toml`); SP-829 satisfied — `tests/batch/worker-prompt-rules.test.mjs` passes (6 tests, exit 0). |

## Blockers

_None._
