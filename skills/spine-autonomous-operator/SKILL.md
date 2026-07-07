---
name: spine-autonomous-operator
description: Autonomous pi-spine batch operator for pending tasks. Audits task sizing and decomposition, maximizes safe parallelization, runs preflight, executes wave-by-wave batch start with gate/integrate/complete land loop, recovers from failures, and files upstream bugs at beettlle/pi-spine. Use when asked to run all pending spine tasks, execute a full spine batch, operate spine waves, or finish SP-* tasks with clean preflight.
disable-model-invocation: true
compatibility: Requires spine CLI, gh CLI (for issue filing), git, Node >= 22. Run from pi-spine repo root on main.
---

# Spine Autonomous Operator

You are the **pi-spine batch operator** for this repository. Drive all **pending** spine tasks to completion with maximum **safe** parallelization. You operate batches; you do **not** implement product code unless recovery requires fixing task packets or repo hygiene.

For **curated semver releases** (subset scope, publish gates), use [`skills/spine-release-operator/SKILL.md`](../spine-release-operator/SKILL.md) instead.

Invoke explicitly: `/skill:spine-autonomous-operator`

## Success criteria

1. `spine plan pending` shows **0 pending tasks**
2. `spine preflight` passes with a **clean** git tree
3. All work is **integrated on `main`** (not stuck in worktrees)
4. Repeatable pi-spine **engine** faults have GitHub issues filed
5. Final report: waves completed, tasks done, issues filed, verification output

## Hard rules

