# pi-spine

[![CI](https://github.com/beettlle/pi-spine/actions/workflows/ci.yml/badge.svg)](https://github.com/beettlle/pi-spine/actions/workflows/ci.yml)

**Orchestration spine for long-running pi development.**

pi-spine is a [pi](https://pi.dev) package for parallel, multi-day agent batches on real codebases. It combines Taskplane-style task packets, Babysitter-grade audit history, and pi-conductor-style human gates in one pi-native flow — **compose, don't merge** three orchestrators into a fourth monolith.

| pi-spine is | pi-spine is not |
|-------------|-----------------|
| A pi extension + CLI (`spine`) for batch orchestration | A replacement for pi itself |
| Compatible with Taskplane `PROMPT.md` / `STATUS.md` packets | A fork of Taskplane |
| An append-only **orchestration journal** for control-plane events | A full Babysitter process-definition engine |
| **Human gates** before integrate/merge | A clone of pi-conductor's external control-plane DB |
| Worktree-isolated parallel lanes | Cross-harness routing (Cursor, Codex, etc.) in v1 |

## Feature summary

- **Taskplane-compatible tasks** — `PROMPT.md`, `STATUS.md`, `dependencies.json`
- **Dependency waves** — topological scheduling with parallel lanes
- **Git worktree isolation** — one lane per worktree; orch branch for integration
- **STATUS-first workers** — checkpoint discipline and step-boundary commits
- **Cross-model review** — reviewer model configurable separately from worker
- **Orchestration journal** — JSONL event log for debugging and resume context
- **Human gates** — approve or reject integrate with test/build evidence
- **Local dashboard** — batch, lane, and gate visibility (SSE)
- **`create-spine-tasks` skill** — decompose PRDs into `spine-tasks/` packets (local install)

## Inspired by

pi-spine builds on ideas from [Taskplane](https://pi.dev/packages/taskplane), [Babysitter](https://github.com/a5c-ai/babysitter), and [pi-conductor](https://www.npmjs.com/package/@feniix/pi-conductor). For comparisons, trade-offs, and when to use each tool alone, see **[Why pi-spine?](docs/adoption/why-pi-spine.md)**.

## Honest limits

pi-spine ships operator-driven batch monitoring, not autonomous supervision.

| Out of scope | What to use instead |
|--------------|---------------------|
| **Supervisor mail** — conversational nudges between orchestrator and workers | `spine status --diagnose`, dashboard diagnosis banner |
| **Autonomous monitor agent** — background session polling batch health | CLI + dashboard surfaces; human operator runs suggested commands |

Primary monitor surfaces: **`spine status --diagnose`**, **`spine dashboard`** / `/spine-dashboard`, and the **[operator runbook](docs/adoption/operator-runbook.md)**. The `.spine/agents/supervisor.md` template documents this no-agent reality; the batch engine does not spawn it.

## Prerequisites

| Dependency | Required |
|------------|----------|
| [Node.js](https://nodejs.org/) ≥ 22 | Yes |
| [pi](https://pi.dev) coding agent | Yes |
| Git (worktree support) | Yes |

## Install

```bash
pi install npm:pi-spine
# or: npm install -g pi-spine
```

For git/path development installs, see **[local-install.md](docs/adoption/local-install.md)**. After install, `spine doctor` warns when a stale global `spine` on PATH does not match your checkout.

| Doc | Purpose |
|-----|---------|
| [bootstrap-checklist.md](docs/adoption/bootstrap-checklist.md) | First-time consumer setup |
| [operator-runbook.md](docs/adoption/operator-runbook.md) | Daily operator procedures |
| [cursor-rules-discovery.md](docs/design/cursor-rules-discovery.md) | Contributor Cursor rules (contributors) |

## Quick start

1. **Install and init** — `pi install npm:pi-spine` then `cd my-project && spine init && spine doctor`
2. **Plan and preflight** — `spine preflight && spine plan all` (pi: `/spine-plan all`)
3. **Start a batch** — `spine batch start pending` (pi: `/spine pending`)
4. **Monitor** — `spine status --diagnose` (pi: `/spine-status`)
5. **Land on main** — `spine gate status` → `spine gate approve` → `spine integrate` (pi: `/spine-gate` → `/spine-integrate`)

Full command reference: **[docs/QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md)**.

## Commands at a glance

### CLI

| Command | Purpose |
|---------|---------|
| `spine init` | Create `.spine/` config and agent stubs |
| `spine doctor` | Validate Node, git, pi, config |
| `spine preflight` | Required checks before batch start |
| `spine plan all` / `pending` | Preview dependency waves and lanes |
| `spine batch start pending` | Run unfinished tasks in dependency order |
| `spine status --diagnose` | Reconciled batch diagnosis + next action |
| `spine batch pause` / `resume` | Stop or continue scheduling |
| `spine gate status` / `approve` | Review evidence; approve integrate |
| `spine integrate` | Merge orch branch → main |
| `spine dashboard` | Local SSE dashboard (default port 8109) |

### pi slash commands

| Command | Purpose |
|---------|---------|
| `/spine-plan all` | Preview waves and lanes |
| `/spine pending` | Start batch for pending tasks |
| `/spine-status` | Batch diagnosis + lane health |
| `/spine-gate` | Gate inspection and resolution |
| `/spine-integrate` | Merge orch branch after gate approval |
| `/spine-dashboard` | Start dashboard in background |

## How it works

```text
preflight → plan waves → batch start (worktree lanes)
    → workers (PROMPT/STATUS, .DONE) → lane merge → orch branch
    → gate approve → integrate → main
```

Waves serialize dependency groups; lanes parallelize disjoint file scopes within a wave. See **[EXECUTION-FLOW-DIAGRAMS.md](docs/EXECUTION-FLOW-DIAGRAMS.md)** and **[EXECUTION-FLOW.md](docs/EXECUTION-FLOW.md)** for lifecycle detail.

## Best-of-N (dev script)

`scripts/best-of-n.mjs` runs the same prompt through multiple pi models in parallel worktrees — for comparing outputs, not production batches. Git checkout only; not shipped on npm. See **[docs/QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md)** (dev scripts) and `scripts/best-of-n.mjs`.

## Migrating from Taskplane

1. Install pi-spine in the same or a new repo.
2. `spine init` then `spine doctor`
3. Migrate config from `.pi/taskplane-config.json` (`spine migrate-from-taskplane`).
4. Run `/spine-plan all` and compare to your last Taskplane plan.

Do **not** run Taskplane and pi-spine batches on the same repo concurrently. See **[bootstrap-checklist.md](docs/adoption/bootstrap-checklist.md)**.

## Project status

**v1.0.2** on [npm](https://www.npmjs.com/package/pi-spine) and [pi.dev](https://pi.dev/packages/pi-spine). API may still evolve in patch releases; see git tags and **[docs/release/](docs/release/)**.

CI runs on every push and PR: typecheck, tests, coverage, and CLI smoke checks — see **[.github/workflows/ci.yml](.github/workflows/ci.yml)** and **[npm-publish.md](docs/release/npm-publish.md)**.

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/PRD.md](docs/PRD.md) | Product requirements and implementation contract |
| [docs/QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md) | Operator command reference |
| [docs/EXECUTION-FLOW.md](docs/EXECUTION-FLOW.md) | Batch lifecycle and scheduling |
| [docs/adoption/why-pi-spine.md](docs/adoption/why-pi-spine.md) | Positioning vs Taskplane, Babysitter, pi-conductor |
| [docs/adoption/operator-runbook.md](docs/adoption/operator-runbook.md) | Daily operator procedures |
| [docs/adoption/bootstrap-checklist.md](docs/adoption/bootstrap-checklist.md) | First-time setup |

## License

MIT (intended).
