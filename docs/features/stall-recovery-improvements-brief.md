# pi-spine feature brief: Stall recovery & operator observability

**Audience:** pi-spine maintainers (product + engineering)  
**Author:** SearchATon operator (dogfooding v3 greenfield batch `20260603T002945`)  
**Date:** 2026-06-03  
**Status:** Proposal — ready for TP task breakdown  
**Related PRD:** §18.4 (progress-aware stall), FR-WORK-09/10, failure class `StallFalsePositive`, GAP-STALL-01 (closed), incident `docs/incidents/20260531-phase0-taskplane-batch.md`

---

## Executive summary

Progress-aware stall detection (TP-029) improved on tool-silence-only kills, but **real batches still fail in ways that waste operator time and risk losing valid lane work**. SearchATon batch `20260603T002945` / task **SAT-020**:

- Worker reported `task.step_completed` for steps 0–1, touched File Scope once, then went silent ~55 minutes.
- Spine correctly killed with **`stall_timeout`** (exit 124).
- Journal `task.failed` had **`output: ""`** — no stderr/stdout for operators.
- Lane worktree had health-handler code later, but **no SAT-020 commit, no `.DONE`**, frozen STATUS.

This brief requests **three enhancements** without weakening `.DONE` / merge policy.

---

## Motivation — SAT-020 timeline

| UTC (approx) | Event |
|--------------|-------|
| 00:29:49 | `task.started` SAT-020 (lane 3, before SAT-023) |
| 00:30:27 / 00:30:55 | `task.step_completed` steps 0–1 |
| 00:43:03 | `fileScopeMtimeMs` changed |
| 00:43–01:38 | Heartbeats only; no commits, no STATUS updates |
| 01:38:20 | `stall_timeout`; `output: ""` |
| 01:38:21 | SAT-023 started and later succeeded |
| 02:36:25 | Batch failed (SAT-020, SAT-030, SAT-032); merge blocked |

**Parallels:** pi-spine incident `20260531-phase0-taskplane-batch.md` (I-01): valid uncommitted work, stall kill, empty output, hard retry.

**Goal:** Next stall → **5-minute diagnosis**, not **2-hour archaeology**.

---

## Design principles

1. Do not weaken completion — `.DONE` remains required.
2. Journal + evidence + diagnosis over silent behavior changes.
3. Destructive salvage (auto-commit) opt-in, default off.
4. Bounded, redacted worker logs.
5. Implement PRD §18.4 literally: file-scope mtime = **warning**, not silent grace extension.

---

## Feature 1 — Worker output capture (`FR-STALL-01`) — P0

### Problem
`task.failed` often has empty `output` on `stall_timeout`; UI cannot show hung test vs pi hang vs OOM.

### Requirements

| ID | Requirement |
|----|-------------|
| FR-STALL-01.1 | On terminal failure (`stall_timeout`, `failed`, `aborted`), capture bounded stdout+stderr tail. |
| FR-STALL-01.2 | Put truncated tail in `task.failed.payload.output` when bytes exist. |
| FR-STALL-01.3 | Persist `.spine/runtime/<batchId>/lanes/lane-<N>/worker-output-<taskId>.log`. |
| FR-STALL-01.4 | Add evidence ref when gate opens; keep artifact even if batch never integrates. |
| FR-STALL-01.5 | Journal `lane.stall_killed` with exitCode, logPath, stallDeadline, progressSignals. |
| FR-STALL-01.6 | Redact secrets (DATABASE_URL, tokens); configurable deny patterns. |

### Config
```json
{ "lanes": { "workerOutputMaxBytes": 262144, "workerOutputTailLines": 200, "retainWorkerOutputOnSuccess": false } }
```

### Acceptance
- [ ] Fixture stall: non-empty `output` tail; log file on disk; diagnose cites path.
- [ ] Truncation marker; redaction test; success path skips log unless configured.

### Code
`worker-host.mjs` (`collectChildOutput`, stall kill ~L295–317), `agent-session-worker.mjs`, `journal.mjs`, `evidence.mjs`, `diagnosis.mjs`.

---

## Feature 2 — Checkpoint warnings (`FR-STALL-02`) — P1

### Problem
PRD says file-scope mtime is “warning only”; operators see only frozen heartbeats for 55+ minutes.

### Requirements

| ID | Requirement |
|----|-------------|
| FR-STALL-02.1 | **Checkpoint:** STATUS mtime, lane commit, `task.step_completed`, `.DONE`. |
| FR-STALL-02.2 | **Activity:** file-scope mtime, scoped `git status --porcelain`. |
| FR-STALL-02.3 | Activity without checkpoint ≥ `checkpointWarningMinutes` (default **10**) → `lane.checkpoint_warning` (once per episode). |
| FR-STALL-02.4 | Payload: dirtyPaths, signals, human suggestion (commit + `spine_report_progress`). |
| FR-STALL-02.5 | `spine status --diagnose` journalHints (< 30 min). |
| FR-STALL-02.6 | Dashboard lane badge (if in scope). |
| FR-STALL-02.7 | **Do not** extend stall grace for file-scope only; `extendGraceOnFileScope: false` default. |

