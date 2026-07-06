# pi-spine upstream issue template

Use when filing engine/orchestrator bugs at https://github.com/beettlle/pi-spine/issues

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

Steps another operator can follow on pi-spine or a consumer repo.

## Related issues

Search first: #114 integrate hang, #118 contract trailing-slash, #130 coverage restore, #163 engine_orphaned
