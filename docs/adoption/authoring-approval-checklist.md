# Authoring approval checklist

**Audience:** Operators and task authors before `spine batch start`  
**Related:** [upstream-execution-workflow.md](./upstream-execution-workflow.md), [operator-runbook.md](./operator-runbook.md), [create-spine-tasks skill](../../skills/create-spine-tasks/SKILL.md), [spec-persistence.md](./spec-persistence.md)

Human **pre-batch gates** close the spec-kit adoption loop: approve upstream spec/plan conversion into spine packets, then run pi-spine structural checks. This checklist is procedural — pi-spine does **not** enforce human sign-off in the batch engine.

---

## When to use

Run this checklist **after** task packets exist under `{tasksRoot}/` and **before** `spine batch start`. It complements:

| Doc | Role |
|-----|------|
| [upstream-execution-workflow.md](./upstream-execution-workflow.md) | How PRDs, zero-pi, or spec-kit artifacts become packets |
| [operator-runbook.md](./operator-runbook.md) §2 | Validate, plan, and preflight commands |
| `create-spine-tasks` skill | Decomposition, lean/full authoring modes |

---

## Pre-batch checklist

Complete every item. Fix failures before `spine batch start`.

| # | Gate | Command / action | Pass criteria |
|---|------|----------------|---------------|
| 1 | **Constitution / spec / plan reviewed** | Human review | Upstream PRD, `docs/constitution.md`, spec-kit `specs/<feature>/spec.md` and `plan.md` (if used), and packet `## Mission` / `## Context to Read First` align. Conversion from upstream artifacts is **approved** — not auto-imported. |
| 2 | **Task packets structurally valid** | `spine tasks validate pending` | Exit 0 — headings, required sections, Testing step, Contract (when required). |
| 3 | **Structural analyze clean** | `spine tasks analyze pending` | Exit 0 — no blocking issues (wave M-count, explore refs, PROMPT/`dependencies.json` drift). Warnings reviewed. |
| 4 | **Wave plan reviewed** | `spine plan pending` | Human approves wave sizing, lane count, and parallel scope — no overlapping File Scope across same-wave lanes unless intentional. |
| 5 | **Preflight green** | `spine preflight` | Exit 0 — doctor, git clean, no active batch, validate + plan checks pass. |

Optional automation:

```bash
spine tasks validate pending --json
spine tasks analyze pending --json
spine plan pending --json
spine preflight --json
```

---

## Authoring gates vs execution gates

Two gate families apply at different lifecycle stages. Do not conflate them.

| | **Authoring gates** | **Execution gates** |
|---|---------------------|---------------------|
| **When** | Before packets are considered launch-ready | After workers finish a wave (or at integrate) |
| **Who** | Human operator / task author | Operator from host shell (not inside worker session) |
| **Purpose** | Approve upstream → packet conversion and decomposition quality | Approve land loop — merge orch → `main` |
| **Examples** | Review constitution/spec/plan; spec-kit clarify/checklist; skill Step C.5 analyze; this checklist | `spine tasks validate`, `spine tasks analyze`, `spine preflight`, `spine batch start`; later `spine gate approve` → `spine integrate` |
| **Enforced by engine?** | **No** — habits and review only | **Partially** — validate/analyze/preflight fail fast; integrate gate when `gates.requireBeforeIntegrate` is true |
| **Typical failure** | Wrong scope in PROMPT; stale spec-kit handoff | `prompt_parse_failed` at worker launch; integrate blocked without approval |

**Authoring gates** (spec-kit alignment):

| spec-kit / skill step | pi-spine equivalent | Notes |
|-----------------------|---------------------|-------|
| `/speckit.constitution` | `docs/constitution.md` (optional) | Principles before feature work |
| `/speckit.clarify` | Skill Step A.5 → `{tasksRoot}/_authoring/{slug}/clarify.md` | Full mode; resolves ambiguity before slice |
| Checklist (spec-kit / skill A.6) | `{tasksRoot}/_authoring/{slug}/checklist.md` | Full mode; readiness before slice |
| `/speckit.plan` + `/speckit.tasks` | `create-spine-tasks` Step B → `PROMPT.md` | Manual or skill conversion — human approves mapping |
| Analyze (spec-kit / skill C.5) | `spine tasks analyze pending` | Skill C.5 is LLM review; CLI analyze is deterministic structural check |

**Execution gates** (pi-spine CLI):

| Command | Blocks |
|---------|--------|
| `spine tasks validate pending` | Invalid PROMPT at plan/worker launch |
| `spine tasks analyze pending` | Structural issues (blocking severity) |
| `spine preflight` | Dirty git, active batch, broken deps, failed validate/plan |
| `spine gate approve` | `spine integrate` when `gates.requireBeforeIntegrate` is true (default) |

Workers calling `spine_request_gate` receive `not_supported` in v2.2 — operators run `spine gate approve` from a clean host shell. See [operator-runbook.md §5.1](./operator-runbook.md#51-worker-spine_request_gate-fr-ship-13--v22).

---

## Mode-specific notes (lean vs full)

Pick authoring mode in `create-spine-tasks` **before** decomposition. See skill [Authoring modes](../../skills/create-spine-tasks/SKILL.md#authoring-modes).

| Mode | Authoring gates to complete | Still required before batch |
|------|----------------------------|----------------------------|
| **Lean** | Optional Step 0 explore only | Checklist rows 1–5 — **skip** skill clarify (A.5), checklist (A.6), and optional LLM analyze (C.5) when requirements are clear |
| **Full** | Step 0 (brownfield) → A.5 clarify → A.6 checklist → slice → optional C.5 analyze → track | Checklist rows 1–5 — upstream quality gates should be **done or explicitly skipped with rationale** before validate/analyze |

**Lean** mirrors spec-kit's lean preset: move from sources to packets with minimal upstream gates. **Full** mirrors spec-kit's standard path (clarify, checklist, analyze) or [Path 4 spec-kit](./upstream-execution-workflow.md#path-4--spec-kit-optional-upstream) upstream, then conversion.

Regardless of mode, pi-spine **always** runs deterministic checks at batch boundary: validate → analyze → plan review → preflight. Lean does not skip CLI structural gates.

---

## Quick sequence

```bash
# 1. Human: approve constitution/spec/plan → packet conversion (this doc § checklist row 1)
# 2. CLI structural gates
spine tasks validate pending
spine tasks analyze pending
spine plan pending          # human review wave sizing
spine preflight
# 3. Launch
spine batch start pending   # or explicit task IDs from plan output

# After wave completes — execution gate (land loop)
spine gate approve
spine integrate
spine batch complete
```

---

## Further reading

- [upstream-execution-workflow.md](./upstream-execution-workflow.md) — Path 1–4 authoring paths
- [spec-persistence.md](./spec-persistence.md) — flow-forward, living spec, flow-back when requirements change
- [operator-runbook.md](./operator-runbook.md) — daily batch operations and land loop
