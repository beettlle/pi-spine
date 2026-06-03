---
name: create-spine-tasks
version: 1.0.0
description: Decomposes PRDs and feature briefs into spine task packets (PROMPT.md, STATUS.md) under spine-tasks/ for autonomous execution via spine batch. Use when asked to "create a spine task", "decompose a PRD", "stage tasks for spine", "write PROMPT.md for spine", "create SP-* tasks", or queue work for spine workers.
---

# Create Spine Tasks

Creates structured task packets (`PROMPT.md` + `STATUS.md`) for autonomous execution via **pi-spine** (`spine batch start`, `/spine`). The spine engine handles waves, worktree lanes, checkpoint discipline, cross-model review, integrate gates, and the dashboard — so `PROMPT.md` stays focused on **what** to build, not **how** the orchestrator runs.

Works from a local pi-spine checkout (`pi install /path/to/pi-spine -l`). No npm publish required.

## Architecture

```
create-spine-tasks skill     → Creates PROMPT.md + STATUS.md (+ dependencies.json edits)
spine-orchestrator extension → Slash commands, batch guidance
spine CLI                      → batch start, plan, preflight, integrate, gates
  ├─ .spine/agents/worker.md   → Worker standing orders (checkpoint discipline)
  ├─ .spine/agents/reviewer.md → Reviewer rubric
  └─ .spine/spine-config.json  → tasks root, testing commands, lanes, gates
```

The skill only creates and updates task files. Execution behavior lives in pi-spine and the worker/reviewer agent prompts.

## Prerequisites

**If `.spine/spine-config.json` does not exist**, the project has not been initialized. Tell the user to run `spine init` first — the skill needs `paths.tasksRoot` (default `spine-tasks/`) and testing commands.

**Migrants from Taskplane:** `spine migrate-from-taskplane` or `spine init --tasks-root taskplane-tasks` keeps existing `TP-*` folders. Use the configured tasks root and ID prefix from `{tasksRoot}/CONTEXT.md`, not hard-coded `spine-tasks/`.

## Configuration

**Read `.spine/spine-config.json` first.** Primary keys:

| Key | Purpose |
|-----|---------|
| `paths.tasksRoot` | Task folder root (default `spine-tasks`) |
| `testing.test` / `testing.build` / `testing.testWithCoverage` | Test, build, and **coverage gate** commands for PROMPT.md verification (pi-spine default: `npm run coverage:check`, **≥77% line coverage**) |
| `referenceDocs` | Tier 3 docs for "Context to Read First" |
| `standards` | Project coding rules |
| `neverLoad` | Docs that must NOT appear in any task |

Override tasks root at runtime with `SPINE_TASKS_ROOT` (env > file).

---

## PRD → Task Decomposition

Use this workflow when the user supplies a PRD, epic brief, or feature spec instead of a single task description.

### Step A: Read sources

1. PRD / brief / epic doc (user-provided path)
2. `{tasksRoot}/CONTEXT.md` — current phase, **Next Task ID**, execution policy
3. Existing `{tasksRoot}/dependencies.json` and open task folders (avoid duplicate work)

### Step B: Slice into spine tasks

| Rule | Guidance |
|------|----------|
| **Size** | Target **M** (2–4 h). Split **XL** work into multiple tasks with dependencies. |
| **Scope** | One deliverable per task; disjoint **File Scope** when tasks can run in parallel. |
| **IDs** | Use `Next Task ID` from CONTEXT.md; increment after each new task. Greenfield spine projects typically use `SP-###`; Taskplane migrants may keep `TP-###`. |
| **Waves** | Order via `## Dependencies` and `{tasksRoot}/dependencies.json`. |
| **Review** | Score complexity (below). Do not default to Level 0 for implementation work. |

### Step C: Update tracking

After creating packets:

1. **`{tasksRoot}/CONTEXT.md`** — increment `Next Task ID`; add rows to the phase table for new tasks
2. **`{tasksRoot}/dependencies.json`** — add edges for every dependency (machine-parseable)
3. Report launch commands: `spine plan pending` then `spine batch start <id>`

**Example decomposition** (feature brief → three tasks):

| Task | Mission | Deps |
|------|---------|------|
| `SP-010-api-schema` | Add request/response types + validation | None |
| `SP-011-api-handlers` | Implement routes using schema | SP-010 |
| `SP-012-api-tests` | Integration tests + docs | SP-011 |

---