### Acceptance
- [ ] Dirty scope, no commit → warning < 10 min; commit/STATUS clears episode.
- [ ] SAT-020 replay: warning before 60 min kill.

### Code
`heartbeat.mjs`, `worker-host.mjs` poll loop, `templates/agents/worker.md`.

---

## Feature 3 — Salvage inspection & optional WIP commit (`FR-STALL-03`) — P1/P2

### Phase A (read-only first)

| ID | Requirement |
|----|-------------|
| FR-STALL-03.1 | On `stall_timeout` / failed without `.DONE`, inspect lane worktree. |
| FR-STALL-03.2 | Scoped porcelain + `git diff --stat` (File Scope + task folder). |
| FR-STALL-03.3 | Journal `lane.salvage_inspection` + `recommendedAction`. |
| FR-STALL-03.4 | `task.failed`: `salvageable`, `changedFileCount`. |
| FR-STALL-03.5 | Diagnose `needs_retry`: “N uncommitted files in scope” + retry command. |
| FR-STALL-03.6 | `evidence/salvage-<taskId>.json` in archive/gate bundle. |

### Phase B (opt-in)

| ID | Requirement |
|----|-------------|
| FR-STALL-03.7 | `autoCommitOnStall: false` — if true, one commit `wip(<taskId>): stall salvage <iso>`. |
| FR-STALL-03.8 | Refuse on merge-in-progress / conflicts / hook failure. |
| FR-STALL-03.9 | Journal `lane.salvage_commit`. |
| FR-STALL-03.10 | Document §18.5 atomic retry: WIP commit stays on lane branch. |

**Non-goals:** auto-`.DONE`, auto-merge orch, force-integrate.

---

## Cross-cutting

### New journal events
`lane.checkpoint_warning`, `lane.stall_killed`, `lane.salvage_inspection`, `lane.salvage_commit`

### Example diagnose
```
Batch 20260603T002945 failed: SAT-020 (stall_timeout)
  → .spine/runtime/.../worker-output-SAT-020.log
  → Salvage: 2 files in scope, 0 lane commits
  → spine batch retry SAT-020
```

### Config additions
```json
{
  "lanes": {
    "checkpointWarningMinutes": 10,
    "workerOutputMaxBytes": 262144,
    "workerOutputTailLines": 200,
    "autoCommitOnStall": false,
    "extendGraceOnFileScope": false
  }
}
```

---

## TP backlog suggestion

| Task | Scope | Priority |
|------|-------|----------|
| TP-STALL-01 | FR-STALL-01 output capture | P0 |
| TP-STALL-02 | FR-STALL-02 checkpoint warnings | P1 |
| TP-STALL-03A | FR-STALL-03A salvage inspect | P1 |
| TP-STALL-03B | FR-STALL-03B auto-commit | P2 |
| TP-STALL-04 | Docs, dashboard, runbook | P1 |

---

## Epic test plan

1. Fixture `tests/fixtures/stall-sat020/`: 2× step_completed, file touch, silence → stall.
2. Assert event order: `checkpoint_warning` → `stall_killed` → `salvage_inspection` → `task.failed` (non-empty output).
3. Diagnose references log + salvage count.
4. Retry retains WIP commit when 03B enabled.
5. Regression: `.DONE` still required; mixed-outcome merge unchanged.

---

## Open questions

1. Does `agent-session-worker` tee stdout/stderr to parent today?
2. Redaction: built-in list vs project config?
3. Salvage scope: File Scope only vs entire worktree?
4. Dashboard v1.1 or CLI-only first?
5. Confirm product agrees: file-scope must not extend grace by default.

---

## References

**SearchATon:** batch `20260603T002945`, journal `.spine/runtime/20260603T002945/journal/events.jsonl`, `.worktrees/spine-20260603T002945/lane-3`, `spine-tasks/SAT-020-health-endpoint/PROMPT.md`, `.spine/agents/worker.md`

**pi-spine:** `src/batch/worker-host.mjs`, `src/batch/heartbeat.mjs`, `docs/incidents/20260531-phase0-taskplane-batch.md`

---

## Submission checklist

- [ ] Link this brief in pi-spine issue/PR
- [ ] Attach SAT-020 journal excerpt (empty output, frozen heartbeats)
- [ ] Offer SearchATon dogfood after TP-STALL-01 ships
