# TP-030: Publish prep + Taskplane migration CLI — Status

**Status:** Done | **Last Updated:** 2026-06-02 | **Review Level:** 2 | **Size:** M

### Step 0 — Done | Step 1 — Done | Step 2 — Done | Step 3 — Done | Step 4 — Done | Step 5 — Done

## Summary

- `spine migrate-from-taskplane` + `src/migrate/taskplane-config.mjs`
- `spine init --preset taskplane-compat`
- LICENSE, package.json publish metadata, `docs/release/v1.0-checklist.md`
- Tests: `tests/migrate/`, `tests/spine-init-preset.test.mjs`

## Baseline

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — **215** pass

## Commits

- feat(TP-030): migrate-from-taskplane, taskplane-compat preset, release checklist
