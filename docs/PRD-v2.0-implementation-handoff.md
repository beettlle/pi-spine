# pi-spine v2.0 CDO — Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.0 CDO (unified v1.3 + Contract layer)  
**Last updated:** 2026-06-11  
**Status:** Ready for `create-spine-tasks` decomposition  

**Source PRDs (read-only context):**

| Document | Role |
|----------|------|
| [docs/PRD.md](PRD.md) v1.2 | Base batch orchestrator — authoritative for engine, journal, gates, reconciliation |
| [docs/PRD-v1.3-upstream-execution-bridge.md](PRD-v1.3-upstream-execution-bridge.md) | Upstream execution bridge — FR-UXB-01–06 |
| [docs/PRD-v2.0.md](PRD-v2.0.md) | Contract-Driven Orchestration vision |

**Purpose:** This document is the **single normative input** for [create-spine-tasks](../skills/create-spine-tasks/SKILL.md) to generate `spine-tasks/SP-123+` packets. Workers should implement from task packets, not re-read three PRDs.

**Prerequisite:** [SP-122](../spine-tasks/SP-122-preflight-scope-prompt-validation/PROMPT.md) (preflight validates pending scope only) must land before Phase 20 batches.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Scope lock](#2-scope-lock)
3. [Compat policy for ## Contract](#3-compat-policy-for--contract)
4. [## Contract normative schema](#4--contract-normative-schema)
5. [Merged functional requirements](#5-merged-functional-requirements)
6. [Data model](#6-data-model)
7. [CLI and slash surface](#7-cli-and-slash-surface)
8. [Agent contract deltas](#8-agent-contract-deltas)
9. [Reconciliation extension](#9-reconciliation-extension)
10. [Test matrix](#10-test-matrix)
11. [Task decomposition (SP-123–SP-140)](#11-task-decomposition-sp-123sp-140)
12. [Wave run order and land checkpoints](#12-wave-run-order-and-land-checkpoints)
13. [Success metrics](#13-success-metrics)
14. [Workflow after this document](#14-workflow-after-this-document)

---

## 1. Executive summary

**pi-spine v2.0** evolves the v1.2 batch orchestrator into a **Contract-Driven Orchestration (CDO)** engine. Tasks remain Taskplane-compatible packets (`PROMPT.md`, `STATUS.md`, `dependencies.json`), but completion requires **machine-verifiable proof** that contract constraints were met — not merely LLM assertion.

### CDO pipeline

```text
[Spec / PRD / brief]
       │
       ▼ (optional)
[_explore/{slug}/findings.md]     ← FR-UXB-03 (authoring only)
       │
       ▼
[PROMPT.md + ## Contract]        ← FR-CDO-01 (new section)
       │
       ▼
[spine tasks validate]           ← FR-UXB-02 + contract syntax
       │
       ▼
[spine preflight → batch start]  ← existing v1.2 engine
       │
       ▼
[Worker executes steps]          ← step review APPROVE/REVISE (unchanged)
       │
       ▼
[Final review PASS/REVISE/REPLAN] ← FR-UXB-04 + contract verifier
       │
       ▼
[Contract verifier]              ← FR-CDO-02 (machine checks)
       │
       ├── PASS → .DONE → wave merge
       ├── REVISE → worker retry (capped)
       └── REPLAN → needs_replan (block merge)
       │
       ▼
[spine handoff / metrics]        ← FR-UXB-05, FR-UXB-06
```

**Tagline:** *Validate before run, explore before plan, contract before done, verdict before merge, handoff before context loss.*

### Implementation status (as of 2026-06-11)

| Layer | Status |
|-------|--------|
| v1.2 batch engine | **Implemented** (TP-002–TP-050, SP-051–SP-121) |
| SP-122 preflight scope fix | **Staged** (not on main) |
| Wave A docs (FR-UXB-01) | **~90% done** (uncommitted working tree) |
| FR-UXB-02–06 code | **Not implemented** |
| `## Contract` + verifier | **Not implemented** |

### Code anchors (reuse — do not reimplement)

| Concern | Primary files |
|---------|---------------|
| PROMPT validation | `src/tasks/packet/parse-prompt.mjs`, `validate-prompt.mjs` |
| Planner / preflight | `src/planner/index.mjs`, `bin/spine-preflight.mjs` |
| Step review | `src/batch/review.mjs` — `APPROVE`/`REVISE` only today |
| Diagnosis | `src/batch/diagnosis.mjs` — **no `needs_replan`** |
| Reconciliation | `src/batch/reconcile.mjs` |
| Journal | `src/batch/journal.mjs` |
| Lifecycle / history | `src/batch/lifecycle.mjs` |
| CLI router | `bin/spine.mjs` — **no `tasks`, `handoff`, `metrics`** |
| Slash commands | `extensions/spine/slash-commands.ts` |

---

## 2. Scope lock

### In scope (Phase 20 — SP-123–SP-140)

- Config schema v2: `review.*`, `handoff.*`, `metrics.*`, `contract.*`
- `## Contract` section in `PROMPT.md` with parser + validate-time checks
- Contract verifier at final review (machine checks)
- `spine tasks validate` CLI + preflight `tasks-validate` check + `/spine-validate`
- Task-level final verdict (`PASS` / `REVISE` / `REPLAN`) + `needs_replan` diagnosis
- `spine handoff` + `/spine-handoff` + journal event
- `run-metrics.jsonl` writer + `spine metrics show` + doctor advisory
- create-spine-tasks skill updates (Step 0 explore + Contract guidance)
- Adoption docs completion (upstream workflow, operator runbook sections)
- Integration fixtures + adoption smoke extension

### Deferred (v2.1+ — do not implement in Phase 20)

| Item | Notes |
|------|-------|
| `spine settings suggest-models` | Read-only model recommendations from metrics aggregates |
| `spine explore` CLI | Skill-only explore; CLI wrapper deferred |
| `handoff.autoWriteOn` triggers | Default `[]`; manual handoff only in v2.0 |
| Journal rebuild from events | Base PRD §11.4 |
| `pi-subagents` in-lane fanout | Base PRD §3.4 |
| npm dependency on `@gonrocca/zero-pi` | Compose via docs only |
| Separate `CONTRACT.md` file | Contract lives in `PROMPT.md` §4 |
| `metrics.maxLines` rotation | Document in runbook; implement v2.1 |
| Journal mirror `metrics.task_recorded` | JSONL is source of truth (P2) |
| Batch history `metricsSummary` | Optional P2 per v1.3 §9.6 |

### Non-goals (unchanged from v1.3 §3.2)

- GitHub issue/PR automation
- Autotune / automatic model switching
- Cross-harness routing
- Conversation tail / pi session compaction hooks

---

## 3. Compat policy for `## Contract`

v1.3 states Taskplane packet required sections are unchanged. v2.0 mandates `## Contract`. This handoff resolves the tension via **config-gated contract mode**.

### 3.1 Config: `contract.mode`

```json
{
  "contract": {
    "mode": "required",
    "legacyTaskIdPrefixes": ["TP-"]
  }
}
```

| Mode | Behavior |
|------|----------|
| `"required"` | `validatePrompt` fails if `## Contract` missing or empty (default for new greenfield `SP-*` repos) |
| `"optional"` | Missing Contract → warning only (`--warnings-only` treats as pass); present Contract must be syntactically valid |
| `"legacy"` | Contract section ignored for validation; verifier skipped at final review; step/final verdict behavior per `review.requireFinalVerdict` |

**Taskplane migrants (`TP-*`):** When `legacyTaskIdPrefixes` includes `"TP-"`, tasks with IDs matching `TP-\d+` are treated as `legacy` regardless of global mode — Contract absent = pass validate, verifier skipped.

**New tasks (`SP-*`):** Default `required` when `contract.mode` is `"required"`.

### 3.2 Contract location

- **Normative:** `## Contract` section inside `PROMPT.md` (after `## File Scope` or before `## Steps` — parser accepts any H2 position).
- **Not used in v2.0:** separate `CONTRACT.md` (v2.0 PRD diagram is conceptual only).
- Preserves Taskplane folder layout: `{tasksRoot}/{task-id}/PROMPT.md`, `STATUS.md`, `dependencies.json`.

### 3.3 Interaction with existing validation

| Check | When |
|-------|------|
| `validatePrompt` (existing) | Always — heading, sections, Testing, steps, size XL |
| `validateContract` (new) | When `contract.mode !== "legacy"` and task not in `legacyTaskIdPrefixes` |
| Contract verifier (new) | At `--type final` when Contract present and mode not legacy for task |

### 3.4 Migration path

1. Land Phase 20 with `contract.mode: "optional"` in pi-spine dogfood repo (100+ legacy packets).
2. New SP-123+ tasks authored with `## Contract`.
3. Flip to `"required"` after backlog packets updated or excluded from `pending` scope.

---

## 4. `## Contract` normative schema

### 4.1 Authoring format (Markdown table)

Task authors add this section to `PROMPT.md`:

```markdown
## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/batch/review.mjs`, `bin/spine-tasks.mjs` |
| fileScopeMustNotChange | `src/planner/**` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/final-verdict.test.mjs` |
```

### 4.2 Field definitions

| Field | Required | Type | Validate-time | Verify-time (final review) |
|-------|----------|------|---------------|----------------------------|
| `testCommand` | Yes (code tasks) | shell string (backtick-quoted) | Non-empty; no newlines; max 500 chars | `spawnSync(shell, -c, cmd)` exit 0 in lane worktree |
| `fileScopeMustChange` | No | comma-separated paths/globs | Glob syntax valid | `git diff --name-only base..HEAD` matches at least one path per entry |
| `fileScopeMustNotChange` | No | comma-separated paths/globs | Glob syntax valid | No changed file matches any glob |
| `minLineCoverage` | No | integer 0–100 | Numeric range | Parse coverage from `testCommand` stdout or `npm run coverage:check` output; reuse existing coverage policy parser |
| `artifactsMustExist` | No | comma-separated paths | Paths relative to worktree root | `fs.existsSync` for each |

**Code task definition:** Any task with Review Level ≥ 1 OR Size M/L OR any step mentioning implementation/file edits. Review Level 0 + Size S may omit `testCommand` only when Contract explicitly sets `testCommand` to `` `true` `` (no-op pass).

### 4.3 Parsed object shape (internal)

```typescript
interface ParsedContract {
  testCommand: string | null;
  fileScopeMustChange: string[];
  fileScopeMustNotChange: string[];
  minLineCoverage: number | null;
  artifactsMustExist: string[];
  rawTableValid: boolean;
  errors: string[];
}
```

### 4.4 Validate-time rules (`validateContract`)

- Section must contain a Markdown table with header row `| Field | Value |`
- Unknown field names → warning (not error) in v2.0
- Duplicate field rows → error
- Empty table → error when mode `required`
- `testCommand` must be parseable from backticks or plain text
- Glob patterns validated via existing minimatch/path rules used in planner file-scope overlap

### 4.5 Verify-time rules (`verifyContract`)

Runs in lane worktree after worker declares steps complete, **before** reviewer returns final verdict (reviewer may consider verifier output):

```typescript
interface ContractVerifyResult {
  ok: boolean;
  checks: Array<{
    field: string;
    ok: boolean;
    message: string;
  }>;
}
```

| Check | Failure message pattern |
|-------|-------------------------|
| testCommand exit ≠ 0 | `Contract testCommand failed (exit N): ...` |
| fileScopeMustChange | `Contract fileScopeMustChange: no matching changes for {path}` |
| fileScopeMustNotChange | `Contract fileScopeMustNotChange: forbidden change {file}` |
| minLineCoverage | `Contract minLineCoverage: {actual}% < {required}%` |
| artifactsMustExist | `Contract artifactsMustExist: missing {path}` |

**Fail-closed:** Verifier failure → reviewer should return `REVISE` (implementation) unless output indicates spec impossibility → `REPLAN`.

### 4.6 Example — minimal S task

```markdown
## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm test -- tests/tasks/validate-cli.test.mjs` |
```

---

## 5. Merged functional requirements

All requirements map to Phase 20 tasks in §11.

| ID | Source | Requirement | Task(s) |
|----|--------|-------------|---------|
| FR-CDO-01 | v2.0 §4.1 | `## Contract` in PROMPT.md with normative schema | SP-124, SP-137 |
| FR-CDO-02 | v2.0 §3.2 step 4–5 | Machine contract verification at final review | SP-131 |
| FR-CDO-03 | v2.0 §4.4 + handoff §3 | `contract.mode` compat policy | SP-123, SP-124 |
| FR-UXB-01 | v1.3 §6.1 | Upstream ↔ execution workflow documentation | SP-136 |
| FR-UXB-02 | v1.3 §6.2 | `spine tasks validate` + preflight + slash | SP-125, SP-126 |
| FR-UXB-03 | v1.3 §6.3 | Optional explore phase (skill + artifact) | SP-137 |
| FR-UXB-04 | v1.3 §6.4 | Final verdict PASS/REVISE/REPLAN | SP-129, SP-130, SP-132, SP-133 |
| FR-UXB-05 | v1.3 §6.5 | `spine handoff` operator note | SP-127, SP-128 |
| FR-UXB-06 | v1.3 §6.6 | `run-metrics.jsonl` + `spine metrics show` | SP-134, SP-135 |

### Non-functional (inherited)

| ID | Requirement | Task(s) |
|----|-------------|---------|
| NFR-UXB-01 | Validate 100 tasks < 2s | SP-125 |
| NFR-UXB-02 | No secrets in handoff/metrics | SP-127, SP-134 |
| NFR-UXB-03 | Validate is read-only | SP-125 |
| NFR-UXB-06 | Single `validatePrompt` + `validateContract` entry | SP-124, SP-125 |
| NFR-UXB-07 | New modules ≥77% line coverage | All |

---

## 6. Data model

### 6.1 New filesystem paths

| Path | Git | Purpose |
|------|-----|---------|
| `{tasksRoot}/_explore/{slug}/findings.md` | Tracked | Explore artifact (FR-UXB-03) |
| `.spine/handoff.md` | Ignored (operator choice) | Operator handoff |
| `.spine/run-metrics.jsonl` | Ignored | Append-only metrics |

### 6.2 `spine-config.json` extensions

```json
{
  "review": {
    "requireFinalVerdict": true,
    "maxFinalAttempts": 3
  },
  "handoff": {
    "path": ".spine/handoff.md",
    "autoWriteOn": []
  },
  "metrics": {
    "enabled": true,
    "path": ".spine/run-metrics.jsonl"
  },
  "contract": {
    "mode": "required",
    "legacyTaskIdPrefixes": ["TP-"]
  }
}
```

| Field | Default | Editable via `spine settings` |
|-------|---------|-------------------------------|
| `review.requireFinalVerdict` | `true` | v2.0: config file only |
| `review.maxFinalAttempts` | `3` | v2.0: config file only |
| `handoff.path` | `.spine/handoff.md` | P2 |
| `handoff.autoWriteOn` | `[]` | P2 (deferred behavior) |
| `metrics.enabled` | `true` | P2 |
| `metrics.path` | `.spine/run-metrics.jsonl` | P2 |
| `contract.mode` | `"required"` | v2.0: config file only |
| `contract.legacyTaskIdPrefixes` | `["TP-"]` | v2.0: config file only |

**SP-123** must update: `templates/spine-config.json`, init scaffold, config validation in `src/config/*`, and document in operator runbook.

### 6.3 Journal event extensions

Add to `SpineEventType`:

```typescript
type SpineEventTypeV20 =
  | "task.verdict_recorded"
  | "handoff.written"
  | "review.exhausted"
  | "contract.verified";  // optional P1 — payload: { ok, checks[] }
```

**`task.verdict_recorded` payload:**

```json
{
  "verdict": "PASS|REVISE|REPLAN",
  "reviewType": "final",
  "attempt": 1,
  "reviewLevel": 2,
  "artifactPath": "spine-tasks/SP-010/.reviews/final-20260610T120000.md",
  "contractOk": true
}
```

**`handoff.written` payload:**

```json
{
  "handoffPath": ".spine/handoff.md",
  "diagnosis": "paused",
  "batchId": "20260610T140000"
}
```

**`review.exhausted` payload:**

```json
{
  "taskId": "SP-042",
  "attempts": 3,
  "lastVerdict": "REVISE"
}
```

### 6.4 `spine tasks validate` JSON output

```typescript
interface TasksValidateResult {
  ok: boolean;
  scope: { mode: string; taskCount: number };
  tasks: Array<{
    taskId: string;
    ok: boolean;
    promptPath: string;
    errors: string[];
    warnings?: string[];
    contract?: { ok: boolean; errors: string[] };
  }>;
}
```

### 6.5 Run metrics JSONL schemas

**Task line (`recordType: "task"`):**

```typescript
interface TaskMetricRecord {
  recordType: "task";
  schemaVersion: 1;
  batchId: string;
  taskId: string;
  agentRole: "worker" | "reviewer";
  model: string;
  thinking: string;
  startedAt: string;
  endedAt: string;
  outcome: "completed" | "failed" | "skipped";
  exitReason?: string;
  reviewLevel?: number;
  finalVerdict?: "PASS" | "REVISE" | "REPLAN" | null;
  finalAttempts?: number;
  contractOk?: boolean | null;
  stallKilled?: boolean;
}
```

**Batch line (`recordType: "batch"`):**

```typescript
interface BatchMetricRecord {
  recordType: "batch";
  schemaVersion: 1;
  batchId: string;
  endedAt: string;
  diagnosis: string;
  taskCount: number;
  completedTasks: number;
  failedTasks: number;
  durationMs: number;
}
```

---

## 7. CLI and slash surface

### 7.1 New commands

| Command | Exit codes | `--json` | FR |
|---------|------------|----------|-----|
| `spine tasks validate <scope> [--json] [--warnings-only]` | 0 pass; 1 failures; 2 config/scope error | `TasksValidateResult` | FR-UXB-02 |
| `spine handoff [--batch ID] [--json]` | 0 written; 1 write error | `{ handoffPath, diagnosis, ... }` | FR-UXB-05 |
| `spine metrics show [--batch ID] [--json] [--last N]` | 0; 1 file missing when required | `{ lines: [...] }` | FR-UXB-06 |

**Scope resolution:** Same as `spine plan` — `all`, `pending`, task IDs, globs via planner.

### 7.2 New slash commands

| Slash | Delegates to |
|-------|--------------|
| `/spine-validate [scope]` | `spine tasks validate` |
| `/spine-handoff` | `spine handoff` |

### 7.3 Modified commands

| Command | Change |
|---------|--------|
| `spine preflight` | Add check id `tasks-validate` for `pending` scope |
| `spine next` | Append `Handoff: .spine/handoff.md` when file exists |
| `spine doctor` | Metrics file advisory |
| `spine help` | Document `tasks`, `handoff`, `metrics` |
| `spine review step` | Support `--type final` |

### 7.4 `spine handoff` content sections (normative order)

1. Generated at (ISO-8601)
2. batchId
3. Diagnosis + headline
4. Suggested command
5. Alternatives[]
6. Pending tasks
7. Lane summary (table)
8. Journal tail (last 10 event types + timestamps)
9. Restore commands

**Idle state (no active batch):** diagnosis `idle`, suggested `spine preflight`.

---

## 8. Agent contract deltas

### 8.1 Worker (`templates/agents/worker.md`)

Add after step completion sequence:

1. When Review Level ≥ 1 and `review.requireFinalVerdict`: run `spine_review_step --type final` (or `spine review step --step N --type final`) **after** Testing step passes and **before** creating `.DONE`.
2. Contract verifier runs automatically as part of final review path — worker must ensure `testCommand` passes locally before invoking final review.
3. On final `REVISE`: address feedback; re-run final review; do not create `.DONE` until `PASS`.
4. On final `REPLAN`: stop; update STATUS Blockers with reviewer feedback; exit non-zero; do not create `.DONE`.

### 8.2 Reviewer (`templates/agents/reviewer.md`)

Add section **Final verdict (`--type final`)**:

- Run after contract verifier (or incorporate verifier JSON in review input).
- Return `PASS` when Contract checks pass AND Completion Criteria met.
- Return `REVISE` when implementation is fixable without PROMPT/Contract changes.
- Return `REPLAN` when scope, Contract constraints, or dependencies are wrong — cite specific PROMPT/Contract sections.
- JSON: `{ "verdict": "PASS"|"REVISE"|"REPLAN", "feedback": "..." }`

**Step reviews unchanged:** `--type plan|code` → `APPROVE` | `REVISE` only.

### 8.3 Review level matrix

| Level | Step review | Final verdict | Contract verify |
|-------|-------------|---------------|-----------------|
| 0 | None | Skipped | Skipped |
| 1 | Plan per step | Required | When Contract present |
| 2 | Plan + code | Required | When Contract present |
| 3 | Plan + code + test | Required | When Contract present |

---

## 9. Reconciliation extension

### 9.1 New diagnosis: `needs_replan`

Extends `DIAGNOSIS_TAXONOMY` in `src/batch/diagnosis.mjs`.

| Field | Value |
|-------|-------|
| `diagnosis` | `needs_replan` |
| Trigger | Task `exitReason: needs_replan` OR last final verdict `REPLAN` |
| `headline` | `Task {id} needs replan — edit PROMPT.md before retry` |
| `suggestedCommand` | `edit {tasksRoot}/{taskId}/PROMPT.md then spine batch retry {taskId}` |
| `alternatives` | `["spine batch skip {taskId}", "spine handoff", "spine status --diagnose"]` |

### 9.2 Precedence rules

1. `needs_replan` takes precedence over `needs_retry` for same task when `exitReason` is `needs_replan`
2. `needs_replan` blocks `needs_merge` and `needs_integrate` until task retried or skipped
3. Plain `needs_retry` unchanged for non-replan failures

### 9.3 Operator JSON example

```json
{
  "diagnosis": "needs_replan",
  "headline": "Task SP-042 needs replan — reviewer rejected scope",
  "batchId": "20260610T140000",
  "suggestedCommand": "edit spine-tasks/SP-042-api/PROMPT.md then spine batch retry SP-042",
  "alternatives": ["spine batch skip SP-042", "spine handoff", "spine status --diagnose"]
}
```

---

## 10. Test matrix

### 10.1 Test files

| File | Covers |
|------|--------|
| `tests/tasks/contract-parse.test.mjs` | Contract table parser, validateContract |
| `tests/tasks/validate-cli.test.mjs` | FR-UXB-02 CLI, JSON, exit codes, contract mode |
| `tests/spine-preflight.test.mjs` (extend) | `tasks-validate` check |
| `tests/batch/contract-verify.test.mjs` | FR-CDO-02 machine checks |
| `tests/batch/final-verdict.test.mjs` | FR-UXB-04 PASS/REVISE/REPLAN, cap, merge block |
| `tests/batch/review.test.mjs` (extend) | `parseReviewVerdict` final types |
| `tests/cli/spine-handoff.test.mjs` | FR-UXB-05 content, no secrets |
| `tests/batch/run-metrics.test.mjs` | FR-UXB-06 JSONL append, show filter |
| `tests/compat/final-verdict-reconcile.test.mjs` | `needs_replan` diagnosis |
| `tests/config/contract-mode.test.mjs` | legacy TP-* prefix behavior |

### 10.2 Fixtures

| Fixture | Purpose |
|---------|---------|
| `test/fixtures/taskplane/FX-invalid-no-testing/` | Validate fails missing Testing |
| `test/fixtures/taskplane/FX-missing-contract/` | Validate fails when mode required |
| `test/fixtures/taskplane/FX-valid-contract/` | Contract parse + validate pass |
| `test/fixtures/taskplane/FX-final-replan/` | PROMPT level ≥1 for REPLAN path |
| `tests/fixtures/handoff-golden.md` | Snapshot handoff structure |

### 10.3 Regression gate (every wave)

```bash
npm run typecheck && SPINE_WORKER_STUB=1 npm test
```

- `tests/batch/review.test.mjs` step APPROVE/REVISE unchanged
- Coverage ≥77% on new `src/` and `bin/` modules

---

## 11. Task decomposition (SP-123–SP-140) — SUPERSEDED

> **Archived 2026-06-11.** Coarse M/L packets moved to `spine-tasks/_archive/phase20-coarse/`.  
> **Active spec:** [§11.1 S-sized decomposition (SP-141–SP-170)](#111-task-decomposition--s-sized-sp-141sp-170--active).

**Next task ID:** SP-123 (after SP-122 lands)  
**Phase:** 20 — v2.0 CDO  
**Sizing:** M unless noted

Each subsection below is copy-ready input for `create-spine-tasks`.

---

### SP-123 — Config schema v2 (`review`, `handoff`, `metrics`, `contract`)

**FRs:** FR-CDO-03, FR-UXB-04.1, FR-UXB-05.1, FR-UXB-06.1  
**Dependencies:** SP-122  
**Review Level:** 1 (Plan Only)  
**Size:** M

**Mission:** Extend `spine-config.json` schema with v2.0 sections and validation defaults. No CLI behavior yet — config load/merge only.

**File Scope:**

- `templates/spine-config.json`
- `src/config/*.mjs` (validation + defaults)
- `bin/spine-init.mjs` (scaffold)
- `tests/config/contract-mode.test.mjs` (new)
- `docs/adoption/operator-runbook.md` (config table only)

**Steps outline:**

1. Add `review`, `handoff`, `metrics`, `contract` blocks per §6.2
2. Validate on `spine init` and config load — unknown keys unchanged; new keys get defaults
3. Export typed defaults from config module for downstream tasks
4. Unit tests: defaults, invalid mode rejected, legacy prefix array

**Completion Criteria:**

- [ ] Fresh `spine init` emits all four new sections
- [ ] Existing repos without new keys get defaults on load (no crash)
- [ ] `contract.mode` enum validated: `required` | `optional` | `legacy`
- [ ] Tests ≥77% on touched config modules

---

### SP-124 — `## Contract` parser + validatePrompt extension

**FRs:** FR-CDO-01, FR-CDO-03, NFR-UXB-06  
**Dependencies:** SP-123  
**Review Level:** 2 (Plan + Code)  
**Size:** M

**Mission:** Parse `## Contract` table from PROMPT.md; add `validateContract`; integrate into `validatePrompt` result based on `contract.mode` and task ID prefix.

**File Scope:**

- `src/tasks/packet/parse-prompt.mjs`
- `src/tasks/packet/validate-prompt.mjs`
- `src/tasks/packet/validate-contract.mjs` (new)
- `src/tasks/packet/index.mjs`
- `tests/tasks/contract-parse.test.mjs` (new)
- `test/fixtures/taskplane/FX-missing-contract/` (new)
- `test/fixtures/taskplane/FX-valid-contract/` (new)

**Steps outline:**

1. `parseContract(markdown)` → `ParsedContract` per §4.3
2. `validateContract(parsed, { mode, taskId, legacyPrefixes })` per §4.4
3. Extend `validatePrompt` to attach `contract` validation; respect legacy TP-* exemption
4. Fixtures for required-mode fail and valid table pass

**Completion Criteria:**

- [ ] Parser extracts all five contract fields from normative table
- [ ] `validatePrompt` returns contract errors when mode `required` and section missing
- [ ] `TP-*` tasks skip contract validation when prefix in `legacyTaskIdPrefixes`
- [ ] No duplicate validation logic outside `validate-contract.mjs`

---

### SP-125 — `spine tasks validate` CLI + `--json` + `--warnings-only`

**FRs:** FR-UXB-02, NFR-UXB-01, NFR-UXB-03  
**Dependencies:** SP-124  
**Review Level:** 2  
**Size:** M

**Mission:** Expose existing `validatePrompt` + `validateContract` as `spine tasks validate <scope>`. Reuse planner scope resolution and `formatPromptValidationFailures`.

**File Scope:**

- `bin/spine-tasks.mjs` (new)
- `bin/spine.mjs` (router: `tasks` subcommand)
- `tests/tasks/validate-cli.test.mjs` (new)
- `test/fixtures/taskplane/FX-invalid-no-testing/` (new or reuse)

**Steps outline:**

1. Implement scope resolution via planner helpers (same as `spine plan`)
2. Per task: `loadTaskPacket`, collect failures via `collectPromptValidationFailure`
3. Human output: `Validated N task(s): X passed, Y failed` + per-task errors
4. `--json` → `TasksValidateResult` per §6.4
5. `--warnings-only`: folder name ≠ heading ID; missing STATUS.md; deps mismatch (P1)
6. Exit codes: 0 / 1 / 2 per FR-UXB-02.6
7. `spine help tasks` documents subcommand

**Completion Criteria:**

- [ ] Missing Testing step fails with same message as planner `prompt_parse_failed`
- [ ] `spine tasks validate TP-012 --json` returns structured errors
- [ ] 100-task validate < 2s on dogfood repo
- [ ] Read-only — no batch-state mutation

**Note:** SP-109 already wired fail-loud validation in planner — this task **exposes** it via CLI; do not duplicate schema.

---

### SP-126 — Preflight `tasks-validate` check + `/spine-validate`

**FRs:** FR-UXB-02.7–02.9  
**Dependencies:** SP-125  
**Review Level:** 1  
**Size:** S

**Mission:** Add distinct preflight check `tasks-validate`; register `/spine-validate` slash command.

**File Scope:**

- `bin/spine-preflight.mjs`
- `extensions/spine/slash-commands.ts`
- `tests/spine-preflight.test.mjs` (extend)

**Steps outline:**

1. New check id `tasks-validate` runs `spine tasks validate pending` logic inline or via shared helper
2. On fail: `suggestedCommand` = `spine tasks validate pending`
3. Slash `/spine-validate [scope]` delegates to CLI
4. Preflight test: distinct check name (not buried in plan error)

**Completion Criteria:**

- [ ] Preflight fails with check name `tasks-validate` when pending packets invalid
- [ ] `/spine-validate` works in pi extension smoke

---

### SP-127 — `spine handoff` CLI module

**FRs:** FR-UXB-05, NFR-UXB-02  
**Dependencies:** SP-123  
**Review Level:** 2  
**Size:** M

**Mission:** Implement `spine handoff [--batch ID] [--json]` writing `.spine/handoff.md` per §7.4.

**File Scope:**

- `src/cli/handoff.mjs` (new)
- `bin/spine.mjs` (router)
- `tests/cli/spine-handoff.test.mjs` (new)
- `tests/fixtures/handoff-golden.md` (new)

**Steps outline:**

1. Data sources: `reconcileBatch()`, batch-state, journal tail reader
2. Markdown renderer with normative section order
3. `--json` same fields + `handoffPath`
4. Redact secrets: no `*_KEY`, `*_TOKEN`, `*SECRET*` in output (NFR-UXB-02)
5. Idle state when no active batch

**Completion Criteria:**

- [ ] Paused batch handoff lists pending tasks + `spine batch resume`
- [ ] Snapshot test matches golden structure (timestamps redacted)
- [ ] No API keys or worker log bodies in output

---

### SP-128 — Handoff slash + journal + `spine next` hint

**FRs:** FR-UXB-05.3, FR-UXB-05.7, FR-UXB-05.10  
**Dependencies:** SP-127  
**Review Level:** 1  
**Size:** S

**Mission:** Wire `/spine-handoff`, journal `handoff.written`, and `spine next` hint.

**File Scope:**

- `extensions/spine/slash-commands.ts`
- `src/batch/journal.mjs`
- `bin/spine-cli/batch.mjs` or `spine next` handler
- `tests/cli/spine-handoff.test.mjs` (extend)

**Steps outline:**

1. `/spine-handoff` → CLI delegate
2. On write with active batch: append `handoff.written` journal event
3. `spine next`: when handoff file exists and diagnosis not idle, append hint line

**Completion Criteria:**

- [ ] Journal contains `handoff.written` after handoff with active batch
- [ ] `spine next` shows handoff path hint when file exists

---

### SP-129 — `parseReviewVerdict` + `--type final` spawn path

**FRs:** FR-UXB-04.2, FR-UXB-04.3, FR-UXB-04.9, FR-UXB-04.10  
**Dependencies:** SP-123  
**Review Level:** 2  
**Size:** M

**Mission:** Extend review module for `--type final` with `PASS`/`REVISE`/`REPLAN` verdict parsing. Step `plan|code` unchanged.

**File Scope:**

- `src/batch/review.mjs`
- `bin/spine-review-step.mjs`
- `tests/batch/review.test.mjs` (extend)

**Steps outline:**

1. `parseReviewVerdict(content, { reviewType })` — when `final`, accept PASS/REVISE/REPLAN
2. `normalizeVerdict` extended; step types still APPROVE/REVISE only
3. `buildReviewArtifactPath` variant: `.reviews/final-{timestamp}.md`
4. CLI `spine review step --step N --type final` documented
5. Regression: existing step APPROVE/REVISE tests green

**Completion Criteria:**

- [ ] Final JSON `{ "verdict": "REPLAN", ... }` parses correctly
- [ ] Step review tests unchanged (M-UXB-07)
- [ ] Spawn failure at level ≥1 exits non-zero (FR-REV-06)

---

### SP-130 — Final verdict engine loop (`REVISE` cap, `REPLAN` fail)

**FRs:** FR-UXB-04.1, FR-UXB-04.4–04.8  
**Dependencies:** SP-129  
**Review Level:** 3 (Full)  
**Size:** L

**Mission:** Engine integration for final review loop in `engine-lanes.mjs` — REVISE retry cap, REPLAN fail path, Review Level 0 skip.

**File Scope:**

- `src/batch/engine-lanes.mjs`
- `tests/batch/final-verdict.test.mjs` (new)
- `test/fixtures/taskplane/FX-final-replan/` (new)

**Steps outline:**

1. After steps complete: if `requireFinalVerdict` && reviewLevel ≥ 1, enter final review phase
2. `REVISE`: increment `finalAttempt`; re-invoke worker or final review per existing patterns
3. `REPLAN`: `status: failed`, `exitReason: needs_replan`, journal `task.verdict_recorded`, no `.DONE`
4. Cap `maxFinalAttempts` → `review_exhausted`, journal `review.exhausted`
5. Review Level 0: skip final entirely
6. Block wave merge when any task has `exitReason: needs_replan`

**Completion Criteria:**

- [ ] Third REVISE without PASS → `review_exhausted`
- [ ] REPLAN → no `.DONE` created
- [ ] Wave merge blocked on `needs_replan`

---

### SP-131 — Contract verifier at final review

**FRs:** FR-CDO-02  
**Dependencies:** SP-124, SP-129  
**Review Level:** 3  
**Size:** M

**Mission:** Implement `verifyContract` machine checks in lane worktree; integrate into final review path before reviewer verdict.

**File Scope:**

- `src/batch/contract-verify.mjs` (new)
- `src/batch/review.mjs` (integrate)
- `src/batch/engine-lanes.mjs` (hook)
- `tests/batch/contract-verify.test.mjs` (new)

**Steps outline:**

1. `verifyContract(worktreePath, parsedContract, config)` per §4.5
2. Reuse coverage parser from existing testing policy
3. Run before reviewer spawn; attach result to review input artifact
4. Skip when task is legacy mode or Contract absent
5. Optional journal `contract.verified`

**Completion Criteria:**

- [ ] testCommand exit ≠ 0 fails verifier with actionable message
- [ ] fileScopeMustNotChange detects forbidden edits
- [ ] Legacy TP-* tasks skip verifier

---

### SP-132 — `needs_replan` diagnosis + reconcile precedence

**FRs:** FR-UXB-04.5, FR-UXB-04.7, v2.0 §4.4  
**Dependencies:** SP-130  
**Review Level:** 2  
**Size:** M

**Mission:** Add `needs_replan` to diagnosis taxonomy and reconciliation precedence per §9.

**File Scope:**

- `src/batch/diagnosis.mjs`
- `src/batch/reconcile.mjs`
- `tests/compat/final-verdict-reconcile.test.mjs` (new)

**Steps outline:**

1. Add `needs_replan` to `DIAGNOSIS_TAXONOMY`
2. `buildDiagnosis` / reconcile: detect `exitReason: needs_replan`
3. Precedence rules §9.2
4. Operator JSON shape matches §9.3

**Completion Criteria:**

- [ ] `spine status --diagnose` shows needs_replan with edit-PROMPT suggestion
- [ ] needs_replan blocks needs_merge
- [ ] needs_retry unchanged for non-replan failures

---

### SP-133 — Worker/reviewer template updates (final + contract)

**FRs:** FR-UXB-04, §8  
**Dependencies:** SP-129, SP-131  
**Review Level:** 1  
**Size:** S

**Mission:** Update agent templates per §8; extend agent template drift test.

**File Scope:**

- `templates/agents/worker.md`
- `templates/agents/reviewer.md`
- `tests/agent-template-drift.test.mjs` (extend if exists) or SP-069 pattern

**Steps outline:**

1. Worker: final review sequence + contract pre-check guidance
2. Reviewer: final verdict section + contract-aware PASS criteria
3. Drift test ensures init copies match templates

**Completion Criteria:**

- [ ] Templates document `--type final` and PASS/REVISE/REPLAN
- [ ] Drift test passes

---

### SP-134 — `run-metrics.jsonl` writer (task + batch lines)

**FRs:** FR-UXB-06.1–06.4, FR-UXB-06.8  
**Dependencies:** SP-130  
**Review Level:** 2  
**Size:** M

**Mission:** Append task and batch metric lines to `.spine/run-metrics.jsonl` on terminal outcomes.

**File Scope:**

- `src/batch/metrics.mjs` (new)
- `src/batch/engine-lanes.mjs` (hook)
- `src/batch/lifecycle.mjs` (batch terminal)
- `tests/batch/run-metrics.test.mjs` (new)

**Steps outline:**

1. `appendTaskMetric(...)` on completed/failed/skipped per §6.5
2. `appendBatchMetric(...)` on batch terminal
3. Respect `metrics.enabled`; include `finalVerdict`, `contractOk`, `finalAttempts`
4. No prompt text or secrets in records

**Completion Criteria:**

- [ ] Stub batch 2 tasks → 2 task lines + 1 batch line
- [ ] `metrics.enabled: false` skips writes without error

---

### SP-135 — `spine metrics show` + doctor advisory

**FRs:** FR-UXB-06.5, FR-UXB-06.6  
**Dependencies:** SP-134  
**Review Level:** 1  
**Size:** S

**Mission:** CLI to read/filter metrics JSONL; doctor hint when file exists.

**File Scope:**

- `bin/spine.mjs` (router: `metrics show`)
- `bin/spine-doctor.mjs`
- `tests/batch/run-metrics.test.mjs` (extend)

**Steps outline:**

1. `spine metrics show [--batch ID] [--json] [--last N]`
2. Filter by batchId; human table output
3. Doctor advisory: task count + `spine metrics show` hint

**Completion Criteria:**

- [ ] `spine metrics show --batch {id}` filters correctly
- [ ] Doctor mentions metrics when file exists

---

### SP-136 — Wave A doc completion + README table

**FRs:** FR-UXB-01  
**Dependencies:** None (can parallel early)  
**Review Level:** 0  
**Size:** S

**Mission:** Finalize Wave A documentation — delta checklist for mostly-complete uncommitted docs.

**File Scope:**

- `docs/adoption/upstream-execution-workflow.md`
- `docs/adoption/bootstrap-checklist.md`
- `README.md`

**Delta checklist (do not re-specify finished prose):**

- [ ] Workflow doc: decision tree greenfield / brownfield / migrant
- [ ] End-to-end spine-native command sequence includes `spine tasks validate pending`
- [ ] README Documentation table links workflow doc
- [ ] bootstrap-checklist links upstream workflow
- [ ] Explicit: pi-spine does not invoke zero-pi

**Completion Criteria:**

- [ ] M-UXB-01 manual walkthrough pass
- [ ] All cross-links resolve

---

### SP-137 — create-spine-tasks Contract + explore guidance

**FRs:** FR-UXB-03, FR-CDO-01  
**Dependencies:** SP-124  
**Review Level:** 1  
**Size:** M

**Mission:** Update skill and prompt template with Step 0 explore + `## Contract` authoring guidance.

**File Scope:**

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/prompt-template.md`
- `skills/create-spine-tasks/references/explore-template.md`
- `skills/create-spine-tasks/references/contract-template.md` (new)

**Steps outline:**

1. Step 0 Explore — when to skip, findings path, link to explore-template
2. Add Contract section to prompt-template with field guidance
3. New contract-template.md with examples per §4
4. Launch command sequence: `spine tasks validate pending` before plan

**Completion Criteria:**

- [ ] Skill documents Contract as required for new SP-* tasks
- [ ] explore-template.md matches v1.3 §6.3 schema
- [ ] M-UXB-03: findings.md example producible from template

---

### SP-138 — Operator runbook v2.0 sections

**FRs:** FR-UXB-01, FR-UXB-02, FR-UXB-04, FR-UXB-05  
**Dependencies:** SP-125, SP-127, SP-128, SP-132  
**Review Level:** 0  
**Size:** M

**Mission:** Add operator runbook sections: validate, handoff, needs_replan, contract mode, metrics.

**File Scope:**

- `docs/adoption/operator-runbook.md`

**Sections to add:**

1. `spine tasks validate` — when, scope, fixing errors
2. `spine handoff` — session continuity workflow
3. `needs_replan` — diagnosis, edit PROMPT, retry
4. `## Contract` — authoring, mode config, legacy TP-*
5. `spine metrics show` — reading outcomes

**Completion Criteria:**

- [ ] Runbook sections cross-link upstream-execution-workflow.md
- [ ] Example commands copy-pasteable

---

### SP-139 — Integration fixtures + adoption smoke extension

**FRs:** All Phase 20  
**Dependencies:** SP-125–SP-135  
**Review Level:** 2  
**Size:** M

**Mission:** End-to-end fixtures and adoption smoke covering validate → batch → final verdict → metrics.

**File Scope:**

- `test/fixtures/taskplane/FX-*` (extend)
- `scripts/adoption-smoke.sh`
- `tests/adoption/*`

**Steps outline:**

1. FX fixtures for contract validate, final REPLAN, metrics lines
2. adoption-smoke: `spine tasks validate` before batch start
3. Stub batch path: REPLAN → needs_replan assertion

**Completion Criteria:**

- [ ] AD-001-smoke passes validate before batch
- [ ] Integration test: REPLAN → needs_replan diagnosis

---

### SP-140 — CONTEXT.md Phase 20 + dependencies.json graph

**FRs:** Meta  
**Dependencies:** SP-123–SP-139  
**Review Level:** 0  
**Size:** S

**Mission:** Update spine-tasks tracking for Phase 20 epic.

**File Scope:**

- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`

**Steps outline:**

1. Add Phase 20 section with wave table and suggested run order
2. Set Next Task ID → SP-141
3. Add dependency edges for SP-123–SP-139 per §12 graph
4. Link to this handoff doc

**Completion Criteria:**

- [ ] `spine plan SP-123` respects dependency graph
- [ ] CONTEXT documents Phase 20 exit criteria

---

## 11.1 Task decomposition — S-sized (SP-141–SP-170) — ACTIVE

**Phase:** 20b — v2.0 CDO (S-sized splits)  
**Next task ID:** SP-171 (after SP-170 lands)  
**Batch policy:** ≤3 tasks per `spine batch start` for real pi workers; SP-151/152/153 serial only (shared `engine-lanes.mjs`)

### ID mapping

| New ID | Slug | Replaces | Deps | Size |
|--------|------|----------|------|------|
| SP-141 | config-defaults-v2 | SP-123a | SP-122 | S |
| SP-142 | contract-config-validate | SP-123b | SP-141 | S |
| SP-143 | contract-parse | SP-124a | SP-142 | S |
| SP-144 | contract-validate-wire | SP-124b | SP-143 | S |
| SP-145 | tasks-validate-core | SP-125a | SP-144 | S |
| SP-146 | tasks-validate-json | SP-125b | SP-145 | S |
| SP-147 | handoff-data | SP-127a | SP-142 | S |
| SP-148 | handoff-render | SP-127b | SP-147 | S |
| SP-149 | final-verdict-parse | SP-129a | SP-142 | S |
| SP-150 | final-review-spawn | SP-129b | SP-149 | S |
| SP-151 | engine-final-phase | SP-130a | SP-150 | S |
| SP-152 | engine-revise-cap | SP-130b | SP-151 | S |
| SP-153 | engine-replan-block | SP-130c | SP-152 | S |
| SP-154 | contract-verify-core | SP-131a | SP-144, SP-150 | S |
| SP-155 | contract-verify-hook | SP-131b | SP-154, SP-151 | S |
| SP-156 | needs-replan-taxonomy | SP-132a | SP-153 | S |
| SP-157 | needs-replan-reconcile | SP-132b | SP-156 | S |
| SP-158 | metrics-task-writer | SP-134a | SP-153 | S |
| SP-159 | metrics-batch-writer | SP-134b | SP-158 | S |
| SP-160 | skill-explore-step0 | SP-137a | SP-144 | S |
| SP-161 | skill-contract-template | SP-137b | SP-144 | S |
| SP-162 | runbook-validate-handoff | SP-138a | SP-146, SP-148 | S |
| SP-163 | runbook-replan-metrics | SP-138b | SP-157, SP-169 | S |
| SP-164 | fixtures-phase20 | SP-139a | SP-146, SP-153 | S |
| SP-165 | adoption-smoke-phase20 | SP-139b | SP-166, SP-157, SP-169 | S |
| SP-166 | preflight-tasks-validate | SP-126 | SP-146 | S |
| SP-167 | handoff-slash-journal | SP-128 | SP-148 | S |
| SP-168 | agent-templates-final | SP-133 | SP-150, SP-155 | S |
| SP-169 | metrics-show-cli | SP-135 | SP-159 | S |
| SP-170 | context-phase20b | SP-140 | SP-165, SP-163, SP-162, SP-168, SP-167, SP-166, SP-161, SP-160 | S |

### Suggested batches (≤3 tasks each)

| Batch | Tasks |
|-------|-------|
| 1 | SP-141 |
| 2 | SP-142 |
| 3 | SP-143, SP-160 |
| 4 | SP-144, SP-161 |
| 5 | SP-145 |
| 6 | SP-146 |
| 7 | SP-147, SP-149 |
| 8 | SP-148, SP-150 |
| 9 | SP-166 |
| 10 | SP-151 |
| 11 | SP-152 |
| 12 | SP-153 |
| 13 | SP-154 |
| 14 | SP-155, SP-168 |
| 15 | SP-156 |
| 16 | SP-157, SP-167 |
| 17 | SP-158 |
| 18 | SP-159, SP-169 |
| 19 | SP-162 |
| 20 | SP-163 |
| 21 | SP-164 |
| 22 | SP-165 |
| 23 | SP-170 |

**Regression gate after each batch:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

---

## 12. Wave run order and land checkpoints

### 12.1 Prerequisite

```bash
# Land SP-122 first
SPINE_WORKER_STUB=1 spine batch start SP-122
```

### 12.2 Dependency graph

```text
SP-122
  └── SP-123 (config)
        ├── SP-124 (contract parse) ──► SP-125 (validate CLI) ──► SP-126 (preflight/slash)
        │                                      │
        ├── SP-127 (handoff) ──► SP-128         │
        │                                      │
        └── SP-129 (final parse) ──► SP-130 ──► SP-131 (contract verify)
                          │              └──► SP-132 (needs_replan)
                          └──► SP-133 (templates)
        SP-130 ──► SP-134 (metrics) ──► SP-135
        SP-136 (docs) — parallel anytime
        SP-124 ──► SP-137 (skill)
        SP-125..132 ──► SP-138 (runbook)
        SP-125..135 ──► SP-139 (fixtures)
        All ──► SP-140 (CONTEXT)
```

### 12.3 Suggested batch waves

| Wave | Tasks | Parallel? | Exit criteria |
|------|-------|-----------|---------------|
| **0** | SP-122 | — | Preflight passes on pending scope |
| **A** | SP-123 | — | Config defaults load |
| **B** | SP-124 → SP-125 → SP-126 | serial | `spine tasks validate pending` works; preflight `tasks-validate` |
| **B′** | SP-127 → SP-128 | parallel to B | `spine handoff` writes file |
| **C** | SP-129 → SP-130 → SP-131 → SP-132, SP-133 | SP-133 parallel after SP-131 | REPLAN → needs_replan; PASS → .DONE |
| **D** | SP-134 → SP-135 | — | metrics JSONL + show |
| **E** | SP-136, SP-137, SP-138, SP-139, SP-140 | SP-136 early | docs + smoke green |

### 12.4 Regression gate (after every wave)

```bash
npm run typecheck && SPINE_WORKER_STUB=1 npm test
```

### 12.5 Phase 20 exit criteria

- [ ] `spine tasks validate pending` passes on dogfood pending scope (or explicit backlog excluded)
- [ ] Stub batch demonstrates PASS, REVISE cap, REPLAN → needs_replan
- [ ] Contract verifier runs on SP-* tasks with `## Contract`
- [ ] TP-* legacy tasks validate without Contract
- [ ] `spine handoff` + `spine metrics show` operational
- [ ] adoption-smoke includes validate step

---

## 13. Success metrics

| ID | Metric | Verification command / test |
|----|--------|----------------------------|
| M1 (v2.0) | 100% `prompt_parse_failed` caught pre-batch | `spine tasks validate` on FX-invalid-no-testing |
| M2 (v2.0) | No orphaned completed-unknown tasks | final-verdict.test.mjs |
| M3 (v2.0) | Session recovery via handoff | spine-handoff.test.mjs + manual |
| M4 (v2.0) | REPLAN → needs_replan with edit hint | final-verdict-reconcile.test.mjs |
| M-UXB-01 | Workflow doc walkthrough | Manual |
| M-UXB-02 | Validate catches invalid PROMPT | validate-cli.test.mjs |
| M-UXB-03 | Explore findings producible | skill template review |
| M-UXB-04 | REPLAN blocks merge | final-verdict.test.mjs |
| M-UXB-05 | Handoff restorable summary | spine-handoff.test.mjs |
| M-UXB-06 | Metrics per task + batch | run-metrics.test.mjs |
| M-UXB-07 | Step review unchanged | review.test.mjs regression |
| M-UXB-08 | No secrets in handoff/metrics | redaction unit tests |

---

## 14. Workflow after this document

### 14.1 Generate task packets

```text
Use create-spine-tasks to decompose docs/PRD-v2.0-implementation-handoff.md
into SP-123+ task packets. Update CONTEXT.md Next Task ID and dependencies.json.
```

### 14.2 Optional explore (recommended)

Brownfield touch across `src/batch/`, `src/tasks/packet/`, `bin/`, `extensions/`:

```text
spine-tasks/_explore/v2.0-cdo/findings.md
```

### 14.3 Validate and run

```bash
spine tasks validate pending   # after SP-125
spine plan pending
spine preflight
SPINE_WORKER_STUB=1 spine batch start SP-123
```

### 14.4 Post-land doc updates

After Phase 20 completes:

- [ ] [docs/PRD-v2.0.md](PRD-v2.0.md) — add pointer to this handoff as normative implementation spec
- [ ] [docs/PRD.md](PRD.md) §25 — reference v2.0 handoff instead of v1.3-only roadmap

---

*End of v2.0 CDO implementation handoff. Base PRD v1.2 + v1.3 addendum remain authoritative for unlisted behavior.*
