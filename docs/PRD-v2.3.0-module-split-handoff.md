# pi-spine v2.3.0 — Batch Module Split Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.3.0 Module Split (semver)  
**Last updated:** 2026-07-10  
**Status:** Ready for spine batch execution  

**Epic alias:** Phase 65 — SP-REL230 (SP-574–595)

**Prerequisite:** v2.2.0 published (`package.json` `2.2.0`, tag `v2.2.0`).

**Release profile:** epic (operator-approved) — structural refactor; semver minor bump with major-scope task count (~22 tasks).

**Parent requirement:** FR-SHIP-02 ([`docs/PRD-v2.2-ship-readiness-handoff.md`](PRD-v2.2-ship-readiness-handoff.md) §FR-SHIP-02).

**Naming note:** Prior backlog-drain minors (v2.1.0, v2.2.0) deferred [#117](https://github.com/beettlle/pi-spine/issues/117) to **v2.3.0**. This release completes the remaining `PHASE23_GRANDFATHERED_OVER_500` debt after SP-207–211 (engine-lanes split).

---

## 1. Executive summary

v2.2.0 closed operator-safety gaps (#190 fail-closed `.DONE`, #158 salvage). **12 open GitHub issues** remain. The highest-priority deferred epic is **#117 — batch module split**: sixteen `src/batch/` modules exceed the 500 LOC policy and are grandfathered in `bin/spine-cli/verify.mjs`.

**v2.3.0** completes FR-SHIP-02: Strangler Fig splits with **no behavioral changes**, re-exports preserving public API, and an empty (or borderline-only) grandfather list.

**Tagline:** *Split the batch layer, empty the grandfather list, ship v2.3.0.*

**Design decision (clarify):** **Split-only epic** — defer #43 monitoring, #120–127 gate maturity, #135 dashboard DAG, and #160 stet evidence to v2.3.1+.

---

## 2. Scope lock

### In scope (Phase 65 — SP-REL230)

| FR | Description |
|----|-------------|
| FR-REL230-01 | Release manifest + regression gate for v2.3.0 |
| FR-REL230-02 | Explore refresh — 16 grandfathered modules (LOC + import graph) |
| FR-REL230-03 | Priority-1 splits (>800 LOC): reconcile, review, detached-start, worker-host, sequence |
| FR-REL230-04 | Priority-2 splits (500–800 LOC): lane-dirty-check, journal-rebuild, contract-verify, attached-runner, state, salvage-batch |
| FR-REL230-05 | Priority-3 cleanup: engine nested-spawn guard, integrate helper (#116), resume-multi-lanes, resume/lifecycle monitor |
| FR-REL230-06 | Remove `PHASE23_GRANDFATHERED_OVER_500` entries; `batch-loc-policy` green |
| FR-REL230-07 | GitHub hygiene — close #117, #116 |

### Deferred (v2.3.1+)

| Item | Rationale |
|------|-----------|
| [#43](https://github.com/beettlle/pi-spine/issues/43) monitoring epic | Separate epic; SP-339–367 partially staged |
| [#120](https://github.com/beettlle/pi-spine/issues/120)–[#127](https://github.com/beettlle/pi-spine/issues/127) | Gate maturity / mailbox roadmap |
| [#135](https://github.com/beettlle/pi-spine/issues/135) dashboard DAG | M-sized UX; deferred since v2.0.0 |
| [#160](https://github.com/beettlle/pi-spine/issues/160) stet gate evidence | P3 |

### Non-goals

- Behavioral changes or API breaks (pure refactor)
- npm publish without operator approval
- Rewriting engine-lanes modules (SP-207–211 complete)

---

## 3. Baseline — prerequisites checklist

| Check | Reference |
|-------|-----------|
| v2.2.0 published | `package.json` `2.2.0`, tag `v2.2.0` |
| `spine doctor` green | operator runbook |
| `npm run release:check` green | release operator Phase 5 |
| Open issues baseline | **12** at handoff authoring |
| Grandfathered modules | **16** in `PHASE23_GRANDFATHERED_OVER_500` |

### Grandfathered module inventory (2026-07-10)

| Module | LOC | Split target |
|--------|-----|--------------|
| `reconcile.mjs` | 1715 | `reconcile-classify.mjs` + `reconcile-diagnosis.mjs` |
| `review.mjs` | 1224 | `review-artifacts.mjs` + `review-spawn.mjs` |
| `detached-start.mjs` | 908 | `detached-diagnostics.mjs` (partial: `detached-spawn.mjs` exists) |
| `worker-host.mjs` | 846 | `worker-spawn.mjs` + `worker-heartbeat.mjs` |
| `salvage-batch.mjs` | 691 | `salvage-batch-list.mjs` + `salvage-batch-integrate.mjs` (or equivalent) |
| `sequence.mjs` | 791 | `sequence-plan.mjs` + `sequence-run.mjs` |
| `lane-dirty-check.mjs` | 750 | extract helpers module |
| `journal-rebuild.mjs` | 740 | `journal-rebuild-structural.mjs` + `journal-rebuild-drift.mjs` |
| `state.mjs` | 729 | `state-io.mjs` + `state-guards.mjs` |
| `contract-verify.mjs` | 714 | `contract-parse.mjs` + `contract-exec.mjs` |
| `attached-runner.mjs` | 647 | `attached-runner-promote.mjs` + `attached-runner-reconcile.mjs` |
| `resume-multi-lanes.mjs` | 583 | extract queue wiring or merge into engine-lanes |
| `engine.mjs` | 556 | extract nested-spawn guard → `batch-guards.mjs` |
| `resume.mjs` | 506 | monitor; split only if still >500 after other work |
| `integrate.mjs` | 506 | `tryRestoreBranch` helper (#116); may drop below 500 |
| `lifecycle.mjs` | 498 | monitor only |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| LOC policy | `bin/spine-cli/verify.mjs` — `PHASE23_GRANDFATHERED_OVER_500` |
| Import cycle guard | SP-432 arch tests |
| Prior split pattern | SP-207–211 (`engine-lanes/`), SP-507 (`snapshot-waves.mjs`) |
| Release gate | `scripts/release-proof-gate.sh` |
| Explore artifact | `spine-tasks/_explore/batch-module-split-v23/findings.md` |

---

## 5. GitHub issue intake

| Issue | Priority | Action | Task |
|-------|----------|--------|------|
| [#117](https://github.com/beettlle/pi-spine/issues/117) | epic | Implement split epic | SP-578–593 |
| [#116](https://github.com/beettlle/pi-spine/issues/116) | low | Bundle with integrate split | SP-589 |

All other open issues deferred per §2.

---

## 6. Task decomposition (SP-REL230 ↔ SP-ID)

| SP-REL230 | SP-ID | Slug | Mission | Size | Deps | Closes |
|-----------|-------|------|---------|------|------|--------|
| 001 | SP-574 | rel230-handoff-doc | This handoff doc | S | — | — |
| 002 | SP-575 | rel230-manifest | Operator manifest `docs/release/manifest-v2.3.0.md` | S | SP-574 | — |
| 003 | SP-576 | rel230-regression-gate | Extend release gate for v2.3.0 | S | SP-575 | — |
| 004 | SP-577 | rel230-module-split-explore | Refresh explore for 16 modules | S | SP-575 | — |
| 005 | SP-578 | rel230-split-reconcile | Split `reconcile.mjs` | M | SP-577 | partial #117 |
| 006 | SP-579 | rel230-split-review | Split `review.mjs` | M | SP-577 | partial #117 |
| 007 | SP-580 | rel230-split-detached-start | Split `detached-start.mjs` | M | SP-577 | partial #117 |
| 008 | SP-581 | rel230-split-worker-host | Split `worker-host.mjs` | M | SP-577 | partial #117 |
| 009 | SP-582 | rel230-split-sequence | Split `sequence.mjs` | M | SP-577 | partial #117 |
| 010 | SP-583 | rel230-split-lane-dirty-check | Split `lane-dirty-check.mjs` | M | SP-577 | partial #117 |
| 011 | SP-584 | rel230-split-journal-rebuild | Split `journal-rebuild.mjs` | M | SP-577 | partial #117 |
| 012 | SP-585 | rel230-split-contract-verify | Split `contract-verify.mjs` | M | SP-577 | partial #117 |
| 013 | SP-586 | rel230-split-attached-runner | Split `attached-runner.mjs` | M | SP-577 | partial #117 |
| 014 | SP-587 | rel230-split-state | Split `state.mjs` | M | SP-596 | partial #117 |
| 015 | SP-588 | rel230-split-engine-guards | Extract nested-spawn guard from `engine.mjs` | S | SP-577 | partial #117 |
| 016 | SP-589 | rel230-split-integrate-helper | `tryRestoreBranch` helper (#116) | S | SP-587 | #116 |
| 017 | SP-590 | rel230-split-resume-multi | Split `resume-multi-lanes.mjs` if >500 | S | SP-588 | partial #117 |
| 018 | SP-591 | rel230-split-salvage-batch | Split `salvage-batch.mjs` | M | SP-577 | partial #117 |
| 019 | SP-592 | rel230-monitor-resume-lifecycle | Verify `resume.mjs` / `lifecycle.mjs` ≤500 | S | SP-590 | partial #117 |
| 020 | SP-593 | rel230-grandfather-list-empty | Empty `PHASE23_GRANDFATHERED_OVER_500` | S | SP-578–605 | #117 |
| 021 | SP-594 | rel230-github-hygiene | Close #117, #116 with commit refs | S | SP-593 | hygiene |
| 022 | SP-595 | rel230-context-capstone | CONTEXT Phase 65 capstone | S | SP-594 | — |

---

## 7. Release execution flow

```text
Phase 0 — Handoff + manifest
  SP-574 (this document)
  SP-575 (operator approves manifest)

Phase 1 — Gate + explore
  SP-576 (regression gate)
  SP-577 (module-split explore — read-only)

Phase 2 — First-half extracts (4 parallel)
  SP-578, SP-579, SP-580, SP-581

Phase 3 — Second-half extracts batch 1 (4 parallel)
  SP-596, SP-597, SP-598, SP-599

Phase 4 — First-half extracts batch 2 (4 parallel; gated on SP-599)
  SP-582, SP-583, SP-584, SP-585

Phase 5 — state.mjs (serial after reconcile-diagnosis)
  SP-587

Phase 6 — Second-half extracts batch 2 + integrate helper (4 parallel; gated on SP-603 for contract-exec wave)
  SP-600, SP-601, SP-602, SP-603, SP-589

Phase 7 — First-half extracts batch 3 (3 parallel; gated on SP-603)
  SP-586, SP-588, SP-591

Phase 8 — Second-half extracts batch 3 + resume-multi (3 parallel)
  SP-604, SP-605, SP-590

Phase 9 — monitor
  SP-592

Phase 10 — Verification + sign-off
  SP-593 (grandfather list empty)
  SP-594 (GitHub hygiene)
  SP-595 (CONTEXT capstone)

Phase 11 — Publish (operator approval)
  npm run release:check → npm version minor → v2.3.0 tag
```

**Regression gate (all implementation waves):** `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check`

---

## 8. Phase 65 exit criteria

- [ ] Operator approved manifest scope (SP-575)
- [ ] All manifest-scoped tasks `.DONE` on `main` (SP-574–605)
- [ ] `npm run release:check` green before tag
- [ ] `PHASE23_GRANDFATHERED_OVER_500` empty or resume.mjs only (borderline)
- [ ] `bin/spine-cli/verify.mjs` `batch-loc-policy` check passes
- [ ] No new import cycles (SP-432)
- [ ] #117 and #116 closed on GitHub
- [ ] Open GitHub issues **12 → ≤10**
- [ ] CONTEXT Phase 65 complete; Next Task ID → SP-606

---

## 9. Success metrics

| ID | Metric | Verification |
|----|--------|--------------|
| M-REL230-01 | Grandfather list empty | `verify.mjs` batch-loc-policy |
| M-REL230-02 | No behavior change | Full test suite + coverage ≥77% |
| M-REL230-03 | Module LOC ≤500 | `wc -l src/batch/*.mjs` + verify |
| M-REL230-04 | Issue delta | `gh issue list --state open` before/after |

---

## 10. Wave run order

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 | SP-574 | Handoff PRD |
| 1 | SP-575 | Manifest — **operator approval required** |
| 2 | SP-576, SP-577 | Gate + explore (2 lanes) |
| 3 | SP-578, SP-579, SP-580, SP-581 | First-half extracts batch 1 (4 lanes) |
| 4 | SP-596, SP-597, SP-598, SP-599 | Second-half extracts batch 1 (4 lanes) |
| 5 | SP-582, SP-583, SP-584, SP-585, SP-587 | Batch 2 first halves (4 lanes) + state (queued); gated on SP-599 |
| 6 | SP-589, SP-600, SP-601, SP-602, SP-603 | Batch 2 second halves (4 lanes) + integrate helper (queued); SP-603 gates wave 7 |
| 7 | SP-586, SP-588, SP-591 | Batch 3 first halves (3 lanes); gated on SP-603 |
| 8 | SP-590, SP-604, SP-605 | Batch 3 second halves + resume-multi (3 lanes) |
| 9 | SP-592 | Monitor resume/lifecycle |
| 10 | SP-593 | Empty `PHASE23_GRANDFATHERED_OVER_500` |
| 11 | SP-594 | GitHub hygiene |
| 12 | SP-595 | CONTEXT capstone |

**Wave gates:** SP-582–585 depend on SP-599; SP-586, SP-588, SP-591 depend on SP-603. These prevent 11-task mega-waves while keeping ≤4 parallel lanes.

Run `spine plan SP-574,...,SP-605` after validate for authoritative waves.

---

## 11. Workflow after this document

### 11.1 Author manifest (operator gate)

```text
SP-575 writes docs/release/manifest-v2.3.0.md from this handoff §5–§6.
Operator must set "Operator approved scope: yes" before implementation batch.
```

### 11.2 Execute release sequence

```bash
./scripts/release-proof-gate.sh
spine tasks validate SP-574 SP-575 SP-576 SP-577 SP-578 SP-579 SP-580 SP-581 SP-582 SP-583 SP-584 SP-585 SP-586 SP-587 SP-588 SP-589 SP-590 SP-591 SP-592 SP-593 SP-594 SP-595 SP-596 SP-597 SP-598 SP-599 SP-600 SP-601 SP-602 SP-603 SP-604 SP-605
spine plan SP-574,SP-575,SP-576,SP-577,SP-578,SP-579,SP-580,SP-581,SP-582,SP-583,SP-584,SP-585,SP-586,SP-587,SP-588,SP-589,SP-590,SP-591,SP-592,SP-593,SP-594,SP-595,SP-596,SP-597,SP-598,SP-599,SP-600,SP-601,SP-602,SP-603,SP-604,SP-605
spine run sequence SP-574,SP-575,SP-576,SP-577,SP-578,SP-579,SP-580,SP-581,SP-582,SP-583,SP-584,SP-585,SP-586,SP-587,SP-588,SP-589,SP-590,SP-591,SP-592,SP-593,SP-594,SP-595,SP-596,SP-597,SP-598,SP-599,SP-600,SP-601,SP-602,SP-603,SP-604,SP-605 --detached
```

### 11.3 Post-release

File v2.3.1 epic for monitoring (#43) and dashboard DAG (#135). Update stabilization roadmap.

---

## 12. Related documents

| Document | Role |
|----------|------|
| [`docs/PRD-v2.2.0-backlog-drain-handoff.md`](PRD-v2.2.0-backlog-drain-handoff.md) | Prior release (Phase 64) |
| [`docs/PRD-v2.2-ship-readiness-handoff.md`](PRD-v2.2-ship-readiness-handoff.md) | FR-SHIP-02 parent spec |
| [`spine-tasks/_explore/batch-module-split-v23/findings.md`](../spine-tasks/_explore/batch-module-split-v23/findings.md) | Explore (SP-577) |
| [`spine-tasks/_authoring/release-v2.3.0/`](../spine-tasks/_authoring/release-v2.3.0/) | Clarify, checklist, analyze |
| [`skills/create-spine-tasks/SKILL.md`](../skills/create-spine-tasks/SKILL.md) | Task decomposition workflow |
