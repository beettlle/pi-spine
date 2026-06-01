# pi-spine

[![CI](https://github.com/beettlle/pi-spine/actions/workflows/ci.yml/badge.svg)](https://github.com/beettlle/pi-spine/actions/workflows/ci.yml)

**Orchestration spine for long-running pi development.**

pi-spine is a [pi](https://pi.dev) package that helps you run parallel, multi-day agent batches on real codebases. It combines the strongest ideas from [Taskplane](https://pi.dev/packages/taskplane), [Babysitter](https://github.com/a5c-ai/babysitter), and [pi-conductor](https://www.npmjs.com/package/@feniix/pi-conductor) without asking you to operate three separate orchestrators—or pick one and miss what the others do well.

---

## Why this exists

Long-running agent development fails for the same reasons repeatedly:

- **Context loss** when sessions compact or crash
- **Parallel collisions** when multiple agents edit one checkout
- **Opaque recovery** when a batch pauses and you cannot tell whether to resume, force-resume, or abort
- **Premature integration** when lane work merges without explicit approval or test evidence
- **Tool fragmentation** when each orchestrator owns state differently and none covers the full workflow

Taskplane, Babysitter, and pi-conductor each solve important slices of this problem. None of them, used alone, gives you **Taskplane-style task packets**, **Babysitter-grade audit history**, and **pi-conductor-style human gates** in one pi-native flow.

pi-spine exists to be that spine: a thin, composable layer you install once and run from your pi session.

---

## What pi-spine is (and is not)

| pi-spine is | pi-spine is not |
|-------------|-----------------|
| A pi extension + CLI (`spine`) for batch orchestration | A replacement for pi itself |
| Compatible with Taskplane `PROMPT.md` / `STATUS.md` packets | A fork of Taskplane |
| An append-only **orchestration journal** for control-plane events | A full Babysitter process-definition engine |
| **Human gates** before integrate/merge | A clone of pi-conductor's external control-plane DB |
| Worktree-isolated parallel lanes | Cross-harness routing (Cursor, Codex, etc.) in v1 |

Design philosophy: **compose, don't merge.** pi-spine adopts patterns; it does not reimplement three products as a fourth monolith.

---

## Advantages over using the others directly

### vs Taskplane alone

Taskplane is the best pi-native batch orchestrator today: dependency waves, worktree lanes, cross-model review, dashboard, and orch-branch integration. pi-spine builds on that foundation rather than competing with it.

| You get with pi-spine | Gap when using Taskplane only |
|-----------------------|-------------------------------|
| **Orchestration journal** — append-only timeline of batch, lane, task, gate, and integrate events | Batch state and diagnostics exist, but post-mortem replay across lane death is harder to reconstruct |
| **Explicit integrate gates** — merge blocked until you approve an evidence bundle (tests, diff stat, task scorecard) | Integration is powerful; human approval is less formalized |
| **Journal-driven reconciliation** — resume hints grounded in event history | Resume works, but stale or partial lane recovery can be opaque in long batches |
| **Same task packets** — point `--tasks-root` at existing `taskplane-tasks/` | No migration rewrite required |

**When to stay on Taskplane only:** You are happy with its dashboard, supervisor, and merge flow and do not need formal gates or a dedicated audit journal.

### vs Babysitter alone

Babysitter excels at **deterministic, event-sourced workflow orchestration** and cross-harness portability. Its pi plugin is experimental and thin; the heavy lifting lives in the SDK and harness adapters.

| You get with pi-spine | Gap when using Babysitter only |
|-----------------------|----------------------------------|
| **pi-native first-class UX** — slash commands, skills, worker sessions in pi | Pi integration is experimental; not the primary Babysitter surface |
| **File-based task packets** — `PROMPT.md` / `STATUS.md` as agent memory | Process definitions in JavaScript; different authoring model |
| **Git worktree lanes** tuned for coding batches | Not the core Babysitter story |
| **Lighter mental model** — journal at orchestration boundaries, not full process replay | Full replay engine is powerful but heavier for solo pi batch work |

**When to stay on Babysitter only:** You need one workflow engine across many harnesses (Codex, Cursor, Gemini) and want JS process definitions with full deterministic replay.

### vs pi-conductor alone

pi-conductor is an actively developed **agent-native control plane**: durable workers, gates, artifacts, and PR-oriented flows via model-callable tools.

| You get with pi-spine | Gap when using pi-conductor only |
|-----------------------|----------------------------------|
| **Taskplane-compatible packets** — reuse existing `TP-*` / `SP-*` folders | Objectives and tool-native orchestration; different task contract |
| **Wave + lane batch model** — familiar `/spine-plan all` → parallel worktrees | Scheduler and conductor tools; different UX paradigm |
| **Opinionated worker/reviewer pipeline** — step checkpoints, `.DONE`, inline review | More flexible control plane; you assemble more yourself |
| **In-repo task folders** as the handoff artifact for humans and agents | State largely outside the repo |

**When to stay on pi-conductor only:** You want tool-driven orchestration (`conductor_run_work`, gate dashboard, PR readiness) and prefer objectives over folder-based packets.

### The combined picture

```text
                    Audit / replay clarity
                           ▲
                           │
              Babysitter   │   pi-spine
                           │
         ──────────────────┼──────────────────► Batch orchestration
                           │
              pi-conductor │   Taskplane
                           │
                    Gates  │   Packets + dashboard
```

pi-spine targets the upper-right: **batch orchestration with strong audit trail and human gates**, using task packets you may already have.

---

## Feature summary

- **Taskplane-compatible tasks** — `PROMPT.md`, `STATUS.md`, `dependencies.json`
- **Dependency waves** — topological scheduling with parallel lanes
- **Git worktree isolation** — one lane per worktree; orch branch for integration
- **STATUS-first workers** — checkpoint discipline and step-boundary commits
- **Cross-model review** — reviewer model configurable separately from worker
- **Orchestration journal** — JSONL event log for debugging and resume context
- **Human gates** — approve or reject integrate with test/build evidence
- **Local dashboard** — batch, lane, and gate visibility (SSE)

See `docs/PRD.md` for the full specification.

---

## Prerequisites

| Dependency | Required |
|------------|----------|
| [Node.js](https://nodejs.org/) ≥ 22 | Yes |
| [pi](https://pi.dev) coding agent | Yes |
| Git (worktree support) | Yes |

---

## Quick start

```bash
# Install the pi package
pi install npm:pi-spine

# In your project repo
cd my-project
spine init --tasks-root taskplane-tasks --preset taskplane-compat
spine doctor
```

In a pi session (Phase 0 — slash commands are registered stubs; batch engine lands in later phases):

| Command | Status |
|---------|--------|
| `/spine` | Stub — project guide / batch execute (`/spine [all\|paths]`, Phase 2+) |
| `/spine-plan` | Stub — preview waves and lanes |
| `/spine-status` | Stub — batch and lane health |
| `/spine-pause` | Stub — pause after current tasks |
| `/spine-resume` | Stub — resume paused or failed batch |
| `/spine-abort` | Stub — abort batch |
| `/spine-gate` | Stub — gate inspection and resolution |
| `/spine-integrate` | Stub — merge orch branch (gate required) |
| `/spine-settings` | Stub — interactive configuration |
| `/spine-deps` | Stub — dependency graph |

Each stub replies with a notification pointing to `spine help` and a future phase. Example flow once implemented:

```text
/spine-plan all    # preview waves and lanes
/spine all         # run the batch
/spine-status      # monitor progress
/spine-gate        # review evidence before merge
/spine-integrate   # merge orch branch (after gate approval)
```

Optional: run the dashboard in another terminal:

```bash
spine dashboard    # default http://localhost:8109
```

---

## Migrating from Taskplane

If you already use Taskplane task folders:

1. Install pi-spine in the same or a new repo.
2. `spine init --tasks-root taskplane-tasks --preset taskplane-compat`
3. Migrate config from `.pi/taskplane-config.json` (see `spine migrate-from-taskplane`).
4. Run `/spine-plan all` and compare to your last Taskplane plan.

Do **not** run Taskplane and pi-spine batches on the same repo at the same time.

---

## Project status

**Early development.** pi-spine is designed as a personal orchestration spine first, publishable as `npm:pi-spine` when stable. API and behavior may change before v1.0.

## Continuous integration

Every push and pull request to `main` runs [GitHub Actions CI](.github/workflows/ci.yml): `npm ci`, `npm run typecheck`, `npm test` (when defined), and CLI smoke checks (`spine version`, `help`, `doctor`).

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/PRD.md](docs/PRD.md) | Product requirements and implementation contract |
| pi.dev package page | Install and package manifest (when published) |

---

## License

MIT (intended).

---

## Related projects

- [Taskplane](https://pi.dev/packages/taskplane) — parallel task orchestration for pi
- [Babysitter](https://github.com/a5c-ai/babysitter) — event-sourced workflow SDK
- [pi-conductor](https://www.npmjs.com/package/@feniix/pi-conductor) — durable agent control plane for pi
- [pi-subagents](https://www.npmjs.com/package/pi-subagents) — optional delegation layer (planned v1.1 backend)

pi-spine respects these tools: it composes their best patterns rather than replacing them outright.
