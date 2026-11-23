# SP-892: Extract issues github provider — Status

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

- [x] Dependencies satisfied (SP-891) — `src/integrations/issues/mission-issue-links.mjs` landed (commit 85c9da05); `defaultRunGh` (sync-on-land.mjs:76–95), `GH_CALL_TIMEOUT_MS` (line 24), `GhRunResult` typedef (lines 39–44) identified as extract surface
- [x] Identify extract surface

---

### Step 1: Extract provider
**Status:** ✅ Complete

- [x] Create providers/github.mjs — exports `defaultRunGh` (spawn options: cwd/encoding/stdio/timeout identical to original; result shape `{ status, stdout, stderr, error }`), `GH_CALL_TIMEOUT_MS`, `GhRunResult` typedef; optional `{ spawn }` injection seam for deterministic tests (repo pattern: `tests/doctor/inherit-provider-auth.test.mjs` `spawnFn`)
- [x] Rewire sync-on-land — removed inlined `spawnSync` import, `GH_CALL_TIMEOUT_MS`, local typedef, and `defaultRunGh`; imports provider; call-site arrow wrapper unchanged; `GhRunResult` re-declared via `import()` type

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Provider + sync tests — new `tests/integrations/issues/providers-github.test.mjs` (7 tests: timeout constant, spawn options incl. no-shell/piped-stdio/hard-timeout, success mapping, non-zero soft-fail, ENOENT→null-status, non-string coercion, ETIMEDOUT shape); added default-wiring test to `sync-on-land.test.mjs` (gh-missing skip without injected `runGh`); all 33 tests green
- [x] Contract testCommand — `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test ...` exited 0

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged (see Discoveries table)
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand failed (exit 1): a3aab5e  src/integrations/issues/providers/github.mjs:15  WARNING  Duplicate implementation of the `gh` CLI runner. `src/cli/boar | advisory — noted, not blocking | contract review step |
| `mock.method` on `node:child_process` does not affect ESM named imports (snapshot bindings) — spawn cannot be stubbed from outside the provider module | Provider takes optional `{ spawn }` injection (repo pattern: `tests/doctor/inherit-provider-auth.test.mjs` `spawnFn`); default behavior identical | `src/integrations/issues/providers/github.mjs` |
| `gh_missing` gate sits AFTER issue-link collection in `syncIssuesOnLand`; default-wiring test needs a task packet with a link to reach it | Test creates packet with `Closes #42.` | `tests/integrations/github/sync-on-land.test.mjs` |
| GitNexus impact ambiguous: a mirrored `defaultRunGh` exists in `src/cli/board-select.mjs` (doc comment "Mirrors defaultRunGh in sync-on-land.mjs"); board-select is OUT of file scope — untouched; its mirror comment is now stale | Follow-up candidate for a future task (not SP-893 scope) | `src/cli/board-select.mjs:77` |
| Impact index stale (7 commits behind) reported inflated CRITICAL blast radius (367 direct); grep verified the sync-on-land `defaultRunGh` is module-local with exactly one call site (line 281) | Behavior-preserving extraction; risk retired by one-site rewiring + green tests | `src/integrations/github/sync-on-land.mjs` |
| Full suite (`worker-verify.sh` / `SPINE_WORKER_STUB=1 npm test`) fails in batch-engine/adoption areas (`tests/adoption/fixture-batch`, `replan-needs-replan`, `tests/batch/attached-batch-exit`, `attached-gate-limbo`) — CONFIRMED pre-existing: same files fail on pre-task commit `008b6bfa`; none import `sync-on-land` or the provider | Not caused by SP-892; full-suite gate is engine's post-integrate `release:check` per PROMPT/user instruction | `tests/adoption/`, `tests/batch/` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-23 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-23 | Step 0 preflight | Extract surface identified; SP-891 path confirmed (85c9da05) |
| 2026-11-23 | Step 1 extract | `providers/github.mjs` created; sync-on-land rewired; lint+typecheck clean |
| 2026-11-23 | Step 2 verify | 7 provider tests + 1 wiring test added; 33/33 green; Contract testCommand EXIT=0 |
| 2026-11-23 | Step 3 delivery | Full-suite batch-area failures verified pre-existing on `008b6bfa`; `.DONE` created |

---

## Blockers

*None* — Contract `testCommand` exits 0; full-suite batch-engine/adoption failures are pre-existing on the base commit (see Discoveries) and gated post-integrate.

---

## Notes

**Completion Criteria**

- [x] `providers/github.mjs` exists and is used by sync-on-land
- [x] No behavior change in sync soft-fail paths (spawn options, result shape, soft-fail mapping byte-identical; tests cover ENOENT/non-zero/timeout shapes)
- [x] Contract `testCommand` exits 0 (lint ✓, typecheck ✓ both tsconfigs, 33/33 tests ✓)

Release v2.35.0 — Partial #387 (provider extract).

**2026-11-23 prelanded amend:** `sync-on-land.mjs` removed from `fileScopeMustChange` (already on main via SP-890/SP-891); still in File Scope for extract rewire.
