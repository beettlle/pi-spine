# Upstream ↔ execution workflow

**Audience:** Operators and task authors using pi-spine on real projects  
**Normative spec:** [PRD v1.3 addendum](../PRD-v1.3-upstream-execution-bridge.md) (FR-UXB-01)  
**Related:** [bootstrap-checklist.md](./bootstrap-checklist.md), [operator-runbook.md](./operator-runbook.md), [create-spine-tasks skill](../../skills/create-spine-tasks/SKILL.md)

pi-spine runs **batches** from task packets. This guide explains how work gets **into** those packets — with or without [zero-pi](https://pi.dev/packages/@gonrocca/zero-pi) upstream — and how to hand off to `spine batch start` safely.

**pi-spine does not invoke zero-pi.** Both packages may be installed on the same machine; they do not share state (`.spine/` vs `.sdd/`).

---

## Choose your path

| Path | When to use | Upstream tool | Tasks root |
|------|-------------|---------------|------------|
| **Spine-native** | You have a PRD, brief, or clear feature scope | `create-spine-tasks` skill | `spine-tasks/` (greenfield) |
| **zero-pi optional** | You want SDD explore/plan before packets | zero-pi `/forge` then manual/skill conversion | Same as spine-native |
| **Taskplane migrant** | Existing `taskplane-tasks/` folders | None (reuse packets) | `taskplane-tasks/` |

### Decision tree

```text
Do you already have PROMPT.md / STATUS.md packets?
├── Yes → spine migrate-from-taskplane (if needed) → spine tasks validate → spine batch start
└── No
    ├── Brownfield / large epic / unclear file scope?
    │   └── Optional explore (Step 0) → create-spine-tasks → validate → batch
    ├── Using zero-pi for this feature?
    │   └── /forge explore+plan → copy tasks/design into PROMPT packets → validate → batch
    └── Greenfield / small scope?
        └── create-spine-tasks from PRD → validate → batch
```

---

## Artifact handoff map

| Stage | zero-pi (optional) | pi-spine (required) |
|-------|-------------------|---------------------|
| Exploration | `.sdd/` run explore findings | `{tasksRoot}/_explore/{slug}/findings.md` |
| Plan / tasks list | `.sdd/` plan, tasks artifacts | `PROMPT.md` steps + `dependencies.json` |
| Execution state | Run slug under `.sdd/` | `STATUS.md`, `.DONE`, `.reviews/` |
| Orchestration | (none — zero-pi is single-run) | `.spine/batch-state.json`, journal, gates |
| Operator continuity | `.pi/zero-resume.md` (pi session) | `.spine/handoff.md` (batch operator) |

**Conversion rule:** zero-pi outputs are **inputs to authoring**, not auto-imported. A human or the `create-spine-tasks` skill turns plan/tasks into spine packets.

---

## Path 1 — Spine-native (recommended default)

### Prerequisites

- `spine init` and `spine doctor` green
- PRD or feature brief path
- pi with `create-spine-tasks` skill (`pi install /path/to/pi-spine -l`)

### Steps

1. **Optional explore (brownfield)** — in pi:
   ```text
   Use create-spine-tasks: Step 0 explore for feature X.
   Write findings to spine-tasks/_explore/feature-x/findings.md (read-only).
   ```
2. **Decompose** — in pi:
   ```text
   Use create-spine-tasks to break docs/PRD.md into M-sized SP-* tasks
   under spine-tasks/. Update CONTEXT.md and dependencies.json.
   ```
3. **Validate** (v1.3):
   ```bash
   spine tasks validate pending
   spine plan pending
   ```
4. **Preflight and run:**
   ```bash
   spine preflight
   spine batch start pending
   ```
5. **Land loop** — see [operator-runbook.md](./operator-runbook.md): status → gate → integrate → complete.

---

## Path 2 — zero-pi optional upstream

Install zero-pi separately (`pi install npm:@gonrocca/zero-pi`); pi-spine does not depend on it.

### Steps

1. **Forge** (zero-pi) — explore and plan for the feature:
   ```text
   /forge "feature description"
   ```
2. **Extract** — from `.sdd/` run artifacts, copy:
   - Requirements / design → task Mission sections
   - Ordered task list → multiple `SP-*` folders or one epic split via skill
   - File paths from explore → `## File Scope` per task
3. **Author packets** — use `create-spine-tasks` with zero-pi artifacts as "Context to Read First" (paths under `.sdd/` or pasted summaries).
4. **Spine-only from here:**
   ```bash
   spine tasks validate pending
   spine preflight
   spine batch start pending
   ```

### What not to do

- Do not run `/forge` build and `spine batch start` on the same checkout concurrently.
- Do not expect pi-spine to read `.sdd/` automatically.
- Do not use zero-pi `pasa` as a substitute for spine integrate gates — spine still requires `spine gate approve` when configured.

---

## Path 3 — Taskplane migrant

1. `spine migrate-from-taskplane` or `spine init --tasks-root taskplane-tasks`
2. `spine doctor` — resolve Taskplane coexistence warnings
3. `spine tasks validate pending`
4. `spine plan pending` — compare to last `/orch-plan` if desired
5. `spine batch start pending` — **do not** run Taskplane `/orch` on the same repo concurrently

---

## Validation before every batch (v1.3)

`spine tasks validate` catches PROMPT errors that otherwise surface as `prompt_parse_failed` at worker launch.

```bash
spine tasks validate pending          # human output
spine tasks validate pending --json   # automation
```

Common failures:

| Error | Fix |
|-------|-----|
| Missing Testing step | Add `### Step N: Testing & Verification` per [SP-119](../incidents/) / skill template |
| Invalid heading | Use em dash: `# Task: SP-042 — Name` |
| Size XL | Split into multiple M tasks |

Preflight includes a `tasks-validate` check when v1.3 is implemented.

---

## Final verdict and replan (v1.3)

When Review Level ≥ 1, workers run a **final** review before `.DONE`:

| Verdict | Meaning | Operator action |
|---------|---------|-----------------|
| `PASS` | Task verified | Batch continues |
| `REVISE` | Fix implementation | Worker retries; auto up to `maxFinalAttempts` |
| `REPLAN` | Wrong PROMPT scope | Edit `PROMPT.md`, then `spine batch retry <id>` |

`spine status` shows `needs_replan` when replan is required.

---

## Operator handoff (v1.3)

When your pi session or IDE restarts mid-batch:

```bash
spine handoff              # write .spine/handoff.md
spine next                 # suggested command
spine batch resume         # if paused
```

Handoff summarizes diagnosis, pending tasks, and journal tail — not full conversation history (see zero-pi `/zero-resume` for session-level handoff).

---

## Run metrics (v1.3)

After batches complete:

```bash
spine metrics show
spine metrics show --batch 20260610T140000 --json
```

Use metrics to compare models and task outcomes over time. v1.3 collects data only; model suggestions are v1.4.

---

## Coexistence with zero-pi and Taskplane

| Tool | State location | Concurrent batch? |
|------|----------------|-------------------|
| pi-spine | `.spine/` | One active spine batch per repo |
| Taskplane | `.pi/batch-state.json` | **No** — mutual exclusion |
| zero-pi | `.sdd/`, `~/.pi/zero.json` | Independent; avoid parallel edits to same files |

`spine doctor` and `spine preflight` warn when Taskplane has an active batch.

---

## Quick reference

```bash
# Author → validate → run
spine tasks validate pending
spine preflight
spine batch start pending
spine status --diagnose

# Pause / resume / handoff
spine batch pause
spine handoff
spine batch resume

# Replan path
# 1. edit PROMPT.md
spine batch retry SP-042
spine batch resume

# Land
spine gate approve
spine integrate
spine batch complete
```

---

## Further reading

- [PRD v1.3 addendum](../PRD-v1.3-upstream-execution-bridge.md) — full FR-UXB specs
- [operator-runbook.md](./operator-runbook.md) — daily procedures
- [bootstrap-checklist.md](./bootstrap-checklist.md) — first-time setup
- [zero-pi package](https://pi.dev/packages/@gonrocca/zero-pi) — upstream SDD (optional)
