# STATUS — SP-540 validate npm test hardfail

**Task:** SP-540
**Status:** In Progress

## Steps

### Step 0: Preflight

- [x] Read SP-522 warn path and PRD criteria

### Step 1: Promote warn to error

- [x] Error collector for required + S/M
- [x] Wire into validateContract errors
- [x] L size retains warning

### Step 2: Preflight inheritance

- [x] tasks-validate fails on error packets (via validatePrompt → validation.errors)

### Step 3: Testing & Verification

- [ ] Tests updated for ok: false on required/S/M
- [ ] Contract and full suite green

### Step 4: Documentation & Delivery

- [ ] `.DONE` created
