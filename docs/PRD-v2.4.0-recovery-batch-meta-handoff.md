# pi-spine v2.4.0 — Recovery Continuity (batch-meta) Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.4.0 Recovery Continuity  
**Last updated:** 2026-07-11  
**Status:** Ready for spine batch execution  

**Epic alias:** Phase 68 — SP-REL240 (SP-602, SP-605, SP-619+)

**Prerequisite:** v2.3.2 on `main` (`package.json` `2.3.2`); Phase 67 state-drift recovery landed ([`PRD-v2.3.2-state-drift-recovery-handoff.md`](PRD-v2.3.2-state-drift-recovery-handoff.md)).

**Release profile:** minor — 6 tasks; S-sized; themed enhancement #126; 0 open bugs (allowed — no floor); detached batches only.

---

## 1. Executive summary

v2.3.2 closed [#196](https://github.com/beettlle/pi-spine/issues/196) (agent-safe drift recovery, salvage, abort dry-run) and [#193](https://github.com/beettlle/pi-spine/issues/193). **Zero open bugs** remain. Ten open enhancements stay deferred except the operator-chosen theme.

**v2.4.0** continues recovery maturity: persist a survival **`batch-meta.json`** so `spine batch resume --force` can reconstruct topology when `batch-state.json` is missing or corrupt ([#126](https://github.com/beettlle/pi-spine/issues/126)), finish deferred v2.3.0 LOC splits (**SP-602**, **SP-605**), and ship runbook + CONTEXT capstone.

**Tagline:** *Survive abort limbo with batch-meta — finish LOC leftovers — ship the minor.*

---

## 2. Scope lock

### In scope (Phase 68 — SP-REL240)

| FR | Description |
|----|-------------|
| FR-REL240-01 | Complete `journal-rebuild-drift.mjs` extract (SP-602; leftover #117 split) |
| FR-REL240-02 | Complete `salvage-batch-integrate.mjs` extract (SP-605; leftover #117 split) |
| FR-REL240-03 | Persist `.spine/runtime/{batchId}/batch-meta.json` at batch start (#126) |
| FR-REL240-04 | Reconstruct batch state from batch-meta + runtime artifacts on `resume --force` when state missing/corrupt (#126) |
| FR-REL240-05 | Operator runbook: force-resume from batch-meta |
| FR-REL240-06 | CONTEXT Phase 68 capstone + release note |

### Deferred (v2.4.1+ / later)

| Item | Rationale |
|------|-----------|
| [#160](https://github.com/beettlle/pi-spine/issues/160) | P3 stet gate evidence — second enh not allowed without override |
| [#135](https://github.com/beettlle/pi-spine/issues/135) | Dashboard DAG — M UX; deferred since v2.0 |
| [#127](https://github.com/beettlle/pi-spine/issues/127)–[#120](https://github.com/beettlle/pi-spine/issues/120), [#124](https://github.com/beettlle/pi-spine/issues/124)–[#123](https://github.com/beettlle/pi-spine/issues/123), [#122](https://github.com/beettlle/pi-spine/issues/122)–[#121](https://github.com/beettlle/pi-spine/issues/121) | Gate maturity / mailbox / strategies — not this theme |
| [#43](https://github.com/beettlle/pi-spine/issues/43) | Monitoring epic — needs epic profile |

### Non-goals

- Breaking public API or migration docs
- npm publish without operator approval
- Auto-selecting a second enhancement
- Rewriting salvage/drift behavior beyond LOC extract and meta reconstruct

---

## 3. Baseline

| Check | Value |
|-------|-------|
| Current version | `2.3.2` |
| Target | `2.4.0` (minor) |
| Next Task ID (pre-author) | SP-619 |
| Open bugs in scope | **0** |
| Open enh in scope | #126 |
| Pending included | SP-602, SP-605 |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| Journal rebuild split | [`src/batch/journal-rebuild.mjs`](../src/batch/journal-rebuild.mjs), new `journal-rebuild-drift.mjs` |
| Salvage integrate split | [`src/batch/salvage-batch.mjs`](../src/batch/salvage-batch.mjs), new `salvage-batch-integrate.mjs` |
| Batch-meta persist | New `src/batch/batch-meta.mjs` (or equivalent); wire from [`src/batch/engine.mjs`](../src/batch/engine.mjs) / [`src/batch/detached-run.mjs`](../src/batch/detached-run.mjs) / lifecycle start |
| Reconstruct + force-resume | [`src/batch/resume.mjs`](../src/batch/resume.mjs), [`src/batch/state-io.mjs`](../src/batch/state-io.mjs), resume-multi-validate |
| Atomic JSON | [`src/fs/atomic-write.mjs`](../src/fs/atomic-write.mjs) |
| Incident fixtures | [`tests/batch/journal-rebuild-incidents.test.mjs`](../tests/batch/journal-rebuild-incidents.test.mjs), resume orphan tests |
| Upstream reference | Taskplane `saveBatchMetaRuntimeArtifact` / `reconstructBatchStateFromRuntime` (issue #126) |

**batch-meta payload (minimum):** `baseBranch`, `orchBranch`, `totalWaves`, `mode`, `tasksRoot`, wave→task mapping. Artifact path: `.spine/runtime/{batchId}/batch-meta.json`. Must outlast abort so force-resume can rebuild when live `batch-state.json` is gone or corrupt.

---

## 5. GitHub issue intake

| Issue | Priority | On `main` | v2.4.0 action | Task |
|-------|----------|-----------|---------------|------|
| [#126](https://github.com/beettlle/pi-spine/issues/126) | enh | Open | **Implement** (2 FRs) | SP-619–620 |
| [#160](https://github.com/beettlle/pi-spine/issues/160), [#135](https://github.com/beettlle/pi-spine/issues/135), [#127](https://github.com/beettlle/pi-spine/issues/127)–[#120](https://github.com/beettlle/pi-spine/issues/120), [#124](https://github.com/beettlle/pi-spine/issues/124)–[#121](https://github.com/beettlle/pi-spine/issues/121), [#43](https://github.com/beettlle/pi-spine/issues/43) | enh/epic | Open | **Defer** | — |
| #117 | closed | Closed | Finish leftover splits only | SP-602, SP-605 |

---

## 6. Functional requirements

### FR-REL240-01 — journal-rebuild-drift extract (SP-602)

1. Extract drift/done-marker paths into `journal-rebuild-drift.mjs`.
2. Thin `journal-rebuild.mjs` ≤500 LOC with re-exports; public API unchanged.
3. Do not edit `bin/spine-cli/verify.mjs` (grandfather list already empty).

### FR-REL240-02 — salvage-batch-integrate extract (SP-605)

1. Extract integrate/confirm/formatters into `salvage-batch-integrate.mjs`.
2. Thin `salvage-batch.mjs` ≤500 LOC with re-exports; public API unchanged.

### FR-REL240-03 — Persist batch-meta (#126)

1. At batch start, write `.spine/runtime/{batchId}/batch-meta.json` with the minimum topology fields above.
2. Use atomic write patterns consistent with existing state I/O.
3. Unit/integration tests prove the file exists after start with expected keys.

### FR-REL240-04 — Reconstruct on force-resume (#126)

1. When `batch-state.json` is missing or corrupt and `resume --force` is requested, rebuild usable batch state from batch-meta + surviving runtime artifacts (journal, lanes).
2. Must not resume the wrong wave; prefer fail-closed with a clear error over silent mis-resume.
3. Incident-style regression tests cover missing/corrupt state + present meta.

### FR-REL240-05 — Runbook

Document operator path: abort limbo → locate batch-meta → `resume --force` reconstruct → diagnose → integrate/salvage as needed. Cross-link #163/#185 detached-first.

### FR-REL240-06 — CONTEXT capstone

Phase 68 table, Next Task ID → SP-623, link PRD + manifest, release note.

---

## 7. Task decomposition (SP-REL240 ↔ SP-ID)

| SP-ID | Slug | Mission | Size | Deps | Closes |
|-------|------|---------|------|------|--------|
| SP-602 | (existing) | FR-REL240-01 | S | SP-584 done | partial #117 |
| SP-605 | (existing) | FR-REL240-02 | S | SP-591 done | partial #117 |
| SP-619 | batch-meta-persist | FR-REL240-03 | S | — | Partial #126 |
| SP-620 | batch-meta-reconstruct | FR-REL240-04 | S | SP-619 | **Closes #126** |
| SP-621 | runbook-batch-meta | FR-REL240-05 | S | SP-620 | — |
| SP-622 | context-phase68-capstone | FR-REL240-06 | S | SP-602,605,619–621 | — |

### File scope hints

**SP-602:** `src/batch/journal-rebuild.mjs`, `src/batch/journal-rebuild-drift.mjs`, `tests/batch/done-marker-fail-closed.test.mjs`

**SP-605:** `src/batch/salvage-batch.mjs`, `src/batch/salvage-batch-integrate.mjs`, `tests/batch/batch-salvage-integrate.test.mjs`

**SP-619:** `src/batch/batch-meta.mjs` (new), start wiring in `engine.mjs` / `detached-run.mjs` / lifecycle; new `tests/batch/batch-meta*.test.mjs`

**SP-620:** `src/batch/resume.mjs`, `src/batch/state-io.mjs` (and/or resume-multi-validate), reconstruct helpers, incident/resume tests

**SP-621:** `docs/adoption/operator-runbook.md`

**SP-622:** `spine-tasks/CONTEXT.md`, `spine-tasks/dependencies.json`

---

## 8. Wave run order

```text
Wave 0 (parallel): SP-602, SP-605, SP-619
Wave 1: SP-620 (deps SP-619)
Wave 2: SP-621 (deps SP-620)
Cap: SP-622
```

**Regression gate (per integrate):** `npm run release:check` with exit-code verification (no tail-only).

**Release execution:** spine-release-operator **minor** profile — detached batches only.

---

## 9. Exit criteria

- [ ] #126 closed — batch-meta persisted at start; force-resume reconstructs when state missing/corrupt
- [ ] SP-602 / SP-605 `.DONE` — journal-rebuild and salvage-batch shims ≤500 LOC
- [ ] Runbook documents force-resume from batch-meta
- [ ] CONTEXT Phase 68 complete; Next Task ID → SP-623
- [ ] `npm run release:check` green on publish HEAD
- [ ] `npm version minor` → v2.4.0 published (operator-gated)

---

## 10. Workflow after this document

```text
Packets: SP-602, SP-605 (existing); SP-619–622 (new)
Manifest: spine-tasks/_authoring/release-v2.4.0/manifest.md
```

```bash
spine tasks validate SP-602 SP-605 SP-619 SP-620 SP-621 SP-622
spine plan SP-602,SP-605,SP-619,SP-620,SP-621,SP-622
spine run sequence SP-602,SP-605,SP-619,SP-620,SP-621,SP-622 --dry-run
```

**Handoff after publish:** resume deferred enhancements (#160, #135, #120–127, #43) under next release profile.
