# Task: SP-824 — Gate streak reset failure fails closed and is journaled

**Created:** 2026-10-10
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Auto-approval is a trust decision. The change must make a failed reset block auto-approval without ever reversing a persisted approve or reject.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0
**Problem theory:** `recordApprovalStreak` and `recordRejectStreakReset` (`src/batch/gate-posture-approve.mjs` ~83-118) wrap streak I/O in `try { … } catch { }` and record nothing. If the **reset** after a reject fails, the old consecutive-approval count survives. `maybeAutoApproveIntegrateGate` (~214) reads `getCategoryStreak` (~239), and `evaluateGatePosture` returns `allow-auto` once the count reaches `autoApproveAfterN`, so the next gate in that category can auto-approve despite the rejection. A failed increment only delays auto-approval, which is the safe direction. Streak state lives at `gatePostureStreakPath(projectRoot)` (`src/batch/gate-posture-streak.mjs` 41); `loadGatePostureStreaks` (~128) treats a missing file as zero counts (confirm in Step 0). `rejectIntegrateGate` (~302) and `approveIntegrateGate` (~128) both have `batchId` and already journal `gate.rejected` / `gate.approved` with `appendJournalEvent`. `readJournalEvents(projectRoot, batchId)` is in `src/batch/journal.mjs` 253.

## Mission

Partial #314 — A failed streak reset can no longer lead to auto-approval, and both streak I/O failure paths are journaled. (Lock-protecting the streak read-modify-write stays open on #314.)

1. **Journal both catches** (`src/batch/gate-posture-approve.mjs`): pass `batchId` into `recordApprovalStreak` / `recordRejectStreakReset`. Each catch appends `gate.streak_io_failed` with `{ op: "increment" | "reset", category, kind, error: <message> }`.
2. **Fail closed on reset**: in the reset catch, try `fs.rmSync(gatePostureStreakPath(projectRoot), { force: true })`. Record `recovered: true` when it succeeds and `recovered: false` (plus the second error) when it does not.
3. **Block auto-approve when unrecovered**: `maybeAutoApproveIntegrateGate` returns the existing "not approved" shape with `reason: "streak_unreliable"` (decision `require-manual`) when the batch journal has a `gate.streak_io_failed` event with `op: "reset"` and `recovered: false`. Do this before reading the streak.
4. **Test seam**: an optional `ctx.streakIo` object (defaults to the real `incrementCategoryStreak`, `incrementKindStreak`, `resetCategoryStreak`, `resetKindStreak`, and a `removeStreakFile` wrapping `fs.rmSync`) lets tests inject failures. No `SPINE_TEST_*` env hooks.
5. **Tests** — new `tests/batch/gate-posture-streak-failure.test.mjs` (temp project with `gates.postures` opted in and `autoApproveAfterN: 2`, following `tests/batch/gate-posture-wire-approve.test.mjs`):
   - two approvals, then reject with a throwing reset and a working `removeStreakFile` → journal has `gate.streak_io_failed` `op: "reset"`, `recovered: true`; the next `maybeAutoApproveIntegrateGate` does **not** auto-approve (streak is zero).
   - same with `removeStreakFile` also throwing → `recovered: false`; next `maybeAutoApproveIntegrateGate` returns `reason: "streak_unreliable"`.
   - throwing increment on approve → the approval is still persisted and `gate.streak_io_failed` `op: "increment"` is journaled.
   - happy path unchanged: reject with working I/O still resets and journals no failure.

## Dependencies

- **None**

## Context to Read First

- GitHub #314
- `src/batch/gate-posture-approve.mjs` (whole file, 359 lines)
- `src/batch/gate-posture-streak.mjs` 30-160
- `tests/batch/gate-posture-wire-approve.test.mjs` 380-470 ("reject resets category streak")

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/gate-posture-approve.mjs`
- `tests/batch/gate-posture-streak-failure.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/gate-posture-streak-failure.test.mjs tests/batch/gate-posture-wire-approve.test.mjs tests/batch/gate-posture-streak.test.mjs tests/batch/gate-posture-evaluate.test.mjs tests/batch/gate-posture-stamp.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/import-cycles.test.mjs` |
| fileScopeMustChange | `src/batch/gate-posture-approve.mjs`, `tests/batch/gate-posture-streak-failure.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `approveIntegrateGate`, `rejectIntegrateGate`, and `maybeAutoApproveIntegrateGate` — record callers in Discoveries
- [ ] Confirm `loadGatePostureStreaks` returns zero counts for a missing file
- [ ] Dependencies satisfied

### Step 1: Journal and fail closed

- [ ] `gate.streak_io_failed` on both catches
- [ ] `rmSync` fallback with `recovered` flag
- [ ] `streakIo` seam

**Artifacts:**
- `src/batch/gate-posture-approve.mjs` (modified)

### Step 2: Block auto-approve

- [ ] `streak_unreliable` early return

**Artifacts:**
- `src/batch/gate-posture-approve.mjs` (modified)

### Step 3: Tests

- [ ] Four cases above

**Artifacts:**
- `tests/batch/gate-posture-streak-failure.test.mjs` (new)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] When the reset write fails, the next `maybeAutoApproveIntegrateGate` does not auto-approve
- [ ] Both failure paths are journaled
- [ ] A streak I/O failure never reverses a persisted approve or reject

## Git Commit Convention

- `fix(SP-824): gate streak reset failure fails closed and is journaled (#314)`

## Do NOT

- Change auto-approve thresholds or `evaluateGatePosture`
- Add locking around streak writes (left open on #314)
- Add `SPINE_TEST_*` environment hooks
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
