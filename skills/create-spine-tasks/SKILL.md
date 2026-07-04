---
name: create-spine-tasks
version: 1.1.0
description: Decomposes PRDs and feature briefs into spine task packets (PROMPT.md, STATUS.md) under spine-tasks/ for autonomous execution via spine batch. Use when asked to "create a spine task", "decompose a PRD", "stage tasks for spine", "write PROMPT.md for spine", "create SP-* tasks", or queue work for spine workers.
---

# Create Spine Tasks

Creates structured task packets (`PROMPT.md` + `STATUS.md`) for autonomous execution via **pi-spine** (`spine batch start`, `/spine`). The spine engine handles waves, worktree lanes, checkpoint discipline, cross-model review, integrate gates, and the dashboard — so `PROMPT.md` stays focused on **what** to build, not **how** the orchestrator runs.

Works from a local pi-spine checkout (`pi install /path/to/pi-spine -l`) or after `pi install npm:pi-spine`.

## Architecture

```
PRD / brief
    │
    ├─ Lean authoring ─────────────────────────────────────────────┐
    │   Step 0? → Step A → Step B → Step C                       │
    │                                                             │
    └─ Full authoring ───────────────────────────────────────────┤
        Step 0? → A.5 clarify → A.6 checklist → B slice → C.5 analyze? → C
                                                                  │
create-spine-tasks skill     → PROMPT.md + STATUS.md (+ dependencies.json edits)
                             → optional _explore/ and _authoring/ artifacts
spine-orchestrator extension → Slash commands, batch guidance
spine CLI                      → tasks validate, tasks analyze, plan, batch start, gates
  ├─ .spine/agents/worker.md   → Worker standing orders (checkpoint discipline)
  ├─ .spine/agents/reviewer.md → Reviewer rubric
  └─ .spine/spine-config.json  → tasks root, testing commands, lanes, gates
```

The skill only creates and updates task files. Execution behavior lives in pi-spine and the worker/reviewer agent prompts. Authoring artifacts under `{tasksRoot}/_explore/` and `{tasksRoot}/_authoring/` inform decomposition — they are not batch engine input.

## Prerequisites

**If `.spine/spine-config.json` does not exist**, the project has not been initialized. Tell the user to run `spine init` first — the skill needs `paths.tasksRoot` (default `spine-tasks/`) and testing commands.

**Migrants from Taskplane:** `spine migrate-from-taskplane` or `spine init --tasks-root taskplane-tasks` keeps existing `TP-*` folders. Use the configured tasks root and ID prefix from `{tasksRoot}/CONTEXT.md`, not hard-coded `spine-tasks/`.

## Configuration

**Read `.spine/spine-config.json` first.** Primary keys:

| Key | Purpose |
|-----|---------|
| `paths.tasksRoot` | Task folder root (default `spine-tasks`) |
| `testing.test` / `testing.build` / `testing.testWithCoverage` | Test, build, and **coverage gate** commands for PROMPT.md verification (pi-spine default: `npm run coverage:check`, **≥77% line coverage**) |
| `referenceDocs` | Tier 3 docs for "Context to Read First" (also injected into worker tail when not in `neverLoad`) |
| `standards` | Explicit rule/doc paths; when `.cursor/rules/` exists these **append** after auto-selected rules (deduped) |
| `neverLoad` | Docs that must NOT appear in any task or worker context |

Override tasks root at runtime with `SPINE_TASKS_ROOT` (env > file).

---

## PRD → Task Decomposition

Use this workflow when the user supplies a PRD, epic brief, or feature spec instead of a single task description.

### Authoring modes

