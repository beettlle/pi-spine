# SP-107 — Brutal Audit: Core Architecture & CLI

**Date:** 2026-06-05  
**Scope:** `src/planner/**`, `src/tasks/**`, `src/config/**`, `bin/**`, related tests  
**Rules:** `.cursor/rules/javascript-3-brutal-audit.mdc`, `.cursor/rules/general-llm-anti-patterns.mdc`  
**Baseline:** `npm run typecheck` ✅ | scoped tests ✅ 103/103 (see Preflight note)

---

## Executive Summary

Core modules are **materially better** after Phase 13 (SP-072–081) and Phase 16 (SP-089–094): CLI routing is split (`bin/spine.mjs` → `bin/spine-cli/*`), evidence commands are allowlisted, worker launch scripts are sandboxed, cursor-rules auto-discovery is integrated, and batch engine paths fail closed on invalid PROMPTs. Tests in the scoped directories are strong (103 passing).

Remaining debt is **concentrated at boundaries**: planner/preflight/plan still treat invalid PROMPTs as plan input, `bin/spine-preflight.mjs` remains a 572-line god module, config evidence fields are empty while gates demand build/test proof, and several operational paths bypass `validatePrompt` in favor of silent `parsePrompt`.

**Cleanliness score: 7/10** (unchanged from Phase 13 baseline — fixes landed, but new Phase 16 surface area and unresolved planner/config gaps hold the score flat).

| Category | Score | Notes |
| --- | --- | --- |
| Module boundaries | 6/10 | Planner vs preflight duplicate discovery; bin/ still hosts business logic |
| Type safety | 7/10 | JSDoc present; broken JSDoc orphan at worker-context:168 |
| Async correctness | 6/10 | Fake async in worker-context + plan CLI |
| Performance | 8/10 | No I/O-in-loop in hot planner paths; sync fs acceptable at CLI scale |
| Test quality | 8/10 | 103 scoped tests green; glob escape bug untested |
| Security | 7/10 | Path traversal blocked in worker context; symlink reads not hardened |
| **OVERALL** | **7/10** | |

---

## Preflight & Baseline

### Typecheck

```
npm run typecheck  → exit 0
```

### Tests (scoped)

**PROMPT command (as written):**

```bash
npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test -- tests/planner/ tests/tasks/ tests/config/
```

**Result:** 559 pass, **3 fail** — Node tries to execute directory paths as test entrypoints:

```
Error: Cannot find module '.../tests/planner'
Error: Cannot find module '.../tests/tasks'
Error: Cannot find module '.../tests/config'
```

**Correct invocation (used for audit counts):**

```bash
SPINE_SUPPRESS_JOURNAL_ATTACH=1 node --experimental-strip-types --test \
  tests/planner/*.test.mjs tests/tasks/*.test.mjs tests/config/*.test.mjs tests/config/cursor-rules/*.test.mjs
```

→ **103 pass, 0 fail**

### Line-count inventory (>250 LOC warning threshold)

| File | LOC | Verdict |
| --- | ---: | --- |
| `bin/spine-preflight.mjs` | 572 | 🚨 God file |
| `bin/spine-batch.mjs` | 415 | 🚨 God file |
| `src/config/worker-context.mjs` | 402 | 🚨 God file |
| `bin/spine-init.mjs` | 394 | ⚠️ Large |
| `bin/spine-doctor.mjs` | 379 | ⚠️ Large |
| `src/config/cursor-rules/profile.mjs` | 311 | ⚠️ Large |
| `bin/spine.mjs` | 311 | ✅ Improved (SP-079 split) |
| `src/config/cursor-rules/discover.mjs` | 290 | ⚠️ Acceptable for scan logic |

No file in `src/planner/` or `src/tasks/` exceeds 400 LOC.

---

## Findings (severity-rated)

```text
🚨 HIGH — Category A3 / SP-075 regression: Planner ignores PROMPT validation
📍 File: src/planner/index.mjs
📝 Lines: 40-49
❌ Issue: loadTaskPacket() returns validation.errors, but buildPlan() never checks packet.validation.ok. Invalid PROMPTs (missing sections, bad heading, no testing) still produce plans with null titles and empty file scopes. Operators discover breakage only at batch start (engine-lanes), not at `spine plan` / `spine preflight`.
✅ Fix: After loadTaskPacket, if !packet.validation.ok throw aggregate Error listing taskId + errors; add checkPromptValidation() helper shared with preflight.
⏱️ Effort: Small (2-3 hours)
```

Evidence — planner ignores validation:

