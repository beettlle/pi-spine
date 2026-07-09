# STATUS — SP-547 Dashboard retry-then-succeed display fix

**Task:** SP-547
**Status:** Complete

## Steps

### Step 0: Preflight

- [x] Read issue #161 root cause (failedCount > 0 overrides completed lane)

### Step 1: Fix row styling logic

- [x] For `lane.status === "completed"`, derive failure from terminal state only
- [x] Keep `failedCount` available as retry metric (optional display), not CSS override
- [x] Preserve SP-489 failed styling for true terminal failures

### Step 2: Regression test

- [x] Add test: journal with 2× `task.failed` then `task.completed` on completed lane → succeeded styling

### Step 3: Testing & Verification

- [x] `node --test tests/dashboard/ui-contract.test.mjs` — 38/38 pass
- [x] `npm run typecheck` — pass

### Step 4: Documentation & Delivery

- [x] Close #161
- [x] Create `.DONE`
