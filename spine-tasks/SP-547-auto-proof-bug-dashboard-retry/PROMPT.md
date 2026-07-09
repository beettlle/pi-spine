# Task: SP-547 — Dashboard retry-then-succeed display fix

**Created:** 2026-07-08
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Dashboard JS fix; regression from SP-489 cumulative failedCount.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix dashboard Lanes table so tasks that failed during retries but **terminally succeeded** show green Done styling, not red FAILED. Use terminal outcome (`lane.activityPhase`, task status) — not cumulative `failedCount` from `lane-throughput.mjs`.

**Closes:** [#161](https://github.com/beettlle/pi-spine/issues/161)

## Dependencies

- SP-543

## Context to Read First

- `src/dashboard/public/dashboard.js`
- `src/dashboard/snapshot.mjs` — `taskFailedWithoutRestart` terminal logic
- `spine-tasks/SP-489-dashboard-failed-task-highlights/PROMPT.md`

## File Scope

- `src/dashboard/public/dashboard.js`
- `tests/dashboard/ui-contract.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/dashboard/ui-contract.test.mjs` |
| fileScopeMustChange | `src/dashboard/public/dashboard.js` |

## Steps

### Step 0: Preflight

- [ ] Read issue #161 root cause (failedCount > 0 overrides completed lane)

### Step 1: Fix row styling logic

- [ ] For `lane.status === "completed"`, derive failure from terminal state only
- [ ] Keep `failedCount` available as retry metric (optional display), not CSS override
- [ ] Preserve SP-489 failed styling for true terminal failures

**Artifacts:**
- `src/dashboard/public/dashboard.js` (modified)

### Step 2: Regression test

- [ ] Add test: journal with 2× `task.failed` then `task.completed` on completed lane → succeeded styling

**Artifacts:**
- `tests/dashboard/ui-contract.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] `node --test tests/dashboard/ui-contract.test.mjs`
- [ ] `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Close #161
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Retry-then-succeed tasks render green Done, not FAILED

## Git Commit Convention

- `fix(SP-547): dashboard terminal success overrides retry failedCount`

## Do NOT

- Change batch engine journal semantics
