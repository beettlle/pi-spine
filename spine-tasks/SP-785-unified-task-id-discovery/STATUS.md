# SP-785: Unified task-ID discovery (SP-1000+) — Status

**Current Step:** Step 3 (Boundary + guard tests)
**Status:** 🔄 In Progress
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
**Status:** ⬜ Not Started

- [ ] Parity + numeric order
- [ ] Regex guard test
- [ ] Preflight test expectations

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Full suite
- [ ] `spine plan all` count unchanged
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| Finding | Detail |
|---------|--------|
| Mismatch reproduced | Fixture `SP-099-baz`/`SP-999-foo`/`SP-1000-bar`/`X-001-single`/`_explore`: planner drops SP-1000, preflight counts `_explore`, lexicographic sort puts SP-1000 before SP-999 |
| Consumer inventory | `discover.mjs:5` (`\d{3}`), `discovery.mjs:15` `TASK_ID_PATTERN` (`[A-Z]{2,}`), `discovery.mjs:35` `taskIdFromFolder`, `discovery.mjs:39/51` unfiltered discovery, `scope.mjs:15` `TASK_ID_RE` (canonical shape), `worker-prompt.mjs:83`, `spine-worker-runner.mjs:315` |
| Out-of-scope regexes (untouched) | `parse-prompt.mjs` (`\d+` heading/parsers), `taskplane-state.mjs:124`, `engine-scope.mjs:92` — not in File Scope |
| Blast radius | GitNexus impact on `discoverTaskFolders`: LOW, 7 impacted (preflight checks → batch preflight → batch start) — matches PROMPT risk note |
| Baseline count | `discoverTasks('spine-tasks')` = **766** tasks, all 3-digit IDs |
| `spine plan all` pre-existing failure | Throws on legacy TP-04x packets with invalid PROMPT (missing Testing) — unrelated to discovery; using `discoverTasks` count for the plan-count criterion instead |

## Blockers

_None._
