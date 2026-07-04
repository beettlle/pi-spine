# pi-spine upstream issue template

Use when filing engine/orchestrator bugs at https://github.com/beettlle/pi-spine/issues during **Phase 4** recovery.

## Environment

- pi-spine: `spine --version`
- pi: `pi --version`
- Node: `node --version`
- Repo: `pi-spine` @ `git rev-parse --short HEAD`

## Commands run

```text
(paste exact spine commands)
```

## Diagnosis

```text
(paste output of: spine status --diagnose)
```

## Journal excerpt

```bash
spine journal replay --batch <batchId>
```

```text
(paste last 20–40 lines relevant to failure)
```

## Expected vs actual

- **Expected:** ...
- **Actual:** ...

## Minimal reproduction

Steps another operator can follow on the pi-spine repo or a consumer repo.

## Related issues

Search first before filing. Common clusters:

- Contract verifier false positives (#105, #118)
- Integrate / post-merge sync (#130, #114)
- Dirty worktree / graphify-out (#113)
- Batch complete stale state (#94)
- Doctor / provider auth (#97)
