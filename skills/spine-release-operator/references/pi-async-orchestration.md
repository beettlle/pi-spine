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
- needs_integrate: inspect .spine/runtime/<batchId>/evidence/ → gate approve → integrate → npm install → batch complete.
- needs_retry / failed / aborted: follow recovery table; do not start next wave.
- running: optional LoopCreate watchdog (below) or spine watch.
Paste diagnosis headline and exit evidence. Do not claim success without CLI output.
```

### onDone prompt template (release:check)

```text
release:check monitor completed. Read tail of /tmp/pi-spine-release-check.log.
If exit 0: present pre-publish checklist from docs/release/npm-publish.md.
If non-zero: STOP; summarize first failing step; do not bump version.
```

---

## When to use LoopCreate (watchdog only)

Use when MonitorCreate's completion wake is insufficient or you need lightweight status polling without blocking the session.

```text
LoopCreate:
  trigger: "2m"
  readOnly: true
  maxFires: 50
  prompt: |
    Check spine status --diagnose for batch <batchId>.
    If diagnosis is terminal (needs_integrate, failed, aborted, needs_retry): LoopDelete this loop and run onDone actions.
    If still running: do nothing.
```

Prefer Monitor's built-in completion wake over LoopCreate when MonitorCreate was used for the same command.

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
