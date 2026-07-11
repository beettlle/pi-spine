# pi-spine v2.3.2 — State-Drift Recovery Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.3.2 State-Drift Recovery  
**Last updated:** 2026-07-11  
**Status:** Ready for spine batch execution  

**Epic alias:** Phase 67 — SP-REL232 (SP-613+)

**Prerequisite:** v2.3.1 on `main` (`package.json` `2.3.1`); Phase 66 reliability landed ([`PRD-v2.3.1-reliability-handoff.md`](PRD-v2.3.1-reliability-handoff.md)).

**Release profile:** patch — 6 tasks; S-sized; 1–2 waves; detached batches only.  
**Operator override:** 1 docs/skill enhancement (#193) included in patch scope (2026-07-11).

---

## 1. Executive summary

v2.3.1 closed four reliability bugs (#191, #192, #194, #195). A consumer release on **pi-spine v2.3.0** then hit a **state_drift dead-end** after engine SIGTERM during final review:

- Detached `spine batch resume --force` fails while `phase=running`
- Attached `resume --attached --force` is refused by the #163 non-TTY guard
- After abort, `spine batch salvage` reports no salvageable commits despite lane task-branch commits + lane `.DONE`
- `abort --dry-run` appears to mutate (archive) the live batch

**v2.3.2** closes [#196](https://github.com/beettlle/pi-spine/issues/196) (split into three S fixes) and ships the deferred skill DoR for [#193](https://github.com/beettlle/pi-spine/issues/193), plus runbook + CONTEXT capstone.

**Tagline:** *Agent-safe drift recovery, salvage that finds lane commits, honest dry-run — ship the patch.*

---

## 2. Scope lock

### In scope (Phase 67 — SP-REL232)

| FR | Description |
|----|-------------|
| FR-REL232-01 | Agent-safe detached recovery when `state_drift` + dead engine + `phase=running` + `doneInLane` → reconcile toward `needs_integrate` / gate (#196 ask 1) |
| FR-REL232-02 | Salvage lists/integrates succeeded lane task-branch commits after abort (#196 ask 2) |
| FR-REL232-03 | `spine batch abort --dry-run` must not archive or mutate (#196 ask 3) |
| FR-REL232-04 | create-spine-tasks DoR — multi-lane plan check, false deps, shared-doc note (#193) |
| FR-REL232-05 | Operator runbook: agent-shell recovery path for the #196 scenario |
| FR-REL232-06 | CONTEXT Phase 67 capstone + release note |

### Deferred (v2.4.0+)

| Item | Rationale |
|------|-----------|
| [#160](https://github.com/beettlle/pi-spine/issues/160), [#135](https://github.com/beettlle/pi-spine/issues/135), [#127](https://github.com/beettlle/pi-spine/issues/127)–[#120](https://github.com/beettlle/pi-spine/issues/120), [#124](https://github.com/beettlle/pi-spine/issues/124)–[#126](https://github.com/beettlle/pi-spine/issues/126), [#43](https://github.com/beettlle/pi-spine/issues/43) | Enhancements / epics — not in this patch beyond #193 override |
| Pending SP-602, SP-605 | Leftover v2.3.0 LOC splits — out of reliability scope; avoid colliding with salvage behavior fix |

### Non-goals

- Behavioral API breaks beyond recovery/salvage/abort dry-run correctness
- npm publish without operator approval
- Engine/planner changes for #193 (skill/docs only)
- Re-running SP-605 salvage module extract in this release

---

## 3. Baseline

| Check | Value |
|-------|-------|
| Current version | `2.3.1` |
| Target | `2.3.2` (patch) |
| Next Task ID (pre-author) | SP-613 |
| Open bugs in scope | #196 (gap — no existing `Closes`) |
| Open enh in scope | #193 (operator override) |
| Pending outside scope | SP-602, SP-605 |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| Detached resume / drift | [`src/batch/detached-run.mjs`](../src/batch/detached-run.mjs), [`src/batch/resume.mjs`](../src/batch/resume.mjs), multi-validate / reconcile |
| Diagnose suggestedCommand | [`src/batch/diagnosis.mjs`](../src/batch/diagnosis.mjs) `buildSuggestedCommand` |
| Salvage list/integrate | [`src/batch/salvage-batch-list.mjs`](../src/batch/salvage-batch-list.mjs), [`src/batch/salvage-batch.mjs`](../src/batch/salvage-batch.mjs) |
| Abort dry-run | [`bin/spine-batch.mjs`](../bin/spine-batch.mjs), [`src/batch/abort.mjs`](../src/batch/abort.mjs) |
| Skill DoR | `skills/create-spine-tasks/SKILL.md`, `skills/spine-autonomous-operator/SKILL.md` |
| Runbook | [`docs/adoption/operator-runbook.md`](adoption/operator-runbook.md) |

---

## 5. GitHub issue intake

| Issue | Priority | On `main` | v2.3.2 action | Task |
|-------|----------|-----------|---------------|------|
| [#196](https://github.com/beettlle/pi-spine/issues/196) | bug | Open | **Implement** (3 FRs) | SP-613–615 |
| [#193](https://github.com/beettlle/pi-spine/issues/193) | enh | Open | **Implement** (docs/skill; override) | SP-616 |
| [#160](https://github.com/beettlle/pi-spine/issues/160), [#135](https://github.com/beettlle/pi-spine/issues/135), [#127](https://github.com/beettlle/pi-spine/issues/127)–[#120](https://github.com/beettlle/pi-spine/issues/120), [#124](https://github.com/beettlle/pi-spine/issues/124)–[#126](https://github.com/beettlle/pi-spine/issues/126), [#43](https://github.com/beettlle/pi-spine/issues/43) | enh/epic | Open | **Defer** | — |

---

## 6. Functional requirements

### FR-REL232-01 — Agent-safe detached drift recovery (#196)

When diagnosis is `state_drift`, engine PID is dead, `phase=running`, and lane evidence shows terminal-success / `doneInLane`:

1. Detached `spine batch resume --force` (or equivalent reconcile path) must progress toward `needs_integrate` / open gate — not reject with `Cannot resume batch in phase running`.
2. `suggestedCommand` must not require `--attached` in agent/non-TTY shells (#163 / #185).
3. Regression tests cover dead-engine + phase-running + doneInLane recovery without attached resume.

### FR-REL232-02 — Salvage succeeded lane commits (#196)

1. After abort, `spine batch salvage --dry-run` lists lanes whose task branches have commits ahead of base when the task reached terminal-success / lane `.DONE` (even if journal status cache disagrees).
2. `salvage --lane N --integrate` can land those commits (no false `lane_not_salvageable` solely from missing journal `lane.committed` when branch evidence exists).
3. Regression tests cover the #196 consumer scenario (branch ahead + empty prior salvage list).

### FR-REL232-03 — Abort dry-run is read-only (#196)

1. `spine batch abort --dry-run` does not archive, journal `batch.aborted`, or clear the live batch.
2. Without `--dry-run`, abort behavior unchanged.
3. Regression test asserts dry-run leaves batch state intact.

### FR-REL232-04 — create-spine-tasks DoR multi-lane (#193)

1. Skill docs: false-deps guidance + parallel counter-example.
2. DoR checkbox: when parallelism intended, `spine plan` must show N lanes (or explain serial collapse).
3. Shared-doc / hot-file note under File Scope.
4. Optional one-line mirror in `spine-task-authoring.mdc` if checklist drifts.
5. No engine/planner behavior change.

### FR-REL232-05 — Runbook agent recovery

Document the agent-safe recovery path for #196 (detached reconcile / salvage after abort; never background `--attached`).

### FR-REL232-06 — CONTEXT capstone

Update Phase 67 table, Next Task ID → SP-619, link PRD + manifest.

---

## 7. Task decomposition

| SP-ID | Slug | Mission | Size | Deps | Closes |
|-------|------|---------|------|------|--------|
| SP-613 | drift-detached-recover | FR-REL232-01 | S | — | Partial #196 |
| SP-614 | salvage-lane-commits | FR-REL232-02 | S | — | Partial #196 |
| SP-615 | abort-dry-run-readonly | FR-REL232-03 | S | SP-613, SP-614 | Closes #196 |
| SP-616 | create-spine-tasks-dor-lanes | FR-REL232-04 | S | — | Closes #193 |
| SP-617 | runbook-agent-drift-recovery | FR-REL232-05 | S | SP-613 | — |
| SP-618 | context-phase67-capstone | FR-REL232-06 | S | SP-613–617 | — |

### File scope hints

**SP-613:** `src/batch/detached-run.mjs`, `src/batch/resume.mjs` (and/or multi-validate), `src/batch/diagnosis.mjs`, tests under `tests/batch/engine-orphan-resume.test.mjs` / drift resume fixtures

**SP-614:** `src/batch/salvage-batch-list.mjs`, `src/batch/salvage-batch.mjs`, tests under `tests/batch/salvage-*.test.mjs`

**SP-615:** `bin/spine-batch.mjs`, `src/batch/abort.mjs`, `tests/batch/abort.test.mjs`

**SP-616:** `skills/create-spine-tasks/SKILL.md`, `skills/spine-autonomous-operator/SKILL.md`, optional `.cursor/rules/spine-task-authoring.mdc`

**SP-617:** `docs/adoption/operator-runbook.md`

**SP-618:** `spine-tasks/CONTEXT.md`, `spine-tasks/dependencies.json`

---

## 8. Wave run order

```text
Wave 0 (parallel): SP-613, SP-614, SP-616
Wave 1: SP-615 (deps 613–614), SP-617 (deps 613)
Cap: SP-618
```

**Regression gate (per integrate):** `npm run release:check` with exit-code verification (no tail-only).

**Release execution:** spine-release-operator **patch** profile — detached batches only; enhancement override recorded in manifest.

---

## 9. Exit criteria

- [ ] #196 closed — agent-safe detached drift recovery; salvage finds lane commits; abort dry-run read-only
- [ ] #193 closed — create-spine-tasks DoR multi-lane checklist + guidance
- [ ] Runbook documents agent recovery for #196
- [ ] CONTEXT Phase 67 complete; Next Task ID → SP-619
- [ ] `npm run release:check` green on publish HEAD
- [ ] `npm version patch` → v2.3.2 published (operator-gated)

---

## 10. Workflow after this document

```text
Packets: SP-613–618 under spine-tasks/
Manifest: spine-tasks/_authoring/release-v2.3.2/manifest.md
```

```bash
spine tasks validate SP-613 SP-614 SP-615 SP-616 SP-617 SP-618
spine plan SP-613,SP-614,SP-615,SP-616,SP-617,SP-618
spine run sequence SP-613,SP-614,SP-615,SP-616,SP-617,SP-618 --dry-run
```

**Handoff after publish:** resume deferred enhancements (#160, #126, etc.) under next minor profile.