```40:49:src/planner/index.mjs
		const packet = loadTaskPacket(discoveredTask.folderPath);
		const prompt = packet.prompt;
		const mergedDeps = mergeTaskDeps({ taskId, prompt }, depsJson);

		tasksById[taskId] = {
			taskId,
			title: prompt.title ?? null,
			fileScope: Array.isArray(prompt.fileScope) ? prompt.fileScope : [],
			dependencies: mergedDeps,
		};
```

Contrast — batch engine fail loud (SP-075):

```149:158:src/batch/engine-lanes.mjs
export function loadTaskFileScopePaths(taskFolderPath) {
	try {
		const packet = loadTaskPacket(taskFolderPath);
		if (!packet.validation?.ok) {
			return {
				ok: false,
				error: packet.validation.errors.join("; "),
```

---

```text
🚨 HIGH — Category A5: glob scope escapeRegexChar emits literal "${ch}" instead of escaping
📍 File: src/planner/scope.mjs
📝 Lines: 18-21, 53
❌ Issue: escapeRegexChar uses backslash-dollar-brace in a template literal, which outputs the literal string "${ch}". Regex meta characters in glob literals (., +, (, ), etc.) become wrong patterns. Simple `TP-002-*` scopes work because * is handled before escapeRegexChar; paths with dots/parens silently mis-match.
✅ Fix: return backslash + ch; add tests for scopes like `src/foo.bar/**` and `docs/(api)/**`.
⏱️ Effort: Small (1-2 hours)
```

Evidence (runtime):

```
escapeRegexChar("*") → "${ch}"   // not escaped
escapeRegexChar(".") → "${ch}"   // not escaped
```

```18:21:src/planner/scope.mjs
function escapeRegexChar(ch) {
	// Escape regex meta characters.
	return /[\^$.*+?()[\]{}|]/.test(ch) ? `\${ch}` : ch;
}
```

---

```text
🚨 HIGH — Config drift: empty testing commands with evidence collection enabled
📍 File: .spine/spine-config.json, templates/spine-config.json, package.json
📝 Lines: repo config 11-15, 38-41; template 11-15, 38-41; package.json 30-34
❌ Issue: Repo spine-config has testing.build/test/testWithCoverage all empty while gates.collectBuildEvidence and gates.collectTestEvidence are true. package.json defines real commands but spine-config does not mirror them. Integrate gate evidence bundle may skip or no-op despite operator expectation of proof.
✅ Fix: Init template should default testing.test to package.json script; doctor should warn when gates expect evidence but testing.* is empty; migrate existing configs.
⏱️ Effort: Medium (3-5 hours)
```

---

```text
⚠️ MEDIUM — Category 1.1: Duplicate task discovery with inconsistent ID rules
📍 File: src/tasks/packet/discover.mjs vs bin/spine-preflight.mjs
📝 Lines: discover.mjs:5,14-36; preflight.mjs:18,46-64,336-342
❌ Issue: Two discovery implementations. discoverTasks requires TASK_FOLDER_RE (PREFIX-###-slug with exactly 3 digits). preflight discoverTaskFolders accepts any directory with PROMPT.md and extracts IDs via loose /^([A-Z]{2,}-\d{3,})/. Preflight can report N task folders while planner discovers fewer.
✅ Fix: Delete discoverTaskFolders; import discoverTasks in preflight; single source of truth.
⏱️ Effort: Small (2-4 hours)
```

---

```text
⚠️ MEDIUM — Category A1: Fake async (buildWorkerContextAsync)
📍 File: src/config/worker-context.mjs
📝 Lines: 226-383
❌ Issue: export async function buildWorkerContextAsync has zero await — entirely synchronous work.
✅ Fix: Remove async keyword OR use fs.promises for disk-bound discovery.
⏱️ Effort: Small (1-2 hours)
```

---

```text
⚠️ MEDIUM — Category A1: Fake async (runSpinePlan)
📍 File: bin/spine-plan.mjs
📝 Lines: 33-60
❌ Issue: runSpinePlan declared async but uses only synchronous APIs. No await.
✅ Fix: Make synchronous or use async fs.promises for artifact write.
⏱️ Effort: Small (1 hour)
```

---

```text
⚠️ MEDIUM — Category A3: Operational paths bypass validatePrompt
📍 File: src/cli/rules.mjs, bin/spine-worker-runner.mjs
📝 Lines: rules.mjs 107-114; worker-runner.mjs 73
❌ Issue: resolveTaskPromptFileScope and stub worker read fileScope via parsePrompt only — structural PROMPT errors not detected until batch.
✅ Fix: Use validatePrompt; propagate errors to CLI exit 1.
⏱️ Effort: Small (2 hours)
```

---

```text
⚠️ MEDIUM — Category 1.6: bin/spine-preflight.mjs god module
📍 File: bin/spine-preflight.mjs
📝 Lines: 1-572
❌ Issue: 572 LOC combines git checks, doctor delegation, task discovery, dependencies validation, plan building, coexistence, worker launch validation, worktree hook validation, and formatting.
✅ Fix: Strangler to src/preflight/*.mjs; bin stub re-exports.
⏱️ Effort: Large (1-2 days)
```

---

```text
⚠️ MEDIUM — Category 5.3: Silent skip of missing worker context docs
📍 File: src/config/worker-context.mjs
📝 Lines: 92-95, 114-120
❌ Issue: Missing referenceDocs/standards paths pushed to skipped[] without operator-visible error.
✅ Fix: Doctor check or journal warning when skipped non-empty.
⏱️ Effort: Small (2-3 hours)
```

---

```text
ℹ️ LOW — Dead JSDoc orphan
📍 File: src/config/worker-context.mjs
📝 Lines: 168-172
❌ Issue: JSDoc for validateWorkerContextConfig detached; next export is cursorRulesRootExists.
✅ Fix: Move JSDoc above validateWorkerContextConfig or delete orphan.
⏱️ Effort: Trivial (5 min)
```

---

```text
ℹ️ LOW — Baseline test command footgun
📍 File: PROMPT.md Step 0; package.json test script
❌ Issue: Appending directory paths to npm test causes 3 false failures.
✅ Fix: Document glob form; add npm run test:core script.
⏱️ Effort: Trivial (30 min)
```

---

## Phase 13 Regression Check (SP-072–081)

| Task | Claim | Audit verdict |
| --- | --- | --- |
| SP-072 | Evidence command allowlist, no shell | ✅ Held |
| SP-073 | FR-WORK-05 standards wired | ✅ Held |
| SP-075 | Fail loud PROMPT parse | ⚠️ Partial — engine yes, planner/preflight/plan no |
| SP-077 | Sandbox workerLaunchScript | ✅ Held |
| SP-079 | Split spine.mjs CLI router | ✅ Held — 311 LOC + spine-cli/ |

## Phase 16 Integration Check (SP-089–094)

| Area | Verdict |
| --- | --- |
| discoverCursorRules + manifest | ✅ Integrated |
| selectRulesForWorker + micromatch | ✅ Present |
| spine rules CLI | ✅ Present |
| Gap | ⚠️ rules select uses parsePrompt not validatePrompt |

---

## Top 10 Refactor Targets

| Rank | File | Primary violation | Effort |
| --- | --- | --- | --- |
| 1 | `bin/spine-preflight.mjs` | God module (572 LOC) | L |
| 2 | `src/planner/index.mjs` | Ignores PROMPT validation | S |
| 3 | `src/planner/scope.mjs` | Broken regex escape in glob | S |
| 4 | `.spine/spine-config.json` + template | Empty testing vs gates | M |
| 5 | `src/config/worker-context.mjs` | God file + fake async + silent skips | M |
| 6 | `bin/spine-batch.mjs` | God CLI module (415 LOC) | L |
| 7 | preflight + discover.mjs | Duplicate discovery | S |
| 8 | `src/cli/rules.mjs` | parsePrompt bypass | S |
| 9 | `bin/spine-plan.mjs` | Fake async plan command | S |
| 10 | `bin/spine-init.mjs` | Large init + config defaults drift | M |

---

## Recommended Remediation Tasks (SP-109+)

| ID | Title | Priority |
| --- | --- | --- |
| SP-109 | Fail-loud PROMPT validation in planner, preflight plan check, and spine plan | P1 |
| SP-110 | Fix glob scope escapeRegexChar + regression tests | P1 |
| SP-111 | Align spine-config testing defaults; doctor warns on empty evidence commands | P1 |
| SP-112 | Strangler bin/spine-preflight.mjs → src/preflight/ | P2 |
| SP-113 | Unify task discovery — delete preflight discoverTaskFolders | P2 |
| SP-114 | Remove fake async from buildWorkerContextAsync and runSpinePlan | P3 |
| SP-115 | Replace operational parsePrompt with validatePrompt | P2 |
| SP-116 | Worker context strict mode for skipped reference paths | P3 |
| SP-117 | Add npm run test:core with explicit globs | P3 |

**Ready for next remediation wave? YES** — land SP-109 and SP-111 before next consumer adoption batch.

---

## Audit metadata

- **Findings:** 10 (3 HIGH, 5 MEDIUM, 2 LOW)
- **Tests:** typecheck pass; 103/103 scoped module tests pass
- **Production code modified:** none (read-only audit)
