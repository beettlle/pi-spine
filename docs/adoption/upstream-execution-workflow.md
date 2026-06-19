# Upstream ↔ execution workflow

**Audience:** Operators and task authors using pi-spine on real projects  
**Normative spec:** [PRD v1.3 addendum](../PRD-v1.3-upstream-execution-bridge.md) (FR-UXB-01)  
**Related:** [bootstrap-checklist.md](./bootstrap-checklist.md), [operator-runbook.md](./operator-runbook.md), [create-spine-tasks skill](../../skills/create-spine-tasks/SKILL.md)

pi-spine runs **batches** from task packets. This guide explains how work gets **into** those packets — with or without optional upstream tools ([zero-pi](https://pi.dev/packages/@gonrocca/zero-pi), [GitHub spec-kit](https://github.com/github/spec-kit)) — and how to hand off to `spine batch start` safely.

**pi-spine does not invoke zero-pi or spec-kit.** Upstream tools may be installed separately; they do not share state with pi-spine (`.spine/` vs `.sdd/` vs `.specify/`).

---

## Choose your path

| Path | When to use | Upstream tool | Tasks root |
|------|-------------|---------------|------------|
| **Spine-native** | You have a PRD, brief, or clear feature scope | `create-spine-tasks` skill | `spine-tasks/` (greenfield) |
| **zero-pi optional** | You want SDD explore/plan before packets | zero-pi `/forge` then manual/skill conversion | Same as spine-native |
| **Taskplane migrant** | Existing `taskplane-tasks/` folders | None (reuse packets) | `taskplane-tasks/` |
| **spec-kit optional** | You want constitution → spec → plan → tasks before packets | [spec-kit](https://github.com/github/spec-kit) `/speckit.*` then manual/skill conversion | Same as spine-native |

### Decision tree

```text
Do you already have PROMPT.md / STATUS.md packets?
├── Yes → spine migrate-from-taskplane (if needed) → spine tasks validate → spine batch start
└── No
    ├── Brownfield / large epic / unclear file scope?
    │   └── Optional explore (Step 0) → create-spine-tasks → validate → batch
    ├── Using zero-pi for this feature?
    │   └── /forge explore+plan → copy tasks/design into PROMPT packets → validate → batch
    ├── Using spec-kit for this feature?
    │   └── /speckit.constitution → specify → clarify → plan → tasks → convert to PROMPT packets → validate → batch
    └── Greenfield / small scope?
        └── create-spine-tasks from PRD → validate → batch
```

---

## Artifact handoff map

| Stage | zero-pi (optional) | spec-kit (optional) | pi-spine (required) |
|-------|-------------------|---------------------|---------------------|
| Principles / constitution | (none — use project docs) | `.specify/memory/constitution.md` | `docs/constitution.md` (optional `spine init` template) |
| Exploration | `.sdd/` run explore findings | `specs/<feature>/spec.md` (after `/speckit.specify`) | `{tasksRoot}/_explore/{slug}/findings.md` |
| Clarify / plan | `.sdd/` plan artifacts | `specs/<feature>/plan.md` (after `/speckit.clarify`, `/speckit.plan`) | `PROMPT.md` Mission + Context to Read First |
| Plan / tasks list | `.sdd/` tasks artifacts | `specs/<feature>/tasks.md` (after `/speckit.tasks`) | `PROMPT.md` steps + `dependencies.json` |
| Execution state | Run slug under `.sdd/` | `.specify/` session state (authoring only) | `STATUS.md`, `.DONE`, `.reviews/` |
| Orchestration | (none — zero-pi is single-run) | (none — spec-kit is single-feature authoring) | `.spine/batch-state.json`, journal, gates |
| Operator continuity | `.pi/zero-resume.md` (pi session) | Feature branch + spec-kit artifacts on disk | `.spine/handoff.md` (batch operator) |

**Conversion rule:** zero-pi and spec-kit outputs are **inputs to authoring**, not auto-imported. A human or the `create-spine-tasks` skill turns plan/tasks into spine packets.

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
3. **Validate and analyze** (v1.3) — complete the [authoring approval checklist](./authoring-approval-checklist.md) before batch start:
   ```bash
   spine tasks validate pending
   spine tasks analyze pending   # structural: overlap, cycles, wave M-count, explore refs, deps drift
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

## Path 4 — spec-kit optional upstream

Install [spec-kit](https://github.com/github/spec-kit) separately (`specify init` or project bootstrap per spec-kit docs); pi-spine does not depend on the `specify` CLI or `.specify/` state.

### Steps

1. **Constitution** (spec-kit) — establish project principles:
   ```text
   /speckit.constitution
   ```
   Output: `.specify/memory/constitution.md` (or project-adapted path). Optionally align with `docs/constitution.md` from `spine init`.
2. **Specify** — draft the feature spec:
   ```text
   /speckit.specify "feature description"
   ```
   Output: `specs/<feature>/spec.md`
3. **Clarify** — resolve ambiguities before planning:
   ```text
   /speckit.clarify
   ```
4. **Plan** — technical plan from the spec:
   ```text
   /speckit.plan
   ```
   Output: `specs/<feature>/plan.md`
5. **Tasks** — ordered work breakdown:
   ```text
   /speckit.tasks
   ```
   Output: `specs/<feature>/tasks.md`
6. **Convert** — from spec-kit artifacts, author spine packets:
   - Constitution + spec → task Mission and Context to Read First
   - `plan.md` → File Scope hints and technical constraints per task
   - `tasks.md` → multiple `SP-*` folders via `create-spine-tasks` (manual mapping or skill-assisted)
7. **Spine-only from here:**
   ```bash
   spine tasks validate pending
   spine preflight
   spine batch start pending
   ```

### Feature-branch handoff during authoring

Spec-kit authoring often happens on a feature branch while batch execution targets the same branch or a follow-up integration branch. Before `spine batch start`:

- Commit or stash spec-kit artifacts (`specs/`, `.specify/`) so workers see stable inputs listed in `## Context to Read First`.
- Do not assume pi-spine workers run `/speckit.*` commands — packets must be self-contained.

### What not to do

- Do not add `specify` or spec-kit as a pi-spine npm dependency.
- Do not auto-import `specs/<feature>/tasks.md` into spine packets — conversion is manual or skill-assisted.
- Do not run `/speckit.implement` and `spine batch start` on the same checkout concurrently.
- Do not expect pi-spine to read `.specify/` or `specs/` automatically.
- Do not treat spec-kit task IDs as spine task IDs — author `SP-*` packets with explicit File Scope.

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

### Spec persistence when requirements change

pi-spine does not auto-sync upstream specs with in-flight packets. Teams choose how to handle scope changes:

| Model | Summary | Typical pi-spine action |
|-------|---------|-------------------------|
| **Flow-forward** (default) | New task folder per change; parents get `.SUPERSEDED` | New `SP-*` folders; update `CONTEXT.md` / `dependencies.json` |
| **Living spec** | Edit PRD or spec-kit `spec.md`; regenerate packets | `create-spine-tasks` → `spine tasks validate pending` |
| **Flow-back** | Any artifact may lead; reconcile manually | `PROMPT.md` amendments, `needs_replan` → edit PROMPT → `spine batch retry` |

See [spec-persistence.md](./spec-persistence.md) for when-to-use guidance and the operator decision table.

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

## Coexistence with zero-pi, spec-kit, and Taskplane

| Tool | State location | Concurrent batch? |
|------|----------------|-------------------|
| pi-spine | `.spine/` | One active spine batch per repo |
| Taskplane | `.pi/batch-state.json` | **No** — mutual exclusion |
| zero-pi | `.sdd/`, `~/.pi/zero.json` | Independent; avoid parallel edits to same files |
| spec-kit | `.specify/`, `specs/<feature>/` | Independent; avoid `/speckit.implement` during `spine batch start` |

`spine doctor` and `spine preflight` warn when Taskplane has an active batch. Spec-kit and zero-pi state are invisible to pi-spine — reference artifact paths explicitly in task packets.

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

- [authoring-approval-checklist.md](./authoring-approval-checklist.md) — human pre-batch gates (authoring vs execution)
- [spec-persistence.md](./spec-persistence.md) — flow-forward, living spec, flow-back models
- [PRD v1.3 addendum](../PRD-v1.3-upstream-execution-bridge.md) — full FR-UXB specs
- [operator-runbook.md](./operator-runbook.md) — daily procedures
- [bootstrap-checklist.md](./bootstrap-checklist.md) — first-time setup
- [zero-pi package](https://pi.dev/packages/@gonrocca/zero-pi) — upstream SDD (optional)
- [GitHub spec-kit](https://github.com/github/spec-kit) — constitution → spec → plan → tasks (optional)
