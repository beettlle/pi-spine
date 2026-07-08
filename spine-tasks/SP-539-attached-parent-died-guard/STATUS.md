# STATUS — SP-539 attached parent-died guard

**Task:** SP-539
**Status:** Not Started

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Parent session monitor module

- [ ] Create `parent-session-monitor.mjs`
- [ ] Periodic parent PID / liveness check
- [ ] Export start/stop hooks

### Step 2: Engine integration and journal

- [ ] Wire monitor into attached engine
- [ ] Journal `engine.parent_died` on detection
- [ ] Reconcile running → failed; pause batch

### Step 3: CLI fail-fast guard

- [ ] `--attached` exits non-zero in risky shells
- [ ] Remediation text in error output

### Step 4: Testing & Verification

- [ ] `attached-parent-died.test.mjs` passes
- [ ] Contract testCommand green
- [ ] Full test suite green

### Step 5: Documentation & Delivery

- [ ] operator-runbook updated
- [ ] `.DONE` created