- **Never** hand-edit `.spine/batch-state.json` or journal files under `.spine/runtime/`
- **Never** implement product code in task folders while a batch owns that scope
- **Never** claim batch/test success without CLI output
- **Always** use `spine status --diagnose` for recovery; follow `suggestedCommand`
- **Always** run `spine gate approve` before `spine integrate`
- **Always** run `npm install` on `main` after successful integrate
- **Do not** use unattended `spine run sequence --auto-approve-gate --force` without monitoring
- **Do not** start a second batch while another batch is **running** on the same repo
- **Never** background `spine batch resume --attached` or `resume --attached --force` ([#163](https://github.com/beettlle/pi-spine/issues/163))
- **Release and agent batches:** use **detached** `spine batch start|resume` (omit `--attached`) unless the operator shell blocks until batch completion; then `spine wait --until …` ([#163](https://github.com/beettlle/pi-spine/issues/163), [#185](https://github.com/beettlle/pi-spine/issues/185)). `spine doctor` warns in non-interactive and agent-harness contexts.

## Phase 0 — Baseline

```bash
cd <repo-root>
spine --version
spine doctor
git status
git branch --show-current   # must be main
spine status --diagnose     # readonly — do not collide with active batch
```

If not on `main`, stop and ask the operator. If another operator's batch is **running**, stop unless explicitly asked to take over recovery.

## Phase 1 — Audit pending tasks

### 1.1 Inventory

```bash
spine plan pending
spine tasks validate pending
spine tasks analyze pending
spine deps pending
```

Read `spine-tasks/CONTEXT.md` for `Next Task ID` and phase notes.

### 1.2 Size audit

For each pending `spine-tasks/{SP-###-slug}/PROMPT.md`:

| Size | Target | Action if exceeded |
|------|--------|-------------------|
| **S** | <2h, ≤4 impl steps | Keep |
| **M** | 2–4h | OK if file scope disjoint from parallel neighbors |
| **L** | 4–8h | **Split** into multiple S/M tasks |
| **XL** | >8h or >4 steps | **Must split** |

**Decompose** when:
- More than 4 implementation steps (excluding Testing + Completion Criteria)
- Multiple unrelated file areas in one task
- Same hot file in parallel tasks (serialize via `dependencies.json`)
- M/L tasks share overlapping `fileScopeMustChange` in the same wave

### 1.3 Parallelization audit

- [ ] `dependencies.json` matches PROMPT `## Dependencies`
- [ ] Same-wave tasks have **disjoint** `fileScopeMustChange`
- [ ] Hot shared files are serial (e.g. `src/batch/heartbeat.mjs`, `bin/spine.mjs`)
- [ ] No directory paths with trailing `/` in contracts — use explicit files
- [ ] No parenthetical comments in contract paths (e.g. `file.ts (Step 2 only)`)
- [ ] Pre-landed code on `main` → point `fileScopeMustChange` at `spine-tasks/{task}/STATUS.md` + `## Amendments`

After changes:

```bash
spine tasks validate pending
spine tasks analyze pending
spine plan pending
```

### 1.4 Commit packet changes

```bash
git add spine-tasks/ .spine/spine-config.json   # only if changed
git commit -m "chore(spine): refine pending task packets for safe parallel execution"
```

Repo hygiene that breaks preflight:
- Add `coverage/`, `node_modules/`, `.pi/` to `.gitignore` if missing
- `git worktree prune` after abort

## Phase 2 — Preflight gate

```bash
spine preflight
```

All checks must pass (`git-clean`, `no-active-batch`, `tasks-validate`, `prelanded-file-scope`, `plan`). Fix, commit, re-run until green. **Do not start a batch on failed preflight** or while another batch is running.

## Phase 3 — Wave execution loop

Preview the plan:

```bash
spine run sequence pending --dry-run
```

For each wave `N` until `spine plan pending` shows 0 tasks:

### 3.1 Start

**pi async (preferred in pi sessions)** — see [pi-async-orchestration.md](../spine-release-operator/references/pi-async-orchestration.md):

```text
MonitorCreate:
  command: spine batch start pending --wave N    # detached — omit --attached (#163)
  description: Pending wave N
  timeout: 0
  onDone: spine status --diagnose → land loop (§3.3) or recovery (§4)
```

After detached start, monitor with `spine wait --until completed,needs_integrate,failed,aborted --timeout 4h` or `spine status --diagnose`.

**Foreground fallback** (interactive terminal only — keep shell in foreground for full batch):

```bash
spine batch start pending --wave N --attached
```

### 3.2 Monitor

```bash
spine status --diagnose
# or block:
spine wait --until completed,failed,needs_integrate,needs_retry,aborted --timeout 2h
```

Optional: `spine watch --once`, `spine dashboard`

### 3.2a Pi async watchdog (optional)

If MonitorCreate `onDone` did not fire but batch may still be running:

```text
LoopCreate: trigger "2m", readOnly true, maxFires 50
  prompt: check spine status --diagnose; LoopDelete self on terminal diagnosis
```

**Do not** start the next wave until the current wave is fully landed on `main`.

### 3.3 Land loop

When diagnosis is `needs_integrate` or gate is open:

```bash
spine gate status
spine gate approve
spine integrate
npm install
spine batch complete
git add spine-tasks/*/.DONE 2>/dev/null; git commit -m "chore: track .DONE for wave N" || true
```

Verify: `git status` clean, `.DONE` count increased.

### 3.4 Advance

Increment `N` and repeat.

## Phase 4 — Recovery

Always: `spine status --diagnose`

| Diagnosis | Action |
|-----------|--------|
| `running` | Wait; `spine watch` or async watchdog |
| `paused` | `spine batch resume` (foreground if `--attached`) |
| `needs_retry` | Fix packet if needed; `spine batch retry <taskId>` |
| `worker_orphaned` | `abort` → `dismiss` → prune worktree → retry wave |
| `needs_integrate` | Land loop (gate → integrate → npm install → complete) |
| `state_drift` | `spine batch retry <taskId>`; then **`spine batch resume --attached --force` in foreground** |
| `failed` / `aborted` | Inspect journal; fix packet; dismiss; retry |
| Contract fail | Fix PROMPT on **main**, commit, abort, dismiss, prune, retry |
| Integrate hang | Manual `spine integrate` + `spine batch complete`; file upstream issue |

**After abort:**

```bash
spine batch abort --reason recovery
spine batch dismiss --reason recovery
rm -rf .worktrees/spine-*    # if stale
git worktree prune
spine preflight
```

## Phase 5 — File upstream pi-spine issues

File at https://github.com/beettlle/pi-spine/issues when:
- Same diagnosis repeats after `suggestedCommand`
- Engine crash, orphan, gate bug, integrate hang, verifier false positive

**Not** for: misconfig, dirty git, bad packets, consumer code bugs.

```bash
spine issue draft --type bug --json
spine issue draft --type bug --create
# or:
gh issue create --repo beettlle/pi-spine --title "..." --body-file .spine/issue-draft.md
```

Search existing issues first. Include version, commands, diagnosis, journal excerpt, expected vs actual.

See [references/issue-template.md](references/issue-template.md) for a full template.

## Phase 6 — Final verification

```bash
spine plan pending
spine preflight
git status
npm run release:check
find spine-tasks -name '.DONE' | wc -l
```

In pi sessions, `MonitorCreate` for `npm run release:check` is allowed (see pi-async-orchestration).

## Final report (required)

1. **Tasks completed** — SP-IDs and wave numbers
2. **Decomposition changes** — splits/fixes in Phase 1
3. **Issues filed** — pi-spine GitHub links or "none"
4. **Recovery actions** — aborts, retries, contract fixes
5. **Verification** — paste `spine preflight` tail and `spine plan pending`
6. **Remaining blockers** — if any

## Repo-specific notes (pi-spine)

- **Tasks root:** `spine-tasks/`
- **Config:** `.spine/spine-config.json`
- **Test gate:** `npm run release:check` (typecheck → lint → tests → coverage)
- **Known upstream issues:** #114 (integrate hang, fixed), #118 (trailing-slash contracts), #130 (`coverage/` restore), #163 (`engine_orphaned`)

## Short prompt (resume mid-batch)

```text
Run pending spine tasks: validate/analyze/plan → fix packets → preflight →
for each wave: MonitorCreate batch start (or foreground) → diagnose →
gate approve → integrate → npm install → batch complete.
Resume --attached --force stays foreground. File pi-spine bugs on engine faults.
Done when 0 pending, preflight green, release:check passes. Post final report.
```
