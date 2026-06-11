# pi-spine — Product Requirements Document (PRD) v2.0

**Document type:** Product Requirements Document (Full Specification)  
**Product:** pi-spine (evolution to Contract-Driven Orchestration)  
**Version:** 2.0 (Unified Specification)  
**Status:** Draft — ready for implementation  
**Parent Concept:** Composition of `zero-pi` (Spec-driven) and `pi-spine` (Execution/Orchestration)

---

## 1. Executive Summary

### 1.1 Vision
The current state of `pi-spine` (v1.2) is a powerful **Batch Orchestrator**: it manages parallel worktrees, maintains an append-only journal, and provides human gates for integration. However, it treats task packets (`PROMPT.md`) as *instructions*—semi-structured text meant for LLM reading.

**pi-spine v2.0** evolves from a "Batch Orchestrator" to a **"Contract-Driven Orchestration" (CDO) Engine**. 

In the CDO model, a task is no longer just a set of instructions; it is a **Contract**. A task is only "Complete" when the agent can prove, via machine-verifiable evidence, that it has fulfilled the specific constraints defined in the task's contract. This evolution bridges the gap between **Upstream Spec-Driven Development (SDD)** (the *intent*) and **Downstream Batch Execution** (the *realization*).

### 1.2 The Core Value Proposition: "Spec-to-Execution"
By adopting the patterns of `zero-pi` (without the dependency), `pi-spine` v2.0 provides a rigorous pipeline:
**[Spec/Contract] $\rightarrow$ [Validation] $\rightarrow$ [Execution] $\rightarrow$ [Verification/Verdict] $\rightarrow$ [Integration/Resolution]**

---

## 2. Product Goals & Success Metrics

### 2.1 Primary Goals
1.  **Formalize the Contract:** Introduce a `CONTRACT` section in task packets (machine-verifiable success criteria like tests, file changes, and coverage).
2.  **Implement Final Verdicts:** Replace the binary "done/not done" with a three-state verdict: `PASS` (fulfilled contract), `REVISE` (implementation errors), and `REPLAN` (specification/scope errors).
3.  **Automate Validation:** Provide a robust CLI and pre-flight mechanism to ensure all tasks are "runnable" before any worker is spawned.
4.  **Bridge the Operator Gap:** Provide an "Handoff" mechanism that summarizes batch state for human operators to prevent context loss during session restarts.
5.  **Build an Observability Feedback Loop:** Collect run-metrics to enable future "model tuning" (recommending specific models for specific task shapes).

