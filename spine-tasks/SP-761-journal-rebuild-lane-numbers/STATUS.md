# SP-761: Preserve laneNumber on journal rebuild — Status

**Current Step:** Step 1 (Preserve laneNumber across rebuild)
**Status:** 🟡 In Execution
**Last Updated:** 2026-09-21
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Reproduce multi-lane collapse to lane 1
- [x] Identify event/seed merge that drops laneNumber
- [x] Dependencies satisfied (none required)

### Step 1: Preserve laneNumber across rebuild
**Status:** ✅ Complete

- [x] Prefer last known finite laneNumber
- [x] Keep distinct lane stubs after retry
- [x] Regression test 3-lane case

**Artifacts:**
- `src/batch/journal-rebuild-structural.mjs` (modified)
- `tests/batch/journal-rebuild-lane-numbers.test.mjs` (new)

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint — `npm run lint` clean (`eslint --max-warnings 0`)
- [x] Run Contract testCommand — `npm run typecheck` clean + new test file 5/5 pass
- [x] Fix all failures — none introduced

### Step 3: Documentation & Delivery
**Status:** 🟡 In Progress

- [x] Discoveries logged
- [ ] Create .DONE

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Collapse reproduced: journal `task.started` events without `laneNumber` (older/laneness producers) make `taskStub` default tasks to lane 1, and `finalizeTasks` lets that bogus derived `1` shadow the seed's correct lanes 2–3 | Fix in scope | `src/batch/journal-rebuild-structural.mjs` (`taskStub`, `finalizeTasks`) |
| `taskStub` guard `hints.laneNumber != null` passes `NaN` (from `Number(undefined)`), then `Number(NaN) \|\| row.laneNumber \|\| 1` prematurely defaults lane-less rows to 1 | Root cause #1 | `taskStub` |
| `finalizeTasks` uses `derived.laneNumber ?? seed?.laneNumber ?? 1` — defaulted derived 1 wins over seed | Root cause #2 | `finalizeTasks` |
| All current producers journal `laneNumber` on `task.started` (engine-lanes.mjs:252, matrix-run.mjs:632, resume-multi-lanes.mjs:248); single-task `resume.mjs:205` hardcodes lane 1 but only runs for 1-task/1-lane batches. Collapse trigger is lane-less/older journal events + seed shadowing | Context | journal producers |
| `lane.tasks_serialized` only journaled when a lane has >1 queued task (resume-multi-queue.mjs), so task→lane mapping usually rests on `task.started` + seed | Context | `resume-multi-queue.mjs` |
| Pre-existing failure (not SP-761): `salvage-inspect.test.mjs` "startBatch worker failure with dirty scoped file…" fails identically on unmodified tree — fixture passes undefined batchId to `readJournalEvents` | No action (out of scope) | `tests/batch/salvage-inspect.test.mjs:215` |
| Full `npm test` inside worker session: 2627 tests, 2584 pass, 43 fail — all 43 are `nested_batch_spawn_blocked` (SP-482 guard, `SPINE_IS_WORKER=1`); identical 43 failures with fix stashed (122-test subset run: 79 pass / 43 fail both ways) | Environmental, zero regressions | `tests/batch/engine*.test.mjs`, `tests/spine-run.test.mjs`, sequence/adoption/attached/detached suites |
| Test-run side effect: running the suite regenerates `.spine/rules-manifest.json` `generatedAt`; reverted (Do-NOT: `.spine/`) | Reverted | `.spine/rules-manifest.json` |
| `docs/adoption/operator-runbook.md` salvage section documents generic dry-run/integrate flow; never documented the collapsed behavior, so no update needed. Operator salvage multi-lane notes belong to SP-766 per PROMPT | No change | `docs/adoption/operator-runbook.md` |
| `detect_changes()` post-edit: changed symbols confined to `journal-rebuild-structural.mjs`; affected process `ListSalvageableLanes → TaskStub` (intended) | Verified | GitNexus |

## Verification Evidence

| Command | Result |
|---------|--------|
| `SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/journal-rebuild-lane-numbers.test.mjs` | 5 tests, 5 pass, 0 fail |
| `npm run lint` | clean (`eslint --max-warnings 0 src bin tests scripts`) |
| `npm run typecheck` | clean (tsconfig.json + tsconfig.batch.json) |
| Neighbors: journal-rebuild*, batch-salvage-*, salvage-* suites | 46/47 pass; 1 pre-existing failure (see Discoveries) |
| Full `npm test` (worker session) | 2584/2627 pass; 43 env-guard failures identical without fix |

## Plan (Step 1, Review Level 2)

1. Add `finiteLaneNumber(value)` helper: finite and > 0 → number, else `null`.
2. `taskStub`: set `row.laneNumber` only from a finite positive hint; never default to 1 inside the stub (defer to seed/fallback in `finalizeTasks`). Last-write-wins among explicit event values is preserved.
3. `finalizeTasks`: `finiteLaneNumber(derived.laneNumber) ?? finiteLaneNumber(seed?.laneNumber) ?? 1` — journal-provided lane wins, seed fills gaps only (FR-SHIP-10 kept), 1 is last resort.
4. New `tests/batch/journal-rebuild-lane-numbers.test.mjs`:
   - Unit: 3-lane DirtyWorktree→retry timeline with lane-less `task.started` events + seed lanes 1–3 → tasks stay on lanes 1–3, lane stubs keep distinct taskIds.
   - Unit: explicit `laneNumber` events still win over seed (journal-wins unchanged).
   - Git-fixture integration: salvage `--dry-run` (`listSalvageableLanes`) lists all 3 lanes with commits ahead after the #287 timeline.

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-21 | Task staged | PROMPT.md and STATUS.md created for v2.22.0 |
| 2026-09-21 | Step 0 preflight | Collapse reproduced via timeline sim (lane-less task.started → all tasks lane 1); root cause identified in `taskStub`/`finalizeTasks`; impact analysis run (CRITICAL blast radius, narrow change kept) |
| 2026-09-21 | Step 1 implement | `finiteLaneNumber` helper; `taskStub` only accepts finite positive lane hints; `finalizeTasks` prefers journal lane → seed lane → 1; 5-test regression suite added, 5/5 pass |
| 2026-09-21 | Step 2 verify | lint clean, typecheck clean, Contract testCommand green, neighbors 46/47 (1 pre-existing), full suite 2584/2627 with 43 env-guard failures identical stashed |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
