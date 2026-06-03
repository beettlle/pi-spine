# TP-020: Review tool + fail-closed — Status

**Status:** Complete | **Last Updated:** 2026-06-01 | **Review Level:** 2 | **Size:** L

### Step 0 — Complete | Step 1 — Complete | Step 2 — Complete | Step 3 — Complete

## Summary

Implemented FR-REV review pipeline with fail-closed spawn failures (FR-REV-06, GAP-REV-01):

- `src/batch/review.mjs` — `runStepReview()`, verdict parsing, artifact paths, stub mode
- `bin/spine-review-step.mjs` — CLI (`spine review step`)
- Worker integration — review preflight in worker-host; runner enforces review on stub tests; pi worker prompt includes review instructions
- Journal events — `review.started`, `review.completed`, `review.failed`
- Tests — 12 new review tests (113 total)

## Verification

- [x] Review spawn failure at level > 0 stops worker; journal `review.failed`
- [x] Tests pass (113)
