# Task Status: SP-690 — Cap nested matrix concurrency to remaining slots

## Current State

**Overall Status:** ⬜ Not Started

**Operator amendment:** SP-688 pre-landed changes in the shared matrix paths. Contract delivery proof now targets this task's `.DONE`; production wiring, regression coverage, and runbook updates remain required.

**Retry amendment:** Wave 1 exposed SP-689's incompatible virtual-row planning (`task_not_found`). Retry must restore parent-task planning, retain the SP-690 throttle, and pass planner plus matrix E2E tests.

## Steps

### Step 0: Preflight
**Status:** ⬜ Not Started
- [ ] Confirm nested full-`maxParallel` overshoot and SP-688 landed

### Step 1: Throttle nested matrix concurrency
**Status:** ⬜ Not Started
- [ ] Apply remaining-slot limit on production matrix path

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Regression for overshoot / remaining slots
- [ ] Contract `testCommand` green

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Runbook interim invariant note
- [ ] `.DONE`
