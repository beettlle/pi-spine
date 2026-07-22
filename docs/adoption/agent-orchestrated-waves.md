# How to orchestrate multi-wave spine batches with an external agent

**pi skill:** [`spine-orchestrate-waves`](../../skills/spine-orchestrate-waves/SKILL.md) — decision tree, evidence checklist, and wave picker for agent sessions.

**pi slash:** `/spine-orchestrate [pending|all] [--from-wave N]` — emits wave plan summary, per-wave outer loop checklist, and skill link. Does **not** auto-approve gates or auto-integrate; the agent decides after reviewing evidence.

Run all pending tasks across multiple dependency waves without manual intervention between each step. An **external agent** (pi, OpenCode, Cursor, CI script) drives the land loop between waves while spine owns batch execution, review, and integrate gates.

**Gate approval by the external agent is intentional** — spine workers return `not_supported` from `spine_request_gate` (FR-SHIP-13). The agent-as-operator model decouples wave scheduling from engine internals.

---

## Prerequisites

- pi-spine installed and configured ([bootstrap-checklist.md](./bootstrap-checklist.md))
- Tasks decomposed into dependency waves (`spine plan pending` shows wave structure)
- Familiarity with the [land loop](./operator-runbook.md#4-land-loop)

---

## Agent shell policy

For agent-driven batches (Cursor Agent, pi MonitorCreate, CI), use **detached** start/resume — omit `--attached`. The engine survives parent shell exit; monitor with `spine status --diagnose` and `spine wait`.

**Automation rule:** External agents must use `spine batch start|resume --force` (detached) unless the agent process will **block until batch completion**. Never pass `--attached` from subprocesses that return before the batch finishes (Cursor tool shells, CI steps with timeouts, `block_until_ms` backgrounds).

Cursor Agent shells may background long commands after **~120 seconds**; an attached engine dies with the parent shell (`engine_orphaned`, exit 137). Run `spine doctor` and heed the `batch --attached orphan risk (#163)` warning.

Full policy: [agent-shell-batch-policy.md](../../skills/spine-autonomous-operator/references/agent-shell-batch-policy.md). Use `--attached` only from a persistent interactive terminal kept in foreground for the full batch.

### Orphan recovery recipe

When diagnosis shows `engine_orphaned` or `worker_orphaned` after a short-lived shell:

```bash
spine batch retry <taskId>       # reconciles orphan running → failed
spine batch resume --force       # detached — omit --attached
spine status --diagnose          # confirm diagnosis: running
```

Inspect `.spine/runtime/detached-engine.log` when the headline links it — absence of `engine.crash` in the journal usually means parent shell exit, not an engine defect ([#185](https://github.com/beettlle/pi-spine/issues/185)).

---

## Responsibility split

| Layer | Owns |
|-------|------|
| **Spine engine** | Batch start, lane provisioning, worker spawn, review, contract verify, lane→orch merge, gate evidence, journal |
| **External agent** | Wave selection, `spine wait`, evidence review, `gate approve`, integrate decision, retry/dismiss, conflict resolution |

The engine never auto-approves the integrate gate or pushes to remote — those decisions belong to the operator (human or agent).

---

## Per-wave land loop

Run this sequence once per wave from the consumer repo root:

```bash
spine preflight
WAVE=0    # agent picks the next wave index from plan output

spine batch start pending --wave $WAVE          # detached — omit --attached
spine status --diagnose
spine wait --until completed,needs_integrate,failed,aborted,needs_retry --timeout 4h

spine status --diagnose
# Read headline + suggestedCommand

# Land loop (after reviewing evidence)
spine gate status
# Inspect .spine/runtime/<batchId>/evidence/
spine gate approve
spine integrate
spine batch complete
git push origin main
```

Increment `$WAVE` and repeat until `spine plan pending` shows no remaining waves.

> **Wait recipe note:** With SP-683, gate-pending land loops report the taxonomy diagnosis `needs_integrate`, so the default `--until` list above wakes on that diagnosis. The [operator runbook](./operator-runbook.md) documents optional land-loop pseudo-diagnoses (`gate_open`, `needs_approval`, `post_merge_limbo`) as belt-and-suspenders waits when you need finer-grained blocking inside the land loop itself.

---

## Multi-wave strategy

**Preferred: agent repeats per wave.** Each iteration is an independent land loop. The agent reviews evidence, approves or rejects the gate, handles failures, then starts the next wave. This approach:

- Decouples from `--auto-approve-gate` (which is stub/CI only)
- Allows the agent to react to partial wave success
- Avoids sequence halt issues on merge-blocked waves

**Optional: sequence dry-run as script template.** Generate the command sequence without executing:

```bash
spine run sequence pending --attached --dry-run
```

The agent can execute each printed block manually with judgment between steps. Use **detached** start for real execution (omit `--attached`).

**Not recommended for real pi:** `spine run sequence pending --auto-approve-gate --force` bypasses evidence review and is restricted to stub/CI environments by safety gates.

---

## Diagnosis → agent action table

After `spine wait` returns or `spine status --diagnose` reports a non-running state:

| Diagnosis | Agent action |
|-----------|--------------|
| `needs_integrate` | Review evidence under `.spine/runtime/<batchId>/evidence/` → `spine gate approve` → `spine integrate` → `spine batch complete` → push |
| `needs_retry` | `spine batch retry <taskId>` then `spine batch resume` (detached); amend PROMPT contract if scope is wrong |
| `needs_retry` + `review_exhausted` | Inspect `.reviews/` feedback; fix implementation or packet scope, then retry |
| `needs_retry` + `contract_failed` | Edit `PROMPT.md` `testCommand` or file scope, then retry |
| `failed` | Inspect journal (`spine journal follow`); fix contract/env before retry |
| `needs_replan` | Read reviewer feedback in `{taskFolder}/.reviews/final-*.md`; edit PROMPT scope, then retry |
| `merge_blocked` | Resolve conflicts on orch branch or lane worktree; `spine batch resume --force` |
| `engine_orphaned` | Do **not** start a second attached engine; follow recovery recipe above — `spine batch retry <taskId>` then `spine batch resume --force` (detached). Headline distinguishes parent shell exit from crash when journal has no `engine.crash` |
| `worker_orphaned` | `spine batch retry <taskId>` (reconciles orphan running → failed) |
| `worker_done_missing` | Read worker output log from headline; fix blocker, then `spine batch retry <taskId>` |
| `completed` | Already landed — run `spine batch complete` if not archived, then push |
| `state_drift` | `spine batch retry <taskId>`; then follow `suggestedCommand` (`resume --attached --force` in **foreground** if diagnose requires) |

---

## Anti-patterns

| Anti-pattern | Why it fails | Correct approach |
|--------------|-------------|------------------|
| `spine batch start … --attached` from Cursor Agent or non-TTY shell | Parent shell backgrounds (~120s) or exits; engine orphaned | Detached start + `spine wait` / `spine status --diagnose` |
| Cursor background shell + `--attached` (tool `block_until_ms` backgrounds) | Parent exits in ~15–120s; `engine_orphaned` misread as crash | Detached start/resume + recovery recipe (retry → resume --force → diagnose) |
| Running `spine batch resume --attached` while `spine run sequence --attached` is active | Two engines on the same batch causes state corruption | Use one entry point; kill stale engines first (`spine status --diagnose` to check PIDs) |
| Approving gate without reading evidence | Merges untested or broken code to main | Always inspect `.spine/runtime/<batchId>/evidence/` before `spine gate approve` |
| Expecting workers to call `spine_request_gate` for integrate | Workers always receive `not_supported` (FR-SHIP-13) | Agent drives gate approval from the host shell |
| Using `--auto-approve-gate` with real pi workers | Bypasses evidence review; safety gates block this for real pi | Use per-wave agent loop with explicit gate approval |
| Starting next wave before land loop completes | Base branch diverges from orch; downstream waves may conflict | Complete `integrate` + `batch complete` + push before next wave |
| Bare full-suite `testCommand` with large output | Contract verify exceeds `maxBuffer` (10MB) and fails | Scope `testCommand` to relevant test files |

---

## Example: full backlog orchestration

```bash
#!/usr/bin/env bash
set -euo pipefail

spine preflight

WAVES=$(spine plan pending --json | jq '.waveCount')

for ((WAVE=0; WAVE<WAVES; WAVE++)); do
  echo "=== Wave $WAVE ==="

  spine batch start pending --wave "$WAVE"
  spine status --diagnose
  spine wait --until completed,needs_integrate,failed,aborted,needs_retry --timeout 4h

  DIAG=$(spine status --json | jq -r '.diagnosis')

  if [ "$DIAG" = "needs_integrate" ]; then
    spine gate status
    spine gate approve
    spine integrate
    spine batch complete
    git push origin main
  else
    echo "Wave $WAVE ended with diagnosis: $DIAG"
    echo "Run: spine status --diagnose"
    exit 1
  fi
done

echo "All waves complete."
```

Adapt for agent sessions: replace the bash loop with agent tool calls (`spine status --json` → parse → branch on diagnosis).

---

## Related docs

| Doc | Relevance |
|-----|-----------|
| [operator-runbook.md §4](./operator-runbook.md#4-land-loop) | Land loop copy-paste sequence |
| [agent-shell-batch-policy.md](../../skills/spine-autonomous-operator/references/agent-shell-batch-policy.md) | Detached default for agent shells |
| [bootstrap-checklist.md](./bootstrap-checklist.md) | First batch setup |
| [upstream-execution-workflow.md](./upstream-execution-workflow.md) | PRD → task packets → batch |
| [QUICK-REFERENCE.md](../QUICK-REFERENCE.md) | Command reference |
| [spine-orchestrate-waves SKILL.md](../../skills/spine-orchestrate-waves/SKILL.md) | pi skill (decision tree + evidence checklist) |

## Related issues

- [#79](https://github.com/beettlle/pi-spine/issues/79) — `--auto-approve-gate` flag (deprioritized; agent loop replaces need)
- [#82](https://github.com/beettlle/pi-spine/issues/82) — sequence stops on merge_blocked
- [#84](https://github.com/beettlle/pi-spine/issues/84) — PROMPT authoring for cross-model
- [#71](https://github.com/beettlle/pi-spine/issues/71) — built-in supervisor (future; agent outer loop bridges gap)
- [#54](https://github.com/beettlle/pi-spine/issues/54) — `spine run sequence` (complementary, not replacement)
- [#163](https://github.com/beettlle/pi-spine/issues/163) — attached orphan risk in short-lived shells
- [#185](https://github.com/beettlle/pi-spine/issues/185) — detached default for release/agent batches
