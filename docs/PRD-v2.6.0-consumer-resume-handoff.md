# pi-spine v2.6.0 — Consumer Reliability + Resume Lifecycle Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.6.0 Consumer Reliability + Resume Lifecycle  
**Last updated:** 2026-07-12  
**Status:** Ready for spine batch execution  

**Epic alias:** Phase 70 — SP-REL260 (SP-635+)

**Prerequisite:** v2.5.0 on `main` (`package.json` `2.5.0`); Phase 69 gate maturity landed ([`PRD-v2.5.0-gate-maturity-handoff.md`](PRD-v2.5.0-gate-maturity-handoff.md)).

**Release profile:** minor — 8 S-sized tasks; 4 open bugs (#197–#200); 1 enhancement (#160 Phase A); runbook + CONTEXT docs; detached batches only.

---

## 1. Executive summary

v2.5.0 shipped gate maturity (#121–#123). Dogfood on consumer Python repos and the v2.5.0 release waves then hit four bugs: resume eligibility disagrees with diagnose (#197), resume engines hang after host integrate (#198), gate evidence rejects `.venv/bin/python` (#199), and lane commits stage hook-created `.venv` symlinks (#200).

**v2.6.0** closes those four bugs, ships **#160 Phase A** (scripts/ gate-evidence executor) as the minor enhancement, and documents operator paths.

**Tagline:** *Fix resume eligibility + post-integrate limbo — unblock Python gate evidence — stop committing hook `.venv` — ship scripts/ evidence executor.*

---

## 2. Scope lock

### In scope (Phase 70 — SP-REL260)

| FR | Description |
|----|-------------|
| FR-REL260-01 | Align force-resume terminal-success eligibility with diagnose classification (#197) |
| FR-REL260-02 | Resume engine finalizes / exits after merge+gate or host integrate (#198) |
| FR-REL260-03 | Diagnose post-integrate / `engine_still_running` honestly; no full suite on main from stuck resume (#198) |
| FR-REL260-04 | Allow project-local interpreters (e.g. `.venv/bin/python`) in evidence commands (#199) |
| FR-REL260-05 | scripts/ validated executor for gate evidence (#160 Phase A) |
| FR-REL260-06 | Default ignore + refuse committing hook `.venv` / setup paths (#200) |
| FR-REL260-07 | Operator runbook for consumer resume + Python evidence + hook ignore |
| FR-REL260-08 | CONTEXT Phase 70 capstone + release note |

### Deferred (v2.6.1+ / later)

| Item | Rationale |
|------|-----------|
| [#160](https://github.com/beettlle/pi-spine/issues/160) Phase B/C | Shell widening / `testing.review` slot |
| [#135](https://github.com/beettlle/pi-spine/issues/135) | Dashboard DAG — M UX |
| [#127](https://github.com/beettlle/pi-spine/issues/127) | Mailbox steering |
| [#124](https://github.com/beettlle/pi-spine/issues/124) | Parallel wave strategies |
| [#120](https://github.com/beettlle/pi-spine/issues/120) | Journal SHA-256 integrity |
| [#43](https://github.com/beettlle/pi-spine/issues/43) | Monitoring epic |

### Non-goals

- Auto-widening evidence shell metacharacters (Phase B)  
- npm publish without operator approval  
- Attached `resume --force` via agent MonitorCreate (#163)  

---

## 3. Baseline

| Check | Value |
|-------|-------|
| Current version | `2.5.0` |
| Target | `2.6.0` (minor) |
| Next Task ID (pre-author) | SP-635 |
| Open bugs in scope | #197, #198, #199, #200 |
| Open enh in scope | #160 Phase A |
| Pending SP-* | **0** (pre-author) |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| #197 | `src/batch/resume-multi-validate.mjs` |
| #198 finalize | `src/batch/post-merge-limbo.mjs`, attached-runner / resume exit paths |
| #198 diagnose | `src/batch/diagnosis-tail-state.mjs`, `src/batch/diagnosis.mjs`, `src/batch/lifecycle.mjs` |
| #199 / #160 | `src/batch/evidence-command.mjs`, `src/config/worker-launch-script.mjs` (pattern) |
| #200 | `src/batch/lane-commit.mjs`, `src/batch/engine-lanes.mjs`, config defaults |
| Docs | `docs/adoption/operator-runbook.md`, `spine-tasks/CONTEXT.md` |

---

## 5. GitHub issue intake

| Issue | Priority | On `main` | v2.6.0 action | Task |
|-------|----------|-----------|---------------|------|
| [#197](https://github.com/beettlle/pi-spine/issues/197) | bug | Open | **Implement** | SP-635 |
| [#198](https://github.com/beettlle/pi-spine/issues/198) | bug | Open | **Implement** (2×S) | SP-636–637 |
| [#199](https://github.com/beettlle/pi-spine/issues/199) | bug | Open | **Implement** | SP-638 |
| [#200](https://github.com/beettlle/pi-spine/issues/200) | bug | Open | **Implement** | SP-640 |
| [#160](https://github.com/beettlle/pi-spine/issues/160) | enh P3 | Open | **Partial Phase A** | SP-639 |
| #135, #127, #124, #120, #43 | enh/epic | Open | **Defer** | — |

---

## 6. Functional requirements

### FR-REL260-01 — Resume eligibility uses terminal classification (SP-635)

When diagnose reports `state_drift` with terminal-success / doneInLane but batch-state `status` is still `running`, detached `resume --force` must succeed without requiring a manual `pause` first. Prefer classification (or heal status) over raw `status===succeeded` only in `allTasksTerminalSuccessForResume`.

### FR-REL260-02 — Resume engine finalizes after integrate path (SP-636)

After merge + gate open (or host integrate while resume engine is alive), the resume engine must emit `batch.land_loop_finalized` / exit so `spine batch complete` is not blocked by a live PID.

### FR-REL260-03 — Honest limbo diagnose (SP-637)

Diagnose must not claim “running reviews” when tasks are terminal-success and orch is merged; surface `engine_still_running` / post-integrate limbo with a kill/abort suggestion. Do not launch full `npm test` on main from a stuck resume engine.

### FR-REL260-04 — Allow venv-relative python for evidence (SP-638)

`parseEvidenceCommandArgv` must accept project-local interpreters such as `.venv/bin/python` (basename `python` under an allowed relative path), with regression tests. Prefer fail-closed for absolute paths outside the project.

### FR-REL260-05 — scripts/ evidence executor (SP-639)

If `testing.build` / `testing.test` / `testing.testWithCoverage` resolves to a path under `scripts/`, run via the same validated-script sandbox pattern as `workerLaunchScript` / worktree setup hooks. Document in templates/runbook (operator docs owned by SP-641).

### FR-REL260-06 — Ignore hook `.venv` on lane commit (SP-640)

Default `worktreeSetupIgnorePaths` (or equivalent defaults applied when unset) include `.venv`. Lane completion must not stage hook-only paths unless listed in task `fileScope`. Regression: untracked `.venv` symlink is skipped, not committed.

### FR-REL260-07 — Runbook (SP-641)

Document #197/#198 recovery, Python evidence command shapes, and hook ignore / no-commit contract.

### FR-REL260-08 — CONTEXT capstone (SP-642)

Phase 70 table, Next Task ID → SP-644, PRD + manifest links, release note, deferred backlog.

### FR-REL260-09 — CLI default PI_SPINE_ROOT (SP-643)

When `PI_SPINE_ROOT` is unset, CLI defaults it to `process.cwd()` so doctor/preflight do not require a manual export. Keep `resolvePiSpineRoot` worker package-root semantics. Related dogfood: #203.

---

## 7. Task decomposition (SP-REL260 ↔ SP-ID)

| SP-ID | Slug | Mission | Size | Deps | Closes |
|-------|------|---------|------|------|--------|
| SP-635 | resume-eligibility-terminal-class | FR-REL260-01 | S | — | **Closes #197** |
| SP-636 | resume-post-integrate-finalize | FR-REL260-02 | S | — | Partial #198 |
| SP-637 | resume-engine-limbo-diagnose | FR-REL260-03 | S | SP-636 | **Closes #198** |
| SP-638 | evidence-allow-venv-python | FR-REL260-04 | S | — | **Closes #199** |
| SP-639 | evidence-scripts-executor | FR-REL260-05 | S | SP-638 | Partial #160 |
| SP-640 | lane-commit-ignore-hook-venv | FR-REL260-06 | S | — | **Closes #200** |
| SP-641 | runbook-v260-consumer-resume | FR-REL260-07 | S | SP-635, SP-637, SP-638, SP-640 | — |
| SP-642 | context-phase70-capstone | FR-REL260-08 | S | SP-635–641, SP-643 | — |
| SP-643 | cli-default-pi-spine-root | FR-REL260-09 | S | — | #203 ergonomics |

---

## 8. Wave run order

```text
Wave 0 (parallel): SP-635, SP-636, SP-638, SP-640, SP-643
Wave 1: SP-637 (deps SP-636), SP-639 (deps SP-638)
Wave 2: SP-641
Cap: SP-642
```

**Regression gate (per integrate):** `npm run release:check` with exit-code verification.

**Release execution:** spine-release-operator **minor** profile — detached batches only. Operator may use `spine batch start pending` for the release scope.

---

## 9. Exit criteria

- [ ] #197 closed — force-resume works without pause when diagnose suggests it  
- [ ] #198 closed — resume engine finalizes; diagnose honest  
- [ ] #199 closed — Python venv evidence commands run  
- [ ] #200 closed — `.venv` hook symlink not committed  
- [ ] #160 Phase A shipped (B/C remain open or noted)  
- [ ] Runbook + CONTEXT Phase 70 complete; Next Task ID → SP-644  
- [ ] SP-643 — unset `PI_SPINE_ROOT` defaults to cwd (#203 ergonomics)  
- [ ] `npm run release:check` green on publish HEAD  
- [ ] `npm version minor` → v2.6.0 published (operator-gated)  

---

## 10. Workflow after this document

```text
Packets: SP-635–643 (new)
Manifest: spine-tasks/_authoring/release-v2.6.0/manifest.md
```

```bash
spine tasks validate pending
spine tasks analyze pending
spine plan pending
spine preflight
spine batch start pending
```

**Handoff after publish:** resume deferred enhancements (#160 B/C, #135, #127, #124, #120, #43) under next release profile.
