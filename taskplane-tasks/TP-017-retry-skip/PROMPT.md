# Task: TP-017 — Atomic retry + skip-task (Phase 3)

**Created:** 2026-06-01
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Closes GAP-RETRY-01; enables Option B (no Taskplane `/orch` for spine tasks until this ships).
**Score:** 5/8

## Mission

1. **`spine batch retry`** / **`/spine-retry-task`** — atomic task + segment reset; journal `pendingSegments` (§18.5).
2. **`spine batch skip`** / **`/spine-skip-task`** — skip task, update counters (FR-BATCH-10 single-lane).
3. Reuse lane worktree on retry when possible (§17.4).

**Out of scope:** multi-lane (TP-019), abort (TP-018).

## Dependencies

- **TP-016**
- **TP-015**

## File Scope

- `src/batch/retry.mjs`, `bin/spine-batch.mjs`, `src/batch/diagnosis.mjs`, `extensions/spine/slash-commands.ts`
- `tests/batch/retry.test.mjs`, `README.md`, `docs/compatibility/taskplane-gap-list.md`

## Steps

### Step 0: Preflight
- [ ] GAP-RETRY-01; TP-016 on `main`

### Step 1: Retry + skip
- [ ] `retryTask` / `skipTask`; CLI; slash; tests

### Step 2: Docs + verification
- [ ] README; close GAP-RETRY-01 if verified; `npm test`

## Completion Criteria

- [ ] Atomic retry; skip; tests pass

## Git Commit Convention

- `feat(TP-017): complete Step N — description`

## Do NOT

- TP-018/019; break Taskplane reader

---

## Amendments (Added During Execution)
