# pi-spine v1.8.1 — Reconciliation Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 1.8.1 Reconciliation  
**Last updated:** 2026-07-07  
**Status:** Ready for `create-spine-tasks` decomposition  

**Epic alias:** Phase 59 — SP-REC (SP-511+)

**Prerequisite:** v1.8.0 on `main` ([`docs/release/stabilization-roadmap-v1.8-v2.0.md`](release/stabilization-roadmap-v1.8-v2.0.md)).

**Release profile:** patch — 5–8 tasks, **S-sized only** per [`skills/spine-release-operator/references/release-profiles.md`](../../skills/spine-release-operator/references/release-profiles.md).

---

## 1. Executive summary

Phase 22 (SP-171–191) delivered journal rebuild, `state_drift` diagnosis, and atomic transitions. **v1.6.0–v1.8.0 release batches still stall** when:

- Lane worktree has `.DONE` + review APPROVE but batch-state shows `status: running` ([#170](https://github.com/beettlle/pi-spine/issues/170))
- Operator pause/resume during contract retry orphans the engine via SIGTERM ([#184](https://github.com/beettlle/pi-spine/issues/184))
- `suggestedCommand` for `state_drift` is non-actionable (retry rejects `running` tasks) ([#170](https://github.com/beettlle/pi-spine/issues/170), [#168](https://github.com/beettlle/pi-spine/issues/168))
- Macro phase reports `Failed` while workers are active ([#165](https://github.com/beettlle/pi-spine/issues/165))
- Dashboard shows `[completed]` under `engine_orphaned` / `state_drift` ([#186](https://github.com/beettlle/pi-spine/issues/186))

**v1.8.1** closes the reconciliation gap so `spine status --diagnose` always returns a **runnable** next command and incident journals replay without manual batch-state edits.

**Tagline:** *Lane truth matches batch truth — every time.*

---

## 2. Scope lock

### In scope (Phase 59 — SP-REC)

| FR | Description |
|----|-------------|
| FR-STA-01 | `doneInLane` + terminal artifacts → batch-state terminal reconcile (idempotent) |
| FR-STA-02 | Pause/resume survives without `engine_orphaned` (SIGTERM path) |
| FR-STA-03 | `state_drift` `suggestedCommand` always actionable for drift retry deadlock |
| FR-STA-04 | Macro phase accurate when batch `running` and lane workers active |
| FR-STA-05 | Dashboard wave panel reflects on-disk terminal success under drift/orphan |
| FR-STA-06 | Incident fixture regression for batches `20260705T210857`, `20260706T052912` |
| FR-STA-07 | Attached pause phase persistence (extends SP-376) |
| FR-STA-08 | Skip clears failed segment for wave merge ([#96](https://github.com/beettlle/pi-spine/issues/96)) |

### Deferred (v1.9.0+)

- Contract `testCommand` validation ([#187](https://github.com/beettlle/pi-spine/issues/187)) — v1.9.0
- Release harness / sequence automation — v1.10.0
- Full batch-state rebuild without cache seed (FR-SHIP-10) — post-v2.0.0
- Concurrent resume fail-fast ([#167](https://github.com/beettlle/pi-spine/issues/167)) — v1.10.0

### Non-goals

- Rewriting the entire engine FSM
- Replacing attached batches with detached-only (document policy in [#185](https://github.com/beettlle/pi-spine/issues/185) for v1.10.0)
- New dashboard features (DAG, throughput) — deferred

---

## 3. Baseline — already landed (do not re-implement)

| Work | Reference | Gap |
|------|-----------|-----|
| Journal rebuild + drift detect | SP-174, SP-175 | Does not cover #170 retry deadlock |
| `state_drift` recovery UX | SP-496, closed [#164](https://github.com/beettlle/pi-spine/issues/164) | Regressed in v1.7.0/v1.8.0 ([#170](https://github.com/beettlle/pi-spine/issues/170)) |
| Attached pause signal | SP-375, SP-376 | Phase persistence incomplete ([#103](https://github.com/beettlle/pi-spine/issues/103)) |
| Orphan detect taxonomy | SP-111, SP-115 | Pause/resume SIGTERM path ([#184](https://github.com/beettlle/pi-spine/issues/184)) |
| doneInLane semantics | SP-344 (partial) | Detection chain not landed (SP-445–447 staged) |

---

## 4. Code anchors (reuse)

| Concern | Primary files |
|---------|---------------|
| Reconcile | `src/batch/reconcile.mjs`, `src/batch/journal-rebuild.mjs` |
| Diagnosis | `src/batch/diagnosis.mjs`, `src/batch/diagnosis-tail-state.mjs` |
| Macro phase | `src/batch/macro-phase.mjs` |
| Orphan detect | `src/batch/orphan-detect.mjs` |
| Attached runner | `src/batch/attached-runner.mjs`, `src/batch/attached-engine-handoff.mjs` |
| Task transitions | `src/batch/lifecycle.mjs`, `src/batch/batch-state-io.mjs` |
| Dashboard waves | `src/dashboard/snapshot-waves.mjs`, `src/dashboard/ui.mjs` |
| Incidents | `tests/fixtures/incidents/*.json` |
| Regression | `tests/batch/journal-rebuild-drift.test.mjs`, `tests/batch/spine-diagnosis-state-drift.test.mjs` |

---

## 5. GitHub issue intake

| Issue | Closes / Partial | Assigned task |
|-------|------------------|---------------|
| [#170](https://github.com/beettlle/pi-spine/issues/170) | Closes | SP-512 (new) |
| [#184](https://github.com/beettlle/pi-spine/issues/184) | Closes | SP-513 (new) |
| [#100](https://github.com/beettlle/pi-spine/issues/100) | Partial | SP-445, SP-446, SP-447, SP-448 |
| [#103](https://github.com/beettlle/pi-spine/issues/103) | Closes | SP-449 |
| [#96](https://github.com/beettlle/pi-spine/issues/96) | Closes | SP-442 |
| [#165](https://github.com/beettlle/pi-spine/issues/165) | Closes | SP-515 (new) |
| [#166](https://github.com/beettlle/pi-spine/issues/166) | Closes | SP-516 (new) |
| [#186](https://github.com/beettlle/pi-spine/issues/186) | Closes | SP-517 (new) |
| [#163](https://github.com/beettlle/pi-spine/issues/163) | Partial | SP-518 (new) — docs + guard; full fix may span v1.10.0 |
| [#168](https://github.com/beettlle/pi-spine/issues/168) | Closes | SP-519 (new) |

---

## 6. Existing staged tasks

| SP-ID | Slug | Size | Status | Issue |
|-------|------|------|--------|-------|
| SP-442 | skip-clears-failed-segment | M | Staged | #96 |
| SP-445 | done-inlane-drift-detect | M | Staged | #100 |
| SP-446 | diagnosis-done-inlane-pending | M | Staged | #100 |
| SP-447 | dashboard-orphan-truth | M | Staged | #100 |
| SP-448 | resume-heartbeat-refresh | S | Staged | #100 |
| SP-449 | pause-phase-persistence | M | Staged | #103 |

**Note:** SP-442, SP-445–449 exceed patch S-only policy. For v1.8.1 release batch, either (a) land as-is with operator override and real-pi monitoring, or (b) split M tasks into S children before batching. New packets SP-512–519 are sized S.

---

## 7. Task decomposition (SP-REC ↔ SP-ID)

| SP-REC | SP-ID | Slug | Mission | Size | Deps | Closes |
|--------|-------|------|---------|------|------|--------|
| 001 | SP-511 | rec-explore-findings | Explore reconciliation gaps; `spine-tasks/_explore/reconciliation-v181/findings.md` | S | — | — |
| 002 | SP-512 | rec-drift-retry-deadlock | Fix #170: reconcile `running` + lane `.DONE` + review APPROVE; actionable retry | S | SP-511 | #170 |
| 003 | SP-513 | rec-pause-resume-sigterm | Fix #184: engine survives pause/resume SIGTERM without `engine_orphaned` | S | SP-511 | #184 |
| 004 | SP-514 | rec-incident-fixtures-v181 | Regression fixtures for batches `20260705T210857`, `20260706T052912` | S | SP-512, SP-513 | — |
| 005 | SP-515 | rec-macro-phase-active | Fix #165: macro phase not `Failed` when batch running + workers active | S | SP-512 | #165 |
| 006 | SP-516 | rec-status-classification | Fix #166: align status/classification after retry/resume | S | SP-512 | #166 |
| 007 | SP-517 | rec-dashboard-wave-completed | Fix #186: wave panel under drift/orphan shows disk truth | S | SP-447 | #186 |
| 008 | SP-518 | rec-attached-sigkill-guard | Partial #163: doctor warn + runbook for attached orphan risk | S | — | #163 (Partial) |
| 009 | SP-519 | rec-state-drift-docs | Close #168: release-operator skill + runbook drift recovery | S | SP-512 | #168 |
| 010 | SP-445 | done-inlane-drift-detect | Extend `detectBatchStateDrift` for doneInLane gap | M | — | #100 (Partial) |
| 011 | SP-446 | diagnosis-done-inlane-pending | Diagnosis headline for doneInLane pending drift | M | SP-445 | #100 (Partial) |
| 012 | SP-447 | dashboard-orphan-truth | Dashboard truth for engine_orphaned/drift | M | SP-446 | #100 (Partial) |
| 013 | SP-448 | resume-heartbeat-refresh | Resume lane heartbeat refresh | S | — | #100 (Partial) |
| 014 | SP-449 | pause-phase-persistence | Attached pause phase persistence | M | SP-376 | #103 |
| 015 | SP-442 | skip-clears-failed-segment | Skip clears failed segment for wave merge | M | SP-401 | #96 |
| 016 | SP-520 | rec-context-phase59 | CONTEXT Phase 59 + dependencies.json | S | leaves | — |

**Release-scoped minimum (patch S-only):** SP-511 → SP-512 → SP-513 → SP-514, SP-515, SP-516, SP-517, SP-519 (7 tasks). Land staged SP-445–449 in follow-up patch v1.8.2 if M tasks block v1.8.1 schedule.

---

## 8. Gaps requiring new packets

All gaps above map to SP-511–520 (see §7). No additional SP-IDs required beyond this table.

---

## 9. Wave run order

```text
SP-511 (explore)
  ├── SP-512 (drift retry deadlock) ──┬── SP-514 (incident fixtures)
  │                                   ├── SP-515 (macro phase)
  │                                   ├── SP-516 (classification)
  │                                   └── SP-519 (docs)
  ├── SP-513 (pause/resume SIGTERM) ──┘
  ├── SP-518 (attached guard — parallel)
  └── SP-447 (dashboard — after SP-446 or parallel with SP-517)
SP-445 → SP-446 → SP-447
SP-448 (parallel with SP-445 chain)
SP-449 (after SP-376 — may parallel SP-513)
SP-442 (after SP-401)
leaves → SP-520
```

### Suggested batches (patch release — prefer S chain first)

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 | SP-511 | Explore only |
| 1 | SP-512 | Core #170 fix |
| 2 | SP-513 | Core #184 fix |
| 3 (parallel) | SP-514, SP-515, SP-516, SP-518 | After wave 1–2 |
| 4 | SP-517, SP-519 | Dashboard + docs |
| 5 | SP-520 | CONTEXT capstone |
| Optional | SP-445 → SP-449, SP-442 | M staged — v1.8.2 or override |

**Regression gate:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run coverage:check`

**Real-pi gate:** Replay incident fixtures; one pause/resume cycle on 3-task stub batch without `engine_orphaned`.

---

## 10. Exit criteria

- [ ] Incident journals `20260705T210857` and `20260706T052912` replay to terminal success without manual batch-state JSON edits
- [ ] `state_drift` with lane `.DONE` + review APPROVE suggests command that succeeds (not `retry` on `running`)
- [ ] One pause/resume cycle during release-scale batch does not leave `engine_orphaned`
- [ ] Macro phase not `Failed` when batch phase `running` and lane PIDs alive ([#165](https://github.com/beettlle/pi-spine/issues/165))
- [ ] Dashboard wave panel does not show `[completed]` when diagnosis is `state_drift` / `engine_orphaned` ([#186](https://github.com/beettlle/pi-spine/issues/186))
- [ ] Issues #170, #184, #165, #166, #186, #168 closed (or Partial with documented remainder)
- [ ] Open GitHub issues ≤ ~35 (down from ~48 baseline)
- [ ] CONTEXT Phase 59 complete; Next Task ID → SP-521

---

## 11. Success metrics

| ID | Metric | Verification |
|----|--------|--------------|
| M-REC-01 | Drift retry deadlock fixed | `tests/batch/spine-diagnosis-state-drift.test.mjs` + #170 fixture |
| M-REC-02 | Pause/resume SIGTERM | New test in `tests/batch/attached-pause-resume.test.mjs` |
| M-REC-03 | Incident replay | `tests/fixtures/incidents/v181-*.json` integration |
| M-REC-04 | Macro phase accuracy | `tests/batch/macro-phase.test.mjs` |
| M-REC-05 | Dashboard wave truth | `tests/dashboard/ui-contract.test.mjs` |

---

## 12. Workflow after this document

### 12.1 Optional explore (recommended)

```text
spine batch start SP-511
# or manual: write spine-tasks/_explore/reconciliation-v181/findings.md
```

### 12.2 Generate task packets

```text
Use create-spine-tasks to decompose docs/PRD-v1.8.1-reconciliation-handoff.md
into SP-511+ packets. Update CONTEXT.md Phase 59 and dependencies.json.
```

### 12.3 Validate and plan

```bash
spine tasks validate SP-511 SP-512 SP-513 SP-514 SP-515 SP-516 SP-517 SP-518 SP-519 SP-520
spine tasks analyze SP-511 SP-512 SP-513 SP-514 SP-515 SP-516 SP-517 SP-518 SP-519 SP-520
spine plan SP-511 SP-512 SP-513 SP-514 SP-515 SP-516 SP-517 SP-518 SP-519 SP-520
```

### 12.4 Release execution

Fill release manifest from [`skills/spine-release-operator/references/release-manifest-template.md`](../../skills/spine-release-operator/references/release-manifest-template.md). Use **detached** resume per stabilization roadmap operator policy.