Pick **lean** or **full** before decomposition. Terminology aligns with [spec-kit presets](https://github.com/github/spec-kit): lean skips pre-slice quality gates; full runs clarify, checklist, and optional LLM analyze before slicing.

| Mode | Pipeline | When to use |
|------|----------|-------------|
| **Lean** | Optional Step 0 explore → Step A read → Step B slice → Step C track | Greenfield or brownfield with clear PRD paths; single S/M task; quick experiments; operator already validated requirements |
| **Full** | Step 0 (if brownfield) → Step A.5 clarify → Step A.6 checklist → Step B slice → optional Step C.5 analyze → Step C track | L/XL epics; ambiguous or conflicting requirements; security/compliance surface; parallel wave planning; production-grade decomposition |

**Lean** mirrors spec-kit's lean preset (Specify → Plan → Tasks): move from sources to packets with minimal upstream gates. **Full** mirrors the standard spec-kit path (adds Clarify, Checklist, and Analyze before implementation) — use skill Steps A.5/A.6/C.5 or external [Path 4 spec-kit](../../docs/adoption/upstream-execution-workflow.md#path-4--spec-kit-optional-upstream) upstream, then convert artifacts into spine packets.

Default to **lean** when the operator does not specify a mode and signals are weak. Switch to **full** when any row in the full-mode table applies.

### Step 0: Explore (optional — brownfield / large epics)

Run **before** Step A when decomposition needs codebase discovery. Authoring-only — `spine tasks validate` does **not** require explore artifacts.

**When to run:**

| Signal | Why explore helps |
|--------|-------------------|
| Brownfield repo | Unfamiliar modules; map touch points before File Scope |
| L/XL epic | Must split anyway; findings drive disjoint scopes per wave |
| File Scope uncertainty | PRD lacks concrete paths; investigate before slicing |
| Parallel wave planning | Need non-overlapping scopes for lane affinity |
| Post-refactor on `main` | Re-explore; mark prior findings `Status: superseded` |

**When to skip:**

- Greenfield with clear PRD and known paths
- Single S/M task with concrete `## File Scope` already
- Migrating existing Taskplane packets unchanged

**Constraints (read-only):**

- No commits; no file edits outside read targets
- Output path: `{tasksRoot}/_explore/{slug}/findings.md` (git-tracked by default)
- Findings inform `## File Scope` in downstream packets (Step B) — not batch engine input

**Workflow:**

1. Read-only investigation — search code, read docs, trace dependencies.
2. Write `{tasksRoot}/_explore/{slug}/findings.md` using [references/explore-template.md](references/explore-template.md) (v1.3 §6.3 schema: Summary, Codebase areas, Risks, Suggested file scopes, Open questions).
3. Link the slug in `{tasksRoot}/CONTEXT.md` — explore table row or `Explore complete: {slug}` with date and path.
4. Use **Suggested file scopes** from findings when slicing tasks in Step B.

See [docs/adoption/upstream-execution-workflow.md](../../docs/adoption/upstream-execution-workflow.md) for optional zero-pi upstream composition (pi-spine does not invoke zero-pi).

### Step A: Read sources

1. PRD / brief / epic doc (user-provided path)
2. `{tasksRoot}/CONTEXT.md` — current phase, **Next Task ID**, execution policy
3. Existing `{tasksRoot}/dependencies.json` and open task folders (avoid duplicate work)

### Step A.5: Clarify (optional — ambiguity pass before slice)

Run **after** Step A when using **full** authoring mode or when the PRD/brief needs ambiguity resolution before decomposition. Authoring-only — `spine tasks validate` does **not** require clarify artifacts.

External equivalent: [spec-kit `/speckit.clarify`](https://github.com/github/spec-kit) — see [Path 4](../../docs/adoption/upstream-execution-workflow.md#path-4--spec-kit-optional-upstream).

**When to run:**

| Signal | Why clarify helps |
|--------|-------------------|
| Ambiguous PRD / brief | Scope, acceptance criteria, or deps unclear before slicing |
| L/XL epic | Must split anyway; resolved decisions drive wave boundaries |
| Conflicting requirements | Multiple sources or stakeholders need reconciliation |
| Post-explore open questions | Step 0 findings left decomposition blockers |
| Full authoring pipeline | Operator wants clarify → checklist → slice before packets |

**When to skip:**

- **Lean** mode with unambiguous PRD and concrete paths
- Single S/M task with no open requirements questions
- Migrating existing Taskplane packets unchanged
- Prior `{tasksRoot}/_authoring/{slug}/clarify.md` still `Status: complete`

**Constraints (read-only on sources):**

- No commits; no file edits outside read targets and the clarify artifact
- Output path: `{tasksRoot}/_authoring/{slug}/clarify.md` (git-tracked by default)
- Clarify informs Step B slicing — not batch engine input

**Workflow:**

1. Read-only review — PRD/brief, explore findings (if any), CONTEXT.md.
2. Write `{tasksRoot}/_authoring/{slug}/clarify.md` using [references/clarify-template.md](references/clarify-template.md) (Summary, Open questions, Assumptions, Resolved decisions, Blockers for decomposition).
3. Link the slug in `{tasksRoot}/CONTEXT.md` — clarify table row or `Clarify complete: {slug}` with date and path.
4. Use **Resolved decisions** and resolved **Open questions** when slicing tasks in Step B.

### Step A.6 — Requirements checklist (optional)

Run **after Step A.5 — Clarify** and **before Step B — Slice**. Authoring-only — `spine tasks validate` does **not** require checklist artifacts.

**Purpose:** Validate requirement quality ("unit tests for requirements") before decomposition — inspired by spec-kit `/speckit.checklist`. Checks whether the PRD/brief is complete, measurable, and slice-ready; does **not** verify implementation.

**Output path:** `{tasksRoot}/_authoring/{slug}/checklist.md` using [references/requirements-checklist-template.md](references/requirements-checklist-template.md).

**When to run:**

| Signal | Why checklist helps |
|--------|---------------------|
| After clarify with open assumptions | Surfaces requirement gaps before slicing |
| L/XL epic or multi-task decomposition | Catches missing NFRs and edge cases early |
| Security- or compliance-touching work | Forces explicit auth/data handling in requirements |
| Vague acceptance language | Converts ambiguity into measurable criteria |
| Parallel wave planning | Ensures disjoint scopes are justified by clear requirements |

**When to skip:**

- Single S/M task with concrete File Scope and measurable acceptance criteria
- Greenfield with a short, unambiguous brief and no security surface
- Migrating existing spine packets unchanged
- Requirements already validated; no open items in `clarify.md`

**Workflow:**

1. Read PRD/brief, `clarify.md` (if present), and project standards referenced in the brief.
2. Write `{tasksRoot}/_authoring/{slug}/checklist.md` — cover acceptance criteria quality, security, edge cases, testability, and non-functional requirements (see template).
3. Resolve or explicitly defer `[Gap]` items before Step B; do **not** duplicate Step 0 explore `findings.md` (explore maps codebase; checklist validates requirements).
4. Link the slug in `{tasksRoot}/CONTEXT.md` when checklist informs decomposition.

**Authoring order:** clarify → checklist → slice (Step A.5 → A.6 → B).

### Step B: Slice into spine tasks

| Rule | Guidance |
|------|----------|
| **Size** | Target **M** (2–4 h). **L** → split when possible. **XL** → **must** split into multiple S/M tasks with dependencies. |
| **Steps** | Max **4** implementation steps per task (exclude Testing & Verification / Documentation & Delivery). More steps → split. |
| **Parallel waves** | Prefer **≤4** M-sized tasks per wave; 8-task mega-waves stall pi workers (see Phase 15 / SP-086–088). |
| **Scope** | One deliverable per task; disjoint **File Scope** when tasks can run in parallel. |
| **IDs** | Use `Next Task ID` from CONTEXT.md; increment after each new task. Greenfield spine projects typically use `SP-###`; Taskplane migrants may keep `TP-###`. |
| **Waves** | Order via `## Dependencies` and `{tasksRoot}/dependencies.json`. |
| **Review** | Score complexity (below). Do not default to Level 0 for implementation work. |

### Step C.5: Analyze (optional — LLM structural review after slice)

Run **after** Step B and **before** Step C when using **full** authoring mode and the operator wants an LLM-authored structural review of drafted packets. Authoring-only — `spine tasks validate` does **not** require analyze artifacts.

External equivalent: [spec-kit `/speckit.analyze`](https://github.com/github/spec-kit) — cross-artifact consistency check before implementation.

**Purpose:** Read-only review of drafted PROMPT/STATUS packets and dependency graph — wave sizing, scope overlap, missing deps, explore/authoring refs. Complements deterministic **`spine tasks analyze`** (CLI structural checks after decomposition).

**Output path:** `{tasksRoot}/_authoring/{slug}/analyze.md` — LLM-authored, read-only report (not batch engine input).

**When to run:**

| Signal | Why LLM analyze helps |
|--------|----------------------|
| Multi-task wave with ≥4 M-sized tasks | Catch scope overlap and wave stall risk before batch |
| First decomposition on a new epic slug | Sanity-check packet quality before operator approval |
| Full authoring pipeline | Close the loop after clarify → checklist → slice |
| Operator requests pre-batch review | Human gate before `spine batch start` |

**When to skip:**

- **Lean** mode or single S/M packet
- Operator will run only `spine tasks analyze pending` (deterministic CLI suffices)
- Packets already reviewed in a prior batch iteration

**Workflow:**

1. Read drafted task folders, `dependencies.json`, and any `_authoring/{slug}/clarify.md` or `checklist.md`.
2. Write `{tasksRoot}/_authoring/{slug}/analyze.md` — structural findings, wave recommendations, blocking issues for operator (resolve before batch).
3. Fix packet issues identified in analyze.md before Step C tracking updates.
4. After Step C, run **`spine tasks analyze pending`** for deterministic structural checks (wave M-count, explore refs, PROMPT/JSON deps drift).

### Step C: Update tracking

After creating packets:

1. **`{tasksRoot}/CONTEXT.md`** — increment `Next Task ID`; add rows to the phase table for new tasks
2. **`{tasksRoot}/dependencies.json`** — add edges for every dependency (machine-parseable)
3. Report launch commands: `spine tasks validate pending` (fix contract/PROMPT errors first), `spine tasks analyze pending` (structural checks — wave sizing, deps drift, explore refs), `spine plan pending`, then `spine batch start <id>`

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
- **Testing step (required for all tasks)** — every packet MUST include `### Step N: Testing & Verification` inside `## Steps`, placed **before** `## Completion Criteria`. This applies to **docs-only Review Level 0 tasks** as well — omitting the step causes `prompt_parse_failed` at batch launch (SP-075). Docs-only tasks still run the full test suite; they may omit the coverage-gate checkbox when no application code changes.
- **Coverage gate** — when the task changes application code, add a coverage verification checkbox in the Testing step using `testing.testWithCoverage` (≥77% line coverage policy)
- **Contract (required for new SP-\* tasks)** — add `## Contract` after `## File Scope` using [references/contract-template.md](references/contract-template.md). Include `testCommand` for code tasks; use `` `true` `` for docs-only S tasks. When `testCommand` is `` `true` `` (docs-only), **always** include `fileScopeMustChange` listing at least one documentation deliverable path — without it, workers can pass contract by creating only `.DONE` (SP-214 batch `20260612T204048`, SP-457 batch `20260703T022335`). When using `fileScopeMustNotChange`, follow parallel-only semantics and never ban `spine-tasks/**` (see contract template and [File Scope and parallel batches](#file-scope-and-parallel-batches)). Legacy `TP-*` packets may omit Contract when `contract.legacyTaskIdPrefixes` includes `TP-`.
- **Completion** — worker creates `{task-folder}/.DONE`; batch engine may auto-commit remaining work

### Step 5: Create STATUS.md

Use the STATUS template in [references/prompt-template.md](references/prompt-template.md). Match PROMPT step structure; omit if the engine will auto-generate (prefer creating it).

### Step 6: Update dependencies (when needed)

If the task depends on others, update **both**:

- `## Dependencies` in PROMPT.md (orchestrator parses this)
- `{tasksRoot}/dependencies.json` (canonical graph for `spine plan`)

### Step 7: Report launch command

```bash
spine tasks validate pending
spine tasks analyze pending
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

When Review Level ≥ 1 (v1.3), workers also run a **final** review (`--type final`) before `.DONE`. Verdicts: `PASS`, `REVISE`, or `REPLAN` (scope wrong — operator edits PROMPT then retries). See [PRD v1.3](../docs/PRD-v1.3-upstream-execution-bridge.md) FR-UXB-04.

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
| **XL** | 8+ hours | **Must split** — never ship a single PROMPT with Size XL (validator rejects) |
| **L** | 4–8 hours | **Prefer split** into 2–3 M tasks; if kept, set Size L and expect longer stall budget (SP-088) |

**Rule of thumb:** More than **4** implementation steps → split. More than **8** file-scope paths → narrow or split.

**Example (incident-driven):** Eight Phase-13 tasks in one batch (`SP-064`…`SP-085`) caused parallel pi stalls. Prefer:

| Instead of | Use |
|------------|-----|
| One batch with 8 M tasks | Wave A: 4 tasks → land → Wave B: 4 tasks |
| One L task “refactor engine + resume + tests” | SP-074 engine scope, SP-076 resume DRY, SP-078 tests (deps) |

---

## Tiered Context Loading

| Tier | What | Loaded by |
|------|------|-----------|
| **1** | PROMPT.md + STATUS.md | Always |
| **2** | `{tasksRoot}/CONTEXT.md` | When listed in "Context to Read First" |
| **3** | Specific reference docs | Only what the task needs |
| **4** | Cursor rules (when `.cursor/rules/` exists) | **Workers:** auto-selected per task via profile `worker.*`, PROMPT File Scope globs, `config.standards` append (FR-WORK-05). **Reviewers:** separate `profile.reviewer.*` selection with review-type scope — plan uses File Scope, code uses git diff paths, final uses always-only rules; 16 KiB cap, no `referenceDocs` (FR-REV-08) |

Populate "Context to Read First" from `referenceDocs` in spine config. Never list docs in `neverLoad`.

When authoring tasks for Cursor-based repos, **File Scope drives glob-matched worker rules** — include concrete paths (e.g. `src/**/*.mjs`, not only `src/`) so language packs activate. The same File Scope applies to **plan review** rule matching; code reviews match globs against changed diff paths instead. Preview worker selection with `spine rules select --task <id>`; preview reviewer selection with `spine rules select --role reviewer --review-type plan|code|final --task <id>`. See [docs/design/cursor-rules-discovery.md](../../docs/design/cursor-rules-discovery.md).

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

**`fileScopeMustNotChange` (parallel lanes only):** When a packet includes `fileScopeMustNotChange` in `## Contract`, use it only to guard **product paths that concurrent tasks on different lanes** must not edit in the same wave — not to isolate paths touched by **prior serialized tasks** on the same lane. When `spine plan` reports `File scope overlaps (tasks serialized to the same lane)`, those tasks run sequentially on one lane; use disjoint `fileScopeMustChange` paths instead of relying on must-not-change. Full semantics and examples: [references/contract-template.md](references/contract-template.md#filescopemustnotchange-semantics).

**Never ban `spine-tasks/**`:** Do **not** list `spine-tasks/**` or the **current task folder** in `fileScopeMustNotChange`. Workers must update `STATUS.md`, create `.DONE`, and may write `.reviews/` — banning those paths causes `contract.verified` failures even when implementation is correct.

**Worker rules:** File Scope also drives **glob-matched Cursor rules** injected into batch workers (FR-WORK-05). Tasks touching `**/*.{js,mjs}` activate JS standards; Swift/Python tasks need scope paths that match those rule globs. Keep scope precise — wide scope pulls more rules and increases prompt byte usage.

**Reviewer rules (FR-REV-08):** Plan reviews use the same File Scope for glob matching; code reviews use changed paths from `git diff`. Final reviews load always-on rules only. Worker-only packs (`taskplane-worker-cursor.mdc`) are excluded from reviewer context by default.

---

## Unsupported (spine v1)

Do **not** generate Taskplane polyrepo **`#### Segment: <repoId>`** markers — pi-spine is monorepo-only (PRD §13.2). Split multi-repo work into separate tasks with dependencies instead.

---

## Checklist (Definition of Ready)

Before reporting launch commands:

- [ ] Authoring mode chosen (lean default; full when ambiguity, L/XL epic, or security surface)
- [ ] `Next Task ID` read from CONTEXT.md and incremented
- [ ] Folder at `{tasksRoot}/{PREFIX-###-slug}/`
- [ ] Complexity scored; review level assigned (0–3)
- [ ] Size S/M/L — split if XL
- [ ] PROMPT.md from template: Mission, Dependencies, Context, File Scope, Contract (SP-\*), Steps, Do NOT, Git Commit Convention, Amendments
- [ ] If `testCommand` is `` `true` ``, `fileScopeMustChange` MUST list at least one deliverable path
- [ ] `### Step N: Testing & Verification` present inside `## Steps` before `## Completion Criteria` (required even for docs-only Review Level 0)
- [ ] STATUS.md with matching steps (hydration markers where needed)
- [ ] `dependencies.json` updated when task has deps
- [ ] CONTEXT.md phase table updated for PRD decompositions
- [ ] Full mode: clarify/checklist/analyze artifacts complete or explicitly skipped with rationale
- [ ] Launch: `spine tasks validate pending` → `spine tasks analyze pending` → `spine plan pending` → `spine preflight` → `spine batch start <id>`

---

## Git Commit Convention

Workers commit at **step boundaries** with the task ID prefix:

- `feat(SP-042): complete Step 1 — init defaults`
- `fix(SP-042): handle missing config path`
- `hydrate: SP-042 expand Step 2 checkboxes`

Hydration commits (STATUS.md expansions) may happen mid-step for crash recovery.

---

## Key Principles

- **Self-contained PROMPT.md** — the worker has no memory of this conversation. Cross-model reviewers receive a **fresh spawn** (FR-REV-04) with only the review request, diff, and Contract — not `referenceDocs` or worker rules. Place acceptance criteria and spec references in PROMPT `## Mission`, `## Contract`, and step checkboxes.
- **Scoped `testCommand` for cross-model batches** — lane worktrees differ from dev checkouts; broad `flutter test` / `npm test` can fail in lanes even when targeted tests pass. See [cross-model authoring guidance](references/contract-template.md#cross-model-authoring-worker--reviewer) for the `testCommand` decision table.
- **Testing step required (never omit)** — every task packet needs `### Step N: Testing & Verification` inside `## Steps`, before `## Completion Criteria`. **Do not skip this for docs-only or Review Level 0 tasks** — the worker rejects packets without a Testing step. Use `testing.test` from spine config; for **code deliverables**, also include `testing.testWithCoverage` and a **≥77% line coverage** checkbox (see prompt template). Docs-only tasks may omit the coverage checkbox.
- **Documentation in every task** — "Must Update" / "Check If Affected" prevent doc drift.
- **Concrete deliverables** — name files to create/modify; avoid shortcuttable vague steps.
- **Local install** — skill ships with pi-spine; `pi install /path/to/pi-spine -l` loads `./skills`.

---

## References

- [references/prompt-template.md](references/prompt-template.md) — PROMPT.md and STATUS.md templates
- [references/contract-template.md](references/contract-template.md) — `## Contract` field guidance and examples (v2.0 §4)
- [references/explore-template.md](references/explore-template.md) — Step 0 `findings.md` schema (v1.3 §6.3)
- [references/clarify-template.md](references/clarify-template.md) — Step A.5 `clarify.md` schema (spec-kit `/speckit.clarify` equivalent)
- [references/requirements-checklist-template.md](references/requirements-checklist-template.md) — Step A.6 `checklist.md` schema (spec-kit `/speckit.checklist` equivalent)
- [references/context-template.md](references/context-template.md) — `{tasksRoot}/CONTEXT.md` scaffold
- [docs/PRD.md](../../docs/PRD.md) — task format spec (§13)
- [docs/adoption/bootstrap-checklist.md](../../docs/adoption/bootstrap-checklist.md) — greenfield setup
- [docs/adoption/operator-runbook.md](../../docs/adoption/operator-runbook.md) — execution policy