## Single-Task Creation Workflow

### Step 1: Determine location and next ID

1. Read `paths.tasksRoot` from `.spine/spine-config.json`
2. Read `{tasksRoot}/CONTEXT.md` → **Next Task ID** counter
3. Use that ID for the new folder; **increment the counter** in the same edit

If `CONTEXT.md` is missing (pre-init legacy repo), ask the user to run `spine init` or create `{tasksRoot}/CONTEXT.md` from [references/context-template.md](references/context-template.md).

### Step 2: Assess complexity and size

**You MUST score and assign review level before creating PROMPT.md.**

Quick reference (full rubric in [Complexity Assessment](#complexity-assessment)):

- Score each dimension 0–2: Blast radius, Pattern novelty, Security, Reversibility
- Sum → Level: 0–1→L0, 2–3→L1, 4–5→L2, 6–8→L3
- Size: S (<2h), M (2–4h), L (4–8h), XL (8h+ → must split)

**Do not default to Review Level 0.** Level 0 is only for trivial changes (doc typo, config knob). Most M-sized tasks score ≥2 and need at least Level 1.

### Step 3: Create task folder

```
{tasksRoot}/{PREFIX-###-slug}/
├── PROMPT.md
└── STATUS.md
```

Folder name must match the PROMPT heading ID (FR-TASK-01): `# Task: SP-042 — slug name`.

### Step 4: Create PROMPT.md

Use [references/prompt-template.md](references/prompt-template.md). Spine-specific requirements:

- **Environment** — include `npm run typecheck && SPINE_WORKER_STUB=1 npm test` when that is the project test command
- **Git Commit Convention** — `feat(SP-###): …` at step boundaries
- **Worker tools** — when Review Level > 0, steps must note `spine_review_step` after each step
- **Coverage gate** — when the task changes application code, add a coverage verification checkbox in the Testing step using `testing.testWithCoverage` (≥77% line coverage policy)
- **Completion** — worker creates `{task-folder}/.DONE`; batch engine may auto-commit remaining work

### Step 5: Create STATUS.md

Use the STATUS template in [references/prompt-template.md](references/prompt-template.md). Match PROMPT step structure; omit if the engine will auto-generate (prefer creating it).

### Step 6: Update dependencies (when needed)

If the task depends on others, update **both**:

- `## Dependencies` in PROMPT.md (orchestrator parses this)
- `{tasksRoot}/dependencies.json` (canonical graph for `spine plan`)

### Step 7: Report launch command

```bash
spine plan pending
spine preflight
SPINE_WORKER_STUB=1 spine batch start SP-042   # stub / CI
# SPINE_WORKER_STUB=0 spine batch start SP-042 # real pi workers
```

In pi: `/spine-plan pending` then `/spine SP-042` (single-task) or `spine batch start pending` for a wave.

---

## Complexity Assessment

### Review Levels

| Level | Label | Spine behavior |
|-------|-------|----------------|
| 0 | None | No `spine_review_step` |
| 1 | Plan Only | Plan review before each step (or checkpoint marker) |
| 2 | Plan + Code | Plan + code review at step boundaries |
| 3 | Full | Plan + code + test review |

Workers call **`spine_review_step`** (Pi tool) or `spine review step --step N [--type plan|code]`.

### Scoring (0–2 per dimension)

| Dimension | 0 (Low) | 1 (Medium) | 2 (High) |
|-----------|---------|------------|----------|
| **Blast radius** | Single file | Single module | Multiple modules/services |
| **Pattern novelty** | Existing patterns | Adapting patterns | New patterns |
| **Security** | No auth/data | Touches auth | Modifies auth/encryption |
| **Reversibility** | Easy revert | Needs migration | Data model change |

Score 0–1 → Level 0 · 2–3 → Level 1 · 4–5 → Level 2 · 6–8 → Level 3

### Per-step override and checkpoint markers

Individual steps can override the task-level review:

```markdown
### Step 3: Add RBAC middleware
> **Review override: code review** — This step touches authorization.
```

**Checkpoint markers** (`**Plan-review checkpoint**`, `**Code review checkpoint**`) consolidate reviews on single-deliverable tasks. Default is per-step reviews when steps are independent.

---

## Task Sizing

| Size | Duration | Action |
|------|----------|--------|
| **S** | < 2 hours | Create as-is |
| **M** | 2–4 hours | Ideal — create as-is |
| **L** | 4–8 hours | Split if possible |
| **XL** | 8+ hours | **Must split** with dependencies |

**Rule of thumb:** More than ~3 major implementation steps → split.

---

## Tiered Context Loading

| Tier | What | Loaded by |
|------|------|-----------|
| **1** | PROMPT.md + STATUS.md | Always |
| **2** | `{tasksRoot}/CONTEXT.md` | When listed in "Context to Read First" |
| **3** | Specific reference docs | Only what the task needs |

Populate "Context to Read First" from `referenceDocs` in spine config. Never list docs in `neverLoad`.

---

## STATUS.md Hydration

STATUS.md is the worker's memory between iterations. Match PROMPT.md granularity — outcome-level checkboxes, not line-by-line implementation scripts.

Use `⚠️ Hydrate` when items depend on runtime discovery:

```markdown
### Step 2: Handle migration
**Status:** ⬜ Not Started
> ⚠️ Hydrate: Expand based on schema gaps identified in Step 1

- [ ] Implement v1→v2 compatibility (details depend on Step 1 findings)
```

**Workers MUST NOT add, remove, or renumber steps at runtime.** Hydration expands checkboxes within existing steps only.

---

## Dependencies Format

The planner **machine-parses** dependencies — use exact patterns:

```markdown
## Dependencies

- **None**

- **Task:** SP-010 (schema types must exist)
- **External:** Docker compose stack running on port 8080
```

Also add to `{tasksRoot}/dependencies.json`:

```json
{
  "SP-011-api-handlers": ["SP-010-api-schema"]
}
```

Task IDs in JSON use the **folder slug** (full `SP-011-api-handlers`) or bare ID (`SP-011`) consistent with existing repo convention — match what `spine plan` already uses in that project.

---

## File Scope and parallel batches

`## File Scope` drives lane affinity. Overlapping scope → same lane (serial). Disjoint scope → parallel lanes.

When decomposing a PRD, assign non-overlapping file scopes to tasks that should run in parallel.

---

## Unsupported (spine v1)

Do **not** generate Taskplane polyrepo **`#### Segment: <repoId>`** markers — pi-spine is monorepo-only (PRD §13.2). Split multi-repo work into separate tasks with dependencies instead.

---

## Checklist (Definition of Ready)

Before reporting launch commands:

- [ ] `Next Task ID` read from CONTEXT.md and incremented
- [ ] Folder at `{tasksRoot}/{PREFIX-###-slug}/`
- [ ] Complexity scored; review level assigned (0–3)
- [ ] Size S/M/L — split if XL
- [ ] PROMPT.md from template: Mission, Dependencies, Context, File Scope, Steps, Do NOT, Git Commit Convention, Amendments
- [ ] STATUS.md with matching steps (hydration markers where needed)
- [ ] `dependencies.json` updated when task has deps
- [ ] CONTEXT.md phase table updated for PRD decompositions
- [ ] Launch: `spine plan pending` → `spine preflight` → `spine batch start <id>`

---

## Git Commit Convention

Workers commit at **step boundaries** with the task ID prefix:

- `feat(SP-042): complete Step 1 — init defaults`
- `fix(SP-042): handle missing config path`
- `hydrate: SP-042 expand Step 2 checkboxes`

Hydration commits (STATUS.md expansions) may happen mid-step for crash recovery.

---

## Key Principles

- **Self-contained PROMPT.md** — the worker has no memory of this conversation.
- **Testing step required** — use `testing.test` from spine config in the verification step; for **code deliverables**, include `testing.testWithCoverage` and a **≥77% line coverage** checkbox (see prompt template).
- **Documentation in every task** — "Must Update" / "Check If Affected" prevent doc drift.
- **Concrete deliverables** — name files to create/modify; avoid shortcuttable vague steps.
- **Local install** — skill ships with pi-spine; `pi install /path/to/pi-spine -l` loads `./skills`.

---

## References

- [references/prompt-template.md](references/prompt-template.md) — PROMPT.md and STATUS.md templates
- [references/context-template.md](references/context-template.md) — `{tasksRoot}/CONTEXT.md` scaffold
- [docs/PRD.md](../../docs/PRD.md) — task format spec (§13)
- [docs/adoption/bootstrap-checklist.md](../../docs/adoption/bootstrap-checklist.md) — greenfield setup
- [docs/adoption/operator-runbook.md](../../docs/adoption/operator-runbook.md) — execution policy
