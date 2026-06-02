# Real-pi adoption E2E

Validate **live `pi` workers and reviewers** on the adoption consumer fixture (`AD-002-real-pi-smoke`), beyond stub dogfood ([`stub-free-dogfood-report.md`](../compatibility/stub-free-dogfood-report.md) covers pi-spine self-dogfood on TP-047).

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js ≥ 22, Git | Same as [bootstrap-checklist.md](./bootstrap-checklist.md) |
| `pi` on PATH | `pi --version` (validated with 0.78.0) |
| pi-spine checkout | Use `SPINE_BIN=node /path/to/pi-spine/bin/spine.mjs` from consumer temp repo |
| `SPINE_WORKER_STUB` unset | Real workers only; stub path uses `./scripts/adoption-smoke.sh` |

## Model config

Agent models come from `.spine/spine-config.json` created by `spine init --preset taskplane-compat`:

```json
"agents": {
  "worker": { "model": "inherit", "thinking": "high" },
  "reviewer": { "model": "inherit", "thinking": "medium" }
}
```

`inherit` uses the operator's pi session model. Override per agent with `spine settings set agents.worker.model <model>` before batch start if needed.

Worker and reviewer system prompts (including `spine_review_step`, `spine_report_progress`, `spine_request_gate` in the tools header) are copied from [`templates/agents/worker.md`](../../templates/agents/worker.md) on init.

## Quick run

**Dry run** (provision temp repo, init, plan — no batch):

```bash
./scripts/real-pi-adoption-e2e.sh
```

**Full real-pi batch** (attached, blocks until complete):

```bash
SPINE_WORKER_STUB=0 ./scripts/real-pi-adoption-e2e.sh --batch --keep-tmp
```

Use `--keep-tmp` to preserve the temp repo for evidence inspection. Default dry run deletes the temp dir on exit.

## Expected duration

| Phase | Typical time (AD-002, Review Level 1) |
|-------|---------------------------------------|
| Init + plan | < 5 s |
| Worker (1 step + progress) | 30–90 s |
| Plan review spawn | 30–90 s |
| Merge + gate | < 5 s |
| **Total** | **~2–3 min** (observed **98 s** on 2026-06-02) |

Review Level 2+ or multi-step tasks scale linearly with worker + code-review spawns.

## Failure recovery

| Symptom | Recovery |
|---------|----------|
| `SPINE_WORKER_STUB is set` | `unset SPINE_WORKER_STUB` or `export SPINE_WORKER_STUB=0` |
| `pi not on PATH` | Install pi; verify with `pi --version` |
| `pi exited but .DONE was not created` | Inspect lane worktree under `.worktrees/<batchId>/lane-1/`; re-run `spine batch resume --attached` or fix worker blockers |
| Review REVISE | Worker must fix feedback and re-run `spine review step --step N --type plan` before `.DONE` |
| Review spawn failure | Non-zero exit — check reviewer template and `pi` auth; see `spine status --diagnose` |
| Preflight git-clean fails | Run from clean fixture temp repo; use `--skip-preflight` only in controlled smoke scripts |
| Stall kill | Ensure worker calls `spine_report_progress`; check journal for `lane.heartbeat` / `task.step_completed` |

## Evidence (2026-06-02 run)

**Operator:** TP-048 validation  
**pi-spine commit:** `e85680a4ab7b6ec4e99ace6ee8f51ad5f94639a9`  
**Batch:** `20260602T224546`  
**Task:** AD-002 (Review Level 1, plan review executed)  
**Worker mode:** `SPINE_WORKER_STUB=0`, real `pi` 0.78.0  
**Duration:** ~98 s (attached batch)

### Batch outcome

- Phase: `completed`
- Lane branch: `task/spine-lane-1-20260602T224546`
- Lane commit: `75347ee5a58bfadd0f26c117c3f04881f321b4e4` — `feat(AD-002): batch 20260602T224546 worker completion`
- `.DONE`: `2026-06-02T22:46:17Z`
- Artifact: `REAL-PI-SMOKE.txt` → `2026-06-02T22:45:55Z`
- Plan review: `.reviews/1-20260602T224617.md` — **APPROVE**

### Journal tail (excerpt)

```json
{"type":"lane.heartbeat","batchId":"20260602T224546","taskId":"AD-002","laneId":"lane-1"}
{"type":"task.step_completed","payload":{"step":1,"checkboxesComplete":3,"checkboxesTotal":4},"taskId":"AD-002"}
{"type":"review.started","payload":{"stepNumber":1,"reviewType":"plan","reviewLevel":1}}
{"type":"review.completed","payload":{"verdict":"APPROVE","reviewType":"plan"}}
{"type":"task.step_completed","payload":{"step":1,"checkboxesComplete":4,"checkboxesTotal":4}}
{"type":"task.completed","taskId":"AD-002"}
{"type":"lane.committed","payload":{"commitSha":"75347ee5a58bfadd0f26c117c3f04881f321b4e4"}}
{"type":"batch.completed","batchId":"20260602T224546"}
```

Full journal: `.spine/runtime/<batchId>/journal/events.jsonl` in the temp project root.

## Related

| Doc / script | Purpose |
|--------------|---------|
| [bootstrap-checklist.md](./bootstrap-checklist.md) | Consumer layout, stub then real-pi |
| [stub-free-dogfood-report.md](../compatibility/stub-free-dogfood-report.md) | pi-spine repo self-dogfood (TP-047) |
| `./scripts/adoption-smoke.sh` | Stub CI path (AD-001) |
| `./scripts/real-pi-adoption-e2e.sh` | Manual real-pi path (AD-002) |
