# TP-031: spine deps CLI + /spine-deps — Status

**Status:** Done | **Last Updated:** 2026-06-02 | **Review Level:** 1 | **Size:** S

### Step 0 — Done | Step 1 — Done | Step 2 — Done | Step 3 — Done

## Summary

Implemented `spine deps <all|paths> [--json]` and `/spine-deps` for dependency graph inspection without a full batch plan. Core logic in `src/cli/deps.mjs` reuses planner scope parsing, `buildGraph`, `topoWaves`, and `findCyclePath`. CLI exits 1 on cycles; slash handler delegates to `bin/spine-deps.mjs` with output truncation for large graphs.

## Baseline

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (237 pass; 1 pre-existing dashboard startup flake unrelated to TP-031)

## Verification

- [x] `spine deps all` prints TP task IDs and edges on repo fixtures
- [x] `spine deps all --json` emits `{ nodes, edges, cycles, waves }`
- [x] `/spine-deps` wired (no Phase 0 stub)
- [x] `tests/spine-deps.test.mjs` — 8 tests pass
- [x] Plan reviews: steps 1–3 APPROVE

## Commits

- Core + tests + CLI + slash (batch merge); follow-up: wire `spine-deps` handler registration
