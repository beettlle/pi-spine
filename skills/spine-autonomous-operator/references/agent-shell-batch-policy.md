# Agent shell batch policy

When an **external agent** (Cursor Agent, pi MonitorCreate, CI script, OpenCode) drives spine batches, the parent shell may return or be killed before the batch engine finishes. Use **detached** start/resume and monitor separately.

**Related:** [#163](https://github.com/beettlle/pi-spine/issues/163) (attached orphan / exit 137), [#185](https://github.com/beettlle/pi-spine/issues/185) (detached default for release/agent batches), [operator-runbook §Attached-first](../../../docs/adoption/operator-runbook.md#attached-first-policy-phase-22).

---

## Default for agents

Omit `--attached`. Detached is the CLI default for `spine batch start` and `spine batch resume`.

```bash
spine batch start pending --wave 0          # detached — engine survives parent shell exit
spine status --diagnose                     # always after detached start/resume return
spine wait --until completed,needs_integrate,failed,aborted --timeout 4h   # optional block
```

Detached start/resume returns when the engine **starts**, not when work completes.

---

## Cursor Agent shell

Cursor Agent shells may background long-running commands after **~120 seconds** even when started from the IDE terminal. An `--attached` engine is tied to that parent process — when the shell backgrounds or exits, the engine is orphaned (`engine_orphaned`, exit 137) and tasks stick in `running`.

**Do not** use `spine batch start … --attached` from Cursor Agent. Use detached start + monitor.

`spine doctor` detects Cursor agent shells (`CURSOR_TRACE_ID`, `CURSOR_SESSION_ID`) and warns with a detached `suggestedCommand`. Run `spine doctor` during Phase 0 baseline and heed the warning.

---

## Monitor pattern (per wave)

```bash
spine preflight
spine batch start pending --wave N
spine status --diagnose
spine wait --until completed,needs_integrate,failed,aborted,needs_retry --timeout 4h
spine status --diagnose
# → land loop or recovery per diagnosis
```

Optional: `spine watch --once`, `spine dashboard`, `spine journal follow`.

---

## When `--attached` is OK

Use `--attached` only when **all** of the following hold:

- Persistent **interactive** terminal (human operator: iTerm, Terminal.app, etc.)
- Shell stays in the **foreground** for the full batch duration (often 30+ minutes for real `pi` workers)
- Short smoke batches where total runtime is well under shell harness limits

```bash
spine batch start SP-042 --attached   # human terminal — blocks until engine finishes
```

---

## Recovery

| Situation | Rule |
|-----------|------|
| Default resume after retry | `spine batch resume` (detached) |
| Diagnose suggests `--attached --force` | Run in **foreground** only — never background |
| `resume --attached` or `resume --attached --force` | **Never** MonitorCreate or background ([#163](https://github.com/beettlle/pi-spine/issues/163)) |
| After detached start/resume | Always `spine status --diagnose` before leaving session |

Follow `suggestedCommand` from `spine status --diagnose` when unsure.

---

## Preflight

```bash
spine doctor
```

If `batch --attached orphan risk (#163)` shows a warning, use detached start/resume for this session.

---

## Skills that reference this doc

| Skill | Use |
|-------|-----|
| `spine-autonomous-operator` | Full pending backlog operator |
| `spine-orchestrate-waves` | Multi-wave outer loop |
| `spine-release-operator` | Curated release batches |