### 2.2 Success Metrics
*   **M1 (Validation):** 100% of `prompt_parse_failed` errors are caught by `spine tasks validate` before batch launch.
*   **M2 (Verdicts):** Zero "orphaned" tasks (tasks that are finished but the engine doesn't know if they succeeded or failed).
*   **M3 (Recovery):** 100% recovery rate for batches after IDE/session restart using `spine handoff` and `spine next`.
*   **M4 (Resolution):** `REPLAN` verdicts successfully trigger a `needs_replan` diagnosis that points to the exact `PROMPT.md` error.

---

## 3. System Architecture: The CDO Model

### 3.1 Component Diagram (Conceptual)

```text
[ USER / OPERATOR ]
       │
       ▼
[ UPSTREAM (SDC/zero-pi patterns) ]
       │  (Task Decomposition / Spec Authoring)
       ▼
[ TASK PACKET (The Contract) ] <───┐
(PROMPT.md + CONTRACT.md + STATUS.md)  │
       │                           │
       ▼                           │
[ PI-SPINE ENGINE ]               │
       │                           │
       ├─> [ VALIDATOR ] ─────────┘ (Pre-flight check)
       │
       ├─> [ SCHEDULER (Waves/Lanes) ]
       │
       ├─> [ WORKER (Executor) ] ───┐
       │                            │ (Proves contract fulfillment)
       └─> [ REVIEWER (Verifier) ] ─┘
       │
       ├─> [ VERDICT ENGINE ] ──────┘ (PASS | REVISE | REPLAN)
       │
       └─> [ RESOLVER (Integrator) ]
             (Merge | Retry | Replan)
```

### 3.2 Data Flow: The Life of a Task
1.  **Definition:** User defines task `SP-001` with `CONTRACT: { tests: "npm test", scope: ["src/api.ts"] }`.
2.  **Validation:** `spine tasks validate` checks if the contract is syntactically valid and the test command exists.
3.  **Execution:** Worker executes `PROMPT.md`.
4.  **Verification:** Upon task completion, the Reviewer runs the contracted `test` command and checks `File Scope` changes.
5.  **Verdict:** 
    *   If tests pass and scope matches $\rightarrow$ `PASS`.
    *   If tests fail but code is logically sound $\rightarrow$ `REVISE`.
    *   If the agent finds the contract is impossible/wrong $\rightarrow$ `REPLAN`.
6.  **Reconciliation:** The Engine updates the batch state. If `REPLAN`, it signals the operator.

---

## 4. Functional Requirements

### 4.1 Task Packet Evolution (The "Contract")
Tasks must now contain a mandatory `## Contract` section.

| Field | Description | Machine-Verifiable Check |
| :--- | :--- | :--- |
| **Test Command** | The command to run to verify implementation. | Exit code `0` |
| **File Scope** | Exact file paths that *must* or *must not* change. | `git diff` matching regex/globs |
| **Coverage** | Minimum acceptable coverage (e.g., 80%). | Coverage report parser |
| **Artifacts** | Specific files/outputs that must exist. | `fs.existsSync` |

### 4.2 The Verdict Loop (The "Verifier")
The `Reviewer` role is upgraded from a "code checker" to a "contract verifier."

| Verdict | Agent Action | Engine Action |
| :--- | :--- | :--- |
| **`PASS`** | Reports completion of contract. | Task $\rightarrow$ `completed`. Advance wave. |
| **`REVISE`** | Identifies fixable errors (e.g., test failure). | Task $\rightarrow$ `failed`. Worker re-invokes. |
| **`REPLAN`** | Identifies fundamental mismatch in task spec. | Task $\rightarrow$ `failed` (`needs_replan`). Block merge. |

### 4.3 New CLI & Slash Commands
*   `spine tasks validate <scope>`: Validates all task packets in a scope against the `CONTRACT` schema.
*   `spine handoff`: Generates `.spine/handoff.md` containing the current batch state, diagnosis, and "Next Action" (e.g., `spine batch resume`).
*   `spine metrics show [--batch ID]`: Displays accumulated performance/verdict data from `.spine/run-metrics.jsonl`.
*   `/spine-validate [scope]`: Slash command for validation.
*   `/spine-handoff`: Slash command for state capture.

### 4.4 Reconciliation & Diagnosis
The `reconcile()` function must now handle the `needs_replan` state.
*   **`needs_replan` Diagnosis:** If a task results in a `REPLAN` verdict, the batch status must transition to `needs_replan`.
*   **Operator Guidance:** The diagnosis must explicitly suggest: `edit spine-tasks/SP-XXX/PROMPT.md` and then `spine batch retry SP-XXX`.

---

## 5. Data Model Extensions

### 5.1 Journal Extensions
New event types to track the decision-making process:
*   `task.verdict_recorded`: Payload includes `{ verdict: "PASS" | "REVISE" | "REPLAN", proof: "path/to/artifact" }`.
*   `handoff.written`: Payload includes `{ batchId, diagnosis, suggestedCommand }`.
*   `review.exhausted`: Triggered when `REVISE` loops exceed `maxFinalAttempts`.

### 5.2 Run Metrics Schema
Accumulated in `.spine/run-metrics.jsonl` for long-term analysis.

```json
{
  "recordType": "task",
  "batchId": "20260610T140000",
  "taskId": "SP-001",
  "outcome": "completed",
  "verdict": "PASS",
  "attempts": 1,
  "model": "anthropic/claude-3-5-sonnet",
  "durationMs": 450000,
  "testOutput": "... [truncated] ..."
}
```

---

## 6. Implementation Roadmap

### Phase 1: The Foundation (Validation & Handoff)
*   Update `validatePrompt` to include `CONTRACT` schema validation.
*   Implement `bin/spine-tasks.mjs` (CLI).
*   Implement `src/cli/handoff.mjs` and `/spine-handoff` slash command.

### Phase 2: The Verdict Loop (Verification)
*   Upgrade `Reviewer` agent prompts to include `contract` context.
*   Implement `REVISE` and `REPLAN` verdict parsing in `src/batch/review.mjs`.
*   Implement `REPLAN` diagnosis in `src/batch/reconcile.mjs`.

### Phase 3: The Feedback Loop (Metrics & Model Intelligence)
*   Implement `run-metrics.jsonl` writer in `src/batch/lifecycle.mjs`.
*   Implement `spine metrics show` CLI.
*   Integrate `metrics` into `spine-preflight` (advisory mode).

---

## 7. Appendix: Example `REPLAN` Scenario

1.  **Operator:** Runs `spine batch start all`.
2.  **Worker:** Fails to implement a specific complex logic in `SP-005`.
3.  **Reviewer:** Runs tests (contracted). Tests fail. Reviewer realizes the `PROMPT.md` instructions are mathematically impossible/contradictory.
4.  **Reviewer:** Returns `{ "verdict": "REPLAN", "feedback": "The current prompt asks for X, but the dependencies require Y. Update the logic to support Y." }`.
5.  **Engine:** Marks `SP-005` as `failed` (`exitReason: needs_replan`).
6.  **Operator:** Runs `spine status`.
7.  **Output:**
    ```text
    Diagnosis: needs_replan
    Headline: Task SP-005 needs replan — contract mismatch
    Suggested Command: edit spine-tasks/SP-005/PROMPT.md then spine batch retry SP-005
    ```
