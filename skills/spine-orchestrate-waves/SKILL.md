---
name: spine-orchestrate-waves
version: 1.0.0
description: Orchestrate multi-wave spine batches with an external agent outer loop — wave selection, land loop, evidence review, gate approval, integrate, and recovery. Use when asked to "run all waves", "orchestrate spine", "hands-off spine development", "land loop", "orchestrate pending tasks", or drive multi-wave batches from pi, Cursor, or OpenCode.
compatibility: Requires spine CLI from pi-spine, consumer repo with `.spine/spine-config.json`. Run from consumer repo root (or pi-spine when dogfooding).
---

# Spine Orchestrate Waves

Drive **multi-wave spine development** from an external agent session. Spine owns batch execution, review, contract verify, and integrate gates; **you** (the agent) own wave selection, `spine wait`, evidence review, `gate approve`, integrate decisions, retry/dismiss, and conflict resolution.

**Gate approval by the external agent is intentional** — workers receive `not_supported` from `spine_request_gate` (FR-SHIP-13). Do not expect workers to approve integrate gates.

Invoke explicitly: `/skill:spine-orchestrate-waves`, `/spine-orchestrate pending`, or "orchestrate all pending spine waves."

**Not** for authoring task packets — use `create-spine-tasks`. **Not** for curated semver releases — use `spine-release-operator`.

## Skill boundaries

| Concern | Delegate to |
|---------|-------------|
| Task packet authoring | `create-spine-tasks` skill |
| Curated release subset | `spine-release-operator` skill |
| Agent shell batch policy (detached vs attached) | [spine-autonomous-operator/references/agent-shell-batch-policy.md](../spine-autonomous-operator/references/agent-shell-batch-policy.md) |
| Pi async batch/verify (MonitorCreate) | [spine-release-operator/references/pi-async-orchestration.md](../spine-release-operator/references/pi-async-orchestration.md) |
| Post-integrate regression gate | [spine-release-operator/references/post-integrate-regression-gate.md](../spine-release-operator/references/post-integrate-regression-gate.md) |
| Canonical how-to prose | [references/outer-loop.md](references/outer-loop.md) (synced from `docs/adoption/agent-orchestrated-waves.md`) |
| Slash entry (`/spine-orchestrate`) | pi-spine extension — wave plan + outer loop checklist |
| Single-task suggested command | `/spine-next` inside land loop |

## Prerequisites

