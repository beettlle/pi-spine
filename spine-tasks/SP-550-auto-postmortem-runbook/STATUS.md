# STATUS — SP-550 Proof post-mortem runbook section

**Task:** SP-550
**Status:** Complete

## Steps

### Step 0: Preflight

- [x] Confirm manifest tasks SP-546–549 `.DONE`

### Step 1: Write proof runbook

- [x] Post-mortem template: batch id, waves, manual recovery count (target 0), issue delta
- [x] Commands: `spine journal export`, `gh issue list` before/after
- [x] Link manifest and signoff checklist

### Step 2: Cross-link signoff checklist

- [x] Add post-mortem checkbox referencing runbook section

### Step 3: Testing & Verification

- [x] `spine tasks validate SP-550` — 1 passed, 0 failed

### Step 4: Documentation & Delivery

- [x] Create `.DONE`

## Completion Criteria

- [x] Operator can fill post-mortem from runbook without reading PRD
