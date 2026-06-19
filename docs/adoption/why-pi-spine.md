# Why pi-spine?

How pi-spine relates to [Taskplane](https://pi.dev/packages/taskplane), [Babysitter](https://github.com/a5c-ai/babysitter), and [pi-conductor](https://www.npmjs.com/package/@feniix/pi-conductor) — and when to use each tool on its own.

---

## The problem

Long-running agent development fails for the same reasons repeatedly:

- **Context loss** when sessions compact or crash
- **Parallel collisions** when multiple agents edit one checkout
- **Opaque recovery** when a batch pauses and you cannot tell whether to resume, force-resume, or abort
- **Premature integration** when lane work merges without explicit approval or test evidence
- **Tool fragmentation** when each orchestrator owns state differently and none covers the full workflow

Taskplane, Babysitter, and pi-conductor each solve important slices of this problem. None of them, used alone, gives you **Taskplane-style task packets**, **Babysitter-grade audit history**, and **pi-conductor-style human gates** in one pi-native flow.

pi-spine exists to be that spine: a thin, composable layer you install once and run from your pi session.

**Design philosophy: compose, don't merge.** pi-spine adopts patterns from these projects; it does not reimplement three products as a fourth monolith.

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

[pi-conductor](https://www.npmjs.com/package/@feniix/pi-conductor) was an **agent-native control plane**: durable workers, gates, artifacts, and PR-oriented flows via model-callable tools. **The upstream project is archived**; pi-spine adopts its gate and evidence patterns without depending on the package.

| You get with pi-spine | Gap when using pi-conductor only |
|-----------------------|----------------------------------|
| **Taskplane-compatible packets** — reuse existing `TP-*` / `SP-*` folders | Objectives and tool-native orchestration; different task contract |
| **Wave + lane batch model** — familiar `/spine-plan all` → parallel worktrees | Scheduler and conductor tools; different UX paradigm |
| **Opinionated worker/reviewer pipeline** — step checkpoints, `.DONE`, inline review | More flexible control plane; you assemble more yourself |
| **In-repo task folders** as the handoff artifact for humans and agents | State largely outside the repo |

**When to stay on pi-conductor only:** You want tool-driven orchestration (`conductor_run_work`, gate dashboard, PR readiness) and prefer objectives over folder-based packets. If you still run pi-conductor, it remains a valid choice for that model; pi-spine is the maintained path for packet-based pi batches with gates and audit history.

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

## Related projects

| Project | Role |
|---------|------|
| [Taskplane](https://pi.dev/packages/taskplane) | Parallel task orchestration for pi — foundation pi-spine extends |
| [Babysitter](https://github.com/a5c-ai/babysitter) | Event-sourced workflow SDK — audit and replay patterns |
| [pi-conductor](https://www.npmjs.com/package/@feniix/pi-conductor) | Archived control plane — gate and evidence inspiration |

pi-spine respects these tools: it composes their best patterns rather than replacing them outright.

---

## Next steps

- **[bootstrap-checklist.md](./bootstrap-checklist.md)** — first-time setup
- **[../README.md](../README.md)** — project overview and quick start
- **[operator-runbook.md](./operator-runbook.md)** — daily operator procedures
