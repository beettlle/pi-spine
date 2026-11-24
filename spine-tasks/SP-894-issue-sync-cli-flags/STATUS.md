# SP-894: Issue-sync CLI flags — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-11-23
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Dependencies satisfied (SP-893)
- [x] Grep old flag call sites

---

### Step 1: Rename public flags
**Status:** ✅ Complete

- [x] --no-issue-sync
- [x] --issue-label
- [x] Tests + help

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Contract testCommand

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `bin/spine-integrate.mjs` is a library module (no own `main`); real CLI surface is the `bin/spine.mjs` dispatcher → `bin/spine-cli/integrate.mjs` | Verified fail-closed through dispatcher: `spine integrate --no-github-sync` → exit 2 `Unknown option(s)`; `--no-issue-sync` accepted | `bin/spine-integrate.mjs` |
| Legacy `--github-label` rejected fail-closed in `parseBoardSelectArgs` (throws with `suggestedCommand`); `bin/spine-plan.mjs` wraps it in the standard `Error:`/`Suggested:` style, exit 1 — no silent alias | Done | `src/cli/board-select.mjs`, `bin/spine-plan.mjs` |
| Machine-readable skip reason renamed `no_github_sync_flag` → `no_issue_sync_flag` (internal reason string, not a journal event type; journal events untouched per SP-895) | Done | `src/integrations/issues/sync-on-land.mjs`, `tests/integrations/issues/sync-on-land.test.mjs` |
| Docs still mention old flags (`docs/adoption/operator-runbook.md`, `agent-orchestrated-waves.md`) — out of File Scope, intentionally untouched | Deferred to SP-896 | `docs/adoption/*` |
| GitNexus impact on `parseBoardSelectArgs` flagged CRITICAL (547 nodes) — transitive import fan-out, not real blast radius; actual direct consumers are `bin/spine-plan.mjs` + board-select tests, both updated, contract green | Noted | — |
| Full-suite `worker-verify.sh` in this worker session: 3450 tests, 3389 pass, 61 fail — every failure is the `nested_batch_spawn_blocked` guard (`SPINE_IS_WORKER=1`, SP-482; engine never starts → missing journal/batch state cascades). `tests/batch/engine.test.mjs` passes 12/12 with `SPINE_IS_WORKER` unset in the same worktree — environmental, not caused by SP-894. Contract testCommand green; full suite runs clean post-integrate outside worker env | Noted | — |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-23 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-23 | Step 0 preflight | Sync module confirmed at `src/integrations/issues/`; old-flag call sites mapped (in-scope only) |
| 2026-11-23 | Step 1 | Flags renamed in CLI + param plumbing + tests; legacy flags rejected fail-closed; help/errors updated |
| 2026-11-23 | Step 2 | Contract testCommand exit 0 (lint, typecheck, 56 tests); dispatcher smoke: old flags rejected (exit 2/1), new flags accepted |
| 2026-11-23 | Step 3 | worker-verify full suite: 61 fails all `nested_batch_spawn_blocked` (worker env, SP-482); engine.test.mjs green with env unset → environmental; SP-894 scope clean |

---

## Blockers

*None*

---

## Notes

Release v2.35.0 — Partial #387 (CLI flags).

**File Scope note:** May touch `sync-on-land.mjs` / `integrate.mjs` for `noIssueSync` param rename. If so, serialize before SP-895 via deps (SP-895 depends on SP-894).

**2026-11-23 prelanded amend:** `board-select.mjs` removed from `fileScopeMustChange` (already on main via SP-891); still in File Scope for `--issue-label`.
