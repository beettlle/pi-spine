# TP-033: spine settings show CLI — Status

**Status:** Done | **Last Updated:** 2026-06-02 | **Review Level:** 1 | **Size:** S

### Step 0 — Done | Step 1 — Done | Step 2 — Done

## Summary

Implemented read-only `spine settings show [path] [--json]` using TP-032 editable field registry and `loadSpineConfig`. Human mode lists all five FR-CFG-03 fields; single-path mode prints one value; JSON mode returns `{ fields }` or `{ path, value }`. Missing config exits 1 with `suggestedCommand: spine init`.

## Baseline

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (258 pass; 1 pre-existing unrelated failure in worker-tools)

## Step 0 — Preflight

- [x] TP-032 registry exports confirmed (`listEditableFields`, `parseSettingPath`, five paths)
- [x] Baseline tests run

## Step 1 — Show implementation

- [x] `formatSettingsShow(config, { path?, json? })` in `src/cli/settings-show.mjs`
- [x] CLI wiring + help: `spine settings show [path] [--json]`
- [x] Tests: temp `.spine/spine-config.json`; single-path; missing config error (human + JSON)
- [x] Plan review APPROVE (`.reviews/1-20260602T193710.md`)

## Step 2 — Verification

- [x] Settings tests green (9/9)
- [x] Manual `spine settings show` on repo
- [x] Full suite (258 pass; 1 pre-existing unrelated failure)

## Commits

- `b526357` feat(TP-033): add spine settings show CLI
