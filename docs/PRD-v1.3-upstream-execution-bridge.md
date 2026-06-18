# pi-spine — PRD v1.3 Addendum: Upstream Execution Bridge

**Document type:** Product Requirements Document (addendum)  
**Product:** pi-spine  
**Version:** 1.3  
**Last updated:** 2026-06-10  
**Status:** Draft — ready for engineering handoff  

**Normative parent:** [docs/PRD.md](PRD.md) v1.2 — batch engine, gates, journal, Taskplane compatibility, reconciliation  
**Pattern inspiration:** [zero-pi](https://pi.dev/packages/@gonrocca/zero-pi) SDD workflow (explore → plan → build → veredicto) — **no runtime dependency**  
**Operator workflow:** [docs/adoption/upstream-execution-workflow.md](adoption/upstream-execution-workflow.md)

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Background and rationale](#2-background-and-rationale)
3. [Goals, non-goals, and success metrics](#3-goals-non-goals-and-success-metrics)
4. [Design principles](#4-design-principles)
5. [User personas and user stories](#5-user-personas-and-user-stories)
6. [Functional requirements](#6-functional-requirements)
7. [Non-functional requirements](#7-non-functional-requirements)
8. [System architecture](#8-system-architecture)
9. [Data model and persistence](#9-data-model-and-persistence)
10. [CLI and pi slash commands](#10-cli-and-pi-slash-commands)
11. [Agent contracts and prompts](#11-agent-contracts-and-prompts)
12. [Skill and adoption documentation](#12-skill-and-adoption-documentation)
13. [Reconciliation and diagnosis extensions](#13-reconciliation-and-diagnosis-extensions)
14. [Testing and verification](#14-testing-and-verification)
15. [Implementation phases](#15-implementation-phases)
16. [Risks and mitigations](#16-risks-and-mitigations)
17. [Appendices](#17-appendices)
18. [Engineering start checklist](#18-engineering-start-checklist)

---

## 1. Executive summary

**pi-spine v1.2** excels at **batch execution**: dependency waves, worktree lanes, journal-backed recovery, human integrate gates, and reconciliation UX. It assumes task packets (`PROMPT.md`, `STATUS.md`) already exist and are valid.

**zero-pi** excels at **upstream discipline**: read-only exploration, structured planning, adversarial final review, per-phase model routing, and session handoff — packaged as an installable pi layer without modifying pi core.

This addendum closes the gap **without** reimplementing zero-pi or coupling to GitHub. It adopts six patterns:

| ID | Capability | Layer |
|----|------------|-------|
| FR-UXB-01 | Upstream ↔ execution composition workflow (documentation) | Adoption |
| FR-UXB-02 | `spine tasks validate` — expose existing PROMPT validation | CLI / preflight |
| FR-UXB-03 | Optional explore phase before task decomposition | Skill + artifact |
| FR-UXB-04 | Task-level final verdict loop (`PASS` / `REVISE` / `REPLAN`) | Engine + reviewer |
| FR-UXB-05 | Operator handoff note (orchestration-layer continuity) | CLI |
| FR-UXB-06 | Run metrics collection (foundation for per-role model hints) | Persistence + CLI |

**Tagline for v1.3:** *Validate before run, explore before plan, verdict before done, handoff before context loss.*

---

## 2. Background and rationale

### 2.1 Problem statement

Operators hit preventable failures at two boundaries:

1. **Authoring → execution:** Invalid `PROMPT.md` packets cause `prompt_parse_failed` at batch launch (see incident batch `20260605T191325`, SP-118/119). Validation exists in [`src/tasks/packet/parse-prompt.mjs`](../src/tasks/packet/parse-prompt.mjs) and [`src/planner/index.mjs`](../src/planner/index.mjs) but is not exposed as a first-class operator command.

2. **Step review → task completion:** Step-level `APPROVE`/`REVISE` (FR-REV-02) does not distinguish "fix implementation" from "replan the task." zero-pi's `corregir` vs `replantear` verdict taxonomy maps to operator actions pi-spine does not yet surface.

3. **Batch continuity → session continuity:** pi-spine solves batch recovery via `STATUS.md`, journal, and `spine batch resume`. When the **operator's pi session** compacts or the IDE restarts, there is no single file summarizing batch diagnosis and next command (zero-pi addresses this with `/zero-resume` at the conversation layer).

4. **Model tuning:** Worker and reviewer models are static in [`templates/spine-config.json`](../templates/spine-config.json). No project-local history informs which models succeed on which task shapes.

### 2.2 Relationship to zero-pi and spec-kit

| Aspect | zero-pi | spec-kit | pi-spine v1.3 |
|--------|---------|----------|---------------|
| Primary loop | `/forge` single-run SDD | `/speckit.*` constitution → spec → plan → tasks | `spine batch start` multi-task parallel |
| Spec store | `.sdd/` canonical specs | `.specify/`, `specs/<feature>/` | Task packets + optional `_explore/` findings |
| Verdict | `pasa` / `corregir` / `replantear` | (authoring-phase checklists; no batch verdict) | `PASS` / `REVISE` / `REPLAN` (English CLI) |
| Dependency | Requires `pi-subagents` for phases | `specify` CLI (separate install) | Optional `pi-subagents` in v1.4+; not required for v1.3 |
| GitHub | `/zero-pr`, `/zero-issue` | **Explicitly out of scope** for pi-spine | **Explicitly out of scope** |

**Composition model:** zero-pi or spec-kit (optional) → task packets → pi-spine. Documented in [upstream-execution-workflow.md](adoption/upstream-execution-workflow.md) (Path 2 and Path 4).

### 2.3 Relationship to base PRD v1.2

All v1.2 requirements remain normative. This addendum **extends** — does not replace:

- §7.6 Review (FR-REV) — step reviews unchanged; final verdict is additive
- §10.2 Journal — new event types appended
- §18.3 Operator messaging — new diagnosis `needs_replan`
- §15 CLI — new commands listed in §10 below

---

## 3. Goals, non-goals, and success metrics

### 3.1 Goals

| ID | Goal |
|----|------|
| G-UXB-1 | Operators can validate task packets before batch start with actionable errors |
| G-UXB-2 | Task authors can optionally run a read-only explore phase before decomposition |
| G-UXB-3 | Final task verdict drives engine actions (`REPLAN` blocks merge with clear next step) |
| G-UXB-4 | Operators can write/read a handoff note without orchestrator literacy |
| G-UXB-5 | Project-local run metrics accumulate per task for later model recommendations |
| G-UXB-6 | Adoption docs describe zero-pi ↔ pi-spine composition without package coupling |

### 3.2 Non-goals (v1.3 locked)

- npm dependency on `@gonrocca/zero-pi` or automatic `.sdd/` import
- `/forge` pipeline, canonical spec store, `/zero-sync`
- GitHub issue/PR automation (`/zero-pr`, `/zero-issue`, `gh` integration)
- Autotune / automatic model switching (collection only in v1.3)
- `spine explore` CLI (skill-only explore; CLI deferred to v1.4)
- Cross-harness routing (unchanged from base PRD v1.2)
- Conversation tail / pi session compaction hooks (handoff is batch-operator scoped)

### 3.3 Success metrics

| ID | Metric | Verification |
|----|--------|--------------|
| M-UXB-01 | New operator completes workflow doc without reading zero-pi source | Manual doc walkthrough |
| M-UXB-02 | Invalid PROMPT caught by `spine tasks validate` before batch | Fixture: missing Testing step → exit 1 |
| M-UXB-03 | Brownfield explore produces `findings.md` linked in CONTEXT.md | Skill output review |
| M-UXB-04 | `REPLAN` verdict → `needs_replan` diagnosis + blocked merge | Integration test |
| M-UXB-05 | `spine handoff` writes restorable summary after pause | CLI snapshot test |
| M-UXB-06 | Stub batch appends ≥1 line per task to `run-metrics.jsonl` | `spine metrics show --json` |
| M-UXB-07 | Step `APPROVE`/`REVISE` behavior unchanged (regression) | Existing `tests/batch/review.test.mjs` green |
| M-UXB-08 | No secrets in handoff or metrics | Redaction unit test |

---

## 4. Design principles

| Principle | Meaning |
|-----------|---------|
| **Compose, don't merge** | Adopt zero-pi *patterns* via docs and thin spine features; do not fork SDD |
| **Fail closed** | Invalid packets block validate/preflight; `REPLAN` blocks `.DONE` and wave merge |
| **English CLI** | Verdict enums and diagnosis in English; map to zero-pi concepts in docs only |
| **Authoring vs execution** | Explore and decomposition are skill/docs; engine changes only for verdict + metrics |
| **Reuse validation** | `spine tasks validate` calls existing `validatePrompt` / `loadTaskPacket` — no second schema |
| **Boundary journaling** | Metrics and handoff are operator artifacts; journal records control events only |
| **Taskplane compat** | No change to packet format required sections (PRD §13) |

---

## 5. User personas and user stories

### 5.1 Personas

| Persona | Need |
|---------|------|
| **Solo operator** | One command to know if tasks are runnable and what to run next |
| **Task author** | Decompose PRDs safely on brownfield repos with explore-first discipline |
| **Batch runner** | Recover after IDE restart without re-reading journal JSONL |
| **Maintainer** | See which models/tasks correlate with failures over time |

### 5.2 User stories

| ID | Story | FR |
|----|-------|-----|
| US-UXB-01 | As an operator, I read one workflow doc that explains optional zero-pi upstream and required spine downstream steps | FR-UXB-01 |
| US-UXB-02 | As an operator, I run `spine tasks validate pending` and fix PROMPT errors before `spine batch start` | FR-UXB-02 |
| US-UXB-03 | As a task author, I run explore (read-only) and link findings before `create-spine-tasks` | FR-UXB-03 |
| US-UXB-04 | As a reviewer, I return `REPLAN` when the task scope is wrong, and the batch tells me to edit PROMPT | FR-UXB-04 |
| US-UXB-05 | As an operator, I run `spine handoff` before closing my laptop and resume with `spine next` | FR-UXB-05 |
| US-UXB-06 | As a maintainer, I run `spine metrics show` after a batch to compare worker outcomes | FR-UXB-06 |

---

## 6. Functional requirements

### 6.1 FR-UXB-01 — Upstream ↔ execution composition workflow

**Priority:** P0  
**Implementation:** Documentation only (Wave A)

| ID | Requirement |
|----|-------------|
| FR-UXB-01.1 | Ship [docs/adoption/upstream-execution-workflow.md](adoption/upstream-execution-workflow.md) as normative operator guide |
| FR-UXB-01.2 | Document three adoption paths: spine-native, zero-pi optional upstream, Taskplane migrant |
| FR-UXB-01.3 | Artifact handoff table: zero-pi outputs vs spine inputs |
| FR-UXB-01.4 | Coexistence: both packages may be installed; no shared state between `.sdd/` and `.spine/` |
| FR-UXB-01.5 | Cross-link from [bootstrap-checklist.md](adoption/bootstrap-checklist.md), [operator-runbook.md](adoption/operator-runbook.md), [create-spine-tasks/SKILL.md](../skills/create-spine-tasks/SKILL.md) |
| FR-UXB-01.6 | Explicit statement: pi-spine does not invoke zero-pi commands |

**Acceptance criteria:**

- [ ] Workflow doc includes decision tree: greenfield vs brownfield vs migrant
- [ ] Workflow doc includes end-to-end command sequence for spine-native path
- [ ] README Documentation table links workflow doc

---

### 6.2 FR-UXB-02 — `spine tasks validate`

**Priority:** P0  
**Implementation anchors:** [`src/tasks/packet/parse-prompt.mjs`](../src/tasks/packet/parse-prompt.mjs), [`src/tasks/packet/validate-prompt.mjs`](../src/tasks/packet/validate-prompt.mjs), [`src/tasks/packet/index.mjs`](../src/tasks/packet/index.mjs) (`loadTaskPacket`), [`bin/spine-preflight.mjs`](../bin/spine-preflight.mjs)

| ID | Requirement |
|----|-------------|
| FR-UXB-02.1 | CLI `spine tasks validate <scope>` — scope matches `spine plan` (`all`, `pending`, task IDs, globs) |
| FR-UXB-02.2 | Resolve tasks via configured `paths.tasksRoot` (same as planner) |
| FR-UXB-02.3 | Per task: load `PROMPT.md`, run `validatePrompt`, collect errors via `collectPromptValidationFailure` |
| FR-UXB-02.4 | Human output: reuse `formatPromptValidationFailures`; prefix with summary line `Validated N task(s): X passed, Y failed` |
| FR-UXB-02.5 | `--json` output shape (normative): see §9.3 |
| FR-UXB-02.6 | Exit codes: `0` all pass; `1` one or more failures; `2` config/tasksRoot/scope resolution error |
| FR-UXB-02.7 | Preflight adds check id `tasks-validate` that runs same validation for `pending` scope (in addition to `plan` check) |
| FR-UXB-02.8 | When `tasks-validate` fails, preflight `suggestedCommand` is `spine tasks validate pending` (or matching scope) |
| FR-UXB-02.9 | Slash `/spine-validate [scope]` delegates to CLI (register in [`extensions/spine/slash-commands.ts`](../extensions/spine/slash-commands.ts)) |
| FR-UXB-02.10 | `--warnings-only` (P1): non-blocking checks — folder name ≠ heading task ID; missing `STATUS.md`; deps in PROMPT not in `dependencies.json` |

**Validation rules (inherited from `validatePrompt` — do not duplicate):**

- Heading: `# Task: PREFIX-### — Name` with em dash U+2014
- Required sections: Mission, Dependencies, File Scope, Steps, Completion Criteria, Do NOT
- Testing: `## Testing` section or step titled "Testing"
- Size XL rejected
- At least one `### Step N:` under Steps

**Acceptance criteria:**

- [ ] Missing Testing step fails with same message as planner `prompt_parse_failed` path
- [ ] `spine tasks validate TP-012 --json` returns structured errors array
- [ ] Preflight fails with distinct `tasks-validate` check name (not buried in plan error)
- [ ] `spine help tasks` documents subcommand

---

### 6.3 FR-UXB-03 — Optional explore phase

**Priority:** P1  
**Implementation:** Skill + artifact contract only (Wave B); no batch engine changes

| ID | Requirement |
|----|-------------|
| FR-UXB-03.1 | Explore is authoring-only; batch engine and `validatePrompt` unchanged |
| FR-UXB-03.2 | Artifact path: `{tasksRoot}/_explore/{slug}/findings.md` (git-tracked by default) |
| FR-UXB-03.3 | `findings.md` required sections: Summary, Codebase areas, Risks, Suggested file scopes, Open questions |
| FR-UXB-03.4 | `CONTEXT.md` tracks explore: table column `Explore` or row `Explore complete: {slug}` with date |
| FR-UXB-03.5 | Update [skills/create-spine-tasks/SKILL.md](../skills/create-spine-tasks/SKILL.md): **Step 0 — Explore (optional)** before PRD decomposition |
| FR-UXB-03.6 | Explore constraints: read-only; no commits; no edits outside read targets; output feeds File Scope in later steps |
| FR-UXB-03.7 | Recommend explore when: brownfield repo, L/XL epic, or File Scope uncertainty |
| FR-UXB-03.8 | `spine tasks validate` does not require explore artifacts |

**`findings.md` schema (normative template in skill references):**

```markdown
# Explore: {slug}

**Date:** YYYY-MM-DD
**Status:** complete | superseded

## Summary
(1–3 sentences)

## Codebase areas
- `path/` — (why relevant)

## Risks
- (risk + mitigation hint)

## Suggested file scopes
- (paths for downstream task packets)

## Open questions
- (blockers for decomposition; None if clear)
```

**Acceptance criteria:**

- [ ] Skill documents Step 0 with when-to-skip guidance
- [ ] Example `findings.md` in `skills/create-spine-tasks/references/explore-template.md`
- [ ] CONTEXT template mentions explore table ([`templates/tasks/CONTEXT.md`](../templates/tasks/CONTEXT.md) optional update in Wave B)

---

### 6.4 FR-UXB-04 — Task-level final verdict loop

**Priority:** P0 (Wave D)  
**Implementation anchors:** [`src/batch/review.mjs`](../src/batch/review.mjs), [`templates/agents/reviewer.md`](../templates/agents/reviewer.md), [`templates/agents/worker.md`](../templates/agents/worker.md)

#### 6.4.1 Verdict model

| Verdict | Meaning | Operator analog (zero-pi) | Engine action |
|---------|---------|---------------------------|---------------|
| `PASS` | Task verified; safe to complete | `pasa` | Allow `.DONE`; proceed to wave merge policy |
| `REVISE` | Implementation/fixable gaps | `corregir` | Worker addresses feedback; re-invoke `--type final` |
| `REPLAN` | Wrong scope/approach; PROMPT must change | `replantear` | Task `failed`, `exitReason: needs_replan`; block wave merge |

**Step reviews (unchanged):** `--type plan|code` continue to use `APPROVE` | `REVISE` only.

**Final review (new):** `--type final` uses `PASS` | `REVISE` | `REPLAN`.

| ID | Requirement |
|----|-------------|
| FR-UXB-04.1 | When `review.requireFinalVerdict` true (default) and Review Level ≥ 1, worker MUST call `spine_review_step --type final` after all steps complete and before `.DONE` |
| FR-UXB-04.2 | Reviewer JSON for final: `{ "verdict": "PASS"|"REVISE"|"REPLAN", "feedback": "..." }` |
| FR-UXB-04.3 | `parseReviewVerdict` extended to accept final verdicts when `reviewType === "final"` |
| FR-UXB-04.4 | `REVISE` on final: worker fixes; increment `finalAttempt`; re-run final review |
| FR-UXB-04.5 | `REPLAN` on final: set task `status: failed`, `exitReason: needs_replan`, journal `task.verdict_recorded`, do not create `.DONE` |
| FR-UXB-04.6 | Iteration cap `review.maxFinalAttempts` (default 3) for REVISE loops; on exhaust: `task.failed`, `exitReason: review_exhausted`, journal `review.exhausted` |
| FR-UXB-04.7 | Wave merge blocked while any wave task has `exitReason: needs_replan` (§17.4 mixed-outcome family) |
| FR-UXB-04.8 | Review Level 0: skip final verdict (no reviewer spawn) |
| FR-UXB-04.9 | Fail closed (FR-REV-06): final review spawn failure at level ≥ 1 stops worker (non-zero exit) |
| FR-UXB-04.10 | Artifacts: `{taskFolder}/.reviews/final-{timestamp}.md` (or `final-{step}-{timestamp}.md`) |

**Journal event `task.verdict_recorded` payload:**

```json
{
  "verdict": "PASS|REVISE|REPLAN",
  "reviewType": "final",
  "attempt": 1,
  "reviewLevel": 2,
  "artifactPath": "spine-tasks/SP-010/.reviews/final-20260610T120000.md"
}
```

**Acceptance criteria:**

- [ ] Final `REPLAN` → reconciliation `needs_replan` with edit-PROMPT suggestion
- [ ] Step `APPROVE`/`REVISE` tests unchanged (M-UXB-07)
- [ ] Third `REVISE` without `PASS` → `review_exhausted`
- [ ] `spine review step --step N --type final` documented in worker template

---

### 6.5 FR-UXB-05 — Operator handoff note

**Priority:** P1 (Wave C)  
**Implementation:** New CLI module; no batch engine changes

| ID | Requirement |
|----|-------------|
| FR-UXB-05.1 | Default output path: `.spine/handoff.md` (configurable `handoff.path`) |
| FR-UXB-05.2 | CLI `spine handoff [--batch ID] [--json]` |
| FR-UXB-05.3 | Slash `/spine-handoff` delegates to CLI |
| FR-UXB-05.4 | Content sections (Markdown, normative order): Generated at, batchId, diagnosis, headline, suggestedCommand, alternatives[], pending tasks, lane summary, journal tail (last 10 event types + timestamps), restore commands |
| FR-UXB-05.5 | Data sources: `reconcileBatch()`, active or archived batch-state, `readJournalTail` |
| FR-UXB-05.6 | `--json` returns same fields as structured object + `handoffPath` |
| FR-UXB-05.7 | Journal event `handoff.written` with `{ handoffPath, diagnosis, batchId }` when batch active |
| FR-UXB-05.8 | Auto-write triggers via `handoff.autoWriteOn`: `pause`, `terminal`, `diagnosis_change` — default `[]` (manual only in v1.3) |
| FR-UXB-05.9 | Must not include API keys, tokens, worker log bodies (NFR-UXB-02) |
| FR-UXB-05.10 | `spine next` appends hint `Handoff: .spine/handoff.md` when file exists and diagnosis not idle |

**Acceptance criteria:**

- [ ] Paused batch handoff lists pending task IDs and `spine batch resume`
- [ ] Snapshot test compares golden `handoff.md` structure (redact timestamps)
- [ ] No batch active: handoff writes idle state with `spine preflight` suggestion

---

### 6.6 FR-UXB-06 — Run metrics collection

**Priority:** P1 (Wave D)  
**Implementation anchors:** [`src/batch/lifecycle.mjs`](../src/batch/lifecycle.mjs), [`src/batch/journal.mjs`](../src/batch/journal.mjs), task completion paths in [`src/batch/engine-lanes.mjs`](../src/batch/engine-lanes.mjs)

| ID | Requirement |
|----|-------------|
| FR-UXB-06.1 | When `metrics.enabled` true (default), append to `.spine/run-metrics.jsonl` |
| FR-UXB-06.2 | One JSON line per task terminal outcome (completed, failed, skipped) |
| FR-UXB-06.3 | One JSON line per batch terminal (completed, dismissed, aborted, failed) |
| FR-UXB-06.4 | Task record fields — see §9.4 |
| FR-UXB-06.5 | CLI `spine metrics show [--batch ID] [--json] [--last N]` |
| FR-UXB-06.6 | `spine doctor` advisory when metrics file exists: task count + `spine metrics show` hint |
| FR-UXB-06.7 | v1.3: collect only; v1.4 documents `spine settings suggest-models` (read-only recommendations) |
| FR-UXB-06.8 | Do not log prompt text, file contents, or env secrets |
| FR-UXB-06.9 | Optional journal mirror `metrics.task_recorded` — **normative: JSONL is source of truth; journal event optional P2** |

**Acceptance criteria:**

- [ ] Stub batch with 2 tasks → 2 task lines + 1 batch line in JSONL
- [ ] `spine metrics show --batch {id}` filters correctly
- [ ] Metrics disabled via config skips writes without error

---

## 7. Non-functional requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-UXB-01 | Performance | `spine tasks validate` for 100 tasks < 2s (same as planner NFR-PERF-01) |
| NFR-UXB-02 | Security | Handoff and metrics MUST NOT contain `*_KEY`, `*_TOKEN`, `*SECRET*` (reuse NFR-SEC-02 patterns) |
| NFR-UXB-03 | Reliability | Validate is read-only; no batch-state mutation |
| NFR-UXB-04 | Compatibility | Taskplane-format packets unchanged; zero-pi not required at runtime |
| NFR-UXB-05 | Observability | New CLI commands support `--json` for automation |
| NFR-UXB-06 | Maintainability | Validate delegates to single `validatePrompt` implementation |
| NFR-UXB-07 | Testing | New modules ≥77% line coverage per NFR-TEST-03 |

---

## 8. System architecture

### 8.1 Component diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Upstream (optional)                          │
│  zero-pi /forge    create-spine-tasks skill    PRD / brief       │
│       │                    │                      │              │
│       └────────────┬───────┴──────────────────────┘              │
│                    ▼                                             │
│           _explore/{slug}/findings.md (FR-UXB-03)               │
│           PROMPT.md / STATUS.md / dependencies.json              │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              FR-UXB-02  spine tasks validate                     │
│              FR-UXB-02  spine preflight (tasks-validate check)   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Base PRD v1.2 batch engine (unchanged core)         │
│  plan → batch start → worker → step review → lane merge → gate  │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  FR-UXB-04            FR-UXB-05            FR-UXB-06
  final verdict        spine handoff        run-metrics.jsonl
  needs_replan         .spine/handoff.md    spine metrics show
```

### 8.2 Module placement (implementation guide)

| Feature | New / modified modules |
|---------|------------------------|
| FR-UXB-02 | `bin/spine-tasks.mjs` (new), `bin/spine.mjs` router, `bin/spine-preflight.mjs`, `extensions/spine/slash-commands.ts` |
| FR-UXB-04 | `src/batch/review.mjs`, `src/batch/engine-lanes.mjs`, `src/batch/diagnosis.mjs`, `src/batch/reconcile.mjs`, `templates/agents/*` |
| FR-UXB-05 | `src/cli/handoff.mjs` (new), `bin/spine-handoff.mjs` or subcommand |
| FR-UXB-06 | `src/batch/metrics.mjs` (new), hook in task terminal paths + `lifecycle.mjs` |

---

## 9. Data model and persistence

### 9.1 New filesystem paths

| Path | Git | Purpose |
|------|-----|---------|
| `{tasksRoot}/_explore/{slug}/findings.md` | Tracked | Explore artifact |
| `.spine/handoff.md` | Ignored (operator choice) | Operator handoff |
| `.spine/run-metrics.jsonl` | Ignored | Append-only metrics |

### 9.2 Journal event extensions

Add to `SpineEventType` (extends PRD §10.2):

```typescript
type SpineEventTypeV13 =
  | "task.verdict_recorded"
  | "handoff.written"
  | "review.exhausted";
```

### 9.3 `spine tasks validate` JSON output

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
  }>;
}
```

### 9.4 Run metrics JSONL schemas

**Task line (`recordType: "task"`):**

```typescript
interface TaskMetricRecord {
  recordType: "task";
  schemaVersion: 1;
  batchId: string;
  taskId: string;
  agentRole: "worker" | "reviewer";
  model: string;           // resolved model id or "inherit"
  thinking: string;        // off | low | medium | high
  startedAt: string;       // ISO-8601
  endedAt: string;
  outcome: "completed" | "failed" | "skipped";
  exitReason?: string;
  reviewLevel?: number;
  finalVerdict?: "PASS" | "REVISE" | "REPLAN" | null;
  finalAttempts?: number;
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

### 9.5 `spine-config.json` extensions

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
  }
}
```

| Field | Default | Editable via `spine settings` |
|-------|---------|-------------------------------|
| `review.requireFinalVerdict` | `true` | v1.3: config file only |
| `review.maxFinalAttempts` | `3` | v1.3: config file only |
| `handoff.path` | `.spine/handoff.md` | P2 |
| `handoff.autoWriteOn` | `[]` | P2 |
| `metrics.enabled` | `true` | P2 |
| `metrics.path` | `.spine/run-metrics.jsonl` | P2 |

### 9.6 Batch history extension (optional P2)

On `complete` / `dismiss`, append optional `metricsSummary` to [`appendBatchHistoryEntry`](../src/batch/lifecycle.mjs):

```json
{
  "metricsSummary": {
    "taskLines": 4,
    "failedTasks": 1,
    "metricsPath": ".spine/run-metrics.jsonl"
  }
}
```

---

## 10. CLI and pi slash commands

### 10.1 New CLI commands

| Command | Description | FR |
|---------|-------------|-----|
| `spine tasks validate <scope> [--json]` | Validate PROMPT packets for scope | FR-UXB-02 |
| `spine handoff [--batch ID] [--json]` | Write operator handoff note | FR-UXB-05 |
| `spine metrics show [--batch ID] [--json] [--last N]` | Display run metrics | FR-UXB-06 |

### 10.2 New slash commands

| Command | Delegates to |
|---------|--------------|
| `/spine-validate [scope]` | `spine tasks validate` |
| `/spine-handoff` | `spine handoff` |

### 10.3 Modified commands

| Command | Change |
|---------|--------|
| `spine preflight` | Add `tasks-validate` check |
| `spine next` | Optional handoff path hint |
| `spine doctor` | Metrics file advisory |
| `spine help` | Document `tasks` subcommand group |

### 10.4 v1.4 deferred (document only)

| Command | Purpose |
|---------|---------|
| `spine settings suggest-models` | Print model recommendations from metrics aggregates |
| `spine explore <slug>` | Optional CLI wrapper for explore template (skill remains primary) |

---

## 11. Agent contracts and prompts

### 11.1 Worker ([`templates/agents/worker.md`](../templates/agents/worker.md))

Add after step completion sequence:

1. When Review Level ≥ 1 and `review.requireFinalVerdict`: run `spine_review_step --type final` (or CLI equivalent) **after** Testing step passes and **before** creating `.DONE`.
2. On final `REVISE`: address feedback, re-run final review (do not create `.DONE` until `PASS`).
3. On final `REPLAN`: stop; update STATUS Blockers with reviewer feedback; exit non-zero; do not create `.DONE`.

### 11.2 Reviewer ([`templates/agents/reviewer.md`](../templates/agents/reviewer.md))

Add section **Final verdict (`--type final`)**:

- Return `PASS` when task meets PROMPT Completion Criteria and tests/coverage gates.
- Return `REVISE` when implementation is fixable without PROMPT changes.
- Return `REPLAN` when scope, approach, or dependencies in PROMPT are wrong — cite specific PROMPT sections.
- JSON: `{ "verdict": "PASS"|"REVISE"|"REPLAN", "feedback": "..." }`

### 11.3 Review level matrix (extends Appendix C)

| Level | Step review | Final verdict |
|-------|-------------|---------------|
| 0 | None | Skipped |
| 1 | Plan per step | Required before `.DONE` |
| 2 | Plan + code per step | Required before `.DONE` |
| 3 | Plan + code + test per step | Required before `.DONE` |

---

## 12. Skill and adoption documentation

| Document | Action | FR |
|----------|--------|-----|
| [upstream-execution-workflow.md](adoption/upstream-execution-workflow.md) | **Create** (normative) | FR-UXB-01 |
| [bootstrap-checklist.md](adoption/bootstrap-checklist.md) | Add link + one paragraph | FR-UXB-01 |
| [operator-runbook.md](adoption/operator-runbook.md) | Add validate, handoff, needs_replan sections | FR-UXB-02,04,05 |
| [create-spine-tasks/SKILL.md](../skills/create-spine-tasks/SKILL.md) | Step 0 Explore + final verdict in PROMPT guidance | FR-UXB-03,04 |
| [create-spine-tasks/references/explore-template.md](../skills/create-spine-tasks/references/explore-template.md) | **Create** | FR-UXB-03 |
| [README.md](../README.md) | Documentation table entry | FR-UXB-01 |

---

## 13. Reconciliation and diagnosis extensions

### 13.1 New diagnosis: `needs_replan`

Extends FR-BATCH-13 taxonomy.

| Field | Value |
|-------|-------|
| `diagnosis` | `needs_replan` |
| Trigger | Any task with `exitReason: needs_replan` or last final verdict `REPLAN` |
| `headline` | `Task {id} needs replan — edit PROMPT.md before retry` |
| `suggestedCommand` | `spine batch retry {taskId}` after PROMPT edit (or manual edit first) |
| `alternatives` | `["spine batch skip {taskId}", "spine handoff"]` |

### 13.2 Precedence rules

When multiple signals apply:

1. `needs_replan` takes precedence over `needs_retry` for the same task when `exitReason` is `needs_replan`
2. `needs_replan` blocks `needs_merge` and `needs_integrate` until task retried or skipped
3. Plain `needs_retry` unchanged for non-replan failures

### 13.3 Operator messaging example

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

## 14. Testing and verification

### 14.1 New test files

| File | Covers |
|------|--------|
| `tests/tasks/validate-cli.test.mjs` | FR-UXB-02 CLI, JSON, exit codes |
| `tests/spine-preflight.test.mjs` (extend) | `tasks-validate` check |
| `tests/batch/final-verdict.test.mjs` | FR-UXB-04 PASS/REVISE/REPLAN, cap, merge block |
| `tests/batch/review.test.mjs` (extend) | `parseReviewVerdict` final types |
| `tests/cli/spine-handoff.test.mjs` | FR-UXB-05 content, no secrets |
| `tests/batch/run-metrics.test.mjs` | FR-UXB-06 JSONL append, show filter |
| `tests/compat/final-verdict-reconcile.test.mjs` | `needs_replan` diagnosis |

### 14.2 Fixtures

| Fixture | Purpose |
|---------|---------|
| `test/fixtures/taskplane/FX-invalid-no-testing/` | Validate fails missing Testing |
| `test/fixtures/taskplane/FX-final-replan/` | PROMPT with level ≥1 for REPLAN path |
| `tests/fixtures/handoff-golden.md` | Snapshot handoff structure |

### 14.3 Regression requirements

- All existing tests green with `SPINE_WORKER_STUB=1`
- `tests/batch/review.test.mjs` step APPROVE/REVISE unchanged
- Coverage ≥77% on new `src/` and `bin/` modules

### 14.4 Manual verification checklist

- [ ] Run workflow doc spine-native path on adoption fixture
- [ ] `spine tasks validate pending` before real-pi batch
- [ ] Trigger REPLAN in stub reviewer; confirm `needs_replan`
- [ ] `spine handoff` after pause; resume from suggested command

---

## 15. Implementation phases

### Wave A — Documentation (no code)

| Task | FR | Est. |
|------|-----|------|
| Ship upstream-execution-workflow.md | FR-UXB-01 | S |
| README + bootstrap + runbook cross-links | FR-UXB-01 | S |
| This PRD addendum (this document) | All | M |

**Exit:** M-UXB-01 satisfied.

### Wave B — Validate + Explore

| Task | FR | Est. |
|------|-----|------|
| `spine tasks validate` CLI + tests | FR-UXB-02 | M |
| Preflight `tasks-validate` check | FR-UXB-02 | S |
| `/spine-validate` slash | FR-UXB-02 | S |
| create-spine-tasks Step 0 + explore template | FR-UXB-03 | M |

**Exit:** M-UXB-02, M-UXB-03 satisfied.

### Wave C — Handoff

| Task | FR | Est. |
|------|-----|------|
| `spine handoff` CLI + journal event | FR-UXB-05 | M |
| `/spine-handoff` slash | FR-UXB-05 | S |
| Operator runbook handoff section | FR-UXB-05 | S |

**Exit:** M-UXB-05 satisfied.

### Wave D — Final verdict + Metrics

| Task | FR | Est. |
|------|-----|------|
| Final review type + verdict parsing | FR-UXB-04 | L |
| Engine REPLAN / needs_replan reconcile | FR-UXB-04 | M |
| Worker/reviewer template updates | FR-UXB-04 | S |
| run-metrics.jsonl writer | FR-UXB-06 | M |
| `spine metrics show` | FR-UXB-06 | S |
| Doctor advisory | FR-UXB-06 | S |

**Exit:** M-UXB-04, M-UXB-06, M-UXB-07 satisfied.

### Dependency graph

```text
Wave A ──► Wave B ──► Wave C ──► Wave D
```

---

## 16. Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep into full SDD/`/forge` | High | Locked non-goals §3.2; compose via docs |
| Final verdict breaks step review | High | Separate `--type final`; separate JSON enum |
| `needs_replan` vs `needs_retry` confusion | Medium | Distinct `exitReason`; precedence §13.2 |
| Duplicate validate logic | Medium | Single `validatePrompt` entry point |
| Metrics JSONL unbounded growth | Low | Document rotation in v1.4; `metrics.maxLines` optional |
| Stale explore findings | Medium | CONTEXT date + skill "re-explore when main diverged" |
| Handoff contains secrets | High | NFR-UXB-02; snapshot test |

---

## 17. Appendices

### Appendix A: Verdict mapping (zero-pi ↔ pi-spine)

| zero-pi (veredicto) | pi-spine final | Step review |
|---------------------|----------------|-------------|
| `pasa` | `PASS` | `APPROVE` |
| `corregir` | `REVISE` | `REVISE` |
| `replantear` | `REPLAN` | (use final only) |

### Appendix B: Example handoff note

```markdown
# pi-spine operator handoff

**Generated at:** 2026-06-10T14:32:00Z
**Batch ID:** 20260610T140000

## Diagnosis
**paused** — 2 tasks pending

## Suggested command
spine batch resume

## Alternatives
- spine status --diagnose
- spine handoff

## Pending tasks
- SP-043 (lane 1, running → pending)
- SP-044 (lane 2, pending)

## Lane summary
| Lane | Status | Tasks |
|------|--------|-------|
| 1 | running | SP-043 |
| 2 | pending | SP-044 |

## Journal tail
- 2026-06-10T14:30:00Z batch.paused
- 2026-06-10T14:28:00Z task.step_completed SP-043
- 2026-06-10T14:20:00Z lane.heartbeat lane-1

## Restore
1. spine status --diagnose
2. spine batch resume
```

### Appendix C: Example metrics JSONL lines

```json
{"recordType":"task","schemaVersion":1,"batchId":"20260610T140000","taskId":"SP-042","agentRole":"worker","model":"inherit","thinking":"high","startedAt":"2026-06-10T14:00:00.000Z","endedAt":"2026-06-10T14:45:00.000Z","outcome":"completed","reviewLevel":2,"finalVerdict":"PASS","finalAttempts":1,"stallKilled":false}
{"recordType":"batch","schemaVersion":1,"batchId":"20260610T140000","endedAt":"2026-06-10T15:00:00.000Z","diagnosis":"needs_integrate","taskCount":2,"completedTasks":2,"failedTasks":0,"durationMs":3600000}
```

### Appendix D: Implementation anchors (code map)

| Concern | Primary files |
|---------|---------------|
| PROMPT validation | `src/tasks/packet/parse-prompt.mjs`, `validate-prompt.mjs` |
| Planner scope | `src/planner/index.mjs` |
| Preflight | `bin/spine-preflight.mjs` |
| Step review | `src/batch/review.mjs` |
| Reconciliation | `src/batch/reconcile.mjs`, `diagnosis.mjs` |
| Journal | `src/batch/journal.mjs` |
| Batch history | `src/batch/lifecycle.mjs`, `state.mjs` |
| Slash commands | `extensions/spine/slash-commands.ts` |

---

## 18. Engineering start checklist

After PRD approval, engineering proceeds in wave order:

1. **Wave A** — Merge workflow doc + cross-links (no `src/` changes).
2. **Wave B** — First command to implement: `spine tasks validate pending`.
3. **Regression gate** — `npm run typecheck && SPINE_WORKER_STUB=1 npm test` after each wave.
4. **Decompose waves** into `spine-tasks/SP-*` packets using [create-spine-tasks](../skills/create-spine-tasks/SKILL.md).
5. **Do not** add `@gonrocca/zero-pi` to `package.json`.
6. **v1.4 tracking** — `spine settings suggest-models`, `handoff.autoWriteOn`, metrics rotation (separate brief).

**First stub-free validation target:** adoption fixture `AD-001-smoke` passes `spine tasks validate` before batch start.

---

*End of PRD v1.3 addendum. Base PRD v1.2 remains authoritative for all unlisted behavior.*
