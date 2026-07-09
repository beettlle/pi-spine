# STATUS — SP-547 Dashboard retry-then-succeed display fix

**Task:** SP-547
**Status:** In progress

## Steps

### Step 0: Preflight

- [x] Read issue #161 root cause (failedCount > 0 overrides completed lane)

### Step 1: Fix row styling logic

- [x] For `lane.status === "completed"`, derive failure from terminal state only
- [x] Keep `failedCount` available as retry metric (optional display), not CSS override
- [x] Preserve SP-489 failed styling for true terminal failures

### Step 2: Regression test

- [ ] Pending

### Step 3: Testing & Verification

- [ ] Pending

### Step 4: Documentation & Delivery

- [ ] Pending
