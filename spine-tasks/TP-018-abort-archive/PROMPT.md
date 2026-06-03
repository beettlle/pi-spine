# Task: TP-018 — Archive-first abort (Phase 3)

**Created:** 2026-06-01
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Closes GAP-ABORT-01; required before multi-lane stress.
**Score:** 5/8

## Mission

Implement **`spine batch abort`** / **`/spine-abort`** (FR-BATCH-06, §18.6):

1. **Always archive** batch snapshot to `.spine/runtime/{batchId}/archive/batch-state.json` before clearing active state.
2. Journal `batch.aborted` with reason; preserve journal tail (NFR-REL-04).
3. **`--hard`** — kill lane worker subprocess; optional worktree cleanup per config.
4. Graceful default — in-flight worker may finish current step boundary.

**Out of scope:** multi-lane (TP-019), full gate UI.

## Dependencies

- **TP-017**

## File Scope

- `src/batch/abort.mjs` (new), `bin/spine-batch.mjs`, `extensions/spine/slash-commands.ts`
- `tests/batch/abort.test.mjs`, `README.md`

## Steps

### Step 0: Preflight
- [ ] §18.6; GAP-ABORT-01

### Step 1: Abort implementation
- [ ] `abortBatch({ hard })`; archive-first; journal

### Step 2: CLI + tests
- [ ] `spine batch abort [--hard]`; `/spine-abort`; tests

### Step 3: Docs
- [ ] README; gap list; CONTEXT

## Completion Criteria

- [ ] Abort never deletes state without archive; tests pass

## Git Commit Convention

- `feat(TP-018): complete Step N — description`

## Do NOT

- TP-019 multi-lane yet

---

## Amendments (Added During Execution)
