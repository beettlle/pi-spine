# pi-spine v2.3.1 — Reliability Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.3.1 Reliability  
**Last updated:** 2026-07-10  
**Status:** Ready for spine batch execution  

**Epic alias:** Phase 66 — SP-REL231 (SP-608+)

**Prerequisite:** v2.3.0 on `main` (`package.json` `2.3.0`); module-split epic landed ([`PRD-v2.3.0-module-split-handoff.md`](PRD-v2.3.0-module-split-handoff.md)).

**Release profile:** patch — 5 tasks; S-sized; 1–2 waves; detached batches only.

**Operator approved scope:** yes (2026-07-10)

---

## 1. Executive summary

v2.3.0 completed the batch module split (#117) and emptied `PHASE23_GRANDFATHERED_OVER_500`. The same release batch (`20260710T182711`) and follow-on operator runs surfaced four **reliability bugs**:

- [#191](https://github.com/beettlle/pi-spine/issues/191) — cross-lane bisect → `merge_blocked` when a dependent lane never syncs orch
- [#192](https://github.com/beettlle/pi-spine/issues/192) — LOC-capstone / empty-grandfather tasks runnable before `batch-loc-policy` readiness
- [#194](https://github.com/beettlle/pi-spine/issues/194) — abort/dismiss/stall kill `workerPid` but leave orphaned `pi` grandchildren (RAM leak)
- [#195](https://github.com/beettlle/pi-spine/issues/195) — watch/dashboard keep stale gitignored/merge headlines after batch is gate-ready

**v2.3.1** closes these four bugs and records Phase 66 in CONTEXT. Enhancements (including [#193](https://github.com/beettlle/pi-spine/issues/193)) stay deferred.

**Tagline:** *Land-loop truth, tree-kill teardown, orch→lane sync — ship the reliability patch.*

---

## 2. Scope lock

### In scope (Phase 66 — SP-REL231)

| FR | Description |
|----|-------------|
| FR-REL231-01 | Prefer gate-ready / `needs_integrate` headline over historical merge/gitignored signals (#195) |
| FR-REL231-02 | Process-group / tree terminate for runner + `pi` grandchildren on abort/dismiss/stall (#194) |
| FR-REL231-03 | Sync lane worktree from orch before task start when deps share File Scope (#191) |
| FR-REL231-04 | Planner/preflight blocks empty-grandfather / LOC-capstone missions when `batch-loc-policy` would fail (#192) |
| FR-REL231-05 | CONTEXT Phase 66 capstone + release note |

### Deferred (v2.4.0+)

| Item | Rationale |
|------|-----------|
| [#193](https://github.com/beettlle/pi-spine/issues/193) create-spine-tasks DoR multi-lane | Operator: next minor; labeled enhancement |
| [#160](https://github.com/beettlle/pi-spine/issues/160), [#135](https://github.com/beettlle/pi-spine/issues/135), [#127](https://github.com/beettlle/pi-spine/issues/127)–[#120](https://github.com/beettlle/pi-spine/issues/120), [#124](https://github.com/beettlle/pi-spine/issues/124)–[#126](https://github.com/beettlle/pi-spine/issues/126), [#43](https://github.com/beettlle/pi-spine/issues/43) | Enhancements / epics — patch = 0 enhancements |
| #191 planner affinity / auto-resolve shim | Nice-to-have; primary close is orch→lane sync |
| Pending SP-602, SP-605 | Leftover v2.3.0 LOC splits — not in release scope |

### Non-goals

- Behavioral API breaks
- npm publish without operator approval
- Re-opening SP-593 / re-filling grandfather list
- Skill authoring clusters (#193)

---

## 3. Baseline

| Check | Value |
|-------|-------|
| Current version | `2.3.0` |
| Target | `2.3.1` (patch) |
| Next Task ID (pre-author) | SP-608 |
| Open bugs in scope | #191, #192, #194, #195 (all gaps — no existing `Closes`) |
| Pending outside scope | SP-602, SP-605 |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| Headline / diagnose | [`src/batch/diagnosis.mjs`](../src/batch/diagnosis.mjs) `buildHeadline`, [`src/batch/reconcile-batch.mjs`](../src/batch/reconcile-batch.mjs) |
| Worker teardown | [`src/batch/worker-host.mjs`](../src/batch/worker-host.mjs) `terminateLaneWorkers`, [`bin/spine-worker-runner.mjs`](../bin/spine-worker-runner.mjs) |
| Lane start / worktree | [`src/batch/engine-lanes.mjs`](../src/batch/engine-lanes.mjs) `runTaskOnLane`, [`src/batch/worktree.mjs`](../src/batch/worktree.mjs) |
| LOC policy / preflight | [`bin/spine-cli/verify.mjs`](../bin/spine-cli/verify.mjs) `batch-loc-policy`, [`src/config/preflight/discovery.mjs`](../src/config/preflight/discovery.mjs) |
| Operator runbook | [`docs/adoption/operator-runbook.md`](adoption/operator-runbook.md) |

---

## 5. GitHub issue intake

| Issue | Priority | On `main` | v2.3.1 action | Task |
|-------|----------|-----------|---------------|------|
| [#195](https://github.com/beettlle/pi-spine/issues/195) | bug | Open | **Implement** | SP-608 |
| [#194](https://github.com/beettlle/pi-spine/issues/194) | bug P2 | Open | **Implement** | SP-609 |
| [#191](https://github.com/beettlle/pi-spine/issues/191) | bug | Open | **Implement** (sync only) | SP-610 |
| [#192](https://github.com/beettlle/pi-spine/issues/192) | bug | Open | **Implement** (readiness gate) | SP-611 |
| [#193](https://github.com/beettlle/pi-spine/issues/193) | enh | Open | **Defer** | — |

---

## 6. Functional requirements

### FR-REL231-01 — Gate-ready headline wins (#195)

When all tasks are terminal-success and an integrate gate is open (or diagnosis is `needs_integrate`):

1. Do **not** headline recovered `mergeGitignoredFailure` or historical `mergeFailed` as the current blocker.
2. Headline / `suggestedCommand` point at gate approve (or equivalent land-loop next step).
3. Historical merge failures may remain in diagnose signals/history, not as primary headline.
4. Regression tests cover gate-ready + stale merge/gitignored context.

### FR-REL231-02 — Tree-kill worker teardown (#194)

1. Shared process-group / tree terminate helper used by dismiss, abort, stall kill, and hung-worker teardown.
2. Killing tracked `workerPid` also reaps nested `pi` (and tool children) for that lane.
3. Regression test: fake grandchild dies when tracked runner is torn down.
4. Short operator-runbook note: detect leftover `pi` via `pgrep` / `SPINE_BATCH_ID` if any remain.

### FR-REL231-03 — Orch→lane sync before task start (#191)

1. Before starting a task on a lane, ensure the lane worktree includes orch commits for satisfied dependencies that share File Scope with the task (hard sync / merge orch→lane).
2. Dependent bisect halves on different lanes no longer produce `merge_blocked` solely from missing orch sync.
3. Regression test with ancestor check / fixture covering shared-path dep across lanes.
4. Defer planner same-lane affinity and shim auto-resolve to a later release.

### FR-REL231-04 — LOC-capstone readiness (#192)

1. Planner or preflight blocks tasks whose mission is emptying `PHASE23_GRANDFATHERED_OVER_500` (or equivalent LOC-capstone) when `batch-loc-policy` would fail after the change.
2. Clear, actionable error — do not schedule into `worker_done_missing`.
3. Do not re-open SP-593 or re-populate the grandfather list.
4. Regression test for blocked vs allowed readiness.

### FR-REL231-05 — CONTEXT capstone

Update Phase 66 table, Next Task ID → SP-613, link PRD + manifest.

---

## 7. Task decomposition

| SP-ID | Slug | Mission | Size | Deps | Closes |
|-------|------|---------|------|------|--------|
| SP-608 | diagnose-gate-ready-headline | FR-REL231-01 | S | — | #195 |
| SP-609 | worker-tree-terminate | FR-REL231-02 | S | — | #194 |
| SP-610 | lane-orch-sync-before-start | FR-REL231-03 | S | — | #191 |
| SP-611 | loc-capstone-readiness-gate | FR-REL231-04 | S | — | #192 |
| SP-612 | context-phase66-capstone | FR-REL231-05 | S | SP-608–611 | — |

### File scope hints

**SP-608:** `src/batch/diagnosis.mjs`, `src/batch/reconcile-batch.mjs`, `tests/batch/diagnosis.test.mjs` (and/or merge-failure / watch diagnose tests)

**SP-609:** `src/batch/worker-host.mjs`, optional `src/process/*` helper, `bin/spine-worker-runner.mjs` (only if spawn group required), `tests/batch/dismiss-orphan-worker-kill.test.mjs` (extend or sibling), `docs/adoption/operator-runbook.md`

**SP-610:** `src/batch/worktree.mjs`, `src/batch/engine-lanes.mjs`, new/extended test under `tests/batch/`

**SP-611:** `src/config/preflight/` and/or `src/planner/`, `bin/spine-cli/verify.mjs` (read helpers only unless tiny export), tests under `tests/config/` or `tests/planner/`

**SP-612:** `spine-tasks/CONTEXT.md`, `spine-tasks/dependencies.json`

---

## 8. Wave run order

```text
Wave 0 (parallel): SP-608, SP-609, SP-610, SP-611
Cap: SP-612
```

**Regression gate (per integrate):** `npm run release:check` with exit-code verification (no tail-only).

**Release execution:** spine-release-operator **patch** profile — detached batches only.

---

## 9. Exit criteria

- [ ] #195 closed — gate-ready headline preferred over stale merge/gitignored
- [ ] #194 closed — tree terminate reaps `pi` grandchildren; runbook note present
- [ ] #191 closed — orch→lane sync before task start for shared-scope deps
- [ ] #192 closed — LOC-capstone readiness gate blocks premature schedule
- [ ] CONTEXT Phase 66 complete; Next Task ID → SP-613
- [ ] `npm run release:check` green on publish HEAD
- [ ] `npm version patch` → v2.3.1 published (operator-gated)

---

## 10. Workflow after this document

```text
Packets: SP-608–612 under spine-tasks/
Manifest: spine-tasks/_authoring/release-v2.3.1/manifest.md
```

```bash
spine tasks validate SP-608 SP-609 SP-610 SP-611 SP-612
spine plan SP-608,SP-609,SP-610,SP-611,SP-612
spine run sequence SP-608,SP-609,SP-610,SP-611,SP-612 --dry-run
```

**Handoff after publish:** resume deferred enhancements (#193 first among skill/docs) under next minor profile.
