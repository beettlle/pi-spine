# Stet Overview

Stet is a local-first, LLM-powered code review CLI written in Go. It reviews git diffs hunk-by-hunk against a local LLM (Ollama or OpenAI-compatible API), producing categorized findings (bug, security, correctness, performance) at severity levels (error, warning, info, nitpick). Key capabilities:

- `stet start [ref]` -- establishes a baseline commit
- `stet run` -- incremental review of changed hunks since baseline
- `stet finish` -- persists session, writes git notes for analytics
- `--json` / `--stream` output for machine consumption
- `--strictness` presets (lenient/default/strict)
- `--verify` for second-pass critic filtering
- RAG-aware: resolves symbols across 6 languages (Go, JS/TS, Python, Swift, Java, Rust)
- Loads `.cursor/rules/` as project review criteria
- History-based suppression of previously dismissed findings

## Pi-Spine Extension Points (relevant to stet)

| Hook | When | Mechanism |
|------|------|-----------|
| worktreeSetupHook | Once per lane, after worktree provision | spine-config.json → script under scripts/ |
| Contract testCommand | After worker completes, during contract verification | PROMPT.md ## Contract → shell command (hardening tracked in [#268](https://github.com/beettlle/pi-spine/issues/268) / SP-723) |
| Gate evidence collection | After all tasks succeed, before integrate approval | spine-config.json → testing.build/testing.test via hardened argv allowlist ([#254](https://github.com/beettlle/pi-spine/issues/254)) |
| Worker launch script | Wraps worker spawn | development.workerLaunchScript |

## Contract testCommand vs gate evidence: two execution models

The two hook paths above execute commands under **different security models**. Task authors and operators must not assume a command that works in one slot works in the other.

**Contract `testCommand` (PROMPT.md `## Contract`) — shell execution.** `src/batch/contract-exec.mjs` (`runContractTestCommand`) spawns the command through the operator's shell (`spawnSync($SHELL, ["-c", …])`) in the lane worktree. Full shell semantics apply: `&&` chaining, pipes, env-var prefixes (`SPINE_WORKER_STUB=1 npm test`), and `$` expansion all work today. That is why Approaches 1 and 5 below chain stet with `npm run typecheck && … stet run …` in the contract. **This is changing:** [#268](https://github.com/beettlle/pi-spine/issues/268) / **SP-723** will reject `$`, backticks, `;`, `|`, `&&`, `||` in contract testCommand **before shell spawn**, with error copy distinct from the gate evidence path. Once SP-723 lands, write contract testCommands as single commands or `scripts/…` wrappers (see [operator-runbook §2.3](adoption/operator-runbook.md#23-contract-authoring-v20--fr-cdo-01)) instead of `&&`-chained stet invocations.

**Gate evidence commands (`testing.build` / `testing.test` / `testing.testWithCoverage`, plus the `testing.review` wrapper) — hardened no-shell execution.** `src/batch/evidence-command.mjs` runs these through `execFileSync` with an allowlist ([#254](https://github.com/beettlle/pi-spine/issues/254), SP-639/SP-653/SP-710): the first token must be `npm` / `node` / `npx` / `pnpm` / `yarn` / `cargo` / `task` (or a project-local `.venv/bin/python`, or a `scripts/` wrapper), `&&` chains are allowed (Phase B), and `;`, `|`, redirects, backticks, and `$VAR` / `$(…)` expansions are rejected fail-closed (bounded `PATH="…"` prefixes excepted). Approach 2's `scripts/spine-evidence-review.sh` wrapper exists precisely because this path forbids inline shell metacharacters — put complex review logic in a script, not in the config string.

| | Contract `testCommand` | Gate evidence `testing.*` |
|---|---|---|
| Executor | Shell (`spawnSync($SHELL, ["-c", …])`) in lane worktree | No-shell argv allowlist (`execFileSync`) at project root |
| `&&`, `\|`, `;`, `$`, backticks | Work today; **rejected once SP-723 lands** (#268) | Rejected now (`&&` chains allowed, Phase B) |
| Env prefixes (`VAR=… cmd`) | Work today; at risk under SP-723 | Only documented `PATH="…"` prefix (SP-710) |
| Complex logic | Move into a `scripts/…` wrapper once SP-723 lands | Always use a `scripts/…` wrapper |

---

## State artifacts & feedback loop

Stet persists session state under `.review/` (default). Pi-spine commits `.review/config.toml` but gitignores runtime files (`session.json`, `lock`, `spine-stet-baseline.ref`). See `.gitignore`.

| Artifact | Purpose |
|----------|---------|
| `.review/session.json` | Active session (baseline, findings, dismissed_ids) |
| `.review/history.jsonl` | Feedback log for `stet optimize` and prompt shadowing |
| `.review/system_prompt_optimized.txt` | Output of `stet optimize` (used when present) |
| `refs/notes/stet` | Session analytics written at `stet finish` |

**When does `history.jsonl` appear?** Only on feedback events: `stet dismiss`, auto-dismiss during re-review, or `stet finish` when the session had findings. The v1.5.0 contract path uses `--auto-finish-zero`; batches with zero findings never append history, so `stet optimize` has nothing to read until dismissals occur.

**Not the same as:** `.spine/run-metrics.jsonl` (spine batch metrics) or `.spine/runtime/*/journal/events.jsonl` (orchestration journal).

For audit findings, operator playbook, and next-release improvements, see [stet feedback loop brief](features/stet-feedback-loop-brief.md).

---

## Five Integration Approaches

### 1. Baseline-at-Setup, Review-at-Contract (recommended first)

Hook into: worktreeSetupHook + contract testCommand

The cleanest two-phase integration. During lane setup, establish the stet baseline at the pre-worker commit. At contract verification, run stet against the worker's changes.

```bash
# scripts/spine-worktree-setup.sh (worktreeSetupHook)
#!/bin/bash
stet start HEAD --allow-dirty --quiet
echo '{"ok":true}'
```

Then in each task PROMPT's contract testCommand, chain stet:

```
npm run typecheck && SPINE_WORKER_STUB=1 npm test && stet run --json --strictness strict --auto-finish-zero
```

Stet exits non-zero if it encounters errors, failing the contract. The `--auto-finish-zero` flag auto-finishes the session when no findings remain, keeping the worktree clean.

**Pros:** Per-task granularity; catches defects at the earliest point; blocks bad code from ever reaching the gate. Uses existing config without any spine code changes.

**Cons:** Adds ~2-5 min to every task's contract phase (LLM inference time); requires Ollama or compatible API running during batch. Tasks with transient contract failures (like SP-451) get an additional failure vector.

---

### 2. Gate Evidence Enrichment (supported)

Hook into: Gate evidence collection via `testing.review` (SP-674)

Add stet review output as evidence the operator sees before approving the integrate gate. This doesn't block individual tasks -- it provides an aggregate review of the entire wave's diff before landing on main.

In `spine-config.json`, set the optional `testing.review` slot to the provided wrapper:

```json
{
  "testing": {
    "build": "npm run typecheck",
    "test": "npm test",
    "review": "scripts/spine-evidence-review.sh"
  }
}
```

`scripts/spine-evidence-review.sh` runs `stet start main`, `stet run --json`, and `stet finish`, writing the JSON review output to the gate evidence bundle. It exits non-zero only on a stet hard failure; active findings are evidence, not a failure. If `stet` is not on `PATH`, the script prints a clear skip message and exits 0 so the gate does not fail on environments without stet installed.

You can also use `testing.build` with a wrapper script that combines build and stet, but the dedicated `testing.review` slot is cleaner and keeps the stet report separate from build/test evidence.

The gate operator (you or Cursor) reviews the `review-output.txt` evidence alongside the diff-stat and test output before `spine gate approve`. See [docs/adoption/operator-runbook.md §8.1 Gate evidence](../adoption/operator-runbook.md#gate-evidence).

**Pros:** Zero impact on individual task runtime; reviews the merged result of all lanes; operator makes informed decision. No task PROMPT changes needed.

**Cons:** Late in the pipeline -- defects found here mean re-running tasks or manual fixes; evidence commands have a 10-min timeout and run against the project root (not individual worktrees), so the diff is the full wave.

---

### 3. Per-Lane Post-Worker Stet Review (via launch script)

Hook into: development.workerLaunchScript

Wrap the worker in a launch script that runs stet after the worker finishes but before the engine picks up the .DONE file. The script runs the normal worker, then does a stet review, and writes findings as a committed artifact in the lane.

```bash
# scripts/spine-worker-launch.sh
#!/bin/bash
RUNNER="$1"; shift

# Run the actual worker
node "$RUNNER" "$@"
WORKER_EXIT=$?

# If worker succeeded, run stet review on its changes
if [ -f "$SPINE_TASK_FOLDER/.DONE" ]; then
  stet start main --allow-dirty --quiet 2>/dev/null
  FINDINGS=$(stet run --json --strictness strict 2>/dev/null)
  ACTIVE=$(echo "$FINDINGS" | node -e "
    const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const errors=d.findings?.filter(f=>f.severity==='error')?.length||0;
    console.log(errors);
  ")
  if [ "$ACTIVE" -gt 0 ]; then
    echo "$FINDINGS" > "$SPINE_TASK_FOLDER/stet-findings.json"
    git add "$SPINE_TASK_FOLDER/stet-findings.json"
    git commit --amend --no-edit --quiet
  fi
  stet finish --quiet 2>/dev/null
fi

exit $WORKER_EXIT
```

**Pros:** Runs in the lane worktree where the diff is clean and task-scoped; findings are committed as a lane artifact; doesn't block the worker but enriches the commit.

**Cons:** Doesn't fail the task on findings (would need to remove .DONE to trigger contract failure); launch script sandbox limits what you can do; adds time between worker completion and engine pickup.

---

### 4. Operator-Driven Pre-Integrate Review

Hook into: Manual operator step between gate approval and integrate

This is a workflow integration, not a config integration. Before running spine integrate, the operator runs stet on the orch branch diff against main:

```bash
# After gate approve, before integrate
git checkout orch/spine-$BATCH_ID
stet start main --allow-dirty --quiet
stet run --json --strictness default --verify | tee /tmp/stet-wave-review.json
stet list  # human-readable summary

# If clean:
stet finish --quiet
git checkout main
spine integrate
```

This could be scripted as `scripts/stet-pre-integrate.sh` and called by the operator (or by Cursor when running the batch drain plan).

**Pros:** Reviews the complete merged result of all lanes; catches cross-task interaction bugs; `--verify` enables the critic for higher-quality findings; doesn't require any spine config changes.

**Cons:** Manual step (though scriptable); if findings are found, you need to decide whether to integrate anyway or fix first; adds 5-15 min to the wave landing cycle.

---

### 5. Contract Strictness Escalation (stet as quality gate)

Hook into: Contract testCommand with tiered strictness

Use stet's `--strictness` presets to create a tiered quality gate. S-size tasks get lenient review, M/L tasks get strict review. The contract fails only on error-severity findings.

In the task PROMPT contract, vary by task size:

```
# S-size tasks:
| testCommand | `npm run typecheck && npm test && stet start HEAD~1 --quiet && stet run --strictness lenient --auto-finish-zero --quiet` |

# M-size tasks:
| testCommand | `npm run typecheck && npm test && stet start HEAD~1 --quiet && stet run --strictness default --verify --auto-finish-zero --quiet` |

# Security-sensitive tasks:
| testCommand | `npm run typecheck && npm test && stet start HEAD~1 --quiet && stet run --strictness strict --verify --nitpicky --auto-finish-zero --quiet` |
```

To make this systematic, you could update the create-spine-tasks skill to auto-include stet in contract templates based on task metadata (size, security score from the PROMPT assessment).

**Pros:** Proportional quality enforcement -- lightweight for small tasks, rigorous for complex ones; integrates into the existing contract system; task authors can tune per-task.

**Cons:** Requires updating task templates and existing task PROMPTs; `HEAD~1` as baseline assumes the worker made a single commit (may need adjustment for multi-commit workers).

---

## Recommendation

Start with Approach 1 (baseline-at-setup + contract testCommand) for the highest-value integration with zero spine code changes. It uses the existing worktreeSetupHook and contract system, catches defects per-task before they reach the gate, and can be rolled out incrementally by updating task PROMPTs.

Layer Approach 2 (gate evidence) on top for wave-level visibility -- the operator gets a full-wave stet report alongside build/test evidence before approving the integrate gate.
