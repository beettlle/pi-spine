# Pi async orchestration (MonitorCreate / LoopCreate)

Use in **pi sessions** when long-running shell work would waste the agent context window. The operator session stays free for intake, manifest edits, issue filing, and recovery planning while batches and verification run in the background.

**Fallback:** When pi bridge tools are unavailable (Cursor-only, no MonitorCreate), use detached `spine batch start` + `spine wait` / `spine status --diagnose` — see [agent-shell-batch-policy.md](../../spine-autonomous-operator/references/agent-shell-batch-policy.md) and each skill's non-pi sections.

---

## When to use MonitorCreate (preferred)

`MonitorCreate` runs a shell command in the background and fires an `onDone` prompt when it exits. No polling loop required.

| Command | timeout | Notes |
|---------|---------|-------|
| `spine batch start <scope> --wave N` | `0` (none) | Detached wave batch; monitor via onDone + `spine wait` ([#163](https://github.com/beettlle/pi-spine/issues/163)) |
| `npm run release:check 2>&1 \| tee /tmp/pi-spine-release-check.log` | `900000` (15m) | Default 5m is too short for full pi-spine suite |
| `gh run watch --exit-status <run-id>` | `1800000` (30m) | After tag push; resolve run-id from `gh run list` |

### onDone prompt template (batch)

```text
Monitor for wave N completed. Run spine status --diagnose.
- needs_integrate: read .spine/runtime/<batchId>/evidence/summary.md (~2 KB) and
  rg -n '^ℹ (tests|pass|fail)|^not ok' .spine/runtime/<batchId>/evidence/test-output.txt
  → gate approve → integrate → npm install → batch complete.
  Never read test-output.txt or coverage-output.txt in full (hundreds of KB).
- needs_retry / failed / aborted: follow recovery table; do not start next wave.
- running: one blocking `spine wait --until … --interval 60`; LoopCreate watchdog only if no Monitor covers the batch.
Paste diagnosis headline and exit evidence. Do not claim success without CLI output.
```

### onDone prompt template (release:check)

```text
release:check monitor completed. Verify exit code from monitor metadata (not log tail alone).
If exit 0: present pre-publish checklist from docs/release/npm-publish.md.
If non-zero: rg -n '^not ok|^ℹ fail|Error' /tmp/pi-spine-release-check.log — read only those
hits plus surrounding lines (rg -C 5) for the first failure; do not load the whole log.
STOP; summarize first failing step; do not bump version.
```

---

## When to use LoopCreate (watchdog only)

Use **only** when no MonitorCreate covers the command (for example, a batch started from another shell). Every fire is a full agent turn, so a fast loop over a multi-hour wave spends tokens on "still running".

```text
LoopCreate:
  trigger: "15m"
  readOnly: true
  maxFires: 8
  prompt: |
    Check spine status --diagnose for batch <batchId>.
    If diagnosis is terminal (needs_integrate, failed, aborted, needs_retry): LoopDelete this loop and run onDone actions.
    If still running: reply "running" only — do not read logs or evidence.
```

`maxFires: 8` × 15m covers a 2-hour wave; recreate the loop if the wave runs longer. When MonitorCreate already wraps the command, its completion wake replaces the loop — do not run both.

---

## When NOT to async

| Action | Rule | Why |
|--------|------|-----|
| `spine batch resume --attached` | **Foreground shell only** | [#163](https://github.com/beettlle/pi-spine/issues/163) engine_orphaned |
| `spine batch resume --attached --force` | **Foreground shell only** | Same; release recovery discipline |
| `spine gate approve` | Agent must read evidence first | FR-SHIP-13; no auto-approve |
| Land loop during active recovery | Stay on current wave | Avoid parallel engines |

If `engine_orphaned` recurs after MonitorCreate on `batch start`, fall back to blocking `spine wait` for that wave and comment on #163.

---

## Cleanup

Before starting the next wave or ending the release session:

```text
LoopList  → LoopDelete any release watchdog loops
MonitorList → note completed monitors; MonitorStop any stale runners
```

---

## Do not interfere with active batches

Before authoring skill-driven commands:

1. Run `spine status --diagnose` (readonly).
2. If a batch is **running** for the current release, do not start a second batch or edit `.spine/runtime/**`.
3. Skill/doc updates on `main` are safe; batch execution is owned by the active operator session.
