# TP-032: Settings editable-field registry — Status

**Status:** In Progress | **Last Updated:** 2026-06-02 | **Review Level:** 1 | **Size:** S

### Step 0 — Done | Step 1 — In Progress | Step 2 — Not Started

## Summary

FR-CFG-03 v1.1 editable-field registry: five dotted paths (`lanes.maxParallel`, `gates.requireBeforeIntegrate`, `agents.worker.model`, `agents.worker.thinking`, `dashboard.port`) with `parseSettingPath`, `validateSettingValue`, and CLI-safe coercion.

## Step 0 — FR-CFG-03 fields (v1.1)

| Path | Type | Notes |
|------|------|-------|
| `lanes.maxParallel` | number ≥ 1 | PRD §10.4 / scheduler cap |
| `gates.requireBeforeIntegrate` | boolean | integrate gate policy |
| `agents.worker.model` | string | default `inherit`; optional empty |
| `agents.worker.thinking` | enum | off, low, medium, high |
| `dashboard.port` | number | default 8109; non-privileged range |

## Baseline

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — 214/215 pass (1 flaky `cli-startup` dashboard banner test)

## Commits

_(pending step commits)_
