# SP-785: Unified task-ID discovery (SP-1000+) — Status

**Current Step:** Complete
**Status:** ✅ Done — all completion criteria met
**Last Updated:** 2026-09-27
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Reproduce mismatch
- [x] List consumers
- [x] Dependencies satisfied

### Step 1: Shared patterns + numeric sort
**Status:** ✅ Done

- [x] Shared regexes + helpers
- [x] `discoverTasks` `\d{3,}` + numeric sort
- [x] `scope.mjs` re-export

### Step 2: Preflight + worker delegation
**Status:** ✅ Done

- [x] Preflight delegates; non-task folders excluded
- [x] Worker prompt/runner use shared helper

### Step 3: Boundary + guard tests
**Status:** ✅ Done

- [x] Parity + numeric order
- [x] Regex guard test
- [x] Preflight test expectations

### Step 4: Testing & Verification
**Status:** ✅ Done

- [x] Lint
- [x] Contract `testCommand`
- [x] Full suite
- [x] `spine plan all` count unchanged
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ✅ Done

- [x] Discoveries logged
- [x] Create `.DONE`

---

## Discoveries

| Finding | Detail |
|---------|--------|
| Mismatch reproduced | Fixture `SP-099-baz`/`SP-999-foo`/`SP-1000-bar`/`X-001-single`/`_explore`: planner drops SP-1000, preflight counts `_explore`, lexicographic sort puts SP-1000 before SP-999 |
| Consumer inventory | `discover.mjs:5` (`\d{3}`), `discovery.mjs:15` `TASK_ID_PATTERN` (`[A-Z]{2,}`), `discovery.mjs:35` `taskIdFromFolder`, `discovery.mjs:39/51` unfiltered discovery, `scope.mjs:15` `TASK_ID_RE` (canonical shape), `worker-prompt.mjs:83`, `spine-worker-runner.mjs:315` |
| Out-of-scope regexes (untouched) | `parse-prompt.mjs` (`\d+` heading/parsers), `taskplane-state.mjs:124`, `engine-scope.mjs:92` — not in File Scope |
| Blast radius | GitNexus impact on `discoverTaskFolders`: LOW, 7 impacted (preflight checks → batch preflight → batch start) — matches PROMPT risk note |
| Fourth private regex | Guard sweep found `worker-prompt.mjs:48` default `taskIdHint` param with its own `/^([A-Z]+-\d+)/`; now defaults to `taskIdFromFolder(taskFolder)` |
| Preflight tests | Existing expectations (TP-001/TP-002) unchanged; added `checkTasksRoot ignores non-task folders` case (`_explore`/`_authoring`/`_archive` with PROMPT.md excluded) |
| Boundary suite | 6/6 pass; affected suites (preflight + worker-prompt + planner) 118/118 pass |
| Verification evidence | lint clean; typecheck clean; Contract testCommand 124/124; full suite `SPINE_WORKER_STUB=1 npm test` **2679/2679 pass** |
| Plan count unchanged | `discoverTasks('spine-tasks')` BEFORE **766** = AFTER **766** (verified against stashed pre-change HEAD); preflight now also reports 766 (agrees with planner). `spine plan all` output identical pre/post: 58 legacy TP-04x "Missing testing coverage" lines — pre-existing validation failure, unrelated to discovery |
| PRD check | `docs/PRD.md` FR-TASK-01 says `{tasksRoot}/{PREFIX-###-slug}/PROMPT.md` — `###` is a placeholder, no "three digits" wording; no doc update required (Must Update: None) |
| Baseline count | `discoverTasks('spine-tasks')` = **766** tasks, all 3-digit IDs |
| `spine plan all` pre-existing failure | Throws on legacy TP-04x packets with invalid PROMPT (missing Testing) — unrelated to discovery; using `discoverTasks` count for the plan-count criterion instead |

## Blockers

_None._

## Completion Criteria

- [x] SP-1000 discovered by planner, preflight, and worker runner (boundary fixture test + repo checks)
- [x] Ordering SP-099 < SP-999 < SP-1000 (`compareTaskIds`)
- [x] `checkTasksRoot` ignores non-task folders (new preflight test)
- [x] One task-ID regex, guarded by a test (guard passes on all four consumer files)
- [x] Closes #300