- pi-spine installed (`pi install npm:pi-spine` or local link)
- `.spine/spine-config.json` present (`spine init` if missing)
- Tasks decomposed into waves (`spine plan pending` shows wave structure)
- Familiarity with [operator-runbook §4 land loop](../../docs/adoption/operator-runbook.md#4-land-loop)

---

## Decision tree

Use this tree after each `spine wait` or when resuming orchestration.

```
START
  │
  ├─ spine preflight
  │     └─ fail → fix env/config; do not start batch
  │
  ├─ spine plan <scope> [--json]
  │     └─ waveCount == 0 → DONE (no pending work)
  │
  └─ FOR each wave W (from --from-wave or 0):
        │
        ├─ spine batch start <scope> --wave W    # detached — omit --attached
        ├─ spine status --diagnose
        ├─ spine wait --until completed,needs_integrate,failed,aborted,needs_retry --timeout 4h
        ├─ spine status --diagnose
        │
        └─ diagnosis?
              ├─ needs_integrate → EVIDENCE CHECKLIST → land loop → next wave
              ├─ needs_retry → retry branch (below) → resume; do not start next wave
              ├─ failed / aborted → journal + packet fix → dismiss/retry; do not start next wave
              ├─ merge_blocked → resolve conflicts → resume --force; stay on wave
              ├─ engine_orphaned / worker_orphaned → recover (below); no second attached engine
              ├─ completed → batch complete + push if needed → next wave
              └─ running / paused → wait or resume; do not start parallel engine
```

**Hard stops before next wave:**

- Land loop incomplete (`integrate` + `batch complete` + push when remote sync desired)
- Post-integrate `npm run release:check` not green on `main` — see [post-integrate-regression-gate.md](../spine-release-operator/references/post-integrate-regression-gate.md)
- Unresolved `failed`, `aborted`, or `needs_retry` on current wave
- Active `spine run sequence --attached` on same batch (state corruption risk)

---

## Wave picker algorithm

1. Run `spine plan pending` (or `spine plan all` / explicit task scope).
2. Parse wave index and task list:
   - **JSON:** `spine plan pending --json` → `waveCount`, per-wave `tasks[]`
   - **Text:** read wave headers from CLI output
3. Choose **W** = lowest index with pending tasks, unless operator passed `--from-wave N`.
4. If prior wave landed on `main`, re-run `spine plan` — dependency graph may have shifted.
5. Prefer **≤4 M-sized tasks per wave**; if plan shows oversized wave, note stall risk but proceed unless operator asked to replan.

---

## Per-wave outer loop

From consumer repo root:

```bash
spine preflight
WAVE=0    # or next index from plan

spine batch start pending --wave $WAVE          # detached — omit --attached
spine status --diagnose
spine wait --until completed,needs_integrate,failed,aborted,needs_retry --timeout 4h

spine status --diagnose
# Read headline + suggestedCommand

spine gate status
# Inspect .spine/runtime/<batchId>/evidence/

spine gate approve          # only after evidence checklist passes
spine integrate
npm install
spine batch complete
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE}.log
test "${PIPESTATUS[0]}" -eq 0   # blocking — see post-integrate-regression-gate.md
git push origin <baseBranch>   # when remote sync desired
```

Increment `WAVE` and repeat until `spine plan pending` shows no remaining waves.

> **Wait recipe note:** With SP-683, gate-pending land loops report the taxonomy diagnosis `needs_integrate`, so the default `--until` list above wakes on that diagnosis. The operator runbook documents optional land-loop pseudo-diagnoses (`gate_open`, `needs_approval`, `post_merge_limbo`) as belt-and-suspenders waits when you need finer-grained blocking inside the land loop itself.

**Optional script template:** `spine run sequence pending --attached --dry-run` — execute each printed block with judgment; do **not** chain `--auto-approve-gate` with real pi workers.

Full reference: [references/outer-loop.md](references/outer-loop.md).

---

## Evidence checklist (before `spine gate approve`)

Inspect `.spine/runtime/<batchId>/evidence/`:

- [ ] Contract verify passed for every task in the wave
- [ ] Test output present and scoped (not truncated by `maxBuffer` — avoid bare full-suite `testCommand` in PROMPTs)
- [ ] Review artifacts acceptable (`.reviews/` or engine-stored review verdicts)
- [ ] No unexpected `fileScopeMustChange` / `fileScopeMustNotChange` violations
- [ ] Integrate merge preview acceptable (no surprise files outside task scope)
- [ ] Operator/agent explicitly approves landing — **never** auto-approve without reading evidence

---

## Diagnosis → agent action

| Diagnosis | Agent action |
|-----------|--------------|
| `needs_integrate` | Evidence checklist → `spine gate approve` → `spine integrate` → `spine batch complete` → push |
| `needs_retry` | `spine batch retry <taskId>` then `spine batch resume` (detached); amend PROMPT contract if scope wrong |
| `needs_retry` + `review_exhausted` | Inspect `.reviews/` feedback; fix implementation or packet scope, then retry |
| `needs_retry` + `contract_failed` | Edit `PROMPT.md` `testCommand` or file scope, then retry |
| `failed` | Inspect journal (`spine journal follow`); fix contract/env before retry |
| `needs_replan` | Read `{taskFolder}/.reviews/final-*.md`; edit PROMPT scope, then retry |
| `merge_blocked` | Resolve conflicts on orch branch or lane worktree; `spine batch resume --force` |
| `engine_orphaned` | Do **not** start a second attached engine; follow recovery recipe in [outer-loop.md](references/outer-loop.md#orphan-recovery-recipe) — `spine batch retry <taskId>` then `spine batch resume --force` (detached). Headline distinguishes parent shell exit from crash when journal has no `engine.crash` |
| `worker_orphaned` | `spine batch retry <taskId>` (reconciles orphan running → failed) |
| `worker_done_missing` | Read worker output log from headline; fix blocker, then `spine batch retry <taskId>` |
| `completed` | Run `spine batch complete` if not archived, then push |
| `state_drift` | `spine batch retry <taskId>`; then follow `suggestedCommand` (`resume --attached --force` in **foreground** if diagnose requires) |

---

## Anti-patterns

| Anti-pattern | Correct approach |
|--------------|------------------|
| `spine batch start … --attached` from Cursor Agent or non-TTY shell | Detached start + `spine wait` / `spine status --diagnose` — see [agent-shell-batch-policy.md](../spine-autonomous-operator/references/agent-shell-batch-policy.md) |
| Cursor background shell + `--attached` (`block_until_ms` backgrounds tool shell) | Parent exits in ~15–120s; `engine_orphaned` misread as crash — detached start/resume + recovery recipe (retry → resume --force → diagnose) |
| `spine batch resume --attached` while `spine run sequence --attached` is active | One entry point; kill stale engines first (`spine status --diagnose`) |
| Approving gate without reading evidence | Always inspect evidence directory before `spine gate approve` |
| Expecting workers to call `spine_request_gate` for integrate | Agent drives gate approval from host shell |
| `--auto-approve-gate` with real pi workers | Per-wave agent loop with explicit gate approval |
| Starting next wave before land loop completes | Complete integrate + batch complete + post-integrate release:check + push before next wave |
| Bare full-suite `testCommand` with large output | Scope `testCommand` to relevant test files |
| `release:check \| tail` for pass/fail | Verify exit code; use `tee` + `${PIPESTATUS[0]}` — see [post-integrate-regression-gate.md](../spine-release-operator/references/post-integrate-regression-gate.md) |

---

## Multi-wave completion report

When all waves finish, report:

1. **Waves executed** — indices, task IDs per wave
2. **Land loops** — integrate commits, push status
3. **Recoveries** — retries, contract fixes, conflict resolution
4. **Verification** — paste `spine preflight` and final `spine plan pending` (should show 0 pending)
5. **Follow-ups** — deferred tasks, CONTEXT.md tech debt, issues to file

---

## Related docs

| Doc | Relevance |
|-----|-----------|
| [references/outer-loop.md](references/outer-loop.md) | Full synced how-to |
| [docs/adoption/agent-orchestrated-waves.md](../../docs/adoption/agent-orchestrated-waves.md) | Canonical doc (update source for sync) |
| [docs/adoption/operator-runbook.md](../../docs/adoption/operator-runbook.md) | Land loop, recovery |
| [docs/adoption/bootstrap-checklist.md](../../docs/adoption/bootstrap-checklist.md) | First batch setup |
| `.cursor/rules/spine-operator-cursor.mdc` | Cursor operator workflow |

## Related issues

- [#90](https://github.com/beettlle/pi-spine/issues/90) — agent-orchestrated multi-wave outer loop
- [#79](https://github.com/beettlle/pi-spine/issues/79) — `--auto-approve-gate` (deprioritized; agent loop replaces need)
- [#82](https://github.com/beettlle/pi-spine/issues/82) — sequence stops on merge_blocked
- [#89](https://github.com/beettlle/pi-spine/issues/89) — nested attached engines

---

## Short prompt (resume mid-orchestration)

```text
Resume spine wave orchestration: spine plan pending --json → pick next wave W →
spine batch start pending --wave W (detached) → spine status --diagnose → spine wait →
branch on diagnosis (evidence checklist before gate approve) → integrate → batch complete → push →
repeat until plan shows 0 waves. Post completion report.
```
